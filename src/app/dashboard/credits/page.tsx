import styles from './credits.module.css';
import { STANDARD_COST } from '@/lib/plans';
import CurrentBalance from './CurrentBalance';
import PricingTable from '@/components/PricingTable';

export default function CreditsPage() {
  return (
    <div>
      <h1 className={styles.title}>Credits &amp; Subscription</h1>
      <CurrentBalance />

      <h2 className={styles.sectionHeading}>Plans</h2>
      <PricingTable ctaHref="/dashboard/credits" currentPlanId="FREE" showCreditCosts />

      <div className={`glass-panel ${styles.costs}`}>
        <h3 className={styles.costsTitle}>What a generation costs</h3>
        <p className={styles.costsNote}>
          Credit cost scales with quality and resolution. These are the standard-quality rates
          &mdash; the exact amount is always shown before you generate.
        </p>
        <ul className={styles.costList}>
          <li>
            Product Shot <span>{STANDARD_COST.productShot} credits</span>
          </li>
          <li>
            Campaign <span>{STANDARD_COST.campaign} credits</span>
          </li>
          <li>
            Refine <span>{STANDARD_COST.refine} credits</span>
          </li>
          <li>
            Video ad (5s, 1080p) <span>{STANDARD_COST.video} credits</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
