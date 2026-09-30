import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Lock, ShieldAlert } from 'lucide-react'
import { Button, Card, CardBody, Input, RequiredNote } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { AuthShell } from '@/components/AuthShell'
import { ResendVerification } from '@/pages/public/RegisterPage'
import { PROJECT_ADMINISTRATOR_NAME, PROJECT_CONTACT_EMAIL, ROLES, ROLE_LABELS } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { userService } from '@/services'
import { destinationAfterSignIn } from '@/constants/navigation'

const loadDemoAccounts = () => userService.getDemoAccounts()

/**
 * How many attempts the API allows before locking an account
 * (`MAX_LOGIN_ATTEMPTS` in api/config.php).
 *
 * Repeated here only to draw the pips below. The server is what counts and
 * what locks; if the two ever disagree, the server is right and this is a
 * cosmetic bug.
 */
const MAX_ATTEMPTS = 3

/**
 * Sign in.
 *
 * The form posts to the API, which verifies the password against the bcrypt
 * hash in the database and starts a PHP session. This component never sees a
 * password again after it is sent, and never decides what the account may do —
 * it only remembers who signed in so the interface can follow.
 *
 * The development panel below stays for the demonstration: it signs in as one
 * of the seeded accounts without needing their passwords typed out.
 *
 * @param {Object} props
 * @param {(user: Object) => void} props.onSignedIn
 * @param {(role: string) => Promise<void>} props.onDemoSignIn
 */
