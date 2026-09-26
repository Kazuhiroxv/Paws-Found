import { useEffect } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { SessionNotice } from '@/components/SessionNotice'
import { cn } from '@/utils/cn'

/**
 * Which environment the page is in. The four canvases share one recipe and
 * differ in which brand colour leads, so the public pages feel warm and
 * community-facing, the coordinator's workspace reads cooler and operational,
 * and administration is the quietest of the four — without any of them looking
 * like a different product (docs/design-system.md).
 */
function canvasFor(pathname) {
  if (pathname.startsWith('/admin')) return 'canvas-admin'
  if (pathname.startsWith('/staff')) return 'canvas-staff'
  // Taller on the customer dashboard: the greeting, the quick actions and the
  // first heading all sit inside the warm region, and it fades out under the
  // cards rather than stopping just below the greeting.
  if (pathname.startsWith('/dashboard')) return 'canvas-customer h-[58rem]'
  return 'canvas-public'
}

/**
 * The shell every page sits inside: navigation, the page itself, and the
 * footer.
 *
 * @param {Object} props
 * @param {string} props.role
 * @param {(role: string) => void} props.onRoleChange  Development only.
 * @param {() => void} props.onSignOut
 * @param {Object|null} props.user
 * @param {Object|null} [props.notice]  A change to the account made elsewhere.
 * @param {() => void} [props.onDismissNotice]
 * @param {() => void} [props.onRouteChange]  Re-check who is signed in.
 */
export function RootLayout({
  role,
  onRoleChange,
  onSignOut,
  user,
  notice,
  onDismissNotice,
  onRouteChange,
}) {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  // Opening a page asks the server who this is, so arriving somewhere is itself
  // a check. Without it, a device left on one page could show a workspace the
  // account no longer has until the next poll — and the first thing anybody
  // does when they pick a device back up is navigate.
  useEffect(() => {
    onRouteChange?.()
  }, [pathname, onRouteChange])

  // Open every page at the top. A single-page app keeps the scroll position
  // when the route changes, so following a link from halfway down a long list
  // landed you halfway down the next page.
  //
  // Two exceptions: a link carrying a `#match-3` style anchor scrolls itself
  // once its data has loaded, and going Back (`POP`) should return you to
  // where you were, which the browser already handles.
  useEffect(() => {
    if (hash || navigationType === 'POP') return
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname, hash, navigationType])

  // The Pet Coordinator and Administration areas bring their own chrome
  // (src/layouts/WorkspaceShell.jsx): a branded rail that carries navigation,
  // the account and the way back out. The public bar would be a second,
  // competing navigation above it, so it comes off — along with the public
  // footer and the page padding, both of which belong to a website rather
  // than to a tool.
  const isWorkspace = pathname.startsWith('/staff') || pathname.startsWith('/admin')

  return (
    <div className="page-ground flex min-h-screen flex-col bg-surface">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {!isWorkspace && (
        <Navbar role={role} onRoleChange={onRoleChange} onSignOut={onSignOut} user={user} />
      )}

      {/* Directly under the navigation, above everything else: a change made to
          this account somewhere else is the most important thing on the page
          at the moment it arrives. */}
      <SessionNotice notice={notice} onDismiss={onDismissNotice} />

      {/* The environment layer: grain plus the two glows for this area of the
          site. It is behind the page, above the ground, and fades out well
          before the content ends — the atmosphere belongs to the top of a
          page, not to the whole scroll. */}
      <main id="main-content" className={cn('relative isolate flex-1', !isWorkspace && 'py-8')}>
        <span
          aria-hidden="true"
          className={cn(
            'canvas-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem]',
            canvasFor(pathname),
          )}
        />
        <Outlet />
      </main>

      {!isWorkspace && <Footer />}
    </div>
  )
}
