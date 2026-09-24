/**
 * UGC Creator's two-step pipeline (server only).
 *
 *   step 1  Higgsfield Marketing Studio composes the opening frame from the
 *           seller's product photo (skipped when there is no photo).
 *   step 2  Veo 3.1 Lite on OpenRouter animates that frame with speech.
 *
 * The generation row tracks each variation as one token in
 * `providerRequestId` (comma-separated), which the status poll advances:
 *   img:<higgsfieldId>          composing the frame
 *   lock:<higgsfieldId>:<ms>    one poll has claimed it and is starting the video
 *   vid:<openrouterJobId>       animating
 * Settings for step 2 live in `meta`, since they are needed after the request ends.
 */

import type { Generation } from '@prisma/client';
import prisma from '@/lib/prisma';
import { checkStatus, isTerminalFailure, startGeneration } from '@/lib/higgsfield';
import { MODELS } from '@/lib/higgsfield-models';
import { UGC_VIDEO_MODEL, getVideo, startVideo } from '@/lib/openrouter-video';
import { buildUgcFramePrompt, buildUgcPrompt, type UgcAspectRatio } from '@/lib/ugc-prompt';

export const UGC_PIPELINE = 'ugc-veo-v1';

/** A claim older than this is assumed dead (the poll that took it crashed) and is retried. */
const LOCK_TTL_MS = 2 * 60 * 1000;

export type UgcVideoSettings = {
  prompt: string;
  duration: number;
  resolution: '720p' | '1080p';
  aspectRatio: UgcAspectRatio;
  sound: boolean;
};

export type UgcMeta = { pipeline: typeof UGC_PIPELINE; model: string; video: UgcVideoSettings };

/* ------------------------------------------------------------------ *
 * Tokens (pure, unit-tested)
 * ------------------------------------------------------------------ */

export type Token =
  | { kind: 'img'; id: string }
  | { kind: 'lock'; id: string; at: number }
  | { kind: 'vid'; id: string };

export function parseTokens(value: string | null): Token[] {
  return (value ?? '')
    .split(',')
    .filter(Boolean)
    .map((raw): Token => {
      const [kind, id, at] = raw.split(':');
      if (kind === 'img') return { kind, id };
      if (kind === 'lock') return { kind, id, at: Number(at) || 0 };
      if (kind === 'vid') return { kind, id };
      throw new Error(`Unknown pipeline token: ${raw}`);
    });
}

export function serializeTokens(tokens: Token[]): string {
  return tokens
    .map((t) => (t.kind === 'lock' ? `lock:${t.id}:${t.at}` : `${t.kind}:${t.id}`))
    .join(',');
}

export function isUgcPipeline(meta: unknown): meta is UgcMeta {
  return !!meta && typeof meta === 'object' && (meta as UgcMeta).pipeline === UGC_PIPELINE;
}

/** Where the browser fetches finished clips (proxied: OpenRouter content needs the API key). */
export const ugcMediaUrls = (generationId: string, count: number) =>
  Array.from({ length: count }, (_, i) => `/api/generate/${generationId}/media?i=${i}`);

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

export type StartUgcInput = {
  userPrompt: string;
  imageUrl?: string;
  settings: Omit<UgcVideoSettings, 'prompt'>;
  variations: number;
};

export async function startUgcPipeline(
  input: StartUgcInput
): Promise<{ providerRequestId: string; meta: UgcMeta }> {
  const hasImage = Boolean(input.imageUrl);
  const video: UgcVideoSettings = {
    ...input.settings,
    prompt: buildUgcPrompt(input.userPrompt, hasImage, input.settings.sound),
  };
  const meta: UgcMeta = { pipeline: UGC_PIPELINE, model: UGC_VIDEO_MODEL, video };
  const runs = Array.from({ length: input.variations });

  if (hasImage) {
    const framePrompt = buildUgcFramePrompt(input.userPrompt);
    const ids = await Promise.all(
      runs.map(() =>
        startGeneration({
          model: MODELS.MARKETING_STUDIO.slug,
          prompt: framePrompt,
          image_urls: [input.imageUrl as string],
          aspect_ratio: video.aspectRatio,
          quality: 'medium',
          // Match the frame to the video's output size.
          resolution: video.resolution === '1080p' ? '2k' : '1k',
        })
      )
    );
    return { providerRequestId: serializeTokens(ids.map((id) => ({ kind: 'img', id }))), meta };
  }

  const ids = await Promise.all(runs.map(() => startVideoFor(meta)));
  return { providerRequestId: serializeTokens(ids.map((id) => ({ kind: 'vid', id }))), meta };
}