export function LoginPage({ onSignedIn, onDemoSignIn }) {
  const navigate = useNavigate()
  const location = useLocation()
  // Defined at module scope, so its identity is already stable.
  const { data: accounts } = useAsync(loadDemoAccounts)

  const [form, setForm] = useState({ email: '', password: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Where the guard bounced them from, so they land back there after signing in.
  const returnTo = location.state?.from

  // Once the account is locked there is nothing to try, so the form stops
  // offering. Clearing this needs an administrator, not a retype — which is
  // why editing the fields below does not bring the button back.
  const isLocked = Boolean(error?.payload?.locked)
  // A refusal the person can act on, unlike a wrong password: the account is
  // real and the password was right, the address simply has not been proved.
  const needsVerification = error?.payload?.code === 'verification_required'

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (!isLocked) setError(null)
  }

  /** Send whoever just signed in to where they were going, if their role may go there. */
  const goToWorkspace = (user) => {
    onSignedIn(user)
    navigate(destinationAfterSignIn(user.role, returnTo), {
      replace: true,
      state: user.previousSessionsEnded ? { sessionNotice: true } : undefined,
    })
  }

  const submit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      goToWorkspace(await userService.signIn(form.email.trim(), form.password))
    } catch (caught) {
      // The API answers "that email address and password do not match" for both
      // an unknown account and a wrong password, and that wording is shown as
      // it stands — narrowing it down would confirm which addresses exist.
      setError(caught instanceof Error ? caught : new Error(String(caught)))
      setIsSubmitting(false)
    }
  }

  const signInAs = async (role) => {
    await onDemoSignIn(role)
    navigate(destinationAfterSignIn(role, returnTo), { replace: true })
  }

  return (
    <AuthShell>
      <PageHeader title="Sign in" description="Access your reports, matches and notifications." />

      {returnTo && (
        <p className="rounded-control border border-border bg-accent-soft px-3 py-2 text-sm text-fg">
          Please sign in to continue.
        </p>
      )}

      <Card>
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <RequiredNote className="text-sm text-fg-muted" />

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => change('email', event.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => change('password', event.target.value)}
              required
            />

            <SignInProblem error={error} />

            <div className="flex flex-wrap items-center gap-3">
              {needsVerification && (
                <div className="flex flex-col gap-2 rounded-control border border-border bg-sunken/70 p-3">
                  <p className="text-sm font-medium text-fg">Email not verified</p>
                  <p className="text-sm text-fg-muted">
                    Follow the link we sent when you registered. If it has expired or never
                    arrived, ask for another.
                  </p>
                  <div className="self-start">
                    <ResendVerification email={form.email.trim()} />
                  </div>
                </div>
              )}

              <p className="-mt-1 text-sm">
                <Link to="/forgot-password" className="text-brand hover:underline">
                  Forgot your password?
                </Link>
              </p>

              <Button type="submit" isLoading={isSubmitting} disabled={isLocked}>
                {isLocked ? 'Account locked' : isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
              {/* A marked way out. Somebody who arrived here and changed
                  their mind had only the browser's Back button, which is the
                  first thing a cautious person looks for and does not find. */}
              <Button as={Link} to="/" variant="ghost" disabled={isSubmitting}>
                Cancel
              </Button>
            </div>

            <p className="text-sm text-fg-muted">
              No account yet?{' '}
              <Link to="/register" className="text-brand underline">
                Create one
              </Link>
              .
            </p>
          </form>
        </CardBody>
      </Card>

      {/* Development scaffolding. Removed from the production bundle rather
          than hidden: these buttons sign in without a password, which must not
          reach a deployed site. */}
      {import.meta.env.DEV && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div>
              <h2 className="font-semibold text-fg">Development sign-in</h2>
              <p className="text-sm text-fg-muted">
                A shortcut for the demonstration. These sign in as the seeded accounts, so you
                can see what each kind of user is allowed to do without typing their passwords.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {Object.values(ROLES).map((role) => (
                <Button
                  key={role}
                  variant="secondary"
                  fullWidth
                  onClick={() => signInAs(role)}
                  className="justify-between"
                >
                  <span>{accounts?.[role]?.fullName ?? ROLE_LABELS[role]}</span>
                  <span className="text-fg-muted">{ROLE_LABELS[role]}</span>
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </AuthShell>
  )
}

/**
 * What went wrong, at the weight it deserves.
 *
 * Three different things can come back from a failed sign-in, and flattening
 * them into one red line was how somebody could fail twice without ever
 * noticing they were running out of attempts:
 *
 *   * an ordinary failure, with attempts left — the count is said in words and
 *     drawn as pips, because a number in a sentence is easy to skim past;
 *   * the account now locked — a different shape entirely, with what to do
 *     next, because retyping the password will not help;
 *   * the account suspended — not the same thing as locked: an administrator
 *     decided it, so the way back is to ask them, not to wait for an unlock;
 *   * anything else, such as the server being unreachable.
 *
 * The pips are never the only signal: the sentence above them says the same
 * thing, so this does not depend on seeing colour.
 */
function SignInProblem({ error }) {
  if (!error) return null

  const locked = Boolean(error.payload?.locked)
  const suspended = error.payload?.code === 'account_suspended'
  const remaining = error.payload?.attempts_remaining

  if (suspended) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-control border border-danger/40 bg-danger-soft p-3"
      >
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-danger-hover" aria-hidden="true" />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-danger-hover">Your account has been suspended.</p>
          <p className="text-fg">
            If you believe this was a mistake or need help restoring access, contact the
            Paws&amp;Found Administrator.
          </p>
          <AdministratorContact subject="Suspended Paws&Found account" />
        </div>
      </div>
    )
  }

  if (locked) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-control border border-danger/40 bg-danger-soft p-3"
      >
        <Lock size={18} className="mt-0.5 shrink-0 text-danger-hover" aria-hidden="true" />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-danger-hover">Your account is locked.</p>
          <p className="text-fg">
            It was locked after {MAX_ATTEMPTS} failed sign-in attempts in a row. An administrator
            must unlock it before you can sign in again; resetting the password does not unlock
            it.
          </p>
          <AdministratorContact subject="Locked Paws&Found account" />
        </div>
      </div>
    )
  }

  if (typeof remaining === 'number') {
    const used = MAX_ATTEMPTS - remaining

    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-control border border-accent/40 bg-accent-soft p-3"
      >
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-lost" aria-hidden="true" />
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-fg">{error.message}</p>

          <p className="flex items-center gap-2 text-fg-muted">
            <span>
              Attempt {used} of {MAX_ATTEMPTS}
            </span>
            <span className="flex gap-1" aria-hidden="true">
              {Array.from({ length: MAX_ATTEMPTS }, (_, index) => (
                <span
                  key={index}
                  className={
                    index < used
                      ? 'size-2 rounded-full bg-danger'
                      : 'size-2 rounded-full border border-border-strong'
                  }
                />
              ))}
            </span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <p role="alert" className="text-sm text-danger">
      {error.message}
    </p>
  )
}

/**
 * Who can restore the account, and a way to reach them that works: the
 * Administrator's name with the Project Team's published address, because the
 * seeded Administrator's own sign-in address is demo data that reaches nobody.
 * And a way out, so a locked-out person is not left facing the form.
 */
function AdministratorContact({ subject }) {
  const mailto = `mailto:${PROJECT_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`

  return (
    <div className="mt-1 flex flex-col gap-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        <dt className="text-fg-muted">Administrator</dt>
        <dd className="font-medium text-fg">{PROJECT_ADMINISTRATOR_NAME}</dd>
        <dt className="text-fg-muted">Contact</dt>
        <dd>
          <a href={mailto} className="font-medium break-all text-brand hover:underline">
            {PROJECT_CONTACT_EMAIL}
          </a>
        </dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button as="a" href={mailto} size="sm">
          Contact administrator
        </Button>
        <Button as={Link} to="/explore" variant="secondary" size="sm">
          Continue browsing
        </Button>
      </div>
    </div>
  )
}
