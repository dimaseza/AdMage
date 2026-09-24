import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { isUuid, toEntryDTO } from '@/lib/prompt-builder/library';
import { getSessionUser } from '@/lib/prompt-builder/session';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 12;

/**
 * The signed-in user's Prompt Library, newest first.
 * Query: kind (image | video), favorite=1, q (searches title and text), cursor (an entry id).
 */
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const kind = params.get('kind');
    const q = (params.get('q') ?? '').trim().slice(0, 100);
    const cursorParam = params.get('cursor');
    const cursor = isUuid(cursorParam) ? cursorParam : null;

    const where: Prisma.PromptEntryWhereInput = {
      userId: user.id,
      ...(kind === 'image' || kind === 'video' ? { kind } : {}),
      ...(params.get('favorite') === '1' ? { favorite: true } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { promptText: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await prisma.promptEntry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      // A cursor from another user's entry simply finds nothing: `where` still scopes the query.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    return NextResponse.json({
      success: true,
      entries: page.map(toEntryDTO),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
