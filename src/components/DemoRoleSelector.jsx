import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { ROLES, ROLE_LABELS } from '@/constants'

/** The value used in the select to mean "signed out". */
const GUEST = 'guest'

/**
 * DEVELOPMENT ONLY — switches which account the interface is rendered as,
 * including signed out.
 *
 * Authentication is simulated during frontend development (CLAUDE.md §6.1), so
 * this stands in for signing in as different kinds of account without a real
 * login. It must be removed once real authentication decides the role.
 *
 * @param {Object} props
 * @param {string|null} props.role  null when signed out.
 * @param {(role: string|null) => void} props.onRoleChange
 * @param {boolean} [props.hideLabel]  The header supplies its own "Demo:"
 *   label, so the built-in one would repeat it. Still present for screen
 *   readers, because the select needs a name either way.
 */
export function DemoRoleSelector({ role, onRoleChange, hideLabel = false }) {
  // The navbar renders this twice — once for desktop, once inside the mobile
  // panel — so the id has to be unique per instance or the labels collide.
  const selectId = useId()

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={selectId}
        className={
          hideLabel ? 'sr-only' : 'text-xs whitespace-nowrap text-fg-muted'
        }
      >
        Demo role
      </label>
      {/* The browser's own arrow is swapped for the header's chevron, so all
          three menus in the bar share one style. A fixed width keeps the
          control the same size whichever role is showing. */}
      <div className="relative">
        <select
          id={selectId}
          value={role ?? GUEST}
          onChange={(event) =>
            onRoleChange(event.target.value === GUEST ? null : event.target.value)
          }
          className="w-40 appearance-none rounded-control border border-border bg-panel py-1.5 pr-8 pl-2.5 text-sm text-fg-muted"
        >
          <option value={GUEST}>Signed out</option>
          {Object.values(ROLES).map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted"
        />
      </div>
    </div>
  )
}
