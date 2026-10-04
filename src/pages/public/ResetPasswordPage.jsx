import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, CardBody } from '@/components/ui'
import {
  ConfirmPasswordField,
  PasswordChecklist,
  PasswordField,
  PasswordStrength,
} from '@/components/PasswordField'
import { passwordChecks, passwordRequirementsMet } from '@/utils/passwordRules'
import { reveal, useRevealWhen } from '@/utils/reveal'
import { userService } from '@/services'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

/**
 * Setting a new password from an emailed link.
 *
 * The button is disabled until the checklist is satisfied, so the requirements
 * are visible before the form is submitted rather than discovered by being
 * refused. The server checks the same rule regardless — this is a courtesy,
 * not the control.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  // A refusal about the password itself, shown on the field. The one the
  // server alone can know: the new password is the one the account has.
  const [passwordError, setPasswordError] = useState(null)
  const [done, setDone] = useState(false)

  // The Confirm box appears once the password meets every requirement the form
  // can check (instructor requirement). The name rule is the server's alone
  // here — the link does not say whose account it is — so a refusal from it
  // counts as unmet too, and hides the box until the password changes.
  const requirementsMet = passwordRequirementsMet(password) && !passwordError
  const ready = requirementsMet && passwordChecks(password, confirmation).every((check) => check.met)

  // Whatever answers a submit is brought into view and focused (see reveal.js).
  const formRef = useRef(null)
  const [refusals, setRefusals] = useState(0)
  useEffect(() => {
    if (refusals) reveal(formRef.current?.querySelector('[aria-invalid="true"], [data-reveal="error"]'))
  }, [refusals])
  const doneRef = useRevealWhen(done)

  const changePassword = (value) => {
    setPassword(value)
    setPasswordError(null)
    // A confirmation is only kept for a password that is still acceptable.
    if (!passwordRequirementsMet(value)) setConfirmation('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setPasswordError(null)

    try {
      await userService.resetPassword(token, password)
      setDone(true)
    } catch (caught) {
      const failure = caught instanceof Error ? caught : new Error(String(caught))
      if (failure.fields?.password) {
        setPasswordError(failure.fields.password)
        setConfirmation('')
      } else {
        setError(failure)
      }
      setIsSubmitting(false)
      setRefusals((count) => count + 1)
    }
  }

  if (!token) {
    return (
      <AuthShell>
        <Card>
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <PageHeader
              title={t('auth.reset.needsLink')}
              description={t('auth.reset.needsLinkBody')}
            />
            <Button as={Link} to="/forgot-password">
              {t('auth.reset.newLink')}
            </Button>
          </CardBody>
        </Card>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell>
        <Card>
          <CardBody
            ref={doneRef}
            tabIndex={-1}
            className="flex scroll-mt-24 flex-col items-center gap-4 text-center outline-none"
          >
            <CircleCheck size={40} className="text-success" aria-hidden="true" />
            <PageHeader
              title={t('auth.reset.done')}
              description={t('auth.reset.doneBody')}
            />
            {/* Said plainly, because it is surprising if it is not: anywhere
                still signed in as this account has been signed out. */}
            <p className="text-sm text-fg-muted">
              {t('auth.reset.others')}
            </p>
            <Button onClick={() => navigate('/login')}>{t('auth.login.title')}</Button>
          </CardBody>
        </Card>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Card>
        <CardBody>
          <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
            <PageHeader title={t('auth.reset.title')} />

            {error && (
              <p
                role="alert"
                data-reveal="error"
                tabIndex={-1}
                className="scroll-mt-24 text-sm text-danger outline-none"
              >
                {errorText(error)}
              </p>
            )}

            <PasswordField
              label={t('auth.reset.newPassword')}
              value={password}
              onChange={(event) => changePassword(event.target.value)}
              error={passwordError}
              autoComplete="new-password"
              required
            />

            {/* Not "not your name or email" here: the link does not say whose
                account it is. The server checks it and says so on the field. */}
            <PasswordChecklist password={password} confirmation={confirmation} confirm={requirementsMet} />
            <PasswordStrength password={password} />
            <ConfirmPasswordField
              ready={requirementsMet}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" isLoading={isSubmitting} disabled={!ready}>
                {isSubmitting ? t('common.saving') : t('auth.reset.save')}
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
