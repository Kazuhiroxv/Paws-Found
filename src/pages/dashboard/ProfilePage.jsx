import { useEffect, useRef, useState } from 'react'
import {
  Check, KeyRound, Lock, MailCheck, MailWarning, MapPin, Pencil, ShieldCheck, UserRound,
} from 'lucide-react'
import {
  Button, Card, CardBody, CardHeader, Checkbox, Input, LoadingSkeleton, RequiredNote,
} from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ROLE_LABELS } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { userService } from '@/services'
import { cleanName, nameProblem } from '@/utils/nameRules'
import { reveal } from '@/utils/reveal'

const loadCurrentUser = () => userService.getCurrentUser()

const header = (
  <PageHeader
    title="Profile"
    description="Your contact details, what you want to be told about, and your password."
    breadcrumb={[{ label: 'My dashboard', to: '/dashboard' }, { label: 'Profile' }]}
  />
)

/** The API's field names → this form's, so a rejected field is marked where it is. */
const API_FIELDS = {
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  contact_number: 'phone',
  preferred_location: 'preferredLocation',
}

/** The three switches, as the rows they are shown in. */
const PREFERENCES = [
  {
    field: 'possibleMatches',
    label: 'Possible matches',
    hint: 'When a report is filed that could be the same pet.',
  },
  {
    field: 'statusUpdates',
    label: 'Status updates',
    hint: 'When one of your reports changes status.',
  },
  {
    field: 'staffMessages',
    label: 'Messages from a Pet Coordinator',
    // What notify_staff actually gates: a coordinator asking for more
    // information. Their decisions arrive as status updates.
    hint: 'When a Pet Coordinator asks you for more information about a pairing.',
  },
]

/**
 * Your own details and notification preferences.
 *
 * Loads the account, then hands it to the form. The form initialises its own
 * state from the prop, so there is no effect copying loaded data into state —
 * `key={user.id}` is what resets it if the account ever changes.
 */
export function ProfilePage() {
  const { data: user, isLoading, error, reload } = useAsync(loadCurrentUser)

  // Only on the first load. After a save the account is fetched again; if
  // that showed the skeleton too, it replaced the form and threw away its
  // "Profile saved" confirmation the moment it appeared.
  if (isLoading && !user) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingSkeleton lines={6} />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p role="alert" className="text-sm text-danger">
          Your profile could not be loaded{error ? `: ${error.message}` : '.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ProfileForm key={user.id} user={user} onSaved={reload} />
      <AccountSecurity email={user.email} />
    </div>
  )
}

/**
 * Account & security: a password reset for somebody who is already signed in.
 *
 * Not a new password flow. It asks for exactly what "Forgot your password?"
 * asks for — the same endpoint, the same one-hour link, the same rate limit,
 * the same generic answer — sent to the verified address on this account. The
 * reset itself happens on the page that link opens, and it bumps the account's
 * session_version, which signs out every session including this one. The copy
 * says so before anybody presses anything.
 *
 * Outside the profile form on purpose: that form is a disabled fieldset until
 * "Edit profile" is pressed, and this should work without entering edit mode.
 */
