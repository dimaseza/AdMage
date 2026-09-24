/**
 * Prompt Builder - shared, client-safe config and types.
 *
 * Keep this file free of server-only imports (OpenRouter keys, system prompts):
 * the browser bundles it. The system prompts live in ./image.ts and ./video.ts.
 */

import { VIDEO_DURATIONS as APP_VIDEO_DURATIONS } from '@/lib/credit-costs';
import { UGC_ASPECT_RATIOS, UGC_DURATIONS } from '@/lib/ugc-prompt';

export type PromptKind = 'image' | 'video';

/* ------------------------------------------------------------------ *
 * Modes
 * ------------------------------------------------------------------ */

export const IMAGE_MODES = ['ugc', 'product-shot', 'campaign'] as const;
export type ImageMode = (typeof IMAGE_MODES)[number];

export const VIDEO_MODES = ['ugc', 'ad'] as const;
export type VideoMode = (typeof VIDEO_MODES)[number];

// The image prompt is pasted into the image tools, which only accept these ratios.
export const PROMPT_ASPECT_RATIOS = ['9:16', '3:4', '1:1', '4:3', '16:9'] as const;
export type PromptAspectRatio = (typeof PROMPT_ASPECT_RATIOS)[number];

// Video Ads (Kling) accepts these three; UGC Creator (Veo) only 9:16 and 16:9.
export const VIDEO_ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const;
export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number];

/** Video Ads lengths. Each mode lists its own below, matching the tool it is pasted into. */
export const VIDEO_DURATIONS: readonly number[] = APP_VIDEO_DURATIONS;

export const DIALOG_LANGUAGES = ['Indonesian', 'English'] as const;
export type DialogLanguage = (typeof DIALOG_LANGUAGES)[number];

export type ModeInfo<TAspect extends string = string> = {
  label: string;
  blurb: string;
  defaultAspect: TAspect;
  /** Where the finished prompt is meant to be pasted. Shown next to the result. */
  pasteInto: string;
  productPlaceholder: string;
  subjectPlaceholder: string;
  scenePlaceholder: string;
};

export type VideoModeInfo = ModeInfo<VideoAspectRatio> & {
  /** Lengths the target tool can render, in seconds. */
  durations: readonly number[];
  /** Ratios the target tool can render. */
  aspects: readonly VideoAspectRatio[];
  hookPlaceholder: string;
  ctaPlaceholder: string;
};

export const IMAGE_MODE_INFO: Record<ImageMode, ModeInfo<PromptAspectRatio>> = {
  ugc: {
    label: 'UGC Photo',
    blurb: 'Creator-shot, phone-camera look',
    defaultAspect: '9:16',
    pasteInto: 'Product Shots or Campaigns',
    productPlaceholder: 'e.g. Serum wajah Somethinc Niacinamide, botol kaca 30ml dengan pipet, label putih-biru',
    subjectPlaceholder: 'e.g. Wanita Indonesia usia 25, hijab kasual, wajah natural',
    scenePlaceholder: 'e.g. Meja rias di kamar tidur, cahaya jendela pagi',
  },
  'product-shot': {
    label: 'Product Shot',
    blurb: 'Clean studio hero photo',
    defaultAspect: '1:1',
    pasteInto: 'Product Shots',
    productPlaceholder: 'e.g. Botol parfum kaca 50ml, tutup emas, label hitam minimalis',
    subjectPlaceholder: 'Leave empty for product only, or e.g. tangan model memegang produk',
    scenePlaceholder: 'e.g. Podium marmer putih dengan bayangan lembut',
  },
  campaign: {
    label: 'Campaign',
    blurb: 'Cinematic ad key visual',
    defaultAspect: '3:4',
    pasteInto: 'Campaigns',
    productPlaceholder: 'e.g. Sepatu lari putih-oranye, sol tebal, logo di sisi samping',
    subjectPlaceholder: 'e.g. Pelari pria berotot, 30 tahun, pakaian olahraga',
    scenePlaceholder: 'e.g. Jalanan kota basah setelah hujan saat fajar',
  },
};

