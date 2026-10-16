import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Button, Container, Modal } from '@/components/ui'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { userService } from '@/services'
import { Rich } from '@/i18n/Rich'
import { t } from '@/i18n'

const STORAGE_KEY = 'paws:privacy-notice'
const SHORT_VERSION = ['name', 'phone', 'location', 'password', 'activity']
const EMPHASIS = { b: (text) => <strong className="font-medium text-fg">{text}</strong> }

function readAgreed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function rememberAgreed(version) {
  try {
    window.localStorage.setItem(STORAGE_KEY, version)
  } catch {
    // Storage blocked: the guest is asked again next time, which is the safe side.
  }
}

/**
 * The Privacy Notice, agreed to before the site can be used.
 *
 * Everybody who opens Paws&Found is asked once per version of the notice, and
 * cannot use the site until they answer: a modal dialog with no close button,
 * no Escape and no click-outside (Kyle's change, 2026-10-16 — it replaced the
 * Correction 7 message above the page, which could be scrolled past).
 *
 * Who has agreed is decided by:
 *   - a signed-in account: its `privacy_consents` record for the current
 *     version (the server's `privacyNoticeAcknowledged`), written by the
 *     existing POST /auth/privacy-acknowledgement;
 *   - a guest: this browser's own note of the version it agreed to. Nothing
 *     about a guest is sent to the server.
 *
 * On the Privacy Notice page itself the dialog steps aside so the notice can
 * be read, and a bar fixed to the bottom of the screen carries "I agree".
 *
 * @param {Object} props
 * @param {Object|null|undefined} props.user  undefined while the session is still being checked.
 * @param {string|null} props.version  The current notice version, from the server.
 * @param {() => Promise<void>|void} props.onAgreed  Re-reads the session.
 */
export function PrivacyConsentDialog({ user, version, onAgreed }) {
  const { pathname } = useLocation()
  // This browser's note is read on every render (it is external state), and a
  // guest's "I agree" re-renders through this counter.
  const [, setAgreements] = useState(0)
  const agreedHere = readAgreed()
  const [isSaving, setIsSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const barRef = useRef(null)

  const accountAgreed = Boolean(user?.privacyNoticeAcknowledged)

  // An account that has agreed counts for this browser too, so signing out
  // does not ask the same person again.
  useEffect(() => {
    if (version && accountAgreed && readAgreed() !== version) rememberAgreed(version)
  }, [version, accountAgreed])

  // While the "I agree" bar is fixed over the bottom of the Privacy Notice,
  // the page keeps that much room below its last line, so nothing is hidden
  // under the bar.
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return undefined
    const reserve = () => { document.body.style.paddingBottom = `${bar.offsetHeight}px` }
    reserve()
    window.addEventListener('resize', reserve)
    return () => {
      window.removeEventListener('resize', reserve)
      document.body.style.paddingBottom = ''
    }
  })

  // Not known yet: nothing is shown rather than a flash of the dialog.
  if (user === undefined || !version) return null
  const needed = user ? !accountAgreed : agreedHere !== version
  if (!needed) return null

  const agree = async () => {
    setIsSaving(true)
    setFailed(false)
    try {
      if (user) {
        await userService.acknowledgePrivacyNotice()
        await onAgreed?.()
      }
      rememberAgreed(version)
      setAgreements((count) => count + 1)
    } catch {
      setFailed(true)
    } finally {
      setIsSaving(false)
    }
  }

  const agreeButton = (
    <Button onClick={agree} disabled={isSaving} data-privacy-agree="">
      {isSaving ? t('shell.privacyConsent.saving') : t('shell.privacyConsent.agree')}
    </Button>
  )
  const failure = failed && (
    <p role="alert" className="text-sm text-danger">
      {t('shell.privacyConsent.failed')}
    </p>
  )

  if (pathname === '/privacy') {
    return (
      <section
        ref={barRef}
        aria-label={t('shell.privacyConsent.title')}
        data-privacy-reading=""
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel shadow-lg print:hidden"
      >
        <Container className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
          <ShieldCheck size={20} className="shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg">{t('shell.privacyConsent.reading')}</p>
            {failure}
          </div>
          <div className="shrink-0">{agreeButton}</div>
        </Container>
      </section>
    )
  }

  return (
    <Modal
      isOpen
      dismissible={false}
      size="lg"
      title={t('shell.privacyConsent.title')}
      description={t('shell.privacyConsent.description')}
      className="print:hidden"
      footer={
        <>
          <LanguageSwitcher className="mr-auto" />
          <Button as={Link} to="/privacy" variant="secondary">
            {t('shell.privacyConsent.readFull')}
          </Button>
          {agreeButton}
        </>
      }
    >
      <div data-privacy-consent="" className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3 text-sm text-fg-muted">
          {SHORT_VERSION.map((key) => (
            <li key={key} className="flex gap-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              <span>
                <Rich k={`privacy.short.${key}`} tags={EMPHASIS} />
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-fg-muted">{t('shell.privacyConsent.note')}</p>
        {failure}
      </div>
    </Modal>
  )
}
