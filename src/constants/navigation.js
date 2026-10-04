import {
  Bell,
  ClipboardCheck,
  FileText,
  FolderTree,
  Flag,
  Gauge,
  Heart,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import { CAPABILITIES, ROLES } from '@/constants'
import { t } from '@/i18n'

/**
 * Navigation link lists.
 *
 * Kept as plain data in one file so the navbar and the sidebar cannot drift
 * apart. `end` marks a link that should only be highlighted on an exact match
 * (otherwise the index link stays active on every child route).
 *
 * Each `label` is a getter (Correction 7): it reads the dictionary when the
 * navigation renders, so the same list answers in English or Filipino.
 */

/** Links shown to everyone in the top navigation. */
export const PUBLIC_NAV = [
  { to: '/', get label() { return t('nav.home') }, end: true },
  { to: '/explore', get label() { return t('nav.explore') } },
  // The two reporting routes are unchanged; they simply share one menu, which
  // takes an item out of the header without hiding anything.
  {
    get label() {
      return t('nav.report')
    },
    children: [
      { to: '/report/lost', get label() { return t('nav.reportLost') } },
      { to: '/report/found', get label() { return t('nav.reportFound') } },
    ],
  },
  { to: '/about', get label() { return t('nav.about') } },
  { to: '/help', get label() { return t('nav.help') } },
]

/** Sidebar links for a Customer/User. */
export const USER_NAV = [
  { to: '/dashboard', get label() { return t('nav.overview') }, icon: LayoutDashboard, end: true },
  { to: '/dashboard/reports', get label() { return t('nav.myReports') }, icon: FileText },
  { to: '/dashboard/matches', get label() { return t('nav.possibleMatches') }, icon: Heart },
  { to: '/dashboard/notifications', get label() { return t('nav.notifications') }, icon: Bell },
  { to: '/dashboard/profile', get label() { return t('nav.profile') }, icon: User },
]

/** Sidebar links for a Staff / Pet Coordinator. */
export const STAFF_NAV = [
  { to: '/staff', get label() { return t('nav.overview') }, icon: Gauge, end: true },
  // Correction 4: new reports wait here for a coordinator before publication.
  { to: '/staff/review', get label() { return t('nav.reportReview') }, icon: ClipboardCheck, get countLabel() { return t('nav.countWaiting') } },
  // The badge counts Active + Possible Match reports: the open ones.
  { to: '/staff/reports', get label() { return t('nav.reportQueue') }, icon: FileText, get countLabel() { return t('nav.countOpen') } },
  { to: '/staff/matches', get label() { return t('nav.matchQueue') }, icon: Heart },
  { to: '/staff/verification', get label() { return t('nav.verification') }, icon: ShieldCheck },
  { to: '/staff/notifications', get label() { return t('nav.notifications') }, icon: Bell },
]

/** Sidebar links for an Administrator. */
export const ADMIN_NAV = [
  { to: '/admin', get label() { return t('nav.overview') }, icon: Gauge, end: true },
  // Correction 6: each link names the capability it needs, and the workspace
  // shows only the ones this administrator's level includes.
  { to: '/admin/users', get label() { return t('nav.users') }, icon: Users, capability: CAPABILITIES.MANAGE_ACCOUNTS },
  { to: '/admin/reports', get label() { return t('nav.reports') }, icon: ListChecks, capability: CAPABILITIES.MODERATE_REPORTS },
  { to: '/admin/categories', get label() { return t('nav.categories') }, icon: FolderTree, capability: CAPABILITIES.MANAGE_REFERENCE_DATA },
  { to: '/admin/moderation', get label() { return t('nav.moderation') }, icon: Flag, capability: CAPABILITIES.MODERATE_REPORTS },
  // Correction 5: sessions, IP addresses, activity and security events —
  // Super Administrators only (Correction 6).
  { to: '/admin/logs', get label() { return t('nav.logs') }, icon: ScrollText, capability: CAPABILITIES.VIEW_SECURITY_LOGS },
]

/**
 * The workspace each role gets a top-navigation shortcut to. Roles only reach
 * their own workspace — switching the demo role is how you see the others.
 */
export const WORKSPACE_BY_ROLE = {
  [ROLES.USER]: { to: '/dashboard', get label() { return t('nav.myDashboard') } },
  [ROLES.STAFF]: { to: '/staff', get label() { return t('nav.staffWorkspace') } },
  [ROLES.ADMIN]: { to: '/admin', get label() { return t('nav.administration') } },
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
