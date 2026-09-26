import { useCallback } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { RootLayout } from '@/layouts/RootLayout'
import { WorkspaceLayout } from '@/layouts/WorkspaceLayout'
import { loadDashboardCounts } from '@/pages/dashboard/dashboardSummary'
import { loadAdminCounts } from '@/pages/admin/adminCounts'
import { loadStaffCounts } from '@/pages/staff/staffCounts'
import { RequireAccess } from '@/components/RequireAccess'
import { useSession } from '@/hooks/useSession'
import { ROLES } from '@/constants'
import { ADMIN_NAV, STAFF_NAV, USER_NAV } from '@/constants/navigation'
import { userService } from '@/services'

import { HomePage } from '@/pages/public/HomePage'
import { ExplorePage } from '@/pages/public/ExplorePage'
import { ReportLostPage } from '@/pages/public/ReportLostPage'
import { ReportFoundPage } from '@/pages/public/ReportFoundPage'
import { PetDetailPage } from '@/pages/public/PetDetailPage'
import { AboutPage } from '@/pages/public/AboutPage'
import { HelpPage } from '@/pages/public/HelpPage'
import { PrivacyPage } from '@/pages/public/PrivacyPage'
import { LoginPage } from '@/pages/public/LoginPage'
import { RegisterPage } from '@/pages/public/RegisterPage'

import { DashboardOverviewPage } from '@/pages/dashboard/DashboardOverviewPage'
import { MyReportsPage } from '@/pages/dashboard/MyReportsPage'
import { EditReportPage } from '@/pages/dashboard/EditReportPage'
import { MyMatchesPage } from '@/pages/dashboard/MyMatchesPage'
import { NotificationsPage } from '@/pages/dashboard/NotificationsPage'
import { ProfilePage } from '@/pages/dashboard/ProfilePage'

import { StaffOverviewPage } from '@/pages/staff/StaffOverviewPage'
import { StaffReportsPage } from '@/pages/staff/StaffReportsPage'
import { StaffMatchesPage } from '@/pages/staff/StaffMatchesPage'
import { StaffVerificationPage } from '@/pages/staff/StaffVerificationPage'

import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage'
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage'
import { AdminModerationPage } from '@/pages/admin/AdminModerationPage'

import { NotFoundPage } from '@/pages/system/NotFoundPage'
import { UnauthorizedPage } from '@/pages/system/UnauthorizedPage'

/**
 * Routes and the session.
 *
 * `user` is whoever the server says the session cookie belongs to, and `null`
 * means signed out — the state a first-time visitor arrives in. Signing in and
 * registering both hand back an account, which is all this component stores;
 * the session itself lives on the server.
 *
 * Browsing is public: anyone can read the homepage, search reports and open a
 * report. Filing a report, and every workspace, requires signing in.
 */
export default function App() {
  // The session lives on the server as a PHP session, so the app has to ask who
  // is signed in rather than remembering it in a variable — and has to keep
  // asking. The same account may be open on three devices while an
  // administrator changes it on a fourth; the API refuses those devices
  // immediately, and this is what makes their screens agree
  // (src/hooks/useSession.js).
  const { user, notice, dismissNotice, refresh, setSignedInUser, signOut } = useSession()

  /**
   * The development role selector.
   *
   * Development scaffolding: it signs in as a seeded account without asking
   * for the password, which is convenient while building and unacceptable on
   * a deployed site. `import.meta.env.DEV` is replaced with `false` when the
   * project is built, so this whole branch — and the demo password it uses —
   * is removed from the production bundle rather than merely hidden.
   */
  const changeRole = useCallback(
    async (nextRole) => {
      if (!import.meta.env.DEV) return

      if (!nextRole) {
        await signOut()
        return
      }

      const accounts = await userService.getDemoAccounts()
      const account = accounts[nextRole]
      setSignedInUser(await userService.signInAsDemoAccount(account.email))
    },
    [signOut, setSignedInUser],
  )

  const role = user?.role ?? null

  // Until the session check finishes, a guarded route must not decide that
  // nobody is signed in — that would bounce a signed-in user to /login on
  // every refresh.
  //
  // This used to render nothing at all, which is invisible when the answer
  // takes 40ms and a blank white page when it takes five seconds. The page
  // now says it is working, and says so to a screen reader as well.
  if (user === undefined) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-dvh items-center justify-center bg-surface"
      >
        <span className="text-sm text-fg-muted">Loading Paws&amp;Found…</span>
      </div>
    )
  }

  return (
    // Served from a sub-folder in production, so the router is told where it
    // starts; without this every route would be matched against the wrong path.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route
          element={
            <RootLayout
              role={role}
              onRoleChange={changeRole}
              onSignOut={signOut}
              user={user}
              notice={notice}
              onDismissNotice={dismissNotice}
              // Every route change re-asks who is signed in, so opening a page
              // is itself a check rather than something the timer catches up
              // with a few seconds later.
              onRouteChange={refresh}
            />
          }
        >
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/pet/:id" element={<PetDetailPage role={role} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route
            path="/login"
            element={<LoginPage onSignedIn={setSignedInUser} onDemoSignIn={changeRole} />}
          />
          <Route path="/register" element={<RegisterPage onSignedIn={setSignedInUser} />} />

          {/* Filing a report requires an account, so a report can be traced
              back to a person and followed up. Any signed-in role may file. */}
          <Route
            path="/report/lost"
            element={
              <RequireAccess role={role}>
                <ReportLostPage />
              </RequireAccess>
            }
          />
          <Route
            path="/report/found"
            element={
              <RequireAccess role={role}>
                <ReportFoundPage />
              </RequireAccess>
            }
          />

          {/* Customer / User */}
          <Route
            path="/dashboard"
            element={
              <RequireAccess role={role} allowed={[ROLES.USER]}>
                <WorkspaceLayout
                  label="My account"
                  items={USER_NAV}
                  loadCounts={loadDashboardCounts}
                />
              </RequireAccess>
            }
          >
            <Route index element={<DashboardOverviewPage />} />
            <Route path="reports" element={<MyReportsPage />} />
            <Route path="reports/:id/edit" element={<EditReportPage />} />
            <Route path="matches" element={<MyMatchesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Staff / Pet Coordinator */}
          <Route
            path="/staff"
            element={
              <RequireAccess role={role} allowed={[ROLES.STAFF]}>
                <WorkspaceLayout
                  label="Staff workspace"
                  items={STAFF_NAV}
                  loadCounts={loadStaffCounts}
                  // Its own chrome: the public bar comes off inside a tool.
                  standalone
                  user={user}
                  onSignOut={signOut}
                />
              </RequireAccess>
            }
          >
            <Route index element={<StaffOverviewPage />} />
            <Route path="reports" element={<StaffReportsPage />} />
            <Route path="matches" element={<StaffMatchesPage />} />
            <Route path="verification" element={<StaffVerificationPage />} />
            <Route
              path="notifications"
              element={
                <NotificationsPage
                  workspacePath="/staff"
                  workspaceLabel="Staff workspace"
                  // The Match Queue holds every pairing; Verification only
                  // the ones someone asked to be checked, so an open match
                  // linked there was not on the page.
                  matchPath="/staff/matches"
                />
              }
            />
          </Route>

          {/* Administrator */}
          <Route
            path="/admin"
            element={
              <RequireAccess role={role} allowed={[ROLES.ADMIN]}>
                <WorkspaceLayout
                  label="Administration"
                  items={ADMIN_NAV}
                  loadCounts={loadAdminCounts}
                  standalone
                  user={user}
                  onSignOut={signOut}
                />
              </RequireAccess>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
          </Route>

          {/* System */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
