import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Button, Container } from '@/components/ui'
import { userService } from '@/services'
import { t } from '@/i18n'

/**
 * "Privacy Notice updated" (Correction 7).
 *
 * Shown to a signed-in account that has not been shown the notice as it now
 * reads — one that registered before Correction 5 described the session and
 * activity records. It does not stop anybody working: it sits above the page
 * until they acknowledge it, and every page behind it works as before.
 *
 * Acknowledging records that the update was shown, nothing more. The records
 * it describes are kept for security whether or not anybody presses the
 * button, and the words say so rather than dressing a notice up as a choice.
 *
 * A region rather than an alert: it is news, not an error, and it should not
 * interrupt a screen reader in the middle of a page.
 *
 * @param {Object} props
 * @param {Object|null} props.user
 * @param {() => Promise<void>|void} props.onAcknowledged  Re-reads the session.
 */
export function PrivacyUpdateNotice({ user, onAcknowledged }) {
  const [isSaving, setIsSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!user || user.privacyNoticeAcknowledged) return null

  const acknowledge = async () => {
    setIsSaving(true)
    setFailed(false)
    try {
      await userService.acknowledgePrivacyNotice()
      await onAcknowledged?.()
    } catch {
      setFailed(true)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section
      aria-labelledby="privacy-update-title"
      data-privacy-update=""
      className="border-b border-brand/20 bg-brand-soft print:hidden"
    >
      <Container className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <h2 id="privacy-update-title" className="font-medium text-fg">
            {t('shell.privacyUpdate.title')}
          </h2>
          <p className="text-sm text-fg">{t('shell.privacyUpdate.body')}</p>
          <p className="mt-1 text-sm text-fg">{t('shell.privacyUpdate.note')}</p>
          {failed && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {t('shell.privacyUpdate.failed')}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button as={Link} to="/privacy" variant="secondary" size="sm">
            {t('shell.privacyUpdate.review')}
          </Button>
          <Button size="sm" onClick={acknowledge} disabled={isSaving}>
            {isSaving ? t('shell.privacyUpdate.saving') : t('shell.privacyUpdate.acknowledge')}
          </Button>
        </div>
      </Container>
    </section>
  )
}
