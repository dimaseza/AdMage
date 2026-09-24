/**
 * UGC Creator's prompt engine and settings. Client-safe (no keys, model slugs
 * or prices), so the generator can show the same limits the server enforces.
 *
 * Pipeline (with a product photo):
 *   1. An image model composes the OPENING FRAME: the person already holding the
 *      product in the scene, using the photo as the product reference.
 *   2. Veo 3.1 Lite animates that frame with the script and native speech.
 * Veo is used because it can speak Indonesian (Kling's audio cannot), but on
 * OpenRouter it only takes an image as a literal first frame, never as a
 * product reference - hence step 1. Without a photo, step 2 runs alone.
 *
 * The user's text always comes FIRST, as the script to follow. An earlier
 * version put long fixed rules first, and a pasted script ran past the model's
 * prompt limit and was cut: the video obeyed the house rules and ignored it.
 */

/** Veo 3.1 Lite accepts exactly these. */
export const UGC_DURATIONS = [4, 6, 8] as const;
export const UGC_ASPECT_RATIOS = ['9:16', '16:9'] as const;
export type UgcAspectRatio = (typeof UGC_ASPECT_RATIOS)[number];

/** Quality tier -> output resolution. */
export const UGC_RESOLUTIONS = { std: '720p', pro: '1080p' } as const;

/** Upper bound for the whole prompt sent to the video model. */
export const UGC_PROMPT_BUDGET = 2500;

/** Below this, the user wrote an idea rather than a script, so add the full UGC style guidance. */
const SHORT_PROMPT_CHARS = 300;

export function ugcDuration(value: unknown): (typeof UGC_DURATIONS)[number] {
  const n = Number(value);
  if (!Number.isFinite(n)) return 6;
  return UGC_DURATIONS.reduce((best, d) => (Math.abs(d - n) < Math.abs(best - n) ? d : best));
}

export function ugcAspectRatio(value: unknown): UgcAspectRatio {
  return value === '16:9' ? '16:9' : '9:16';
}

export function ugcResolution(mode: unknown): '720p' | '1080p' {
  return mode === 'pro' ? UGC_RESOLUTIONS.pro : UGC_RESOLUTIONS.std;
}

/* ------------------------------------------------------------------ *
 * Video prompt (step 2)
 * ------------------------------------------------------------------ */

const STYLE =
  'Authentic user-generated content (UGC) video, shot like a real person filmed it on a smartphone: ' +
  'handheld with subtle natural shake, casual framing, everyday light, relatable and unscripted. ' +
  'Talking to camera or a hands-on demo, like a genuine TikTok or Reels review. No slick cinematic ' +
  'moves, dramatic grading or advertising gloss.';

const SCRIPT_HEADER =
  'Create this authentic UGC-style smartphone video. Follow the script below exactly: its person, ' +
  'setting, actions, timing, spoken lines and their language take priority over the general rules ' +
  'after it.';

const FRAME_RULE =
  'The video starts from the supplied first frame and continues it as one continuous handheld take, ' +
  'with the same person, outfit, setting and product. No cuts, angle jumps, slow motion or speed ' +
  'ramps. Keep the product identical to the first frame in every frame: same shape, colors, label ' +
  'and printed text, sharp and spelled exactly, never changed or swapped.';

const SOUND_ON =
  "Audio: the person's own natural voice at a relaxed conversational pace, saying the script's " +
  'spoken lines word for word, in the language they are written in, with native pronunciation ' +
  '(or talking casually about the product if there are none), with quiet room tone. No music, no ' +
  'voiceover, no announcer delivery.';

const SOUND_OFF = 'Silent clip: nobody speaks. Only quiet room tone.';

/** Video models draw text badly, and captions belong in the seller's editor. */
const NO_TEXT = 'No on-screen text, captions, subtitles or watermarks.';

function guardrails(hasImage: boolean, sound: boolean, withStyle: boolean): string[] {
  return [
    ...(withStyle ? [STYLE] : []),
    ...(hasImage ? [FRAME_RULE] : []),
    sound ? SOUND_ON : SOUND_OFF,
    NO_TEXT,
  ];
}

/** Longest user prompt that still fits the budget alongside the guardrails. */
export function ugcPromptMaxChars(hasImage: boolean, sound: boolean): number {
  const fixed = [SCRIPT_HEADER, ...guardrails(hasImage, sound, false)].join('\n\n').length + 2;
  return UGC_PROMPT_BUDGET - fixed;
}

/** Largest limit across settings, for the textarea's hard cap. */
export const UGC_PROMPT_MAX_CHARS = ugcPromptMaxChars(false, false);

export function buildUgcPrompt(userPrompt: string, hasImage: boolean, sound: boolean): string {
  const script = userPrompt.trim();

  if (!script) {
    return [STYLE, ...guardrails(hasImage, sound, false)].join('\n\n');
  }

  const isShort = script.length < SHORT_PROMPT_CHARS;
  return [SCRIPT_HEADER, script, ...guardrails(hasImage, sound, isShort)].join('\n\n');
}

/* ------------------------------------------------------------------ *
 * Opening-frame prompt (step 1)
 * ------------------------------------------------------------------ */

const FRAME_PRODUCT_RULE =
  "IMAGE 1 is the seller's actual product. Reproduce it EXACTLY: same shape, proportions, colors, " +
  'material, cap, label artwork and every printed word and logo. Do not redesign it and never ' +
  'invent a brand name or wording that is not visible in IMAGE 1.';

const FRAME_LOOK =
  'Photorealistic smartphone photo that is the FIRST FRAME of an authentic UGC video. The person is ' +
  'mid-motion and natural, not posed, looking at the camera, holding the product close to the lens ' +
  'with the label facing the camera and fully readable. Real skin texture, everyday light, casual ' +
  'framing, lived-in real place. Not an advertisement. No text overlays, captions or watermarks.';

const FRAME_DEFAULT_SCENE =
  'Scene: a relatable everyday person in a real, lived-in room, already holding the product as if ' +
  'about to talk about it.';

/**
 * Prompt for the image model that composes the opening frame. The script
 * describes the whole clip; the frame shows its very first moment, so the
 * video model starts already inside the scene instead of on the packshot.
 */
export function buildUgcFramePrompt(userPrompt: string): string {
  const script = userPrompt.trim();
  return [
    FRAME_LOOK,
    FRAME_PRODUCT_RULE,
    script
      ? 'Show the person, outfit, setting and props at the very first moment (0 seconds) of this ' +
        `video script, before any later action happens:\n${script}`
      : FRAME_DEFAULT_SCENE,
  ].join('\n\n');
}
