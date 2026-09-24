import { NextResponse } from 'next/server';
import { startGeneration, HiggsfieldGenerationRequest } from '@/lib/higgsfield';
import {
  FEATURE_MODEL,
  clamp,
  clampDuration,
  imageCredits,
  videoModel,
  videoCreditsPerSecond,
  ugcModel,
  ugcCostKey,
  assertPublishedCreditsMatchCost,
  type ModelCapabilities,
} from '@/lib/higgsfield-models';
import { UGC_CREDITS_PER_SECOND } from '@/lib/credit-costs';
import prisma from '@/lib/prisma';
import { getPlan } from '@/lib/plans';

type GenerationType = 'refine' | 'product-shot' | 'campaign' | 'video' | 'ugc';

// Fail loudly in development if the prices shown in the browser stop matching
// what this route charges.
if (process.env.NODE_ENV !== 'production') {
  assertPublishedCreditsMatchCost();
}

const PRODUCT_RULE =
  "IMAGE 1 is the user's actual product. Reproduce it EXACTLY: same shape, proportions, color, " +
  'material, finish, label artwork, and all existing text and logos. Do not redesign it, do not ' +
  'restyle the packaging, and never invent a brand name or wording that is not visible in IMAGE 1. ' +
  'The product in the output must be recognisably the same physical item.';

const STYLE_RULE =
  'IMAGE 2 is a style reference. Recreate its scene: composition, camera angle, framing, lighting ' +
  'direction and quality, color grading, background, surface, props, and overall mood. Substitute ' +
  'the product from IMAGE 1 into that scene in place of whatever product IMAGE 2 shows. Match ' +
  'IMAGE 2 for everything except the product itself.';

/**
 * Builds the instruction sent to the model.
 *
 * Images are attached positionally on `image_urls`, so the prompt must describe
 * them in the same order: [0] = the user's product, [1] = style reference.
 */
function buildImagePrompt(
  type: Exclude<GenerationType, 'video'>,
  userPrompt: string,
  hasStyleRef: boolean
): string {
  const styleRule = hasStyleRef ? STYLE_RULE : null;
  const sections: string[] = [];

  switch (type) {
    case 'refine':
      sections.push(
        'Retouch this product photo to professional e-commerce quality.',
        PRODUCT_RULE,
        'Remove dust, scratches, sensor noise and blemishes. Correct white balance, improve ' +
          'lighting, contrast and micro-detail sharpness. Keep the existing composition and ' +
          'background unless the user asks otherwise. Do not add new objects or text.'
      );
      if (styleRule) sections.push(styleRule);
      break;

    case 'product-shot':
      sections.push(
        'Create a photorealistic, high-end commercial product photograph.',
        PRODUCT_RULE,
        styleRule ??
          'Place the product in a premium, clean studio setting with professional lighting, ' +
            'realistic contact shadows and accurate reflections.',
        'Physically plausible result: correct perspective, grounded contact shadows, reflections ' +
          'consistent with the scene lighting. No text overlays, no watermarks, no UI elements.'
      );
      break;

    case 'campaign':
      sections.push(
        'Create an award-winning, cinematic advertising campaign image.',
        PRODUCT_RULE,
        styleRule ??
          'Build a visually striking composition with premium lighting, deliberate color grading ' +
            'and art direction that tells a story and sells the product.',
        'The product must remain the clear hero of the frame and stay perfectly legible. ' +
          'No added text, headlines, logos, watermarks or UI elements.'
      );
      break;
  }

  if (userPrompt.trim()) {
    sections.push(
      `User request (follow this, without breaking the rules above): ${userPrompt.trim()}`
    );
  }

  return sections.join('\n\n');
}

function buildVideoPrompt(userPrompt: string, hasImage: boolean): string {
  const sections = [
    'High-end commercial advertising video. Cinematic, photorealistic, smooth natural motion, ' +
      'stable camera work, consistent lighting, broadcast quality suitable for social media ads.',
  ];
  if (hasImage) {
    sections.push(
      'Animate the supplied image. Keep the product exactly as it appears in the source frame: ' +
        'same shape, colors, label artwork and text. Do not morph, warp or restyle the product, ' +
        'and do not introduce new objects or text.'
    );
  }
  if (userPrompt.trim()) {
    sections.push(`User request: ${userPrompt.trim()}`);
  }
  return sections.join('\n\n');
}

