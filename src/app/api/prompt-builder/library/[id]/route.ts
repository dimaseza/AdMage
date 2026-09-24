import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isUuid } from '@/lib/prompt-builder/library';
import { getSessionUser } from '@/lib/prompt-builder/session';

export const dynamic = 'force-dynamic';

/** Toggle or set the favorite flag on one of the user's own entries. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (typeof body?.favorite !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    // Scoping by userId in the same statement is the ownership check.
    const res = await prisma.promptEntry.updateMany({
      where: { id, userId: user.id },
      data: { favorite: body.favorite },
    });
    if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, favorite: body.favorite });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const res = await prisma.promptEntry.deleteMany({ where: { id, userId: user.id } });
    if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
