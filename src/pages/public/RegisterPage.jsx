import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, CardBody, Input, RequiredNote } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { AuthShell } from '@/components/AuthShell'
import { userService } from '@/services'
import { cn } from '@/utils/cn'

/**
 * Create an account.
 *
 * The API hashes the password with bcrypt, rejects an email address that is
 * already taken, and always creates an ordinary user — the role is never sent
 * from here. A successful registration also starts the session, so a new member
 * arrives signed in rather than being asked to type the password again.
 *
 * The API validates every field regardless of what this form checks; the checks
 * here exist to answer faster, not to be the ones that count.
 *
 * @param {Object} props
 * @param {(user: Object) => void} props.onSignedIn
 */
export function RegisterPage({ onSignedIn }) {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    // Starts false and is never pre-ticked. An agreement somebody has to
    // actively give is the only kind worth recording.
    privacyConsent: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  // Keyed by the API's field names, so a 422 marks the right inputs.
  const [fieldErrors, setFieldErrors] = useState({})

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError(null)
    setFieldErrors({})
  }

  const submit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      const user = await userService.register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        privacyConsent: form.privacyConsent,
      })

      onSignedIn(user)
      navigate('/dashboard', { replace: true })
    } catch (caught) {
      const failure = caught instanceof Error ? caught : new Error(String(caught))
      // A 422 or a duplicate email names the fields that failed (see api.js).
      if (failure.fields) setFieldErrors(failure.fields)
      setError(failure)
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <PageHeader
        title="Create an account"
        description="An account lets you file reports, follow possible matches, and receive notifications."
      />

      <Card>
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <RequiredNote className="text-sm text-fg-muted" />

            <Input
              label="Full name"
              autoComplete="name"
              placeholder="e.g. Maria Santos"
              value={form.fullName}
              onChange={(event) => change('fullName', event.target.value)}
              error={fieldErrors.full_name}
              maxLength={120}
              required
              hint="Shown on the reports you file."
            />
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => change('email', event.target.value)}
              error={fieldErrors.email}
              maxLength={190}
              required
            />
            <Input
              label="Phone number"
              type="tel"
              autoComplete="tel"
              placeholder="e.g. +63 917 000 0000"
              value={form.phone}
              onChange={(event) => change('phone', event.target.value)}
              error={fieldErrors.contact_number}
              maxLength={30}
              hint="Optional. Never shown on a report unless you choose to share it."
            />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => change('password', event.target.value)}
              error={fieldErrors.password}
              required
              hint="At least 8 characters."
            />

            {/* The privacy acknowledgement sits immediately above the button
                that creates the account, not in the footer. Somebody should be
                told what is collected before they hand it over, which means
                while they are still looking at the form. */}
            <div
              className={cn(
                'flex flex-col gap-2 rounded-control border p-3',
                fieldErrors.privacy_consent
                  ? 'border-danger/50 bg-danger-soft'
                  : 'border-border bg-sunken/70',
              )}
            >
              <label className="flex cursor-pointer gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.privacyConsent}
                  onChange={(event) => change('privacyConsent', event.target.checked)}
                  aria-describedby="privacy-consent-hint"
                  className="mt-0.5 size-4 shrink-0 accent-brand"
                />
                <span className="text-fg">
                  I have read and understood the{' '}
                  <Link to="/privacy" target="_blank" rel="noreferrer" className="text-brand underline">
                    Paws&amp;Found Privacy Notice
                  </Link>
                  .
                </span>
              </label>

              <p id="privacy-consent-hint" className="pl-7 text-sm text-fg-muted">
                It opens in a new tab, so you will not lose what you have typed. In short: your
                name is shown on the reports you file, your phone number and email are not unless
                you choose to share them, and locations are kept approximate.
              </p>

              {fieldErrors.privacy_consent && (
                <p role="alert" className="pl-7 text-sm text-danger">
                  {fieldErrors.privacy_consent}
                </p>
              )}
            </div>

            {/* Only shown when it says something the marked fields do not. */}
            {error && Object.keys(fieldErrors).length === 0 && (
              <p role="alert" className="text-sm text-danger">
                {error.message}
              </p>
            )}

            {/* Disabled until the box is ticked, so the requirement is visible
                before it is discovered. The API refuses either way. */}
            <Button type="submit" isLoading={isSubmitting} disabled={!form.privacyConsent}>
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>

            <p className="text-sm text-fg-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-fg underline">
                Sign in
              </Link>
              .
            </p>
          </form>
        </CardBody>
      </Card>
    </AuthShell>
  )
}
