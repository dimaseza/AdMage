/**
 * Higgsfield model registry + credit pricing.
 *
 * SERVER ONLY. This module carries the Higgsfield model slugs and the wholesale
 * cost table. Importing it from a `'use client'` component bundles your supplier
 * prices into the browser, where anyone can read them and back out your margin.
 * Client components must import `./credit-costs` instead.
 *
 * Every constraint below was verified against the live API
 * (POST https://api.higgsfield.ai/<slug> with a deliberately invalid value,
 * reading back the enum from the 400 `detail`).
 *
 * This matters because the Higgsfield validator SILENTLY IGNORES fields it does
 * not know: sending `input_images` / `reference_image_urls` / `input_image` to
 * an image model returns 200 and generates from the prompt alone. The only
 * field that actually attaches an image is `image_urls` (array of URL strings)
 * for image models, and `image_url` (single URL string) for image-to-video.
 */

import {
  IMAGE_CREDITS,
  VIDEO_CREDITS_PER_SECOND,
  type ImageModelKey,
} from './credit-costs';

export type ModelCapabilities = {
  slug: string;
  /** Max images accepted on `image_urls`. 0 = text-only model. */
  maxImages: number;
  aspectRatios?: readonly string[];
  qualities?: readonly string[];
  resolutions?: readonly string[];
  /** Inclusive [min, max] integer seconds. Kling takes a range, not an enum. */
  durationRange?: readonly [number, number];
  /** image-to-video models take a single `image_url` instead of `image_urls`. */
  singleImageField?: 'image_url';
  /** Higgsfield credit cost keyed by `${quality}:${resolution}`. See PRICING below. */
  prices?: Readonly<Record<string, number>>;
};

/* ------------------------------------------------------------------ *
 * PRICING
 *
 * Higgsfield bills in its own credits at a flat $0.0625 per credit. The
 * per-config costs below came from `POST /estimate/<slug>` (an endpoint that
 * returns both `credits` and `usd`), not from an estimate or a price list.
 *
 * Image cost swings ~44x across settings - Marketing Studio ranges from
 * 0.207 credits (low/1k) to 9.240 (high/4k) - so a flat per-feature credit
 * charge sells the expensive configs far below cost. App credits are therefore
 * derived from the real cost rather than hand-set.
 * ------------------------------------------------------------------ */

/** Higgsfield's own billing rate. */
export const HIGGSFIELD_USD_PER_CREDIT = 0.0625;

/** App credit face value, per the PRD credit system. */
export const APP_CREDIT_IDR = 250;
export const USD_TO_IDR = 18_000;

/** Target gross margin on image generations. Change this to reprice all images. */
export const TARGET_IMAGE_MARGIN = 0.5;

/** What one Higgsfield credit costs you, in app-credit terms. */
export const APP_CREDITS_AT_COST =
  (HIGGSFIELD_USD_PER_CREDIT * USD_TO_IDR) / APP_CREDIT_IDR;

/**
 * App credits charged per Higgsfield credit consumed.
 *
 * Derived, not hand-set: at Rp 18,000/USD one HF credit costs Rp 1,125 = 4.5 app
 * credits, so a 50% margin means charging 4.5 / 0.50 = 9 app credits per HF credit.
 * Adjusting USD_TO_IDR or TARGET_IMAGE_MARGIN reprices every image automatically.
 */
export const CREDIT_MARKUP = APP_CREDITS_AT_COST / (1 - TARGET_IMAGE_MARGIN);

/** Verified 2026-09-18 via POST /estimate/marketing-studio/image. */
const MARKETING_STUDIO_PRICES = {
  'low:1k': 0.207,
  'low:2k': 0.284,
  'low:4k': 0.385,
  'medium:1k': 0.806,
  'medium:2k': 1.502,
  'medium:4k': 2.409,
  'high:1k': 2.829,
  'high:2k': 5.612,
  'high:4k': 9.24,
} as const;

/** Verified 2026-09-18 via POST /estimate/xai/grok-imagine-image-2.0. */
const GROK_IMAGE_PRICES = {
  'low:1k': 0.64,
  'low:2k': 0.96,
  'medium:1k': 0.96,
  'medium:2k': 1.28,
} as const;

export const MODELS = {
  /** Multi-reference commercial image model. Supports high/4k. */
  MARKETING_STUDIO: {
    slug: 'marketing-studio/image',
    maxImages: 8,
    aspectRatios: ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'],
    qualities: ['low', 'medium', 'high'],
    resolutions: ['1k', '2k', '4k'],
    prices: MARKETING_STUDIO_PRICES,
  },
  /** Image edit/retouch. Caps out at medium quality / 2k. */
  GROK_IMAGE: {
    slug: 'xai/grok-imagine-image-2.0',
    maxImages: 8,
    aspectRatios: ['auto', '1:1', '1:2', '2:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'],
    qualities: ['low', 'medium'],
    resolutions: ['1k', '2k'],
    prices: GROK_IMAGE_PRICES,
  },
} as const satisfies Record<string, ModelCapabilities>;

/** Which model backs each image feature. Shared by the API route and the UI. */
export const FEATURE_MODEL = {
  refine: MODELS.GROK_IMAGE,
  'product-shot': MODELS.MARKETING_STUDIO,
  campaign: MODELS.MARKETING_STUDIO,
} as const satisfies Record<string, ModelCapabilities>;

export type ImageFeature = keyof typeof FEATURE_MODEL;

/**
 * Credits to charge for one image, derived from what Higgsfield actually bills
 * for that exact quality/resolution combination.
 *
 * Falls back to the most expensive entry in the table rather than the cheapest,
 * so an unknown combination can never be sold below cost.
 */
