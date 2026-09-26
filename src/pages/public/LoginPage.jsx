import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Lock, ShieldAlert } from 'lucide-react'
import { Button, Card, CardBody, Input, RequiredNote } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { AuthShell } from '@/components/AuthShell'
import { ROLES, ROLE_LABELS } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { userService } from '@/services'
import { WORKSPACE_BY_ROLE } from '@/constants/navigation'

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

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (!isLocked) setError(null)
  }

  /** Send whoever just signed in to where they were going. */
  const goToWorkspace = (user) => {
    onSignedIn(user)
    navigate(returnTo ?? WORKSPACE_BY_ROLE[user.role].to, { replace: true })
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
    navigate(returnTo ?? WORKSPACE_BY_ROLE[role].to, { replace: true })
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

            <Button type="submit" isLoading={isSubmitting} disabled={isLocked}>
              {isLocked ? 'Account locked' : isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>

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
 *   * anything else, such as the server being unreachable.
 *
 * The pips are never the only signal: the sentence above them says the same
 * thing, so this does not depend on seeing colour.
 */
function SignInProblem({ error }) {
  if (!error) return null

  const locked = Boolean(error.payload?.locked)
  const remaining = error.payload?.attempts_remaining

  if (locked) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-control border border-danger/40 bg-danger-soft p-3"
      >
        <Lock size={18} className="mt-0.5 shrink-0 text-danger-hover" aria-hidden="true" />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-danger-hover">This account is locked</p>
          <p className="text-fg">{error.message}</p>
          <p className="text-fg-muted">
            An administrator unlocks it from the Users page. Nothing you type here will open it
            until they do.
          </p>
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
