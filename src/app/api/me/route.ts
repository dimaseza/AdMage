import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { getPlan, allowanceFor } from '@/lib/plans';

export const dynamic = 'force-dynamic';

/** Current credit balance and plan. Polled by the sidebar after each generation. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Lazily create the row so a fresh signup sees its starting grant.
    const plan = getPlan('FREE');
    const dbUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email ?? '',
        credits: plan.credits,
        tier: plan.id,
      },
      select: { credits: true, tier: true },
    });

    const userPlan = getPlan(dbUser.tier);

    return NextResponse.json({
      success: true,
      credits: dbUser.credits,
      tier: dbUser.tier,
      planName: userPlan.name,
      allowsVideo: userPlan.allowsVideo,
      allowance: allowanceFor(dbUser.credits, userPlan.allowsVideo),
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
