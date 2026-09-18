import { NextResponse } from 'next/server';
import { checkStatus, isTerminalFailure } from '@/lib/higgsfield';
import prisma from '@/lib/prisma';

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

    if (!generation.providerRequestId) {
       return NextResponse.json({ error: 'Missing provider request ID' }, { status: 500 });
    }

    const requestIds = generation.providerRequestId.split(',');
    const statuses = await Promise.all(requestIds.map(id => checkStatus(id)));

    // `nsfw` and `canceled` are terminal too - treating them as pending polls forever.
    const failure = statuses.find(s => isTerminalFailure(s.status));
    if (failure) {
      // Credits were reserved at submission. Refund them, but only on the poll that
      // actually flips the row to FAILED, so concurrent polls cannot refund twice.
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
      const reason =
        failure.status === 'nsfw'
          ? 'Blocked by the content filter. Try a different image or prompt.'
          : failure.status === 'canceled'
            ? 'The generation was canceled.'
            : failure.error || 'The provider failed to generate this.';
      return NextResponse.json({ success: false, status: 'FAILED', error: reason });
    }

    const allCompleted = statuses.every(s => s.status === 'completed');
    if (allCompleted) {
      const resultUrls = statuses.flatMap(s => s.output_urls || [s.output_url]).filter(Boolean) as string[];
      // No charge here - credits were already reserved when the request was submitted.
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          resultUrl: resultUrls[0],
          resultUrls: resultUrls,
          status: 'COMPLETED',
        },
      });

      return NextResponse.json({
        success: true,
        status: 'COMPLETED',
        resultUrl: resultUrls[0],
        resultUrls: resultUrls
      });
    }

    return NextResponse.json({ success: true, status: 'PENDING' });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
