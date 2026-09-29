import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck, TriangleAlert } from 'lucide-react'
import { Button, Card, CardBody, Input, RequiredNote } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { AuthShell } from '@/components/AuthShell'
import { PasswordChecklist, PasswordField } from '@/components/PasswordField'
import { Turnstile } from '@/components/Turnstile'
import { passwordChecks } from '@/utils/passwordRules'
import { userService } from '@/services'
import { cn } from '@/utils/cn'

/**
 * Create an account.
 *
 * The API hashes the password with bcrypt, rejects an email address that is
 * already taken, and always creates an ordinary user — the role is never sent
 * from here.
 *
 * Registering does NOT sign anybody in any more. The address has not been
 * proved yet, so the account cannot be used, and handing out a session here
 * would be a session that is refused by everything it tried. The form ends on
 * "check your email" instead.
 *
 * The API validates every field regardless of what this form checks; the checks
 * here exist to answer faster, not to be the ones that count.
 */
/**
 * Something@something.something, with no spaces. Deliberately loose: it catches
 * a missing @ or domain as the person types, and the API's stricter check
 * (FILTER_VALIDATE_EMAIL) still decides.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmation: '',
    // Starts false and is never pre-ticked. An agreement somebody has to
    // actively give is the only kind worth recording.
    privacyConsent: false,
  })
  const [captchaToken, setCaptchaToken] = useState(null)
  // Bumped to make the widget draw itself again after a refusal: a Turnstile
  // token is single-use, so the one on screen is spent even though it looks
  // fine, and submitting it twice fails for a reason nobody could guess.
  const [captchaAttempt, setCaptchaAttempt] = useState(0)
  const [sent, setSent] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  // Keyed by the API's field names, so a 422 marks the right inputs.
  const [fieldErrors, setFieldErrors] = useState({})
  // Fields the person has left at least once. Nothing is marked wrong on a
  // fresh form or while the first attempt is still being typed; after a field
  // has been left, it is re-checked as it changes, so a fix clears at once.
  const [touched, setTouched] = useState({})
  const leave = (field) => setTouched((current) => ({ ...current, [field]: true }))

  // The same rules as the API (api/auth.php), said sooner. The API still
  // checks everything, and its answer wins when it arrives.
  const problems = {
    full_name: form.fullName.trim() === '' ? 'Enter your name.' : null,
    email:
      form.email.trim() === ''
        ? 'Enter your email address.'
        : !EMAIL_SHAPE.test(form.email.trim())
          ? 'Enter a valid email address, such as name@example.com.'
          : null,
  }
  const shown = (apiField, field) => fieldErrors[apiField] ?? (touched[field] ? problems[apiField] : null)

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError(null)
    setFieldErrors({})
  }

  const submit = async (event) => {
    event.preventDefault()

    // Submitting counts as leaving every field: anything still wrong is shown,
    // and nothing is sent.
    if (problems.full_name || problems.email) {
      setTouched({ fullName: true, email: true })
      return
    }

    setIsSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      const result = await userService.register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        privacyConsent: form.privacyConsent,
        captchaToken,
      })

      setSent(result)
    } catch (caught) {
      const failure = caught instanceof Error ? caught : new Error(String(caught))
      // A 422 or a duplicate email names the fields that failed (see api.js).
      if (failure.fields) setFieldErrors(failure.fields)
      setError(failure)
      setCaptchaToken(null)
      setCaptchaAttempt((attempt) => attempt + 1)
      setIsSubmitting(false)
    }
  }

  const passwordReady = passwordChecks(form.password, form.confirmation).every((c) => c.met)
  const canSubmit = form.privacyConsent && passwordReady

  // The account exists; as far as the system is concerned the address does not
  // yet belong to anybody. This screen is the whole reason registration no
  // longer ends at a dashboard.
  if (sent) {
    return (
      <AuthShell>
        <Card>
          <CardBody className="flex flex-col items-center gap-4 text-center">
            {sent.emailSent ? (
              <MailCheck size={40} className="text-brand" aria-hidden="true" />
            ) : (
              <TriangleAlert size={40} className="text-lost" aria-hidden="true" />
            )}
            <PageHeader
              title={sent.emailSent ? 'Check your email' : 'Account created — but the email did not send'}
              description={
                sent.emailSent
                  ? `We sent a link to ${sent.email}. Follow it and your account is ready.`
                  : 'Your account exists and nothing was lost. The message could not be delivered just now, so ask for it again in a moment.'
              }
            />
            <p className="text-sm text-fg-muted">
              The link works once and expires in a day. If nothing arrives, check the spam
              folder before asking for another.
            </p>
            <ResendVerification email={form.email.trim()} />
            <Button as={Link} to="/login" variant="ghost">
              Back to sign in
            </Button>
          </CardBody>
        </Card>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <PageHeader
        title="Create an account"
        description="An account lets you file reports, follow possible matches, and receive notifications."
      />

      <Card>
        <CardBody>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <RequiredNote className="text-sm text-fg-muted" />

            <Input
              label="Full name"
              autoComplete="name"
              placeholder="e.g. Maria Santos"
              value={form.fullName}
              onChange={(event) => change('fullName', event.target.value)}
              onBlur={() => leave('fullName')}
              error={shown('full_name', 'fullName')}
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
              onBlur={() => leave('email')}
              error={shown('email', 'email')}
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
            <PasswordField
              label="Password"
              value={form.password}
              onChange={(event) => change('password', event.target.value)}
              error={fieldErrors.password}
              required
            />
            <PasswordField
              label="Type it again"
              value={form.confirmation}
              onChange={(event) => change('confirmation', event.target.value)}
              required
            />
            <PasswordChecklist password={form.password} confirmation={form.confirmation} />

            <Turnstile onToken={setCaptchaToken} attempt={captchaAttempt} />

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
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" isLoading={isSubmitting} disabled={!canSubmit}>
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
              {/* A marked way out. Somebody who arrived here and changed
                  their mind had only the browser's Back button, which is the
                  first thing a cautious person looks for and does not find. */}
              <Button as={Link} to="/" variant="ghost" disabled={isSubmitting}>
                Cancel
              </Button>
            </div>

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

/**
 * Ask for the verification email again.
 *
 * The answer never varies, so there is nothing to branch on — the same
 * sentence comes back whether the address has an unverified account, a
 * verified one, or no account at all. Used here and on the sign-in page, which
 * reaches the same dead end from the other direction.
 */
export function ResendVerification({ email }) {
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('')

  const send = async () => {
    setState('sending')

    try {
      setMessage(await userService.resendVerification(email))
    } catch (caught) {
      // A rate limit is the likely one, and its message is worth showing.
      setMessage(caught instanceof Error ? caught.message : String(caught))
    }

    setState('sent')
  }

  if (state === 'sent') {
    return (
      <p role="status" className="text-sm text-fg-muted">
        {message}
      </p>
    )
  }

  return (
    <Button onClick={send} isLoading={state === 'sending'} disabled={!email}>
      {state === 'sending' ? 'Sending…' : 'Send the link again'}
    </Button>
  )
}