export function imageCredits(
  model: ModelCapabilities,
  quality: string | undefined,
  resolution: string | undefined
): number {
  const q = clamp(quality, model.qualities, 'medium');
  const r = clamp(resolution, model.resolutions, model.resolutions?.[0] ?? '1k');
  const prices = model.prices;
  if (!prices) return 1;
  const hfCredits = prices[`${q}:${r}`] ?? Math.max(...Object.values(prices));
  return Math.ceil(hfCredits * CREDIT_MARKUP);
}

/* ------------------------------------------------------------------ *
 * VIDEO
 *
 * Kling 3.0 is the strongest option on this account for UGC, product showcase
 * and content-marketing clips.
 *
 * Kling tiers quality by ENDPOINT, not by a `resolution` field - the std/pro/4k
 * variants ignore `resolution` entirely and encode it in the path. So the UI's
 * resolution picker selects the variant.
 *
 * Duration is an integer 3-15 on every variant (verified), which is why the
 * 3-second option is valid - Wan only accepted 5/10/15.
 * ------------------------------------------------------------------ */

export const VIDEO_DURATION_RANGE = [3, 15] as const;

/** Only text-to-video validates aspect_ratio; image-to-video infers it from the source image. */
const VIDEO_T2V_ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const;

/**
 * `hfCreditsPerSecond` verified via POST /estimate/kling-video/v3.0/<tier>/image-to-video.
 * `creditsPerSecond` is the app's sell rate.
 */
export const VIDEO_TIERS = {
  '720p': {
    label: 'Kling 3.0 Standard',
    creditsPerSecond: 6,
    hfCreditsPerSecond: 1.008,
    image: 'kling-video/v3.0/std/image-to-video',
    text: 'kling-video/v3.0/std/text-to-video',
  },
  '1080p': {
    label: 'Kling 3.0 Pro',
    creditsPerSecond: 8,
    hfCreditsPerSecond: 1.344,
    image: 'kling-video/v3.0/pro/image-to-video',
    text: 'kling-video/v3.0/pro/text-to-video',
  },
  '4k': {
    label: 'Kling 3.0 4K',
    creditsPerSecond: 22,
    hfCreditsPerSecond: 3.36,
    image: 'kling-video/v3.0/4k/image-to-video',
    text: 'kling-video/v3.0/4k/text-to-video',
  },
} as const;

export type VideoTier = keyof typeof VIDEO_TIERS;

export const VIDEO_RESOLUTIONS = Object.keys(VIDEO_TIERS) as VideoTier[];

export function resolveVideoTier(resolution: string | undefined): VideoTier {
  return resolution && resolution in VIDEO_TIERS ? (resolution as VideoTier) : '1080p';
}

/** Build the capability record for a video request. */
export function videoModel(resolution: string | undefined, hasImage: boolean): ModelCapabilities {
  const tier = VIDEO_TIERS[resolveVideoTier(resolution)];
  return hasImage
    ? {
        slug: tier.image,
        maxImages: 1,
        singleImageField: 'image_url',
        durationRange: VIDEO_DURATION_RANGE,
      }
    : {
        slug: tier.text,
        maxImages: 0,
        aspectRatios: VIDEO_T2V_ASPECT_RATIOS,
        durationRange: VIDEO_DURATION_RANGE,
      };
}

export function videoCreditsPerSecond(resolution: string | undefined): number {
  return VIDEO_TIERS[resolveVideoTier(resolution)].creditsPerSecond;
}

/* ------------------------------------------------------------------ *
 * Clamping
 * ------------------------------------------------------------------ */

/**
 * Snap a user-supplied value onto what the model actually accepts.
 * Falls back to the first allowed value rather than letting the API 400.
 */
export function clamp<T extends string | number>(
  value: T | undefined,
  allowed: readonly T[] | undefined,
  fallback: T
): T {
  if (!allowed || allowed.length === 0) return value ?? fallback;
  if (value !== undefined && allowed.includes(value)) return value;
  return allowed.includes(fallback) ? fallback : allowed[0];
}

/** Clamp to the model's integer second range. */
export function clampDuration(
  value: number | undefined,
  range: readonly [number, number] = VIDEO_DURATION_RANGE
): number {
  const [min, max] = range;
  const target = Math.round(Number(value));
  if (!Number.isFinite(target)) return min;
  return Math.min(Math.max(target, min), max);
}


/* ------------------------------------------------------------------ *
 * Drift guard
 *
 * `credit-costs.ts` publishes the credit prices to the browser. They must equal
 * what this module derives from real cost, or the UI would quote one number and
 * the API would charge another.
 * ------------------------------------------------------------------ */

export function assertPublishedCreditsMatchCost(): void {
  const pairs: Array<[ImageModelKey, ModelCapabilities]> = [
    ['MARKETING_STUDIO', MODELS.MARKETING_STUDIO],
    ['GROK_IMAGE', MODELS.GROK_IMAGE],
  ];

  for (const [key, model] of pairs) {
    for (const [combo, hfCredits] of Object.entries(model.prices ?? {})) {
      const expected = Math.ceil(hfCredits * CREDIT_MARKUP);
      const published = IMAGE_CREDITS[key][combo];
      if (published !== expected) {
        throw new Error(
          `Credit table drift: ${key} ${combo} is published as ${published} but costs ${expected}. ` +
            `Update IMAGE_CREDITS in src/lib/credit-costs.ts.`
        );
      }
    }
  }

  for (const [tier, cfg] of Object.entries(VIDEO_TIERS)) {
    if (VIDEO_CREDITS_PER_SECOND[tier] !== cfg.creditsPerSecond) {
      throw new Error(
        `Credit table drift: video ${tier} is published as ` +
          `${VIDEO_CREDITS_PER_SECOND[tier]} but charges ${cfg.creditsPerSecond}.`
      );
    }
  }
}
