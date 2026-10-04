/**
 * Match suggestion data access.
 *
 * Reads, generates and updates match suggestions. The comparison itself lives
 * on the server in api/matching.php, which runs whenever a report is filed;
 * this file is the data access and the workflow around it.
 *
 * Language rule (CLAUDE.md §6.5): a match is always a *possible* match. Nothing
 * in this layer, or any UI built on it, may present one as a certainty.
 */

import { MATCH_STATUSES, REPORT_STATUSES } from '@/constants'
import * as petService from './petService'

import { apiFetch, queryString } from './api'
import { t } from '@/i18n'

/** The seven signals the matcher compares, with the wording the UI shows. */
const SIGNAL_KEYS = ['species', 'location', 'breed', 'color', 'size', 'date', 'characteristics']


/**
 * Every decision on a pairing goes through one endpoint, which names the
 * action. The API decides who is allowed to take it — a reporter can say "this
 * could be mine" or "not my pet", but only a coordinator can confirm or reject.
 */
async function decide(matchId, action, note) {
  const payload = await apiFetch(`/matches/${matchId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, note: note ?? null }),
  })

  return matchFromApi(payload.data)
}

/** Map an API match onto the shape the match components already read. */
function matchFromApi(row) {
  return {
    id: row.match_id,
    lostReportId: row.lost_report_id,
    foundReportId: row.found_report_id,
    score: row.score,
    status: row.status,
    proofNotes: row.proof_notes ?? '',
    reviewedByStaffId: row.reviewed_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signals: (row.signals ?? []).map((signal) => ({
      key: signal.key,
      // Read when shown, in the language showing (Correction 7). The detail
      // beside it is the server's own sentence, written in English when the
      // pairing was scored.
      get label() {
        return SIGNAL_KEYS.includes(signal.key) ? t(`matching.signal.${signal.key}`) : signal.key
      },
      matched: signal.matched,
      weight: signal.weight,
      detail: signal.detail ?? '',
    })),
  }
}


/** A suggestion the user or staff has already dealt with is not offered again. */
const SETTLED_STATUSES = [MATCH_STATUSES.REJECTED, MATCH_STATUSES.DISMISSED]

/** List suggestions, highest score first. `query` accepts: status, minScore, limit. */
export async function getMatches(query = {}) {
  const payload = await apiFetch(`/matches${queryString({ status: query.status })}`)
  return payload.data.map(matchFromApi)
}

export async function getMatchById(id) {
  const payload = await apiFetch(`/matches/${id}`)
  return matchFromApi(payload.data)
}

export async function getMatchesForReport(reportId) {
  const payload = await apiFetch(`/matches${queryString({ report_id: reportId })}`)
  return payload.data.map(matchFromApi)
}

export async function getMatchesForUser(userId) {
  const payload = await apiFetch(`/matches${queryString({ user_id: userId })}`)
  return payload.data.map(matchFromApi)
}

export async function updateMatchStatus(id, status, context = {}) {
  const match = await getMatchById(id)

  match.status = status
  match.updatedAt = new Date().toISOString()

  if (context.staffId) match.reviewedByStaffId = context.staffId
  if (context.note) match.staffNotes = context.note

  return match
}

/**
 * A user dismissing a suggestion about their own report.
 *
 * A generated suggestion has to be stored before it can be dismissed, or the
 * algorithm simply offers it again on the next page load.
 *
 * @param {Object} match  A stored match or a generated suggestion.
 */
export async function dismissMatch(match) {
  return decide(match.id ?? match, 'dismiss')
}

export async function requestVerification(match, _requestedByUserId) {
  // The API takes the requester from the session rather than the argument, so
  // one account cannot raise a request in another account's name.
  return decide(match.id ?? match, 'request_verification')
}

export async function confirmMatch(id, context = {}) {
  // Confirming closes both reports as returned and notifies both reporters.
  // That cascade runs inside one database transaction on the server.
  return decide(id, 'confirm', context.note)
}

/**
 * The reporter says their pet is home.
 *
 * This used to look for an open pairing first and confirm it, but that branch
 * could never run: it read pairings from mock data, whose ids never equal the
 * numeric ones the API returns. Pointing it at real data would not have fixed
 * it either — confirming a pairing is a coordinator's decision, so an owner
 * marking their own pet returned would have started failing with 403.
 *
 * So it now does what it has always actually done: set the status. An open
 * pairing stays open for a coordinator to settle. Whether marking a pet
 * returned should also dismiss one is a decision for the team, not something
 * to infer from dead code.
 */
export async function markReportReturned(reportId, actorId) {
  const report = await petService.updateReportStatus(reportId, REPORT_STATUSES.RETURNED, {
    actorId,
    note: 'Marked as returned by the reporter.',
  })

  return { report, confirmedMatchId: null }
}

/**
 * A coordinator deciding the two reports are not the same animal.
 *
 * Both reports stay open — rejecting a pairing does not mean either pet has
 * been found, and the search continues.
 *
 * @param {string} id
 * @param {{ staffId: string, note?: string }} context
 */
export async function rejectMatch(id, context = {}) {
  return decide(id, 'reject', context.note)
}

/**
 * A Pet Coordinator undoes a rejection or a confirmation made in error. The
 * server decides whether it may (api/matches.php, reopen_preflight()): it
 * refuses if a report has been closed since, or has changed so that the stored
 * comparison no longer describes it.
 */
export async function reopenMatch(id, note) {
  return decide(id, 'reopen', note)
}

export async function requestMoreInformation(id, context = {}) {
  return decide(id, 'request_information', context.note)
}

/**
 * A reporter's answer to requestMoreInformation. The server delivers it to the
 * Pet Coordinators only; the other reporter never receives it.
 */
export const PROVIDE_INFORMATION_MAX = 255

export async function provideInformation(id, answer) {
  return decide(id, 'provide_information', answer)
}

export async function getMatchesWithReports(query = {}) {
  const payload = await apiFetch('/matches')
  let rows = payload.data.map(matchFromApi)

  if (query.statuses) rows = rows.filter((match) => query.statuses.includes(match.status))
  if (query.status) rows = rows.filter((match) => match.status === query.status)

  // Each pairing needs both of its reports for the side-by-side comparison.
  return Promise.all(
    rows.map(async (match) => ({
      match,
      lostReport: await petService.getReportById(match.lostReportId),
      foundReport: await petService.getReportById(match.foundReportId),
    })),
  )
}

/**
 * Stored matches plus freshly generated suggestions for every report a user
 * filed — what the "Possible matches" page shows.
 *
 * @param {string} userId
 */
export async function getSuggestionsForUser(userId) {
  // Suggestions are stored rows now, not something recomputed in the browser:
  // the coordinator and the reporter must be looking at the same comparison.
  const payload = await apiFetch(`/matches${queryString({ user_id: userId })}`)

  return payload.data
    .map(matchFromApi)
    .filter((match) => !SETTLED_STATUSES.includes(match.status))
}
