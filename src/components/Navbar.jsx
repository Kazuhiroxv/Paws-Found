import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import logoLockup from '@/assets/pawsfound-logo-horizontal.webp'
import { Button, Container } from '@/components/ui'
import { DemoRoleSelector } from './DemoRoleSelector'
import { NavDropdown, NavDropdownItem } from './NavDropdown'
import { PUBLIC_NAV, WORKSPACE_BY_ROLE } from '@/constants/navigation'
import { cn } from '@/utils/cn'

const linkClasses = ({ isActive }) =>
  cn(
    'rounded-control px-3 py-2 text-[0.9375rem] font-medium transition-colors',
    isActive ? 'bg-brand-soft text-brand-hover' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  )

/** The "Report" trigger, styled to sit level with the plain links beside it. */
const triggerClasses =
  'flex items-center gap-1 rounded-control px-3 py-2 text-[0.9375rem] font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg'

/**
 * Top navigation.
 *
 * Four groups, in this order, because they answer four different questions:
 *
 *   1. brand              — where am I
 *   2. public navigation  — where can I go
 *   3. workspace          — where does my role work
 *   4. account and demo   — who am I, and the development role switch
 *
 * They used to sit in one row at equal weight, which read as a single mush of
 * links. The workspace is now a bordered control rather than a sixth link, the
 * account is a menu rather than a label, and the demo selector sits behind a
 * divider under a muted "Demo:" so it can never be mistaken for a real account
 * control.
 *
 * Below `xl` everything collapses behind the menu button: a signed-in
 * coordinator carries seven items plus a name plus the selector, which does not
 * fit a 1024px laptop.
 *
 * @param {Object} props
 * @param {string|null} props.role  null when signed out.
 * @param {(role: string|null) => void} props.onRoleChange
 * @param {Object|null} props.user  The signed-in account; null when signed out.
 */
