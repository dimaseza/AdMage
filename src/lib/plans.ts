import { FEATURE_MODEL, imageCredits, VIDEO_TIERS, APP_CREDIT_IDR } from './higgsfield-models';

/**
 * Subscription plans.
 *
 * Credits are sold at a flat Rp 250 each on every tier. The PRD originally gave
 * volume discounts down to Rp 200/credit, but the cost per credit does not fall
 * with volume - a credit spent on video costs ~Rp 189 whoever spends it - so the
 * discount cut the worst-case margin from 24% to 6%. Holding the rate keeps
 * every tier at the same floor.
 */

/**
 * The "standard quality" settings used to advertise how much a plan gets you.
 * Marketing copy quotes these, so they must stay in step with real credit costs.
 */
export const STANDARD_IMAGE_QUALITY = 'medium';
export const STANDARD_IMAGE_RESOLUTION = '1k';
export const STANDARD_VIDEO_TIER = '1080p';
export const STANDARD_VIDEO_SECONDS = 5;

export type PlanId = 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

export type Plan = {
  id: PlanId;
  name: string;
  priceIDR: number;
  credits: number;
  /** Free accounts are image-only: video burns ~1.5x the credits-to-cost of images. */
  allowsVideo: boolean;
  tagline: string;
  popular?: boolean;
  /** Number of custom LoRA trainings included. */
  customLora?: number;
  priorityQueue?: boolean;
  /** Prompt Builder prompts per day. Free to use (no credits), so this is the only gate. */
  promptsPerDay: number;
  /** Prompt Builder product-photo analyses per day (double the prompt limit). */
  photoAnalysesPerDay: number;
};

/** Prompt Builder daily limits: 3 prompts on Free, 15 on every paid plan. */
const FREE_PROMPT_LIMITS = { promptsPerDay: 3, photoAnalysesPerDay: 6 };
const PAID_PROMPT_LIMITS = { promptsPerDay: 15, photoAnalysesPerDay: 30 };

export const PLANS: Plan[] = [
  {
    id: 'FREE',
    name: 'Free',
    priceIDR: 0,
    credits: 100,
    allowsVideo: false,
    tagline: 'Try the image tools, no card needed',
    ...FREE_PROMPT_LIMITS,
  },
  {
    id: 'STARTER',
    name: 'Starter',
    priceIDR: 50_000,
    credits: 200,
    allowsVideo: true,
    tagline: 'For solo sellers getting started',
    ...PAID_PROMPT_LIMITS,
  },
  {
    id: 'PRO',
    name: 'Pro',
    priceIDR: 100_000,
    credits: 400,
    allowsVideo: true,
    tagline: 'For active shops posting weekly',
    popular: true,
    ...PAID_PROMPT_LIMITS,
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    priceIDR: 200_000,
    credits: 800,
    allowsVideo: true,
    tagline: 'For brands running paid campaigns',
    customLora: 1,
    ...PAID_PROMPT_LIMITS,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    priceIDR: 500_000,
    credits: 2_000,
    allowsVideo: true,
    tagline: 'For agencies managing many clients',
    customLora: 3,
    priorityQueue: true,
    ...PAID_PROMPT_LIMITS,
  },
];

export function getPlan(id: string | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function planAllowsVideo(tier: string | undefined): boolean {
  return getPlan(tier).allowsVideo;
}

/** Credit cost of one generation at the advertised "standard quality". */
export const STANDARD_COST = {
  productShot: imageCredits(
    FEATURE_MODEL['product-shot'],
    STANDARD_IMAGE_QUALITY,
    STANDARD_IMAGE_RESOLUTION
  ),
  campaign: imageCredits(FEATURE_MODEL.campaign, STANDARD_IMAGE_QUALITY, STANDARD_IMAGE_RESOLUTION),
  refine: imageCredits(FEATURE_MODEL.refine, STANDARD_IMAGE_QUALITY, STANDARD_IMAGE_RESOLUTION),
  video: VIDEO_TIERS[STANDARD_VIDEO_TIER].creditsPerSecond * STANDARD_VIDEO_SECONDS,
} as const;

export type Allowance = {
  productShot: number;
  campaign: number;
  refine: number;
  video: number;
};

/**
 * How many of each feature a credit balance buys at standard quality.
 * Derived from the live credit costs, so it can never contradict what the
 * generator actually charges.
 */
export function allowanceFor(credits: number, allowsVideo: boolean): Allowance {
  return {
    productShot: Math.floor(credits / STANDARD_COST.productShot),
    campaign: Math.floor(credits / STANDARD_COST.campaign),
    refine: Math.floor(credits / STANDARD_COST.refine),
    video: allowsVideo ? Math.floor(credits / STANDARD_COST.video) : 0,
  };
}

export function planAllowance(plan: Plan): Allowance {
  return allowanceFor(plan.credits, plan.allowsVideo);
}

export function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export const CREDIT_PRICE_IDR = APP_CREDIT_IDR;


/* ------------------------------------------------------------------ *
 * Comparison table
 * ------------------------------------------------------------------ */

export type ComparisonRow = {
  label: string;
  /** Sub-label shown under the row name, e.g. the quality assumed. */
  hint?: string;
  /** One cell per plan, in PLANS order. */
  values: string[];
  /** Renders the row as a highlighted group header. */
  emphasis?: boolean;
};

const DASH = '—';

/** Rows for the pricing comparison table, derived from live credit costs. */
export function comparisonRows(): ComparisonRow[] {
  const a = PLANS.map(planAllowance);

  return [
    {
      label: 'Credits per month',
      values: PLANS.map((p) => p.credits.toLocaleString('id-ID')),
      emphasis: true,
    },
    {
      label: 'Product Shots',
      hint: `${STANDARD_COST.productShot} credits each`,
      values: a.map((x) => `${x.productShot} images`),
    },
    {
      label: 'Campaign images',
      hint: `${STANDARD_COST.campaign} credits each`,
      values: a.map((x) => `${x.campaign} images`),
    },
    {
      label: 'Refine images',
      hint: `${STANDARD_COST.refine} credits each`,
      values: a.map((x) => `${x.refine} images`),
    },
    {
      label: 'Video ads',
      hint: `${STANDARD_COST.video} credits per 5s clip`,
      values: PLANS.map((p, i) => (p.allowsVideo ? `${a[i].video} clips` : DASH)),
    },
    {
      label: 'Prompt Builder',
      hint: 'Free, no credits',
      values: PLANS.map((p) => `${p.promptsPerDay} / day`),
    },
    {
      label: 'Custom LoRA',
      values: PLANS.map((p) => (p.customLora ? `${p.customLora}x` : DASH)),
    },
    {
      label: 'Priority rendering',
      values: PLANS.map((p) => (p.priorityQueue ? 'Yes' : DASH)),
    },
  ];
}