function startVideoFor(meta: UgcMeta, firstFrameUrl?: string): Promise<string> {
  return startVideo({
    model: meta.model,
    prompt: meta.video.prompt,
    duration: meta.video.duration,
    resolution: meta.video.resolution,
    aspectRatio: meta.video.aspectRatio,
    generateAudio: meta.video.sound,
    firstFrameUrl,
  });
}

/* ------------------------------------------------------------------ *
 * Advance (called by the status poll)
 * ------------------------------------------------------------------ */

export type UgcProgress =
  | { status: 'PENDING'; stage: 'frame' | 'video' }
  | { status: 'COMPLETED'; resultUrls: string[] }
  | { status: 'FAILED'; error: string };

/**
 * Moves every variation one step forward. Several polls can run at once, so each
 * transition is a compare-and-swap on the token string: only the poll whose write
 * lands starts the video, so a frame is never animated (and billed) twice.
 */
export async function advanceUgcPipeline(generation: Generation): Promise<UgcProgress> {
  if (!isUgcPipeline(generation.meta)) return { status: 'FAILED', error: 'Unknown pipeline.' };
  const meta = generation.meta;
  let current = generation.providerRequestId ?? '';
  let tokens = parseTokens(current);
  // Variations whose video has finished rendering.
  let finished = 0;

  const swap = async (next: Token[]): Promise<boolean> => {
    const serialized = serializeTokens(next);
    const res = await prisma.generation.updateMany({
      where: { id: generation.id, providerRequestId: current },
      data: { providerRequestId: serialized },
    });
    if (res.count === 1) {
      current = serialized;
      tokens = next;
      return true;
    }
    return false;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.kind === 'img' || (token.kind === 'lock' && Date.now() - token.at > LOCK_TTL_MS)) {
      const frame = await checkStatus(token.id);
      if (isTerminalFailure(frame.status)) {
        return {
          status: 'FAILED',
          error:
            frame.status === 'nsfw'
              ? 'Blocked by the content filter. Try a different image or prompt.'
              : 'Could not compose the opening shot. Please try again.',
        };
      }
      if (frame.status !== 'completed' || !frame.output_url) continue;

      // Claim it, start the video, then record the job id.
      const claimed = tokens.map((t, j): Token => (j === i ? { kind: 'lock', id: token.id, at: Date.now() } : t));
      if (!(await swap(claimed))) return { status: 'PENDING', stage: 'frame' };

      let jobId: string;
      try {
        jobId = await startVideoFor(meta, frame.output_url);
      } catch (err) {
        console.error('[ugc-pipeline] could not start video:', err);
        return { status: 'FAILED', error: 'The video service rejected the request. Please try again.' };
      }
      await swap(tokens.map((t, j): Token => (j === i ? { kind: 'vid', id: jobId } : t)));
      continue;
    }

    if (token.kind === 'vid') {
      const job = await getVideo(token.id);
      if (job.status === 'failed') {
        console.error(`[ugc-pipeline] video ${token.id} failed: ${job.error}`);
        return { status: 'FAILED', error: 'The video could not be generated. Please try again.' };
      }
      if (job.status === 'completed') finished++;
    }
  }

  if (finished === tokens.length) {
    return { status: 'COMPLETED', resultUrls: ugcMediaUrls(generation.id, tokens.length) };
  }
  return { status: 'PENDING', stage: tokens.some((t) => t.kind !== 'vid') ? 'frame' : 'video' };
}