function AccountSecurity({ email }) {
  const [state, setState] = useState('idle') // idle | sending | sent
  const [error, setError] = useState(null)

  const sendLink = async () => {
    setState('sending')
    setError(null)

    try {
      await userService.forgotPassword(email)
      setState('sent')
    } catch (caught) {
      // A rate limit (three an hour) or the server being unreachable. The
      // server's own sentence says which, and when to try again.
      setError(caught instanceof Error ? caught : new Error(String(caught)))
      setState('idle')
    }
  }

  return (
    <Card>
      <CardHeader titleAs="h2" title="Account & security" />
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
            <KeyRound size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-fg">Reset password</h3>
            <p className="mt-1 max-w-prose text-sm text-fg-muted">
              We&apos;ll send a reset link to your verified email. Completing the reset will
              sign you out on all devices.
            </p>

            {state === 'sent' && (
              <p role="status" className="mt-3 flex items-start gap-2 text-sm text-success-ink">
                <MailCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Check <strong className="font-medium">{email}</strong> for the link. It works
                  once and expires in an hour; asking again replaces it.
                </span>
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                The reset link could not be requested: {error.message}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={sendLink}
          isLoading={state === 'sending'}
          className="w-full shrink-0 sm:w-auto"
        >
          {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Send again' : 'Send reset link'}
        </Button>
      </CardBody>
    </Card>
  )
}

/** The form's fields, as the account currently has them on the server. */
function formFrom(user) {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    preferredLocation: user.preferredLocation,
    ...user.notificationPreferences,
  }
}

/** How the API compares addresses (normalise_email in api/auth.php). */
const sameEmail = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

function ProfileForm({ user, onSaved }) {
  const [form, setForm] = useState(() => formFrom(user))
  const [isSaving, setIsSaving] = useState(false)
  // What the last save did: null, { emailTo: null } for an ordinary save, or
  // { emailTo, emailSent } when it asked for a new address.
  const [saved, setSaved] = useState(null)
  const [saveError, setSaveError] = useState(null)
  // The name rule (the same one registration uses), shown once a field has
  // been left or a save was tried. The server checks it again either way.
  const [nameTouched, setNameTouched] = useState(false)
  const firstNameError = nameProblem(form.firstName, 'first')
  const lastNameError = nameProblem(form.lastName, 'last')

  // A refused save takes the person to the first field that refused it: the
  // name fields are at the top, far above the Save button (see reveal.js).
  const formRef = useRef(null)
  const [refusals, setRefusals] = useState(0)
  useEffect(() => {
    if (refusals) reveal(formRef.current?.querySelector('[aria-invalid="true"], [data-reveal="error"]'))
  }, [refusals])
  // Reading is the default state. The form used to be permanently open, so a
  // stray keystroke on a real account field was a real change waiting for a
  // Save nobody meant to press.
  const [isEditing, setIsEditing] = useState(false)

  /** Throw away anything typed and go back to reading. */
  const cancel = () => {
    setForm(formFrom(user))
    setSaveError(null)
    setSaved(null)
    setNameTouched(false)
    setIsEditing(false)
  }

  // The server's own per-field messages, placed under the fields they name.
  const fieldErrors = Object.fromEntries(
    Object.entries(saveError?.fields ?? {}).map(([name, message]) => [API_FIELDS[name] ?? name, message]),
  )

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setSaved(null)
  }

  const save = async (event) => {
    event.preventDefault()
    if (firstNameError || lastNameError) {
      setNameTouched(true)
      setRefusals((count) => count + 1)
      return
    }
    setIsSaving(true)
    setSaveError(null)

    const email = form.email.trim()
    const emailChanged = !sameEmail(email, user.email)

    try {
      const updated = await userService.updateUser(user.id, {
        firstName: cleanName(form.firstName),
        lastName: cleanName(form.lastName),
        email,
        phone: form.phone.trim(),
        preferredLocation: form.preferredLocation.trim(),
        notificationPreferences: {
          possibleMatches: form.possibleMatches,
          statusUpdates: form.statusUpdates,
          staffMessages: form.staffMessages,
        },
      })
      // Back to what the server now holds. A new address is only pending, so
      // the field shows the verified one again; it used to keep the typed
      // address, which read as though the change had already happened, and a
      // later save of anything else sent the verification link again.
      setForm(formFrom(updated))
      setSaved(emailChanged ? { emailTo: email, emailSent: updated.emailChangeSent !== false } : { emailTo: null })
      setIsEditing(false)
      onSaved()
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught : new Error(String(caught)))
      setRefusals((count) => count + 1)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={save} className="flex flex-col gap-6">
      {header}

      {/* One disabled fieldset rather than a second, read-only copy of every
          field. The browser makes every control inside it non-interactive and
          skips it in the tab order, which is exactly what view mode means —
          and it cannot drift from the editable version the way a duplicate
          layout would. */}
      <fieldset disabled={!isEditing} className="flex flex-col gap-6 border-0 p-0">
        {isEditing && <RequiredNote className="-mt-2 text-sm text-fg-muted" />}

      <Card>
        <CardHeader
          titleAs="h2"
          title="Your details"
          // Read-only, and shaped like it: a badge in the header rather than a
          // line among fields that can all be edited.
          action={
            // fg, not fg-muted: muted ink on surface-muted fails contrast.
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-muted px-3 py-1 text-sm text-fg">
              <ShieldCheck size={14} className="text-fg-muted" aria-hidden="true" />
              Account type
              <span className="font-semibold">{ROLE_LABELS[user.role]}</span>
            </span>
          }
        />

        <CardBody className="flex flex-col gap-7">
          <FieldGroup icon={UserRound} title="Personal information">
            {/* Two fields since the post-defense corrections (migration 008).
                The database joins them into the name shown everywhere else. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(event) => change('firstName', event.target.value)}
                onBlur={() => setNameTouched(true)}
                maxLength={60}
                required
                error={fieldErrors.firstName ?? (nameTouched ? firstNameError : undefined)}
              />
              <Input
                label="Last name"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(event) => change('lastName', event.target.value)}
                onBlur={() => setNameTouched(true)}
                maxLength={60}
                required
                error={fieldErrors.lastName ?? (nameTouched ? lastNameError : undefined)}
              />
            </div>
            <p className="-mt-2 text-sm text-fg-muted">Shown on the reports you file.</p>

            <div className="flex flex-col gap-2">
              <Input
                label="Preferred location"
                value={form.preferredLocation}
                onChange={(event) => change('preferredLocation', event.target.value)}
                maxLength={80}
                placeholder="e.g. Makati City, Metro Manila"
                error={fieldErrors.preferredLocation}
              />
              <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
                <MapPin size={15} className="shrink-0 text-brand" aria-hidden="true" />
                Private. Where you usually are — only you and Pet Coordinators can see it.
              </p>
            </div>
          </FieldGroup>

          <FieldGroup icon={Lock} title="Contact information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Email address"
                type="email"
                value={form.email}
                onChange={(event) => change('email', event.target.value)}
                required
                hint={user.pendingEmail ? 'Your current, verified sign-in email.' : undefined}
                error={fieldErrors.email}
              />
              <Input
                label="Phone number"
                type="tel"
                value={form.phone}
                onChange={(event) => change('phone', event.target.value)}
                error={fieldErrors.phone}
              />
            </div>

            {/* A change that has been asked for and not yet proved. The account
                keeps its verified address, for signing in and for password
                resets, until somebody follows the link sent to the new one. */}
            {user.pendingEmail && <PendingEmail current={user.email} pending={user.pendingEmail} />}

            {/* fg, not fg-muted: on brand-soft the muted ink is 4.14:1. */}
            <p className="flex items-start gap-2 rounded-control border border-brand/20 bg-brand-soft px-3 py-2.5 text-sm text-fg">
              <Lock size={15} className="mt-0.5 shrink-0 text-brand-hover" aria-hidden="true" />
              Your email and phone number are only shown on a report if you choose to share
              them, and you choose that separately for each report.
            </p>
          </FieldGroup>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titleAs="h2"
          title="Notifications"
          subtitle="Which updates appear in your notifications."
        />
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {PREFERENCES.map((pref) => (
              // One setting per row: its name, what it covers, and the box.
              <li key={pref.field}>
                <Checkbox
                  label={<span className="font-medium">{pref.label}</span>}
                  hint={pref.hint}
                  checked={form[pref.field]}
                  onChange={(event) => change(pref.field, event.target.checked)}
                  className="px-5 py-3.5"
                />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      </fieldset>

      {/* The action bar: separated from the last card, with the outcome of
          the last save beside the button. */}
      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
        {isEditing ? (
          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={cancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
            <Pencil size={16} aria-hidden="true" />
            Edit profile
          </Button>
        )}

        {saved && (saved.emailTo && !saved.emailSent ? (
          <p role="alert" className="text-sm text-danger">
            Profile saved, but the verification email to <strong className="font-medium">{saved.emailTo}</strong> could
            not be sent. Enter the new address again and save to retry.
          </p>
        ) : (
          <p role="status" className="flex items-center gap-1 text-sm text-success-ink">
            <Check size={16} aria-hidden="true" />
            {saved.emailTo ? 'Profile saved. Your new email is awaiting verification.' : 'Profile saved'}
          </p>
        ))}
        {saveError && (
          <p
            role="alert"
            data-reveal="error"
            tabIndex={-1}
            className="scroll-mt-24 text-sm text-danger outline-none"
          >
            {saveError.fields
              ? 'Please check the highlighted fields.'
              : `Your profile could not be saved: ${saveError.message}`}
          </p>
        )}
      </div>
    </form>
  )
}

/**
 * A new address that has not been confirmed yet, shown beside the verified one
 * so it cannot be mistaken for the address the account now uses. The account
 * itself is not unverified: only the new address is waiting.
 */
function PendingEmail({ current, pending }) {
  return (
    <div className="rounded-control border border-lost/30 bg-lost-soft p-4 text-sm text-fg">
      <p className="flex items-center gap-2 font-semibold">
        <MailWarning size={16} className="shrink-0 text-lost" aria-hidden="true" />
        Email change pending verification
      </p>
      <p className="mt-2">
        We sent a verification link to <strong className="font-medium break-all">{pending}</strong>.
      </p>
      <p className="mt-1">
        Your current email <strong className="font-medium break-all">{current}</strong> will remain your
        sign-in email until the new address is verified. Please check the new email address and
        confirm the change.
      </p>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
        <dt className="text-fg-muted">Current verified email</dt>
        <dd className="font-medium break-all">{current}</dd>
        <dt className="text-fg-muted">New email awaiting verification</dt>
        <dd className="font-medium break-all">{pending}</dd>
        <dt className="text-fg-muted">Status</dt>
        <dd className="font-medium">Pending verification</dd>
      </dl>
    </div>
  )
}

function FieldGroup({ icon: Icon, title, children }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">
        <Icon size={15} aria-hidden="true" />
        {title}
      </legend>
      {children}
    </fieldset>
  )
}
