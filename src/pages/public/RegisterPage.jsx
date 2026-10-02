import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck, TriangleAlert } from 'lucide-react'
import { Button, Card, CardBody, Input, RequiredNote } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { AuthShell } from '@/components/AuthShell'
import {
  ConfirmPasswordField,
  PasswordChecklist,
  PasswordField,
  PasswordStrength,
} from '@/components/PasswordField'
import { Turnstile } from '@/components/Turnstile'
import { passwordChecks, passwordRequirementsMet } from '@/utils/passwordRules'
import { cleanName, nameProblem } from '@/utils/nameRules'
import { userService } from '@/services'
import { cn } from '@/utils/cn'
import { reveal, useRevealWhen } from '@/utils/reveal'

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

/** Who is choosing the password, for the name and email rules. */
const identityOf = (form) => ({ email: form.email, firstName: form.firstName, lastName: form.lastName })

export function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
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

  // Every refused submit bumps this, and the effect below takes the person to
  // whatever refused it: the first marked field, or the message if none is.
  const formRef = useRef(null)
  const [refusals, setRefusals] = useState(0)
  useEffect(() => {
    if (refusals) reveal(formRef.current?.querySelector('[aria-invalid="true"], [data-reveal="error"]'))
  }, [refusals])

  // The same rules as the API (api/auth.php), said sooner. The API still
  // checks everything, and its answer wins when it arrives.
  const problems = {
    first_name: nameProblem(form.firstName, 'first'),
    last_name: nameProblem(form.lastName, 'last'),
    email:
      form.email.trim() === ''
        ? 'Enter your email address.'
        : !EMAIL_SHAPE.test(form.email.trim())
          ? 'Enter a valid email address, such as name@example.com.'
          : null,
  }
  const shown = (apiField, field) => fieldErrors[apiField] ?? (touched[field] ? problems[apiField] : null)

  const change = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value }
      // A confirmation is only kept for a password that is still acceptable.
      // Changing the password, or a name it now contains, hides the second
      // box again and empties it, so a stale match can never carry over.
      if (!passwordRequirementsMet(next.password, { identity: identityOf(next) })) next.confirmation = ''
      return next
    })
    setError(null)
    setFieldErrors({})
  }

  const submit = async (event) => {
    event.preventDefault()

    // Submitting counts as leaving every field: anything still wrong is shown,
    // and nothing is sent.
    if (problems.first_name || problems.last_name || problems.email) {
      setTouched({ firstName: true, lastName: true, email: true })
      setRefusals((count) => count + 1)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      const result = await userService.register({
        firstName: cleanName(form.firstName),
        lastName: cleanName(form.lastName),
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
      setRefusals((count) => count + 1)
    }
  }

  // Who is choosing: the password may not be their email address, nor contain
  // their first or last name anywhere.
  const identity = identityOf(form)
  // Every requirement but the match. The Confirm box appears only once this is
  // true (instructor requirement).
  const requirementsMet = passwordRequirementsMet(form.password, { identity })
  const passwordReady = passwordChecks(form.password, form.confirmation, { identity }).every((c) => c.met)
  // Every requirement, not the strength label: Fair is accepted.
  const canSubmit =
    form.privacyConsent && passwordReady && !problems.first_name && !problems.last_name && !problems.email

  // The confirmation replaces the form, which can leave the window scrolled to
  // where the button was. Taken to it, with focus, so the result is seen.
  const sentRef = useRevealWhen(sent)

  // The account exists; as far as the system is concerned the address does not
  // yet belong to anybody. This screen is the whole reason registration no
  // longer ends at a dashboard.
  if (sent) {
    return (
      <AuthShell>
        <Card>
          <CardBody
            ref={sentRef}
            tabIndex={-1}
            className="flex scroll-mt-24 flex-col items-center gap-4 text-center outline-none"
          >
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
          <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
            <RequiredNote className="text-sm text-fg-muted" />

            {/* Two fields since the post-defense corrections (migration 008).
                Side by side where there is room, one above the other on a
                phone. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                autoComplete="given-name"
                placeholder="e.g. Maria"
                value={form.firstName}
                onChange={(event) => change('firstName', event.target.value)}
                onBlur={() => leave('firstName')}
                error={shown('first_name', 'firstName')}
                maxLength={60}
                required
              />
              <Input
                label="Last name"
                autoComplete="family-name"
                placeholder="e.g. Dela Cruz"
                value={form.lastName}
                onChange={(event) => change('lastName', event.target.value)}
                onBlur={() => leave('lastName')}
                error={shown('last_name', 'lastName')}
                maxLength={60}
                required
              />
            </div>
            <p className="-mt-2 text-sm text-fg-muted">
              Shown on the reports you file. Letters, spaces, apostrophes, hyphens and periods.
            </p>
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
            <PasswordChecklist
              password={form.password}
              confirmation={form.confirmation}
              confirm={requirementsMet}
              identity={identity}
            />
            <PasswordStrength password={form.password} identity={identity} />
            <ConfirmPasswordField
              ready={requirementsMet}
              value={form.confirmation}
              onChange={(event) => change('confirmation', event.target.value)}
            />

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
              <p
                role="alert"
                data-reveal="error"
                tabIndex={-1}
                className="scroll-mt-24 text-sm text-danger outline-none"
              >
                {error.message}
              </p>
            )}

            {/* Disabled until the name, the address, every password
                requirement and the box are all satisfied, so what is missing
                is visible before it is discovered. The API refuses either way. */}
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
