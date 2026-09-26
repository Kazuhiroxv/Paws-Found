import { useId, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowLeft, LogOut, Menu, X } from 'lucide-react'
import logoLockup from '@/assets/pawsfound-logo-horizontal.webp'
import { ROLE_LABELS } from '@/constants'
import { cn } from '@/utils/cn'

const linkClasses = ({ isActive }) =>
  cn(
    'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-brand-soft font-medium text-brand-hover'
      : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  )

/**
 * The chrome around the Pet Coordinator and Administration workspaces.
 *
 * These two are tools, not pages of the community website, and they used to
 * wear the public navigation bar — which cost a whole row to Home, Explore,
 * About and Help, none of which a coordinator working a queue is reaching
 * for, and blurred the line between browsing the site and operating it.
 *
 * So the public bar comes off inside a workspace and the rail carries
 * everything instead: the brand, which workspace this is, the sections, and
 * the account controls that used to live in the top-right menu. "Back to the
 * public site" is a link rather than an assumption — leaving is deliberate,
 * and it is always available.
 *
 * ONE shell for both workspaces, not one each. The canvases already differ
 * (`canvas-staff` is cooler than `canvas-admin`), which is the amount of
 * difference the two should have: Paws&Found wearing a work coat, not two
 * unrelated applications. The customer dashboard deliberately does NOT use
 * this — it keeps the public bar, because somebody managing their own reports
 * is still a visitor and still wants Explore one click away.
 *
 * @param {Object} props
 * @param {string} props.label  "Staff workspace" / "Administration".
 * @param {{ to: string, label: string, icon: React.ElementType, end?: boolean }[]} props.items
 * @param {Record<string, number>} [props.counts]  Count badges keyed by link `to`.
 * @param {Object|null} props.user
 * @param {() => void} props.onSignOut
 * @param {React.ReactNode} props.children
 */
export function WorkspaceShell({ label, items, counts, user, onSignOut, children }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuId = useId()

  // Choosing a section closes the drawer, on the click rather than in an
  // effect watching the path: the click is the moment the decision is made,
  // and an effect would also fire on navigations that did not come from here.
  const nav = (onNavigate) => (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = item.icon
        const count = counts?.[item.to]

        return (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={linkClasses} onClick={onNavigate}>
              <Icon size={16} aria-hidden="true" />
              <span className="whitespace-nowrap">{item.label}</span>
              {count > 0 && (
                <span className="ml-auto min-w-6 rounded-pill bg-surface-muted px-2 py-0.5 text-center text-xs font-medium text-fg tabular-nums">
                  {count}
                  <span className="sr-only"> {count === 1 ? 'item' : 'items'}</span>
                </span>
              )}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )

  const account = (onNavigate) => (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      {user && (
        <div className="px-3 pb-1">
          <p className="truncate text-sm font-medium text-fg">{user.fullName}</p>
          <p className="truncate text-xs text-fg-muted">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>
      )}

      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 rounded-control px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to the public site
      </Link>

      <button
        type="button"
        onClick={onSignOut}
        className="flex items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
      >
        <LogOut size={16} aria-hidden="true" />
        Sign out
      </button>
    </div>
  )

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Phones and tablets: a bar with the brand and one button. The rail
          below it would otherwise push the actual work off the first screen. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-2.5 lg:hidden">
        <Link to="/" className="flex items-center">
          <img src={logoLockup} alt="Paws&Found" className="h-8 w-auto" />
        </Link>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
          className="flex items-center gap-2 rounded-control border border-border-strong px-3 py-1.5 text-sm font-medium text-fg"
        >
          {isMenuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
          {label}
        </button>
      </header>

      {isMenuOpen && (
        <div id={menuId} className="border-b border-border bg-panel px-4 py-3 lg:hidden">
          <nav aria-label={label} className="flex flex-col gap-3">
            {nav(() => setIsMenuOpen(false))}
            {account(() => setIsMenuOpen(false))}
          </nav>
        </div>
      )}

      {/* Desktop: a fixed rail. `sticky` with its own scroll, so a long queue
          scrolls under navigation that stays put. */}
      <div className="hidden w-60 shrink-0 border-r border-border bg-panel lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Link to="/" className="flex items-center border-b border-border px-4 py-4">
          <img src={logoLockup} alt="Paws&Found" className="h-9 w-auto" />
        </Link>

        <div className="px-4 pt-4 pb-2">
          <p className="text-xs font-medium tracking-wide text-fg-muted uppercase">{label}</p>
        </div>

        <nav aria-label={label} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {nav()}
        </nav>

        <div className="px-2 pb-3">{account()}</div>
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
