import { useState } from 'react'
import { Check, Lock, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import {
  Button, Card, CardBody, CardHeader, Checkbox, Input, LoadingSkeleton, RequiredNote,
} from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ROLE_LABELS } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { userService } from '@/services'

const loadCurrentUser = () => userService.getCurrentUser()

const header = (
  <PageHeader
    title="Profile"
    description="Your contact details and what you want to be told about."
    breadcrumb={[{ label: 'My dashboard', to: '/dashboard' }, { label: 'Profile' }]}
  />
)

/** The API's field names → this form's, so a rejected field is marked where it is. */
const API_FIELDS = {
  full_name: 'fullName',
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

  return <ProfileForm key={user.id} user={user} onSaved={reload} />
}

function ProfileForm({ user, onSaved }) {
  const [form, setForm] = useState(() => ({
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    preferredLocation: user.preferredLocation,
    ...user.notificationPreferences,
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // The server's own per-field messages, placed under the fields they name.
  const fieldErrors = Object.fromEntries(
    Object.entries(saveError?.fields ?? {}).map(([name, message]) => [API_FIELDS[name] ?? name, message]),
  )

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setIsSaved(false)
  }

  const save = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setSaveError(null)

    try {
      await userService.updateUser(user.id, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        preferredLocation: form.preferredLocation.trim(),
        notificationPreferences: {
          possibleMatches: form.possibleMatches,
          statusUpdates: form.statusUpdates,
          staffMessages: form.staffMessages,
        },
      })
      setIsSaved(true)
      onSaved()
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      {header}

      <RequiredNote className="-mt-2 text-sm text-fg-muted" />

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
            <Input
              label="Full name"
              value={form.fullName}
              onChange={(event) => change('fullName', event.target.value)}
              maxLength={80}
              required
              hint="Shown on the reports you file."
              error={fieldErrors.fullName}
            />

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

      {/* The action bar: separated from the last card, with the outcome of
          the last save beside the button. */}
      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
        <Button type="submit" isLoading={isSaving} className="w-full sm:w-auto">
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>

        {isSaved && (
          <p role="status" className="flex items-center gap-1 text-sm text-success-ink">
            <Check size={16} aria-hidden="true" />
            Profile saved
          </p>
        )}
        {saveError && (
          <p role="alert" className="text-sm text-danger">
            {saveError.fields
              ? 'Please check the highlighted fields.'
              : `Your profile could not be saved: ${saveError.message}`}
          </p>
        )}
      </div>
    </form>
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
