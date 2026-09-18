'use client';

import { useEffect, useState, useCallback } from 'react';
import { CREDITS_REFRESH_EVENT } from '@/components/CreditBalance';
import styles from './credits.module.css';

type Me = {
  credits: number;
  planName: string;
  allowance: { productShot: number; campaign: number; refine: number; video: number };
};

export default function CurrentBalance() {
  const [me, setMe] = useState<Me | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setMe(data);
    } catch {
      /* keep the last known value */
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(CREDITS_REFRESH_EVENT, load);
    return () => window.removeEventListener(CREDITS_REFRESH_EVENT, load);
  }, [load]);

  return (
    <div className={`glass-panel ${styles.balance}`}>
      <div>
        <p className={styles.balanceLabel}>Current balance</p>
        <p className={styles.balanceValue}>
          {me ? me.credits.toLocaleString('id-ID') : '—'} <span>credits</span>
        </p>
      </div>
      {me && (
        <div className={styles.balanceMeta}>
          <p className={styles.balancePlan}>{me.planName} plan</p>
          <p className={styles.balanceHint}>
            Enough for {me.allowance.productShot} Product Shots
            {me.allowance.video > 0 && ` or ${me.allowance.video} video ads`}
          </p>
        </div>
      )}
    </div>
  );
}
