import prisma from '@/lib/prisma';
import type { Plan } from '@/lib/plans';
import type { UsageSnapshot } from './config';

/**
 * Daily limits for the Prompt Builder.
 *
 * A "day" is the calendar day in WIB (UTC+7), the timezone of the audience, so
 * the counters reset at midnight in Jakarta rather than at 07:00 local time.
 * Counters live in their own table: deleting a saved prompt must not hand the
 * user their quota back.
 */

export type UsageKind = 'prompt' | 'photo';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day in WIB, e.g. "2026-09-24". */
export function wibDay(now: Date = new Date()): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** The next midnight in WIB, as an ISO instant. */
export function nextResetIso(now: Date = new Date()): string {
  const shifted = now.getTime() + WIB_OFFSET_MS;
  const nextMidnightShifted = (Math.floor(shifted / DAY_MS) + 1) * DAY_MS;
  return new Date(nextMidnightShifted - WIB_OFFSET_MS).toISOString();
}

function limitFor(plan: Plan, kind: UsageKind): number {
  return kind === 'prompt' ? plan.promptsPerDay : plan.photoAnalysesPerDay;
}

export type UsageClaim = { ok: boolean; day: string };

/**
 * Takes one unit of today's allowance, atomically.
 *
 * The increment only matches while `count < limit`, so two concurrent requests
 * cannot both slip through the last remaining unit (a read-then-write check would).
 */
export async function claimUsage(userId: string, plan: Plan, kind: UsageKind): Promise<UsageClaim> {
  const day = wibDay();
  // ON CONFLICT DO NOTHING, so concurrent first requests of the day cannot collide.
  await prisma.promptUsage.createMany({ data: [{ userId, day, kind }], skipDuplicates: true });
  const res = await prisma.promptUsage.updateMany({
    where: { userId, day, kind, count: { lt: limitFor(plan, kind) } },
    data: { count: { increment: 1 } },
  });
  return { ok: res.count === 1, day };
}

/** Hands a unit back when the AI call failed, so an error never costs the user a try. */
export async function releaseUsage(userId: string, claim: UsageClaim, kind: UsageKind) {
  await prisma.promptUsage.updateMany({
    where: { userId, day: claim.day, kind, count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  });
}

export async function getUsageSnapshot(userId: string, plan: Plan): Promise<UsageSnapshot> {
  const day = wibDay();
  const rows = await prisma.promptUsage.findMany({
    where: { userId, day },
    select: { kind: true, count: true },
  });
  const used = (kind: UsageKind) => rows.find((r) => r.kind === kind)?.count ?? 0;

  return {
    planName: plan.name,
    isFree: plan.id === 'FREE',
    prompts: { used: used('prompt'), limit: plan.promptsPerDay },
    photos: { used: used('photo'), limit: plan.photoAnalysesPerDay },
    resetsAt: nextResetIso(),
  };
}
