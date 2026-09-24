/**
 * Client-safe pricing.
 *
 * Everything here is already visible to the user (the generator shows the credit
 * cost before they generate), so it is safe to ship to the browser.
 *
 * What must NOT be imported by a client component is `higgsfield-models.ts`:
 * it carries the Higgsfield model slugs and the wholesale cost table, and
 * bundling those lets anyone read your supplier prices out of devtools and
 * derive your margin. Keep that module server-side only.
 *
 * These numbers are the published prices. `higgsfield-models.ts` derives the
 * same values from real cost and asserts they match, so they cannot drift.
 */

export type ImageModelKey = 'MARKETING_STUDIO' | 'GROK_IMAGE';

/** Credits per image, keyed by `${quality}:${resolution}`. */
export const IMAGE_CREDITS: Record<ImageModelKey, Readonly<Record<string, number>>> = {
  MARKETING_STUDIO: {
    'low:1k': 2,
    'low:2k': 3,
    'low:4k': 4,
    'medium:1k': 8,
    'medium:2k': 14,
    'medium:4k': 22,
    'high:1k': 26,
    'high:2k': 51,
    'high:4k': 84,
  },
  GROK_IMAGE: {
    'low:1k': 6,
    'low:2k': 9,
    'medium:1k': 9,
    'medium:2k': 12,
  },
};

/** Quality/resolution options each image model accepts. */
export const IMAGE_OPTIONS: Record<
  ImageModelKey,
  { qualities: readonly string[]; resolutions: readonly string[] }
> = {
  MARKETING_STUDIO: {
    qualities: ['low', 'medium', 'high'],
    resolutions: ['1k', '2k', '4k'],
  },
  GROK_IMAGE: {
    qualities: ['low', 'medium'],
    resolutions: ['1k', '2k'],
  },
};

export type ImageFeature = 'refine' | 'product-shot' | 'campaign';

export const FEATURE_IMAGE_MODEL: Record<ImageFeature, ImageModelKey> = {
  refine: 'GROK_IMAGE',
  'product-shot': 'MARKETING_STUDIO',
  campaign: 'MARKETING_STUDIO',
};

export const VIDEO_CREDITS_PER_SECOND: Record<string, number> = {
  '720p': 6,
  '1080p': 8,
  '4k': 22,
};

export const VIDEO_RESOLUTIONS = Object.keys(VIDEO_CREDITS_PER_SECOND);

export const VIDEO_TIER_LABELS: Record<string, string> = {
  '720p': 'Kling 3.0 Standard',
  '1080p': 'Kling 3.0 Pro',
  '4k': 'Kling 3.0 4K',
};

/**
 * UGC Creator credit rates. It now runs on Veo 3.1 Lite (see ugc-pipeline.ts);
 * these rates were set for Kling O3 and have not been repriced.
 */
export const UGC_CREDITS_PER_SECOND: Record<string, number> = {
  'std:off': 7,
  'std:on': 9,
  'pro:off': 9,
  'pro:on': 12,
};

export const UGC_MODEL_LABEL = 'Veo 3.1 Lite';

export const UGC_MODES = ['std', 'pro'] as const;

export const UGC_MODE_LABELS: Record<string, string> = {
  std: 'Standard 720p',
  pro: 'Pro 1080p',
};

export function resolveUgcMode(mode: string | undefined): string {
  return mode === 'pro' ? 'pro' : 'std';
}

/** Credits per second at the given mode/sound combination. */
export function ugcCreditsPerSecond(mode: string | undefined, sound: boolean): number {
  return UGC_CREDITS_PER_SECOND[`${resolveUgcMode(mode)}:${sound ? 'on' : 'off'}`];
}

export const VIDEO_DURATION_RANGE: readonly [number, number] = [3, 15];

/** Options the UI offers for video length. Kling accepts any integer 3-15s. */
export const VIDEO_DURATIONS = [3, 5, 8, 10, 15];

function pick(value: string | undefined, allowed: readonly string[], fallback: string): string {
  return value && allowed.includes(value) ? value : fallback;
}

/** Credits for one image at the given settings. Mirrors the server's calculation. */
export function imageCreditsFor(
  feature: ImageFeature,
  quality: string | undefined,
  resolution: string | undefined
): number {
  const key = FEATURE_IMAGE_MODEL[feature];
  const opts = IMAGE_OPTIONS[key];
  const table = IMAGE_CREDITS[key];
  const q = pick(quality, opts.qualities, 'medium');
  const r = pick(resolution, opts.resolutions, opts.resolutions[0]);
  // Fall back to the dearest entry so a bad combination never undercharges.
  return table[`${q}:${r}`] ?? Math.max(...Object.values(table));
}

export function videoCreditsPerSecond(resolution: string | undefined): number {
  return VIDEO_CREDITS_PER_SECOND[resolveVideoTier(resolution)];
}

export function resolveVideoTier(resolution: string | undefined): string {
  return resolution && resolution in VIDEO_CREDITS_PER_SECOND ? resolution : '1080p';
}

export function clampDuration(
  value: number | undefined,
  range: readonly [number, number] = VIDEO_DURATION_RANGE
): number {
  const [min, max] = range;
  const target = Math.round(Number(value));
  if (!Number.isFinite(target)) return min;
  return Math.min(Math.max(target, min), max);
}
