import { NextResponse } from 'next/server';
import type { Generation } from '@prisma/client';
import { checkStatus, isTerminalFailure } from '@/lib/higgsfield';
import { advanceUgcPipeline, isUgcPipeline } from '@/lib/ugc-pipeline';
import prisma from '@/lib/prisma';

/**
 * Marks a generation FAILED and refunds its reserved credits - but only on the
 * poll that actually flips the row, so concurrent polls cannot refund twice.
 */
async function failAndRefund(generation: Generation, reason: string) {
  const flipped = await prisma.generation.updateMany({
    where: { id: generation.id, status: { not: 'FAILED' } },
    data: { status: 'FAILED' }
  });
  if (flipped.count > 0) {
    await prisma.user.update({
      where: { id: generation.userId },
      data: { credits: { increment: generation.creditCost } },
    });
  }
  return NextResponse.json({ success: false, status: 'FAILED', error: reason });
}

async function complete(generation: Generation, resultUrls: string[]) {
  // No charge here - credits were already reserved when the request was submitted.
  await prisma.generation.update({
    where: { id: generation.id },
    data: { resultUrl: resultUrls[0], resultUrls, status: 'COMPLETED' },
  });
  return NextResponse.json({ success: true, status: 'COMPLETED', resultUrl: resultUrls[0], resultUrls });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const generation = await prisma.generation.findUnique({
      where: { id }
    });

    if (!generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    if (generation.status === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        status: 'COMPLETED',
        resultUrl: generation.resultUrl,
        resultUrls: generation.resultUrls
      });
    }

    if (generation.status === 'FAILED') {
      return NextResponse.json({ success: false, status: 'FAILED', error: 'Generation failed.' });
    }

    // UGC Creator: frame image -> video, advanced one step per poll.
    if (isUgcPipeline(generation.meta)) {
      const progress = await advanceUgcPipeline(generation);
      if (progress.status === 'FAILED') return failAndRefund(generation, progress.error);
      if (progress.status === 'COMPLETED') return complete(generation, progress.resultUrls);
      return NextResponse.json({ success: true, status: 'PENDING', stage: progress.stage });
    }

    if (!generation.providerRequestId) {
       return NextResponse.json({ error: 'Missing provider request ID' }, { status: 500 });
    }

    const requestIds = generation.providerRequestId.split(',');
    const statuses = await Promise.all(requestIds.map(id => checkStatus(id)));

    // `nsfw` and `canceled` are terminal too - treating them as pending polls forever.
    const failure = statuses.find(s => isTerminalFailure(s.status));
    if (failure) {
      const reason =
        failure.status === 'nsfw'
          ? 'Blocked by the content filter. Try a different image or prompt.'
          : failure.status === 'canceled'
            ? 'The generation was canceled.'
            : failure.error || 'The provider failed to generate this.';
      return failAndRefund(generation, reason);
    }

    const allCompleted = statuses.every(s => s.status === 'completed');
    if (allCompleted) {
      const resultUrls = statuses.flatMap(s => s.output_urls || [s.output_url]).filter(Boolean) as string[];
      return complete(generation, resultUrls);
    }

    return NextResponse.json({ success: true, status: 'PENDING' });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
