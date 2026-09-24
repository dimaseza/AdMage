import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { fetchVideoContent } from '@/lib/openrouter-video';
import { isUgcPipeline, parseTokens } from '@/lib/ugc-pipeline';

export const dynamic = 'force-dynamic';

const PASSTHROUGH_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges'];

/**
 * Streams a finished UGC clip. OpenRouter's content endpoint needs the API key,
 * so the browser gets it through here, and only for the owner's own generation.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const generation = await prisma.generation
    .findFirst({ where: { id, userId: user.id } })
    .catch(() => null); // a malformed id makes the uuid column throw
  if (!generation || !isUgcPipeline(generation.meta)) return new Response('Not found', { status: 404 });

  const index = Number(new URL(request.url).searchParams.get('i') ?? 0);
  const token = parseTokens(generation.providerRequestId)[index];
  if (!Number.isInteger(index) || !token || token.kind !== 'vid') {
    return new Response('Not found', { status: 404 });
  }

  const upstream = await fetchVideoContent(token.id, 0, request.headers.get('range'));
  if (!upstream.ok && upstream.status !== 206) {
    console.error(`[ugc-media] content ${token.id} -> ${upstream.status}`);
    return new Response('Video unavailable', { status: 502 });
  }

  const headers = new Headers({ 'Cache-Control': 'private, max-age=3600' });
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('content-type')) headers.set('content-type', 'video/mp4');
  return new Response(upstream.body, { status: upstream.status, headers });
}
