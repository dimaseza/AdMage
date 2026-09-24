/**
 * OpenRouter video API client (server only), used by UGC Creator for Veo 3.1 Lite.
 *
 * Contract verified 2026-09-24 against GET /api/v1/videos/models and deliberately
 * rejected requests:
 *   - google/veo-3.1-lite: durations 4/6/8, 720p/1080p, aspect 16:9 or 9:16 only.
 *   - It REJECTS `input_references` ("does not support image input references").
 *     The only image input is `frame_images` with frame_type first_frame/last_frame,
 *     which is why UGC Creator composes a first frame before animating.
 *   - Jobs are async: POST returns an id, GET polls, /content streams the file.
 */

const BASE = 'https://openrouter.ai/api/v1/videos';

export const UGC_VIDEO_MODEL = process.env.OPENROUTER_UGC_VIDEO_MODEL || 'google/veo-3.1-lite';

export type VideoJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type StartVideoOptions = {
  model: string;
  prompt: string;
  duration: number;
  resolution: '720p' | '1080p';
  aspectRatio: '9:16' | '16:9';
  generateAudio: boolean;
  /** Public URL of the image the clip must open on. */
  firstFrameUrl?: string;
};

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  return key;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text);
    return j?.error?.message || text;
  } catch {
    return text;
  }
}

/** Queues a video and returns the OpenRouter job id. */
export async function startVideo(opts: StartVideoOptions): Promise<string> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      'X-Title': 'AdMage UGC Creator',
    },
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      duration: opts.duration,
      resolution: opts.resolution,
      aspect_ratio: opts.aspectRatio,
      generate_audio: opts.generateAudio,
      ...(opts.firstFrameUrl
        ? {
            frame_images: [
              { type: 'image_url', image_url: { url: opts.firstFrameUrl }, frame_type: 'first_frame' },
            ],
          }
        : {}),
    }),
  });

  if (!res.ok) {
    const detail = await readError(res);
    console.error(`[openrouter-video] start failed ${res.status}: ${detail.slice(0, 500)}`);
    throw new Error(`Video service error (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error('Video service returned no job id');
  return data.id;
}

export type VideoJob = {
  status: VideoJobStatus;
  error?: string;
  /** USD actually charged, once known. */
  cost?: number;
};

export async function getVideo(jobId: string): Promise<VideoJob> {
  const res = await fetch(`${BASE}/${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Video status error (${res.status}): ${(await readError(res)).slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    status?: VideoJobStatus;
    error?: string | { message?: string };
    usage?: { cost?: number };
  };
  const error = typeof data.error === 'string' ? data.error : data.error?.message;
  if (data.status === 'completed' && data.usage?.cost !== undefined) {
    console.info(`[openrouter-video] ${jobId} completed, cost=$${data.usage.cost}`);
  }
  return { status: data.status ?? 'pending', error, cost: data.usage?.cost };
}

/** Streams a finished video. Passes Range through so the browser can seek. */
export function fetchVideoContent(jobId: string, index = 0, range?: string | null): Promise<Response> {
  return fetch(`${BASE}/${encodeURIComponent(jobId)}/content?index=${index}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(range ? { Range: range } : {}),
    },
    cache: 'no-store',
  });
}
