import { MATCH_STATUSES, MATCH_STATUSES_AWAITING_STAFF, REPORT_STATUSES } from '@/constants'
import { matchService, notificationService, petService, userService } from '@/services'

/**
 * The Staff sidebar's count badges, keyed by the link they sit on. Each is a
 * number the page behind the link already shows:
 *
 *   Report Review  reports waiting for a coordinator before publication
 *   Report Queue   open reports (Active + Possible Match)
 *   Match Queue    open pairings no one has acted on yet
 *   Verification   pairings waiting on a coordinator
 *   Notifications  unread
 */
export async function loadStaffCounts() {
  const user = await userService.getCurrentUser()
  const [reports, matches, unread, waiting] = await Promise.all([
    petService.getReports(),
    matchService.getMatches(),
    notificationService.getUnreadCount(user.id),
    petService.getReportsForReview(),
  ])

  return {
    '/staff/review': waiting.length,
    '/staff/reports': reports.filter((report) =>
      [REPORT_STATUSES.ACTIVE, REPORT_STATUSES.POSSIBLE_MATCH].includes(report.status),
    ).length,
    '/staff/matches': matches.filter((match) => match.status === MATCH_STATUSES.SUGGESTED).length,
    '/staff/verification': matches.filter((match) =>
      MATCH_STATUSES_AWAITING_STAFF.includes(match.status),
    ).length,
    '/staff/notifications': unread,
  }
}
