import { ShieldAlert, X } from 'lucide-react'
import { Container } from '@/components/ui'
import { PROJECT_ADMINISTRATOR_NAME, PROJECT_CONTACT_EMAIL, ROLE_LABELS } from '@/constants'

/**
 * What to say when the session ended, by the reason the SERVER gave
 * (`session_ended` from /auth/me; api/helpers.php). Never guessed here: a
 * browser that was not told why says only that it is signed out.
 */
const SIGNED_OUT = {
  logout: ['You have been signed out.', null],
  idle_timeout: [
    'Your session expired due to inactivity. Please sign in again.',
    'Nothing was done on Paws&Found for a while, so the session was ended to protect the account.',
  ],
  absolute_timeout: [
    'Your session has ended. Please sign in again.',
    'For security, a session lasts a fixed time however active it is.',
  ],
  new_privileged_login: [
    'Your session ended because this account was signed in on another device.',
    'A Pet Coordinator or Administrator account stays signed in on one device at a time. If that was not you, sign in again and tell the Paws&Found Administrator.',
  ],
  password_reset: [
    'Your session ended because the account password was changed.',
    'Every device signed in to this account was signed out. Sign in with the new password.',
  ],
  role_promoted: [
    "Your session ended because this account's access level changed. Please sign in again.",
    null,
  ],
  account_locked: [
    'Your account is locked.',
    'It was locked after repeated failed sign-in attempts. An administrator must unlock it before you can sign in again.',
  ],
  account_suspended: [
    'Your account has been suspended.',
    'If you believe this was a mistake or need help restoring access, contact the Paws&Found Administrator.',
  ],
}

/** Any other ending, or none given: another tab signed out, or the server did not say. */
const SIGNED_OUT_UNKNOWN = ['You have been signed out.', 'This browser is no longer signed in to Paws&Found.']

/**
 * Says out loud that the session ended or the account changed underneath the
 * person, and why.
 *
 * The same account can be signed in on several devices. When an administrator
 * changes a role, or suspends or locks an account, the API refuses the next
 * request from every one of them — but a device nobody is touching would
 * otherwise just quietly rearrange its own navigation or land on Sign in,
 * which looks like a bug rather than a decision. "Does not say you are signed
 * out" was the instructor's word for exactly that (Correction 5).
 *
 * `role="alert"` so it is announced to a screen reader, not only drawn, and it
 * stays until it is dismissed: a message that disappears on its own is a
 * message somebody missed.
 */
export function SessionNotice({ notice, onDismiss }) {
  if (!notice) return null

  const [title, body] =
    notice.kind === 'signed-out'
      ? (SIGNED_OUT[notice.reason] ?? SIGNED_OUT_UNKNOWN)
      : [
          'Your access level changed',
          `An administrator changed this account from ${ROLE_LABELS[notice.from] ?? notice.from} to ${
            ROLE_LABELS[notice.to] ?? notice.to
          }. The pages available to you have changed to match.`,
        ]
  const contact = ['account_locked', 'account_suspended'].includes(notice.reason)

  return (
    <div role="alert" data-session-ended={notice.reason ?? undefined} className="border-b border-accent/30 bg-accent-soft">
      <Container className="flex items-start gap-3 py-3">
        <ShieldAlert size={20} className="mt-0.5 shrink-0 text-lost" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{title}</p>
          {body && <p className="text-sm text-fg-muted">{body}</p>}
          {contact && (
            <p className="text-sm text-fg-muted">
              {PROJECT_ADMINISTRATOR_NAME} ·{' '}
              <a href={`mailto:${PROJECT_CONTACT_EMAIL}`} className="font-medium break-all text-brand hover:underline">
                {PROJECT_CONTACT_EMAIL}
              </a>
            </p>
          )}
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
