import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ROLES } from '@/constants'
import { can } from '@/utils/permissions'
import { t } from '@/i18n'

/**
 * Route guard for anything behind a sign-in.
 *
 * Two cases, in order:
 *   signed out            → /login, remembering where they were headed
 *   signed in, wrong role → /unauthorized
 *
 * NOT SECURITY. Authentication is simulated and this runs in the browser, so it
 * only keeps the interface coherent — real enforcement arrives with the backend
 * (CLAUDE.md §8).
 *
 * @param {Object} props
 * @param {string|null} props.role   Current role, or null when signed out.
 * @param {string[]} [props.allowed] Roles permitted here. Omit to allow any
 *   signed-in account.
 */
export function RequireAccess({ role, allowed, children }) {
  const location = useLocation()

  if (!role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowed && !allowed.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

/**
 * Keeps an administrator in Administration.
 *
 * The administrator manages the system; they do not browse for pets or file
 * reports. So the community pages — Home, Explore, Report a pet, About,
 * Help — send them back to /admin. A report's own page (/pet/:id) is not
 * wrapped: Moderation, Records and the Overview link to it, and it is where
 * an administrator reads the report they are deciding about. Nor are the
 * Privacy Notice and the Disclaimer (Correction 7): they describe the system
 * to everybody who uses it, administrators included.
 *
 * Like RequireAccess, this keeps the interface coherent. It is not what stops
 * anything: the API decides what each role may do.
 *
 * @param {Object} props
 * @param {string|null} props.role  Current role, or null when signed out.
 */
export function AdminStaysInWorkspace({ role }) {
  if (role === ROLES.ADMIN) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}

/**
 * A section of Administration that this administrator's level does not
 * include (Correction 6): Users without manage_accounts, Logs without
 * view_security_logs, and so on.
 *
 * Says so in place, inside the workspace, rather than bouncing somewhere
 * else: somebody who typed /admin/logs should learn why it is closed to them,
 * and nothing of the page is rendered — not even a loading request for its
 * data. Like RequireAccess, this keeps the interface coherent; the API
 * refuses the same request with 403 whatever the page does.
 *
 * @param {Object} props
 * @param {Object|null} props.user        The signed-in account.
 * @param {string} props.capability       One of CAPABILITIES in src/constants.
 */
export function RequireCapability({ user, capability, children }) {
  if (can(user, capability)) {
    return children
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t('shell.access.eyebrow')} title={t('shell.access.title')} />
      <EmptyState
        icon={Lock}
        title={t('shell.access.denied')}
        description={t('shell.access.deniedBody')}
        action={
          <Link to="/admin" className="text-sm text-fg underline">
            {t('shell.access.back')}
          </Link>
        }
      />
    </div>
  )
}
