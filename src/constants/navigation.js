import {
  Bell,
  FileText,
  FolderTree,
  Flag,
  Gauge,
  Heart,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import { ROLES } from '@/constants'

/**
 * Navigation link lists.
 *
 * Kept as plain data in one file so the navbar and the sidebar cannot drift
 * apart. `end` marks a link that should only be highlighted on an exact match
 * (otherwise the index link stays active on every child route).
 */

/** Links shown to everyone in the top navigation. */
export const PUBLIC_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/explore', label: 'Explore' },
  // The two reporting routes are unchanged; they simply share one menu, which
  // takes an item out of the header without hiding anything.
  {
    label: 'Report',
    children: [
      { to: '/report/lost', label: 'Report a lost pet' },
      { to: '/report/found', label: 'Report a found pet' },
    ],
  },
  { to: '/about', label: 'About' },
  { to: '/help', label: 'Help' },
]

/** Sidebar links for a Customer/User. */
export const USER_NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/reports', label: 'My Reports', icon: FileText },
  { to: '/dashboard/matches', label: 'Possible Matches', icon: Heart },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { to: '/dashboard/profile', label: 'Profile', icon: User },
]

/** Sidebar links for a Staff / Pet Coordinator. */
export const STAFF_NAV = [
  { to: '/staff', label: 'Overview', icon: Gauge, end: true },
  // The badge counts Active + Possible Match reports: the open ones.
  { to: '/staff/reports', label: 'Report Queue', icon: FileText, countLabel: 'Open' },
  { to: '/staff/matches', label: 'Match Queue', icon: Heart },
  { to: '/staff/verification', label: 'Verification', icon: ShieldCheck },
  { to: '/staff/notifications', label: 'Notifications', icon: Bell },
]

/** Sidebar links for an Administrator. */
export const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/reports', label: 'Reports', icon: ListChecks },
  { to: '/admin/categories', label: 'Pet Categories', icon: FolderTree },
  { to: '/admin/moderation', label: 'Moderation', icon: Flag },
]

/**
 * The workspace each role gets a top-navigation shortcut to. Roles only reach
 * their own workspace — switching the demo role is how you see the others.
 */
export const WORKSPACE_BY_ROLE = {
  [ROLES.USER]: { to: '/dashboard', label: 'My Dashboard' },
  [ROLES.STAFF]: { to: '/staff', label: 'Staff Workspace' },
  [ROLES.ADMIN]: { to: '/admin', label: 'Administration' },
}

/**
 * Where to send somebody who has just signed in: back to the page they were
 * headed for, unless it lies inside another role's workspace.
 *
 * Signing out inside a workspace bounces through the route guard, which
 * remembers that workspace as the way back. Whoever signs in next may hold a
 * different role, and returning them there only ever produced "No access".
 * The guards themselves are unchanged: typing such an address still ends at
 * /unauthorized.
 */
export function destinationAfterSignIn(role, from) {
  const home = WORKSPACE_BY_ROLE[role].to
  const isOtherWorkspace = Object.values(WORKSPACE_BY_ROLE).some(
    ({ to }) => to !== home && (from === to || from?.startsWith(`${to}/`)),
  )

  return from && !isOtherWorkspace ? from : home
}
