import { useId, useState } from 'react'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { Input } from '@/components/ui'
import { passwordChecks, passwordStrength } from '@/utils/passwordRules'
import { cn } from '@/utils/cn'

/**
 * A password box that can be read.
 *
 * Typing a password you cannot see, twice, is how people end up locked out of
 * accounts they just made. The reveal is a real button rather than a decorated
 * icon, because it is operable from the keyboard and announced by a screen
 * reader — and the label says which state pressing it produces.
 */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete = 'new-password',
  required = false,
}) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="relative">
      <Input
        label={label}
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        error={error}
        hint={hint}
        autoComplete={autoComplete}
        required={required}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setRevealed((shown) => !shown)}
        // Sits over the input, clear of the label above and any error below.
        className="absolute top-[2.15rem] right-2 flex size-8 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
        aria-pressed={revealed}
      >
        {revealed ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        <span className="sr-only">{revealed ? 'Hide password' : 'Show password'}</span>
      </button>
    </div>
  )
}

/**
 * What the password still needs.
 *
 * `aria-live="polite"` so somebody using a screen reader hears a requirement
 * being met as they type, rather than finding out when the form is refused.
 * The tick and the cross carry text as well as colour — a checklist that only
 * distinguishes its states by green and grey says nothing to a person who
 * cannot tell them apart.
 */
export function PasswordChecklist({ password, confirmation, confirm = true, identity = null }) {
  const headingId = useId()
  const checks = passwordChecks(password, confirmation, { confirm, identity })

  return (
    <div className="flex flex-col gap-1.5">
      <p id={headingId} className="text-sm font-medium text-fg">
        Password requirements
      </p>
      <ul aria-labelledby={headingId} aria-live="polite" className="flex flex-col gap-1 text-sm">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2">
            {check.met ? (
              <Check size={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <X size={15} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden="true" />
            )}
            <span className={check.met ? 'text-fg' : 'text-fg-muted'}>{check.label}</span>
            <span className="sr-only">{check.met ? ' — met' : ' — not yet met'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * How hard the password looks to guess: Weak, Fair or Strong.
 *
 * Advice beside the requirements, never a second set of them. Weak means a
 * requirement is not met yet; Fair means every one is, and the form accepts
 * it; Strong is recommended, not required. The word is always shown, so
 * nothing depends on telling the bar's colours apart, and Fair is drawn in the
 * brand colour, not as an error.
 */
const STRENGTH = {
  weak: {
    label: 'Weak',
    advice: 'Too easy to guess, or a requirement is not met yet. Try a longer passphrase.',
    bars: 1,
    colour: 'bg-danger',
  },
  fair: { label: 'Fair', advice: 'Meets the requirements.', bars: 2, colour: 'bg-brand' },
  strong: { label: 'Strong', advice: 'Hard to guess. Good choice.', bars: 3, colour: 'bg-success' },
}

export function PasswordStrength({ password, identity = null }) {
  const level = passwordStrength(password, { identity })
  if (!level) return null

  const { label, advice, bars, colour } = STRENGTH[level]

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <p className="text-sm text-fg">
        <span className="font-medium">Strength: </span>
        <span className="font-semibold">{label}</span>
        <span className="text-fg-muted"> — {advice}</span>
      </p>
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn('h-1.5 flex-1 rounded-pill', bar <= bars ? colour : 'bg-surface-muted')}
          />
        ))}
      </div>
    </div>
  )
}
