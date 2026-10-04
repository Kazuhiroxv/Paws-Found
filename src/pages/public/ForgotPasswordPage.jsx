import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, CardBody, Input } from '@/components/ui'
import { userService } from '@/services'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

/**
 * Asking for a password reset.
 *
 * The answer is the same whatever is typed — a real address, an invented one,
 * a suspended account, an address whose mail server is refusing everything.
 * That is the whole point: anything that varies is a way of asking the site
 * which addresses have accounts, one guess at a time.
 *
 * So this page does not branch on the result. It shows one confirmation, and
 * that confirmation is deliberately careful about what it claims.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await userService.forgotPassword(email.trim())
      setSent(true)
    } catch (caught) {
      // Only a rate limit or the server being down reaches here — an unknown
      // address does not, by design.
      setError(caught instanceof Error ? caught : new Error(String(caught)))
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <Card>
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <MailCheck size={40} className="text-brand" aria-hidden="true" />
            <PageHeader
              title={t('auth.register.checkEmail')}
              description={t('auth.forgot.sent')}
            />
            <p className="text-sm text-fg-muted">
              {t('auth.forgot.linkNote')}
            </p>
            <Button as={Link} to="/login" variant="ghost">
              {t('auth.backToSignIn')}
            </Button>
          </CardBody>
        </Card>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Card>
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-5">
            <PageHeader
              title={t('auth.login.forgot')}
              description={t('auth.forgot.description')}
            />

            {error && (
              <p role="alert" className="text-sm text-danger">
                {errorText(error)}
              </p>
            )}

            <Input
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" isLoading={isSubmitting}>
                {isSubmitting ? t('flag.sending') : t('auth.forgot.send')}
              </Button>
              <Button as={Link} to="/login" variant="ghost" disabled={isSubmitting}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </AuthShell>
  )
}
