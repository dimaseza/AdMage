import { NextResponse } from 'next/server';
import { OpenRouterError } from '@/lib/openrouter';
import { describeProductPhoto } from '@/lib/prompt-builder/image';
import { getSessionUser } from '@/lib/prompt-builder/session';
import { claimUsage, getUsageSnapshot, releaseUsage } from '@/lib/prompt-builder/usage';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

/** The browser resizes to ~768px JPEG (roughly 100-250 KB); this is a generous ceiling. */
const MAX_DATA_URL_CHARS = 1_500_000;
const DATA_URL_PREFIX = /^data:image\/(?:jpeg|png|webp);base64,/;
const BASE64_BODY = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Reads a product photo and returns a short description that pre-fills the
 * product field. Has its own daily counter, separate from prompt generation.
 * The image goes straight to the vision model and is never stored.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const image: unknown = body?.image;
    if (typeof image !== 'string' || image.length > MAX_DATA_URL_CHARS) {
      return NextResponse.json({ error: 'That image is too large.' }, { status: 400 });
    }
    const prefix = DATA_URL_PREFIX.exec(image);
    if (!prefix || !BASE64_BODY.test(image.slice(prefix[0].length))) {
      return NextResponse.json({ error: 'Upload a JPG, PNG or WebP photo.' }, { status: 400 });
    }

    const claim = await claimUsage(user.id, user.plan, 'photo');
    if (!claim.ok) {
      const usage = await getUsageSnapshot(user.id, user.plan);
      return NextResponse.json(
        {
          error: `You've used all ${usage.photos.limit} photo analyses for today. You can still describe the product by typing.`,
          limitReached: true,
          usage,
        },
        { status: 429 }
      );
    }

    try {
      const description = await describeProductPhoto(image);
      return NextResponse.json({
        success: true,
        description,
        usage: await getUsageSnapshot(user.id, user.plan),
      });
    } catch (err) {
      await releaseUsage(user.id, claim, 'photo');
      throw err;
    }
  } catch (error) {
    if (error instanceof OpenRouterError) {
      console.error('[prompt-builder/analyze]', error.message);
      return NextResponse.json({ error: error.publicMessage }, { status: 502 });
    }
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
