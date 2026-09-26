import { ShieldAlert, X } from 'lucide-react'
import { Container } from '@/components/ui'
import { ROLE_LABELS } from '@/constants'

/**
 * Says out loud that the account changed underneath the person.
 *
 * The same account can be signed in on several devices. When an administrator
 * changes a role, or suspends or locks an account, the API refuses the next
 * request from every one of them — but a device nobody is touching would
 * otherwise just quietly rearrange its own navigation, which looks like a bug
 * rather than a decision.
 *
 * `role="alert"` so it is announced, not only drawn, and it stays until it is
 * dismissed: a message that disappears on its own is a message somebody
 * missed.
 */
export function SessionNotice({ notice, onDismiss }) {
  if (!notice) return null

  const [title, body] =
    notice.kind === 'signed-out'
      ? [
          'You have been signed out',
          'This account is no longer active on this device. It may have been suspended, or locked after failed sign-in attempts. Sign in again, or ask an administrator.',
        ]
      : [
          'Your access level changed',
          `An administrator changed this account from ${ROLE_LABELS[notice.from] ?? notice.from} to ${
            ROLE_LABELS[notice.to] ?? notice.to
          }. The pages available to you have changed to match.`,
        ]

  return (
    <div role="alert" className="border-b border-accent/30 bg-accent-soft">
      <Container className="flex items-start gap-3 py-3">
        <ShieldAlert size={20} className="mt-0.5 shrink-0 text-lost" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{title}</p>
          <p className="text-sm text-fg-muted">{body}</p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 shrink-0 rounded-control p-1 text-fg-muted hover:bg-panel hover:text-fg focus-visible:bg-panel focus-visible:text-fg"
        >
          <X size={18} aria-hidden="true" />
          <span className="sr-only">Dismiss this message</span>
        </button>
      </Container>
    </div>
  )
}
