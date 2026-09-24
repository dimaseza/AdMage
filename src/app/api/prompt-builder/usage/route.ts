import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/prompt-builder/session';
import { getUsageSnapshot } from '@/lib/prompt-builder/usage';

export const dynamic = 'force-dynamic';

/** Today's Prompt Builder allowance for the signed-in user. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json({
      success: true,
      usage: await getUsageSnapshot(user.id, user.plan),
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
