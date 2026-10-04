import { ShieldAlert, X } from 'lucide-react'
import { Container } from '@/components/ui'
import { PROJECT_ADMINISTRATOR_NAME, PROJECT_CONTACT_EMAIL, ROLE_LABELS } from '@/constants'
import { hasKey, t } from '@/i18n'

/**
 * What to say when the session ended, by the reason the SERVER gave
 * (`session_ended` from /auth/me; api/helpers.php). Never guessed here: a
 * browser that was not told why says only that it is signed out. The words
 * are `shell.session.<reason>` and, where there is more to say,
 * `shell.session.<reason>_body`, in English or Filipino (Correction 7).
 */
const REASONS = [
  'logout',
  'idle_timeout',
  'absolute_timeout',
  'new_privileged_login',
  'password_reset',
  'role_promoted',
  'privilege_changed',
  'account_locked',
  'account_suspended',
]

function signedOutWords(reason) {
  const key = REASONS.includes(reason) ? reason : 'unknown'
  const body = `shell.session.${key}_body`
  return [t(`shell.session.${key}`), hasKey(body) ? t(body) : null]
}

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
      ? signedOutWords(notice.reason)
      : [
          t('shell.session.roleChangedTitle'),
          t('shell.session.roleChangedBody', {
            from: ROLE_LABELS[notice.from] ?? notice.from,
            to: ROLE_LABELS[notice.to] ?? notice.to,
          }),
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
          <span className="sr-only">{t('shell.session.dismiss')}</span>
        </button>
      </Container>
    </div>
  )
}
