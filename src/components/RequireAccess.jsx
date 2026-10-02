import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ROLES } from '@/constants'

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
 * reports. So the community pages — Home, Explore, Report a pet, About, Help,
 * Privacy — send them back to /admin. A report's own page (/pet/:id) is not
 * wrapped: Moderation, Records and the Overview link to it, and it is where
 * an administrator reads the report they are deciding about.
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
