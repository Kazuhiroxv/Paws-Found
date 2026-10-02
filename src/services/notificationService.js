/**
 * Notification data access.
 *
 * Every function here calls the PHP API, which reads and writes the
 * `notifications` table. Nothing creates a notification from the browser: the
 * API writes them itself, inside the same transaction as the decision that
 * caused them, so a notification can never exist for something that did not
 * happen.
 */

import { apiFetch } from './api'

/** An API notification in the shape the notification centre already reads. */
function notificationFromApi(row) {
  return {
    id: row.notification_id,
    type: row.type,
    title: row.title,
    body: row.body ?? '',
    reportId: row.report_id,
    matchId: row.match_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  }
}


/** One user's notifications, newest first. `query` accepts: unreadOnly, limit. */
export async function getNotifications(_userId) {
  // The account comes from the session, not the argument: one account must not
  // be able to read another's notifications by passing a different id.
  const payload = await apiFetch('/notifications')
  return payload.data.map(notificationFromApi)
}

export async function getUnreadCount(_userId) {
  const payload = await apiFetch('/notifications')
  return payload.meta.unread
}

export async function markAsRead(id) {
  const payload = await apiFetch(`/notifications/${id}`, { method: 'PATCH' })
  return payload.data.map(notificationFromApi)
}

export async function markAllAsRead(_userId) {
  const payload = await apiFetch('/notifications', { method: 'PATCH' })
  return payload.data.map(notificationFromApi)
}
