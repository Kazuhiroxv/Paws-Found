import { useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Container } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { can } from '@/utils/permissions'
import { WorkspaceShell } from './WorkspaceShell'

/**
 * Sidebar + content shell shared by the three workspaces: the user dashboard,
 * the staff workspace and the administration area.
 *
 * One layout serves all three because they differ only in which links the
 * sidebar shows — three near-identical layout files would be exactly the
 * duplication docs/ui-inventory.md warns about.
 *
 * Two shapes, though, and the difference is deliberate:
 *
 *   * `standalone` — Pet Coordinator and Administration. Their own chrome,
 *     with the public navigation bar removed (see WorkspaceShell). These are
 *     tools, and the row of public links was costing space and blurring the
 *     boundary between browsing the site and operating it.
 *
 *   * the default — the customer dashboard, which stays inside the public bar.
 *     Somebody managing their own reports is still a visitor: they will want
 *     Explore in one click, and giving them an operator's console would be a
 *     colder room than they need to be in.
 *
 * @param {Object} props
 * @param {string} props.label  Workspace name, used to label the sidebar nav.
 * @param {Array} props.items   Sidebar links; see constants/navigation.js.
 * @param {() => Promise<Record<string, number>>} [props.loadCounts]  Fetches
 *   the sidebar's count badges. Re-read whenever the person moves to another
 *   section, so a count that changed on one page is right on the next.
 * @param {boolean} [props.standalone]  Render the workspace's own chrome.
 * @param {Object|null} [props.user]       Required when `standalone`.
 * @param {() => void} [props.onSignOut]   Required when `standalone`.
 */
export function WorkspaceLayout({ label, items, loadCounts, standalone = false, user, onSignOut }) {
  const { pathname, state } = useLocation()
  const navigate = useNavigate()

  // As in RootLayout: home first, then the session, so the workspace is not
  // remembered as the way back for whoever signs in next.
  const signOutToHome = useCallback(async () => {
    navigate('/', { replace: true })
    await onSignOut?.()
  }, [navigate, onSignOut])

  const readCounts = useCallback(
    () => (loadCounts ? loadCounts(pathname) : Promise.resolve(null)),
    [loadCounts, pathname],
  )
  const { data: counts } = useAsync(readCounts)

  // Only the sections this account may open (Correction 6): a link names the
  // capability it needs, and an administrator's level decides which they have.
  const visibleItems = items.filter((item) => !item.capability || can(user, item.capability))

  if (standalone) {
    return (
      <WorkspaceShell
        label={label}
        items={visibleItems}
        counts={counts}
        user={user}
        onSignOut={signOutToHome}
      >
        <Container className="py-8">
          {/* Once, on arrival from the sign-in page: a privileged account keeps
              one session, so signing in here ended any other. "Any" because
              the server cannot tell whether another one was open. */}
          {state?.sessionNotice && (
            <p role="status" className="mb-6 rounded-control border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-fg">
              Signed in on this device. For security, any previous session for this account is no
              longer valid.
            </p>
          )}
          {/* The pages read the signed-in account from here
              (useWorkspaceUser) to decide which actions to offer. */}
          <Outlet context={{ user }} />
        </Container>
      </WorkspaceShell>
    )
  }

  return (
    <Container className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <Sidebar label={label} items={visibleItems} counts={counts} />

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </Container>
  )
}
