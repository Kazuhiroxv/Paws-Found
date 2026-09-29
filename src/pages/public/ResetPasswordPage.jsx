import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, CardBody } from '@/components/ui'
import { PasswordChecklist, PasswordField } from '@/components/PasswordField'
import { passwordChecks } from '@/utils/passwordRules'
import { userService } from '@/services'

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

  const ready = passwordChecks(password, confirmation).every((check) => check.met)

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
      if (failure.fields?.password) setPasswordError(failure.fields.password)
      else setError(failure)
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthShell>
        <Card>
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <PageHeader
              title="This page needs your link"
              description="Open it from the email we sent, so it arrives with the one-time code attached."
            />
            <Button as={Link} to="/forgot-password">
              Ask for a new link
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
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <CircleCheck size={40} className="text-success" aria-hidden="true" />
            <PageHeader
              title="Password changed"
              description="You can sign in with it now."
            />
            {/* Said plainly, because it is surprising if it is not: anywhere
                still signed in as this account has been signed out. */}
            <p className="text-sm text-fg-muted">
              Any other device signed in to this account has been signed out.
            </p>
            <Button onClick={() => navigate('/login')}>Sign in</Button>
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
            <PageHeader title="Set a new password" />

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error.message}
              </p>
            )}

            <PasswordField
              label="New password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordError(null)
              }}
              error={passwordError}
              autoComplete="new-password"
              required
            />

            <PasswordField
              label="Type it again"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
            />

            <PasswordChecklist password={password} confirmation={confirmation} />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" isLoading={isSubmitting} disabled={!ready}>
                {isSubmitting ? 'Saving…' : 'Save the new password'}
              </Button>
              <Button as={Link} to="/login" variant="ghost" disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </AuthShell>
  )
}
