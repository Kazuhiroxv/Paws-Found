/**
 * The activity trail and the administrators' log viewer (Correction 5).
 *
 * The browser reports one thing, the page a signed-in person opened. Everything
 * else in the logs — every action, who, which session, the IP, the time — is
 * written by the PHP API itself (api/helpers.php, activity_log()).
 */

import { apiFetch, queryString } from './api'

/**
 * Report the page this signed-in browser just opened. The path only: never the
 * query string or the #fragment, which is where a reset link keeps its token.
 * Best effort — a log that could not be written must never stop the page.
 */
export async function logPageView(pathname) {
  try {
    await apiFetch('/activity/page-view', {
      method: 'POST',
      body: JSON.stringify({ path: pathname }),
    })
  } catch {
    // Deliberately ignored: navigation does not depend on the trail.
  }
}

/** One page of a log, newest first: `{ rows, page, totalPages, total }`. */
async function page(kind, filters) {
  const payload = await apiFetch(`/logs/${kind}${queryString(filters)}`)

  return {
    rows: payload.data,
    page: payload.meta.page,
    perPage: payload.meta.per_page,
    total: payload.meta.total,
    totalPages: payload.meta.total_pages,
  }
}

/** filters: user, action ('actions' for everything but page views), ip, route, session, from, to, page. */
export const getActivityLog = (filters = {}) => page('activity', filters)

/** filters: user, ip, session, state ('open' | 'ended' | 'expired'), from, to, page. */
export const getSessionLog = (filters = {}) => page('sessions', filters)

/** filters: user, action, outcome, ip, from, to, page. */
export const getAuditLog = (filters = {}) => page('audit', filters)
