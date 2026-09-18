'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Live credit balance for the sidebar.
 *
 * Generations reserve credits at submit time and refund on failure, so the
 * balance can change without a navigation. Anything that moves it dispatches
 * `credits:refresh` on window and this refetches.
 */
export const CREDITS_REFRESH_EVENT = 'credits:refresh';

/** Call after submitting or completing a generation to resync the sidebar. */
export function refreshCredits() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CREDITS_REFRESH_EVENT));
  }
}

type Me = {
  credits: number;
  planName: string;
  allowsVideo: boolean;
};

export default function CreditBalance() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setMe({ credits: data.credits, planName: data.planName, allowsVideo: data.allowsVideo });
      }
    } catch {
      // Leave the last known balance on screen rather than flashing an error.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(CREDITS_REFRESH_EVENT, load);
    // Catch changes made in another tab.
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(CREDITS_REFRESH_EVENT, load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return (
    <div className="credit-balance">
      <p className="credits">
        {loading && !me ? '— Credits' : `${(me?.credits ?? 0).toLocaleString('id-ID')} Credits`}
      </p>
      {me && <p className="credit-plan">{me.planName} plan</p>}
      <Link
        href="/dashboard/credits"
        className="btn-primary"
        style={{ textAlign: 'center', display: 'block' }}
      >
        {me && me.planName === 'Free' ? 'Upgrade' : 'Top Up'}
      </Link>
    </div>
  );
}
