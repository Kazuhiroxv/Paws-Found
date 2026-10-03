import { MATCH_STATUSES, PUBLICATION_STATUSES, REPORT_STATUSES } from '@/constants'
import { matchService, notificationService, petService, userService } from '@/services'

const OPEN_STATUSES = [REPORT_STATUSES.ACTIVE, REPORT_STATUSES.POSSIBLE_MATCH]

/**
 * The handful of numbers a customer's dashboard is built around, read once so
 * the Overview's summary row and the sidebar counts can never disagree.
 *
 * "Possible matches" means pairings still open. A confirmed match is a pet that
 * went home — it belongs under Returned pets, not in a count of things that
 * might be your pet. Rejected and dismissed pairings are already left out by
 * the service.
 */
export async function loadDashboardSummary() {
  const user = await userService.getCurrentUser()

  const [reports, suggestions, unread] = await Promise.all([
    petService.getReportsByUser(user.id),
    matchService.getSuggestionsForUser(user.id),
    notificationService.getUnreadCount(user.id),
  ])

  // Open and Returned are cases, and a case starts at publication
  // (Correction 4): a report waiting for review is not an Open report yet.
  const published = reports.filter((report) => report.publicationStatus === PUBLICATION_STATUSES.PUBLISHED)

  return {
    user,
    reports,
    openReports: published.filter((report) => OPEN_STATUSES.includes(report.status)),
    returnedReports: published.filter((report) => report.status === REPORT_STATUSES.RETURNED),
    inReview: reports.filter((report) => report.publicationStatus === PUBLICATION_STATUSES.PENDING_REVIEW),
    openMatches: suggestions.filter((match) => match.status !== MATCH_STATUSES.CONFIRMED),
    unread,
  }
}

/** The sidebar's count badges, keyed by the link they sit on. */
export async function loadDashboardCounts() {
  const summary = await loadDashboardSummary()

  return {
    '/dashboard/reports': summary.openReports.length,
    '/dashboard/matches': summary.openMatches.length,
    '/dashboard/notifications': summary.unread,
  }
}
