import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { OpenRouterError } from '@/lib/openrouter';
import { isImageMode, isVideoMode, type PromptKind } from '@/lib/prompt-builder/config';
import { generateImagePrompt, parseBrief } from '@/lib/prompt-builder/image';
import { generateVideoPrompt, parseVideoBrief } from '@/lib/prompt-builder/video';
import { toEntryDTO } from '@/lib/prompt-builder/library';
import { getSessionUser } from '@/lib/prompt-builder/session';
import { claimUsage, getUsageSnapshot, releaseUsage } from '@/lib/prompt-builder/usage';

export const dynamic = 'force-dynamic';
// Two model attempts at worst; the default serverless limit is too tight for that.
export const maxDuration = 60;

type Built = {
  kind: PromptKind;
  mode: string;
  brief: object;
  run: () => Promise<{ title: string; json: object; promptText: string }>;
};

/** Validates the request body and prepares the matching generator, or explains what is wrong. */
function build(body: Record<string, unknown>): Built | { error: string } {
  // Older clients send no kind: that means image.
  const kind = body.kind === undefined ? 'image' : body.kind;

  if (kind === 'video') {
    if (!isVideoMode(body.mode)) return { error: 'Pick a mode first.' };
    const mode = body.mode;
    const parsed = parseVideoBrief(body.brief, mode);
    if (!parsed.ok) return { error: parsed.error };
    return { kind, mode, brief: parsed.brief, run: () => generateVideoPrompt(mode, parsed.brief) };
  }

  if (kind === 'image') {
    if (!isImageMode(body.mode)) return { error: 'Pick a mode first.' };
    const parsed = parseBrief(body.brief);
    if (!parsed.ok) return { error: parsed.error };
    const mode = body.mode;
    return { kind, mode, brief: parsed.brief, run: () => generateImagePrompt(mode, parsed.brief) };
  }

  return { error: 'Invalid request.' };
}

/**
 * Turns a short brief into a ready-to-paste image or video prompt and saves it
 * to the Prompt Library. Free to use (no credits) but capped per day by plan;
 * image and video prompts share the same daily allowance.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const job = build(body as Record<string, unknown>);
    if ('error' in job) return NextResponse.json({ error: job.error }, { status: 400 });

    const claim = await claimUsage(user.id, user.plan, 'prompt');
    if (!claim.ok) {
      const usage = await getUsageSnapshot(user.id, user.plan);
      return NextResponse.json(
        {
          error: `You've used all ${usage.prompts.limit} prompts for today. The limit resets at midnight WIB.`,
          limitReached: true,
          usage,
        },
        { status: 429 }
      );
    }

    try {
      const result = await job.run();

      const row = await prisma.promptEntry.create({
        data: {
          userId: user.id,
          kind: job.kind,
          mode: job.mode,
          title: result.title,
          brief: job.brief,
          promptJson: result.json,
          promptText: result.promptText,
        },
      });

      return NextResponse.json({
        success: true,
        entry: toEntryDTO(row),
        usage: await getUsageSnapshot(user.id, user.plan),
      });
    } catch (err) {
      // Nothing was delivered, so the attempt must not count against the day.
      await releaseUsage(user.id, claim, 'prompt');
      throw err;
    }
  } catch (error) {
    if (error instanceof OpenRouterError) {
      console.error('[prompt-builder/generate]', error.message);
      return NextResponse.json({ error: error.publicMessage }, { status: 502 });
    }
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