export const VIDEO_MODE_INFO: Record<VideoMode, VideoModeInfo> = {
  ugc: {
    label: 'UGC Video',
    blurb: 'Real-person review, one handheld take',
    defaultAspect: '9:16',
    pasteInto: 'UGC Creator',
    durations: UGC_DURATIONS,
    aspects: UGC_ASPECT_RATIOS,
    productPlaceholder: 'e.g. Parfum HMNS Melting Temptation 100ml, botol kaca cokelat, tutup perak yang diputar lalu ditarik',
    subjectPlaceholder: 'e.g. Wanita Indonesia usia 20an, rambut panjang, santai',
    scenePlaceholder: 'e.g. Meja rias di kamar tidur, cahaya jendela pagi',
    hookPlaceholder: 'e.g. Wanginya tahan seharian, cocok buat yang suka aroma manis',
    ctaPlaceholder: 'e.g. Cek keranjang kuning ya',
  },
  ad: {
    label: 'Video Ad',
    blurb: 'Cinematic product showcase',
    defaultAspect: '9:16',
    pasteInto: 'Video Ads',
    durations: APP_VIDEO_DURATIONS,
    aspects: VIDEO_ASPECT_RATIOS,
    productPlaceholder: 'e.g. Sepatu lari putih-oranye, sol tebal, logo di sisi samping',
    subjectPlaceholder: 'Leave empty for product only, or e.g. pelari pria di tepi pantai',
    scenePlaceholder: 'e.g. Studio gelap dengan lampu neon oranye',
    hookPlaceholder: 'e.g. Ringan, empuk, dibuat untuk lari jauh',
    ctaPlaceholder: 'e.g. Beli sekarang, stok terbatas',
  },
};

export const VIBES = [
  'Clean & minimal',
  'Luxury',
  'Cozy',
  'Fresh & natural',
  'Bold & street',
  'Playful',
  'Cinematic',
  'Warm & nostalgic',
] as const;

export const MAX_VIBES = 3;

/** Field length caps, enforced by the form and re-checked on the server. */
export const BRIEF_LIMITS = {
  product: 600,
  subject: 300,
  scene: 300,
  notes: 500,
  hook: 300,
  cta: 150,
} as const;

/* ------------------------------------------------------------------ *
 * Briefs (what the user fills in)
 * ------------------------------------------------------------------ */

export type ImageBrief = {
  product: string;
  subject: string;
  scene: string;
  vibes: string[];
  aspectRatio: PromptAspectRatio;
  notes: string;
};

export type VideoBrief = {
  product: string;
  subject: string;
  scene: string;
  vibes: string[];
  aspectRatio: VideoAspectRatio;
  /** Seconds. One of the mode's `durations`. */
  duration: number;
  /** false = silent clip: no speech and no audio direction. */
  sound: boolean;
  /** Language of the spoken lines. The rest of the prompt is always English. */
  dialogLanguage: DialogLanguage;
  /** The one message or benefit the video should land. */
  hook: string;
  /** Optional call to action. */
  cta: string;
  notes: string;
};

/** Longest side, in px, the browser resizes a product photo to before upload. */
export const PHOTO_MAX_SIDE = 768;

/* ------------------------------------------------------------------ *
 * Usage and saved entries
 * ------------------------------------------------------------------ */

export type UsageCounter = { used: number; limit: number };

export type UsageSnapshot = {
  planName: string;
  /** True on the Free plan, where hitting a limit should point at the upgrade page. */
  isFree: boolean;
  prompts: UsageCounter;
  photos: UsageCounter;
  /** ISO time the daily counters reset (midnight WIB). */
  resetsAt: string;
};

/** Text meant for the video editor (video tools render on-screen text poorly). */
export type EditorNotes = {
  headline: string;
  tagline: string;
  callToAction: string;
  subtitles: string;
};

type EntryBase = {
  id: string;
  title: string;
  promptText: string;
  favorite: boolean;
  createdAt: string;
};

export type ImageEntryDTO = EntryBase & { kind: 'image'; mode: ImageMode; brief: ImageBrief };

export type VideoEntryDTO = EntryBase & {
  kind: 'video';
  mode: VideoMode;
  brief: VideoBrief;
  editorNotes: EditorNotes | null;
};

export type PromptEntryDTO = ImageEntryDTO | VideoEntryDTO;

/** Mode metadata (label, where to paste) for any saved or fresh entry. */
export function modeInfoFor(entry: Pick<PromptEntryDTO, 'kind' | 'mode'>): ModeInfo {
  return entry.kind === 'video'
    ? VIDEO_MODE_INFO[entry.mode as VideoMode]
    : IMAGE_MODE_INFO[entry.mode as ImageMode];
}

/* ------------------------------------------------------------------ *
 * Guards
 * ------------------------------------------------------------------ */

export function isImageMode(value: unknown): value is ImageMode {
  return typeof value === 'string' && (IMAGE_MODES as readonly string[]).includes(value);
}

export function isVideoMode(value: unknown): value is VideoMode {
  return typeof value === 'string' && (VIDEO_MODES as readonly string[]).includes(value);
}

export function isAspectRatio(value: unknown): value is PromptAspectRatio {
  return typeof value === 'string' && (PROMPT_ASPECT_RATIOS as readonly string[]).includes(value);
}

export function isVideoAspectRatio(value: unknown): value is VideoAspectRatio {
  return typeof value === 'string' && (VIDEO_ASPECT_RATIOS as readonly string[]).includes(value);
}

export function isDialogLanguage(value: unknown): value is DialogLanguage {
  return typeof value === 'string' && (DIALOG_LANGUAGES as readonly string[]).includes(value);
}
