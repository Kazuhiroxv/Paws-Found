import { useId, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import { t } from '@/i18n'

const linkClasses = ({ isActive }) =>
  cn(
    'flex items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-brand-soft font-medium text-brand-hover'
      : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  )

/**
 * Workspace navigation for the dashboard, staff and admin areas.
 *
 * No panel — the links sit on the page ground with a hairline divider, and
 * only the current destination gets the pale-teal surface. (A tall white
 * panel around five links read as an empty, unfinished box.) Below `lg` it
 * becomes one compact "section" menu instead of a stack of links above the
 * content.
 *
 * @param {Object} props
 * @param {string} props.label  Names the nav for screen readers, e.g. "My Account".
 * @param {{ to: string, label: string, icon: React.ElementType, end?: boolean }[]} props.items
 * @param {Record<string, number>} [props.counts]  Small count badges, keyed by
 *   link `to`. Only real, non-zero counts are shown.
 */
export function Sidebar({ label, items, counts }) {
  const { pathname } = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()

  // The section being shown, for the compact menu's button. An `end` link only
  // matches exactly; the others also own their child routes (an edit page sits
  // under My Reports).
  const current =
    items.find((item) =>
      item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
    ) ?? items[0]
  const CurrentIcon = current.icon

  const links = (onNavigate) =>
    items.map((item) => {
      const Icon = item.icon
      const count = counts?.[item.to]

      return (
        <li key={item.to}>
          <NavLink to={item.to} end={item.end} className={linkClasses} onClick={onNavigate}>
            <Icon size={16} className="shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{item.label}</span>
            {count > 0 && <CountBadge count={count} />}
          </NavLink>
        </li>
      )
    })

  return (
    <nav aria-label={label} className="lg:w-56 lg:shrink-0 lg:border-r lg:border-border lg:pr-5">
      {/* Phones and tablets: one line that names where you are, and opens the
          other four. */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls={menuId}
          className="flex w-full items-center justify-between gap-3 rounded-control border border-border-strong bg-panel px-3.5 py-2.5 text-sm font-medium text-fg"
        >
          <span className="flex items-center gap-2">
            <CurrentIcon size={16} className="text-brand" aria-hidden="true" />
            <span className="sr-only">{t('shell.workspace.section', { label })}</span>
            {current.label}
          </span>
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={cn('shrink-0 text-fg-muted transition-transform', isOpen && 'rotate-180')}
          />
        </button>

        {isOpen && (
          <ul
            id={menuId}
            className="mt-2 flex flex-col gap-0.5 rounded-card border border-border bg-panel p-1.5 shadow-raised"
          >
            {links(() => setIsOpen(false))}
          </ul>
        )}
      </div>

      <ul className="hidden flex-col gap-0.5 lg:flex">{links()}</ul>
    </nav>
  )
}

function CountBadge({ count }) {
  return (
    <span className="ml-auto min-w-6 rounded-pill bg-surface-muted px-2 py-0.5 text-center text-xs font-medium text-fg tabular-nums">
      {count}
      <span className="sr-only"> {t('shell.workspace.item', { count })}</span>
    </span>
  )
}
