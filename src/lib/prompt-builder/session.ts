import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { getPlan, type Plan } from '@/lib/plans';

export type SessionUser = { id: string; plan: Plan };

/**
 * The signed-in user, taken from the Supabase session cookie.
 *
 * The Prompt Builder never accepts a userId from the request body: its daily
 * limits and the saved library are keyed on identity, so identity has to come
 * from the verified session and nothing the client can edit.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Lazily create the row so a brand-new signup can use the feature straight away.
  const free = getPlan('FREE');
  const dbUser = await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, email: user.email ?? '', credits: free.credits, tier: free.id },
    select: { tier: true },
  });

  return { id: user.id, plan: getPlan(dbUser.tier) };
}
