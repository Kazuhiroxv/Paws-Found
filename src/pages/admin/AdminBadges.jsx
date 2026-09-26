import { cn } from '@/utils/cn'

/**
 * The Administration workspace's state pills — accounts, flags and
 * categories — drawn the same way as a report's status pill (StatusBadge
 * `pill`), so every state on these pages reads as one system. The word is
 * always there; the colour and the dot only reinforce it.
 */
const STATES = {
  account: {
    active: ['Active', 'bg-success-soft text-success-ink', 'bg-status-returned'],
    suspended: ['Suspended', 'bg-danger-soft text-danger-hover', 'bg-danger'],
    // Locked is not suspended, and must not look like it. Suspended is a
    // decision an administrator made about a person; locked is what happened
    // to an account after three failed sign-in attempts. Amber, the colour
    // this system already uses for "needs attention", rather than red.
    locked: ['Locked', 'bg-accent-soft text-lost', 'bg-status-match'],
  },
  moderation: {
    open: ['Awaiting review', 'bg-accent-soft text-lost', 'bg-status-match'],
    actioned: ['Actioned', 'bg-brand-soft text-brand-hover', 'bg-brand'],
    dismissed: ['Dismissed', 'bg-status-closed-soft text-fg', 'bg-status-closed'],
  },
  category: {
    available: ['Available', 'bg-success-soft text-success-ink', 'bg-status-returned'],
    deactivated: ['Deactivated', 'bg-status-closed-soft text-fg', 'bg-status-closed'],
  },
}

function StatePill({ kind, state, className }) {
  const entry = STATES[kind][state]
  if (!entry) return null
  const [label, colours, dot] = entry

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        colours,
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      {label}
    </span>
  )
}

/** Active, Suspended or Locked. */
export function AccountStatusBadge({ status, className }) {
  return <StatePill kind="account" state={status} className={className} />
}

/** Awaiting review, Actioned or Dismissed. */
export function ModerationStatusBadge({ status, className }) {
  return <StatePill kind="moderation" state={status} className={className} />
}

/** Available or Deactivated. */
export function CategoryStatusBadge({ isActive, className }) {
  return <StatePill kind="category" state={isActive ? 'available' : 'deactivated'} className={className} />
}
