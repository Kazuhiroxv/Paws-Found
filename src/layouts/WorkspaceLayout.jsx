import { useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Container } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
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
  const { pathname } = useLocation()

  const readCounts = useCallback(
    () => (loadCounts ? loadCounts(pathname) : Promise.resolve(null)),
    [loadCounts, pathname],
  )
  const { data: counts } = useAsync(readCounts)

  if (standalone) {
    return (
      <WorkspaceShell
        label={label}
        items={items}
        counts={counts}
        user={user}
        onSignOut={onSignOut}
      >
        <Container className="py-8">
          <Outlet />
        </Container>
      </WorkspaceShell>
    )
  }

  return (
    <Container className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <Sidebar label={label} items={items} counts={counts} />

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </Container>
  )
}
