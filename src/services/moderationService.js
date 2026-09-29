/**
 * Moderation data access — flags raised against reports, resolved by
 * administrators.
 *
 * Keep this to the approved actions only (CLAUDE.md §6.9). No automated
 * takedowns, bulk suspensions, or scoring of users.
 */

import { apiFetch, assetUrl, queryString } from './api'

/**
 * Turn one API queue row into the shape the moderation page already reads.
 *
 * The server sends the case, the flagged report and both people together, so
 * this is a reshape rather than four more requests.
 */
function fromApi(row) {
  return {
    moderationCase: {
      id: row.case_id,
      reportId: row.report_id,
      reason: row.reason,
      details: row.details ?? '',
      status: row.case_status,
      resolutionNote: row.resolution_note ?? '',
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    },
    report: {
      id: row.report.report_id,
      petName: row.report.pet_name,
      reportType: row.report.report_type,
      status: row.report.status,
      description: row.report.description ?? '',
      photos: row.report.photo_path
        ? [{ id: `photo-${row.report.report_id}`, url: assetUrl(row.report.photo_path), alt: '', isPrimary: true }]
        : [],
    },
    reporter: {
      id: row.owner.user_id,
      fullName: row.owner.full_name,
      accountStatus: row.owner.account_status,
    },
    // The flagging account may since have been deleted, and the queue still
    // has to render — the flag is about the report, not about who raised it.
    reportedBy: row.flagged_by
      ? { id: row.flagged_by.user_id, fullName: row.flagged_by.full_name }
      : { id: null, fullName: 'A removed account' },
  }
}

/**
 * Flagged cases with everything the moderation queue needs: the report, whoever
 * filed it, and whoever flagged it.
 *
 * `query` accepts: status ('open' | 'dismissed' | 'actioned'), reason.
 */
export async function getCasesWithContext(query = {}) {
  const payload = await apiFetch(`/moderation${queryString(query)}`)

  return payload.data.map(fromApi)
}

/**
 * A community member flags a report. `input` takes: reportId, reason, details.
 *
 * There is no `reportedByUserId` — the server takes that from the session, so
 * nobody can raise a flag in someone else's name.
 */
export async function createCase(input) {
  const payload = await apiFetch('/moderation', {
    method: 'POST',
    // Stringified here, like every other JSON write: apiFetch labels the body
    // application/json but sends it as given, and a plain object goes out as
    // "[object Object]", which the API rightly refuses as invalid JSON.
    body: JSON.stringify({
      report_id: input.reportId,
      reason: input.reason,
      details: input.details,
    }),
  })

  return payload.data
}

/**
 * Apply an administrator's decision to a flagged report.
 *
 * The four actions from the approved list (CLAUDE.md §6.9), and nothing beyond
 * them. The server closes the case, applies the consequence and tells whoever
 * is affected in one transaction — a moderation decision that nobody hears
 * about is not a decision, it is a deletion.
 *
 * @param {number} caseId
 * @param {Object} decision
 * @param {'dismiss'|'warn'|'remove'|'suspend'} decision.action
 * @param {string} [decision.note]
 */
export async function applyDecision(caseId, decision) {
  const payload = await apiFetch(`/moderation/${caseId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: decision.action, note: decision.note ?? '' }),
  })

  return payload.data
}
