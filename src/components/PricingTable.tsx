import Link from 'next/link';
import { PLANS, comparisonRows, formatIDR } from '@/lib/plans';
import styles from './PricingTable.module.css';

const DASH = '—';

type Props = {
  /** Plan id of the signed-in user, highlighted as their current plan. */
  currentPlanId?: string;
  /** Where the per-plan buttons link to. Omit to render no action row. */
  ctaHref?: string;
  /**
   * Show per-generation credit costs.
   *
   * Off by default, and must stay off on public pages: published alongside the
   * plan prices, the per-generation cost lets anyone derive the rupiah value of
   * a credit and back out the unit margin. Signed-in users need it to budget
   * their balance, so the dashboard opts in.
   */
  showCreditCosts?: boolean;
};

/**
 * Plan comparison table.
 *
 * A table rather than cards: five plans x seven features wraps badly in cards,
 * and the point of the section is comparing the same row across plans.
 */
export default function PricingTable({ currentPlanId, ctaHref, showCreditCosts = false }: Props) {
  const rows = comparisonRows();

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          Figures assume standard quality &mdash; medium quality at 1K for images, and 5-second
          1080p video. Higher quality and 4K resolution use more credits, and the exact amount is
          always shown before you generate. Credits never expire on paid plans.
        </caption>

        <thead>
          <tr>
            <th scope="col" className={styles.corner}>
              <span className={styles.srOnly}>Feature</span>
            </th>
            {PLANS.map((plan) => {
              const isCurrent = currentPlanId === plan.id;
              return (
                <th
                  key={plan.id}
                  scope="col"
                  className={[
                    styles.planHead,
                    plan.popular ? styles.colPopular : '',
                    isCurrent ? styles.colCurrent : '',
                  ].join(' ')}
                >
                  {isCurrent ? (
                    <span className={styles.tag}>Your plan</span>
                  ) : plan.popular ? (
                    <span className={styles.tag}>Most Popular</span>
                  ) : (
                    <span className={styles.tagSpacer} />
                  )}
                  <span className={styles.planName}>{plan.name}</span>
                  <span className={styles.planPrice}>
                    {/* The plan is already named "Free"; repeating it as the price read as a bug. */}
                    {formatIDR(plan.priceIDR)}
                    <span className={styles.per}>/mo</span>
                  </span>
                  <span className={styles.planTagline}>{plan.tagline}</span>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.emphasis ? styles.rowEmphasis : ''}>
              <th scope="row" className={styles.rowHead}>
                <span className={styles.rowLabel}>{row.label}</span>
                {showCreditCosts && row.hint && (
                  <span className={styles.rowHint}>{row.hint}</span>
                )}
              </th>
              {row.values.map((value, i) => (
                <td
                  key={PLANS[i].id}
                  className={[
                    styles.cell,
                    PLANS[i].popular ? styles.colPopular : '',
                    currentPlanId === PLANS[i].id ? styles.colCurrent : '',
                    value === DASH ? styles.cellEmpty : '',
                  ].join(' ')}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        {ctaHref && (
          <tfoot>
            <tr>
              <td className={styles.rowHead} />
              {PLANS.map((plan) => {
                const isCurrent = currentPlanId === plan.id;
                return (
                  <td
                    key={plan.id}
                    className={[
                      styles.cell,
                      styles.ctaCell,
                      plan.popular ? styles.colPopular : '',
                      isCurrent ? styles.colCurrent : '',
                    ].join(' ')}
                  >
                    {isCurrent ? (
                      <span className={styles.currentBtn}>Current</span>
                    ) : (
                      <Link
                        href={ctaHref}
                        className={plan.popular ? 'btn-primary' : styles.btnGhost}
                        style={{ display: 'block', textAlign: 'center', width: '100%' }}
                      >
                        {plan.priceIDR === 0 ? 'Start Free' : 'Choose'}
                      </Link>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
