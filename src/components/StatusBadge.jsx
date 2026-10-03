import { PUBLICATION_STATUSES, PUBLICATION_STATUS_LABELS, REPORT_STATUSES, REPORT_STATUS_LABELS } from '@/constants'
import { cn } from '@/utils/cn'

/**
 * Where a report stands: Active, Possible Match, Returned, Closed.
 *
 * Deliberately quieter than ReportTypeBadge — a small dot plus text rather
 * than a filled badge — because type and status sit side by side and must not
 * compete. Type and status are separate concepts and never share a treatment.
 *
 * The dot is decorative; the label carries the meaning.
 */
const DOT_COLOURS = {
  [REPORT_STATUSES.ACTIVE]: 'bg-status-active',
  [REPORT_STATUSES.POSSIBLE_MATCH]: 'bg-status-match',
  [REPORT_STATUSES.RETURNED]: 'bg-status-returned',
  [REPORT_STATUSES.CLOSED]: 'bg-status-closed',
}

/**
 * The filled variant: a restrained pill, used on the customer dashboard where
 * status is the thing a person scans for. Each pairing measures above 4.5:1,
 * and the label is always present, so colour is never the only signal.
 */
const PILL_COLOURS = {
  [REPORT_STATUSES.ACTIVE]: 'bg-brand-soft text-brand-hover',
  [REPORT_STATUSES.POSSIBLE_MATCH]: 'bg-accent-soft text-lost',
  [REPORT_STATUSES.RETURNED]: 'bg-success-soft text-success-ink',
  [REPORT_STATUSES.CLOSED]: 'bg-status-closed-soft text-fg',
}

/**
 * @param {Object} props
 * @param {string} props.status  One of REPORT_STATUSES.
 * @param {'dot'|'pill'} [props.variant]  `dot` everywhere by default.
 */
export function StatusBadge({ status, variant = 'dot', className }) {
  const dot = DOT_COLOURS[status]
  if (!dot) return null

  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium',
          PILL_COLOURS[status],
          className,
        )}
      >
        <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
        {REPORT_STATUS_LABELS[status]}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-fg-muted', className)}>
      <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
      {REPORT_STATUS_LABELS[status]}
    </span>
  )
}

/**
 * Whether the public may see a report (Correction 4), beside its case status.
 * Shown only when the answer is not simply "published": Pending review, Not
 * approved, Removed. A dashed border tells it apart from the status pill;
 * the words carry the meaning.
 *
 * @param {Object} props
 * @param {string} props.publication  One of PUBLICATION_STATUSES.
 */
export function PublicationBadge({ publication, className }) {
  if (!publication || publication === PUBLICATION_STATUSES.PUBLISHED) return null

  return (
    <span
      data-publication={publication}
      className={cn(
        'inline-flex items-center rounded-pill border border-dashed px-2.5 py-0.5 text-xs font-medium',
        publication === PUBLICATION_STATUSES.PENDING_REVIEW && 'border-brand text-brand-hover',
        publication === PUBLICATION_STATUSES.REJECTED && 'border-accent text-lost',
        publication === PUBLICATION_STATUSES.REMOVED && 'border-danger text-danger',
        className,
      )}
    >
      {PUBLICATION_STATUS_LABELS[publication]}
    </span>
  )
}