/**
 * UGC Creator's "prompt engine": a template tuned for the user-generated-content
 * look (handheld, authentic, creator-shot) rather than the polished commercial
 * look `buildVideoPrompt` targets for Video Ads.
 *
 * Runs on Kling O3 image-reference, where the upload is a REFERENCE rather than
 * the opening frame. The reference rule below is what stops the model falling
 * back to the packshot: given a product shot on a white background, it will
 * happily open on that static packshot and then cut to the scene unless told
 * plainly that the image describes the product, not the first shot.
 */
function buildUgcPrompt(userPrompt: string, hasImage: boolean, sound: boolean): string {
  const sections = [
    'Authentic user-generated content (UGC) style short video, shot like a real creator filmed it ' +
      'on a smartphone. Handheld camera with subtle natural shake, casual framing, everyday indoor ' +
      'lighting (not studio-perfect), relatable and unscripted energy. Talking-to-camera or ' +
      'hands-on product demo feel, the way a genuine review or unboxing clip looks on TikTok, ' +
      'Instagram Reels or YouTube Shorts. Avoid slick cinematic camera moves, dramatic color grading ' +
      'or polished advertising gloss.',
  ];

  if (hasImage) {
    sections.push(
      'The reference image is supplied ONLY to define what the product looks like: its shape, ' +
        'proportions, colors, material, finish, label artwork, logo and existing text. Reproduce the ' +
        'product faithfully from it, and never invent branding or wording it does not show.',
      'The reference image is NOT a frame of the video and its background is NOT the setting. ' +
        'Open the video already inside a real, lived-in scene with the person present and the product ' +
        'already in their hand or in shot, moving from the very first frame. Do not begin on the ' +
        'product alone, on a static product shot, on a plain white, empty or studio background, or on ' +
        'a still frame that then animates. No packshot opening, no logo card, no reveal, no fade, ' +
        'wipe, zoom-out or cut from a product photo into the scene. It must read as one continuous ' +
        'handheld take that was already rolling.',
      // O3 is a multi-shot model and will cut to a new setup on its own. Each cut
      // re-derives the product from the reference, which is where it drifts -
      // the label re-letters, the colour shifts, the proportions change.
      'Hold the product identical in every single frame: same proportions, same cap, same colour ' +
        'and fill level, same label layout. The label text must stay sharp, legible and spelled ' +
        'exactly as in the reference - never let it blur, warp, re-letter, translate or change ' +
        'wording partway through. Keep the product fully in frame, held steady, never clipped at ' +
        'the edge, and never swap it for a different bottle, box or variant.',
      // Fine label text only resolves when the product occupies enough pixels.
      // Held small or far from the lens it renders blank and pops in later.
      'Keep the product close to the camera and large in frame for most of the shot, held up near ' +
        'the face or reached toward the lens, so the label stays big enough to read throughout. ' +
        'Do not leave it small, low in the lap, or far from the lens.',
      'Film it as ONE single unbroken shot from one camera position. No cuts, no shot changes, no ' +
        'angle jumps, no second location, no montage, no slow motion and no speed ramps.'
    );
  }

  sections.push(
    sound
      ? 'Include natural audio: the person speaking in a relaxed, conversational voice, at normal ' +
          'conversational pace, with quiet realistic room tone. No background music, no voiceover ' +
          'narration read over the top, no studio announcer delivery.'
      : 'No spoken dialogue.'
  );

  if (userPrompt.trim()) {
    sections.push(
      `User request (follow this, without breaking the rules above): ${userPrompt.trim()}`
    );
  }

  return sections.join('\n\n');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, payload, userId } = body as {
      type: GenerationType;
      payload: any;
      userId: string;
    };

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const freePlan = getPlan('FREE');
    const dbUser = await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: '',
        credits: freePlan.credits,
        tier: freePlan.id,
      },
    });
    const userPlan = getPlan(dbUser.tier);

    const {
      aspectRatio = '1:1',
      variations = 1,
      duration = 5,
      resolution,
      quality = 'medium',
      imageUrl,
      styleImageUrl,
    } = payload || {};

    const userPrompt: string = payload?.prompt || '';
    const safeVariations = Math.min(Math.max(1, Number(variations) || 1), 4);

    let creditCost: number;
    let model: ModelCapabilities;
    let prompt: string;
    let ugcSound = false;

    switch (type) {
      // Refine, Product Shot and Campaign share one path: the model comes from
      // FEATURE_MODEL and the credit cost is derived from what Higgsfield actually
      // bills for the chosen quality/resolution, not a flat per-feature number.
      case 'refine':
      case 'product-shot':
      case 'campaign': {
        if (!imageUrl) {
          return NextResponse.json(
            { error: `${type} requires a product image.` },
            { status: 400 }
          );
        }
        model = FEATURE_MODEL[type];
        prompt = buildImagePrompt(type, userPrompt, Boolean(styleImageUrl));
        creditCost = imageCredits(model, quality, resolution) * safeVariations;
        break;
      }

      case 'video': {
        // Video burns ~1.5x the cost-per-credit of images, so free accounts are image-only.
        if (!userPlan.allowsVideo) {
          return NextResponse.json(
            {
              error:
                'Video generation is not available on the Free plan. Upgrade to Starter to create video ads.',
              upgradeRequired: true,
            },
            { status: 403 }
          );
        }
        if (!imageUrl && !userPrompt.trim()) {
          return NextResponse.json(
            { error: 'Video requires an image or a prompt.' },
            { status: 400 }
          );
        }
        // Kling 3.0 tiers quality by endpoint, so the resolution picks the variant.
        model = videoModel(resolution, Boolean(imageUrl));
        prompt = buildVideoPrompt(userPrompt, Boolean(imageUrl));
        creditCost =
          videoCreditsPerSecond(resolution) *
          clampDuration(duration, model.durationRange) *
          safeVariations;
        break;
      }

      case 'ugc': {
        if (!userPlan.allowsVideo) {
          return NextResponse.json(
            {
              error:
                'UGC Creator is not available on the Free plan. Upgrade to Starter to create UGC videos.',
              upgradeRequired: true,
            },
            { status: 403 }
          );
        }
        if (!imageUrl && !userPrompt.trim()) {
          return NextResponse.json(
            { error: 'UGC video requires an image or a prompt.' },
            { status: 400 }
          );
        }
        // Sound defaults on: a silent talking-head clip is useless for social.
        ugcSound = payload?.sound !== false;
        model = ugcModel(payload?.mode);
        prompt = buildUgcPrompt(userPrompt, Boolean(imageUrl), ugcSound);
        creditCost =
          UGC_CREDITS_PER_SECOND[ugcCostKey(payload?.mode, ugcSound)] *
          clampDuration(duration, model.durationRange) *
          safeVariations;
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid generation type' }, { status: 400 });
    }

    const genPayload: HiggsfieldGenerationRequest = {
      model: model.slug,
      prompt,
    };

    // Snap every knob onto what this specific model accepts. Sending `high` to Grok
    // or `4k` to a video model is a hard 400, and the UI offers both.
    if (model.aspectRatios) {
      genPayload.aspect_ratio = clamp(aspectRatio, model.aspectRatios, '1:1');
    }
    if (model.qualities) {
      genPayload.quality = clamp(quality, model.qualities, 'medium');
    }
    if (model.resolutions) {
      genPayload.resolution = clamp(resolution, model.resolutions, model.resolutions[0]);
    }
    if (model.durationRange) {
      genPayload.duration = clampDuration(duration, model.durationRange);
    }
    if (model.modes) {
      genPayload.mode = clamp(payload?.mode, model.modes, model.modes[0]);
    }
    if (model.supportsSound) {
      genPayload.sound = ugcSound ? 'on' : 'off';
    }

    // Attach the images. Order is load-bearing: the prompt refers to IMAGE 1 / IMAGE 2.
    if (model.singleImageField === 'image_url') {
      if (imageUrl) genPayload.image_url = imageUrl;
    } else if (model.maxImages > 0) {
      const images = [imageUrl, styleImageUrl].filter(Boolean) as string[];
      if (images.length) genPayload.image_urls = images.slice(0, model.maxImages);
    }

    // Reserve the credits up front, conditionally, so two concurrent submissions
    // cannot both pass a read-then-write balance check and overdraw the account.
    const reserved = await prisma.user.updateMany({
      where: { id: userId, credits: { gte: creditCost } },
      data: { credits: { decrement: creditCost } },
    });

    if (reserved.count === 0) {
      return NextResponse.json(
        { error: `Not enough credits. This costs ${creditCost}, you have ${dbUser.credits}.` },
        { status: 402 }
      );
    }

    let providerRequestIds: string[];
    try {
      // num_images is not honoured by these models, so each variation is its own request.
      providerRequestIds = await Promise.all(
        Array.from({ length: safeVariations }, () => startGeneration(genPayload))
      );
    } catch (err) {
      // Nothing was queued, so hand the reservation straight back.
      await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: creditCost } },
      });
      throw err;
    }

    const generation = await prisma.generation.create({
      data: {
        userId,
        type,
        creditCost,
        status: 'PENDING',
        providerRequestId: providerRequestIds.join(','),
      },
    });

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      creditCost,
      creditsRemaining: dbUser.credits - creditCost,
      message: `Started ${type} generation`,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