export function Navbar({ role, onRoleChange, onSignOut, user }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // Flat while the page is at the top; once content has scrolled underneath,
  // the header separates from it with a shadow instead of only a hairline.
  const [isScrolled, setIsScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const workspace = role ? WORKSPACE_BY_ROLE[role] : null

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <header
      className={cn(
        // Translucent rather than solid: the canvas and its gradients drift
        // under the header as the page moves, which is most of the depth.
        'sticky top-0 z-50 border-b bg-panel/92 backdrop-blur-[14px]',
        'transition-[box-shadow,border-color] duration-200',
        isScrolled ? 'border-brand/12 shadow-header' : 'border-border',
      )}
    >
      <Container className="flex h-[4.5rem] items-center gap-6">
        {/* 1. Brand */}
        {/* The lockup rather than the mark beside typed-out text: the mark
            alone is a dog, a cat, a heart and a pin, and at the 36px a navbar
            gives it those collapse into a blob. The lockup carries its own
            wordmark, so the brand is legible at the size it actually appears.
            The alt text is the name — the image IS the name here. */}
        <Link to="/" className="mr-2 flex shrink-0 items-center">
          <img src={logoLockup} alt="Paws&Found" className="h-11 w-auto" />
        </Link>

        {/* 2. Public navigation */}
        <nav aria-label="Main" className="hidden items-center gap-1.5 xl:flex 2xl:gap-2.5">
          {PUBLIC_NAV.map((item) =>
            item.children ? (
              <NavDropdown
                key={item.label}
                label={item.label}
                triggerClassName={triggerClasses}
                isActive={item.children.some((child) => location.pathname === child.to)}
              >
                {(close) =>
                  item.children.map((child) => (
                    <NavDropdownItem key={child.to} as={Link} to={child.to} onClick={close}>
                      {child.label}
                    </NavDropdownItem>
                  ))
                }
              </NavDropdown>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        {/* 3 and 4 sit together on the right, behind a divider: the public
            links answer "where can I go", these answer "who am I", and without
            a break between them the whole row reads as one list. */}
        <div className="ml-auto hidden items-center gap-4 xl:flex">
          <span className="h-7 w-px bg-border" aria-hidden="true" />
          {/* 3. The role's own workspace — a destination, not a sixth link.
              A fixed width, and a fixed width on the account menu beside it, so
              "My Dashboard", "Staff Workspace" and "Administration" all start
              and end at the same place: the right side lines up identically for
              every role. While you are in it, it fills with the same pale teal
              the active public link uses. */}
          {workspace && (
            <NavLink
              to={workspace.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex w-36 justify-center rounded-control border px-3 py-1.5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-brand-soft bg-brand-soft text-brand-hover'
                    : 'border-border-strong text-fg hover:bg-surface-muted',
                )
              }
            >
              {workspace.label}
            </NavLink>
          )}

          {/* 4. Account, then the demo control behind a divider. */}
          {user ? (
            <NavDropdown
              align="right"
              label={
                <span className="min-w-0 truncate" title={user.fullName}>
                  {user.fullName}
                </span>
              }
              triggerClassName="flex w-44 items-center justify-between gap-1.5 rounded-control border border-transparent px-2 py-1.5 text-left text-[0.9375rem] font-medium text-fg transition-colors hover:bg-surface-muted"
            >
              {(close) => (
                <>
                  <p className="px-3 pt-1 pb-2 text-xs break-all text-fg-muted">{user.email}</p>
                  <NavDropdownItem
                    as="button"
                    type="button"
                    onClick={() => {
                      close()
                      onSignOut()
                    }}
                  >
                    <LogOut size={15} aria-hidden="true" />
                    Sign out
                  </NavDropdownItem>
                </>
              )}
            </NavDropdown>
          ) : (
            <Button as={Link} to="/login" size="sm" variant="secondary">
              Sign in
            </Button>
          )}

          {/* Development scaffolding. Removed from the production bundle, not
              merely hidden: it signs in without a password, which must not
              exist on a deployed site. The divider goes with it, or it would
              be left separating nothing. */}
          {import.meta.env.DEV && (
            <>
              <span className="h-6 w-px bg-border" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-fg-muted">Demo:</span>
                <DemoRoleSelector role={role} onRoleChange={onRoleChange} hideLabel />
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          className="ml-auto rounded-control p-2.5 text-fg hover:bg-surface-muted xl:hidden"
        >
          {isMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          <span className="sr-only">{isMenuOpen ? 'Close menu' : 'Open menu'}</span>
        </button>
      </Container>

      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-border bg-panel xl:hidden">
          <Container className="flex flex-col py-4">
            {/* The Report menu flattens here: on a phone a submenu inside a
                submenu is worse than two plain links. */}
            <nav aria-label="Main" className="flex flex-col gap-0.5">
              {PUBLIC_NAV.flatMap((item) =>
                item.children
                  ? item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={linkClasses}
                        onClick={closeMenu}
                      >
                        {child.label}
                      </NavLink>
                    ))
                  : [
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={linkClasses}
                        onClick={closeMenu}
                      >
                        {item.label}
                      </NavLink>,
                    ],
              )}
            </nav>

            {workspace && (
              <NavLink
                to={workspace.to}
                onClick={closeMenu}
                className={({ isActive }) =>
                  cn(
                    'mt-3 rounded-control border px-3.5 py-2 text-center text-[0.9375rem] font-medium',
                    isActive
                      ? 'border-brand-soft bg-brand-soft text-brand-hover'
                      : 'border-border-strong text-fg',
                  )
                }
              >
                {workspace.label}
              </NavLink>
            )}

            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
              {user ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">
                      {user.fullName}
                    </span>
                    <span className="block truncate text-xs text-fg-muted">{user.email}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      closeMenu()
                      onSignOut()
                    }}
                  >
                    <LogOut size={14} aria-hidden="true" />
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button as={Link} to="/login" variant="secondary" onClick={closeMenu}>
                  Sign in
                </Button>
              )}

              {/* Development scaffolding — see the note on the desktop copy. */}
              {import.meta.env.DEV && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-fg-muted">Demo:</span>
                  <DemoRoleSelector role={role} onRoleChange={onRoleChange} hideLabel />
                </div>
              )}
            </div>
          </Container>
        </div>
      )}
    </header>
  )
}
