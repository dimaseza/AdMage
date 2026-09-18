import { NextResponse } from 'next/server';
import { startGeneration, HiggsfieldGenerationRequest } from '@/lib/higgsfield';
import {
  FEATURE_MODEL,
  clamp,
  clampDuration,
  imageCredits,
  videoModel,
  videoCreditsPerSecond,
  assertPublishedCreditsMatchCost,
  type ModelCapabilities,
} from '@/lib/higgsfield-models';
import prisma from '@/lib/prisma';
import { getPlan } from '@/lib/plans';

type GenerationType = 'refine' | 'product-shot' | 'campaign' | 'video';

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
