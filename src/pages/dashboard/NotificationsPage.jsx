import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Flag, Heart, House, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { NOTIFICATION_TYPES } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { notificationService, userService } from '@/services'
import { formatRelativeTime } from '@/utils/date'
import { cn } from '@/utils/cn'
import emptyNoNotifications from '@/assets/empty-no-notifications.webp'

/**
 * An icon and a tone per kind of event, so the list can be scanned without
 * reading every line. Three tones only — amber for a possible match, teal for
 * the verification steps, green for a pet home — and grey for everything
 * else. The title always says what happened, so colour is never the only cue.
 */
const TYPE_STYLES = {
  [NOTIFICATION_TYPES.MATCH_SUGGESTED]: [Heart, 'bg-accent-soft text-lost'],
  [NOTIFICATION_TYPES.VERIFICATION_REQUESTED]: [ShieldCheck, 'bg-brand-soft text-brand-hover'],
  [NOTIFICATION_TYPES.STAFF_REVIEWED]: [ShieldCheck, 'bg-brand-soft text-brand-hover'],
  [NOTIFICATION_TYPES.MATCH_CONFIRMED]: [House, 'bg-success-soft text-success-ink'],
  [NOTIFICATION_TYPES.PET_RETURNED]: [House, 'bg-success-soft text-success-ink'],
  [NOTIFICATION_TYPES.MATCH_REJECTED]: [XCircle, 'bg-surface-muted text-fg-muted'],
  [NOTIFICATION_TYPES.REPORT_UPDATED]: [RefreshCw, 'bg-surface-muted text-fg-muted'],
  [NOTIFICATION_TYPES.STATUS_CHANGED]: [RefreshCw, 'bg-surface-muted text-fg-muted'],
  [NOTIFICATION_TYPES.REPORT_FLAGGED]: [Flag, 'bg-surface-muted text-fg-muted'],
}

async function loadNotifications() {
  const user = await userService.getCurrentUser()
  const notifications = await notificationService.getNotifications(user.id)
  return { user, notifications }
}

/**
 * The notification centre.
 *
 * Shared by the user dashboard and the staff workspace — the list is the
 * current account's either way, so only the breadcrumb differs.
 *
 * @param {Object} props
 * @param {string} [props.workspacePath]
 * @param {string} [props.workspaceLabel]
 */
export function NotificationsPage({
  workspacePath = '/dashboard',
  workspaceLabel = 'My dashboard',
  // Where "See the match" goes. A coordinator acts on pairings in the
  // verification workspace; a user reviews them on their matches page.
  matchPath = '/dashboard/matches',
}) {
  const { data, error, isLoading, reload } = useAsync(loadNotifications)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const header = (
    <PageHeader
      title="Notifications"
      description="Updates on your reports, possible matches and verification requests."
      breadcrumb={[{ label: workspaceLabel, to: workspacePath }, { label: 'Notifications' }]}
    />
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingSkeleton lines={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p role="alert" className="text-sm text-danger">
          Your notifications could not be loaded: {error.message}
        </p>
      </div>
    )
  }

  const { user, notifications } = data
  const unreadCount = notifications.filter((item) => !item.isRead).length
  const visible = showUnreadOnly ? notifications.filter((item) => !item.isRead) : notifications

  const markOne = async (id) => {
    await notificationService.markAsRead(id)
    reload()
  }

  const markAll = async () => {
    setIsBusy(true)
    try {
      await notificationService.markAllAsRead(user.id)
      reload()
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex gap-1" role="tablist" aria-label="Show">
          {[
            { id: 'all', label: 'All', count: notifications.length, unreadOnly: false },
            { id: 'unread', label: 'Unread', count: unreadCount, unreadOnly: true },
          ].map((tab) => {
            const selected = showUnreadOnly === tab.unreadOnly

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setShowUnreadOnly(tab.unreadOnly)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-sm transition-colors',
                  selected
                    ? 'bg-brand-soft font-semibold text-brand-hover'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'min-w-5 rounded-pill px-1.5 text-center text-xs font-semibold tabular-nums',
                    selected ? 'bg-panel text-brand-hover' : 'bg-surface-muted text-fg-muted',
                  )}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={markAll}
          disabled={unreadCount === 0}
          isLoading={isBusy}
        >
          Mark all as read
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
illustration={emptyNoNotifications}
          title={showUnreadOnly ? "You're all caught up" : 'No notifications yet'}
          description={
            showUnreadOnly
              ? 'Every notification has been read. Earlier ones are still under All.'
              : 'When a possible match is found, or one of your reports changes, you will hear about it here.'
          }
        />
      ) : (
        // Grouped by age and packed into divided rows rather than a stack of
        // separate cards. A notification list is read top to bottom in one
        // pass; twelve bordered panels made that a scroll.
        <div className="flex flex-col gap-6">
          {groupByAge(visible).map((group) => (
            <section key={group.label} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-fg-muted">{group.label}</h2>

              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-panel">
                {group.items.map((notification) => {
                  const [Icon, tone] = TYPE_STYLES[notification.type] ?? [
                    Bell,
                    'bg-surface-muted text-fg-muted',
                  ]
                  const unread = !notification.isRead
                  // Following one of its links is reading it: the same
                  // mark-as-read request the button sends, fired as you go.
                  const readOnFollow = unread ? () => markOne(notification.id) : undefined
                  const date = (
                    <time
                      dateTime={notification.createdAt}
                      className="text-sm whitespace-nowrap text-fg-muted"
                    >
                      {formatRelativeTime(notification.createdAt)}
                    </time>
                  )

                  return (
                    <li
                      key={notification.id}
                      // Unread: a thin teal bar and the faintest tint, a
                      // stronger title and the New badge. Read: plain white.
                      className={cn(
                        'relative flex gap-3 p-4 sm:gap-4',
                        unread &&
                          'bg-brand-soft/20 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-brand',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control',
                          tone,
                        )}
                      >
                        <Icon size={17} aria-hidden="true" />
                      </span>

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className={cn('text-fg', unread ? 'font-semibold' : 'font-medium')}>
                            {notification.title}
                          </h3>
                          {unread && (
                            <span className="rounded-pill bg-brand px-2 py-0.5 text-[0.6875rem] font-semibold text-fg-inverted">
                              New
                            </span>
                          )}
                          {/* Beside the title from `sm` up; on a phone it
                              gets its own line under the message. */}
                          <span className="ml-auto hidden sm:inline">{date}</span>
                        </div>

                        {notification.body && (
                          <p className="text-sm text-fg-muted">{notification.body}</p>
                        )}

                        <span className="sm:hidden">{date}</span>

                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                          {notification.reportId && (
                            <Link
                              to={`/pet/${notification.reportId}`}
                              onClick={readOnFollow}
                              className="py-1 text-sm font-medium text-brand hover:underline"
                            >
                              View report
                            </Link>
                          )}
                          {notification.matchId && (
                            <Link
                              to={`${matchPath}#match-${notification.matchId}`}
                              onClick={readOnFollow}
                              className="py-1 text-sm font-medium text-brand hover:underline"
                            >
                              See match
                            </Link>
                          )}
                          {unread && (
                            <button
                              type="button"
                              onClick={() => markOne(notification.id)}
                              className="py-1 text-sm text-fg-muted hover:text-fg hover:underline"
                            >
                              Mark as read
                              <span className="sr-only">: {notification.title}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Split a notification list into Today / This week / Earlier, keeping the
 * original newest-first order inside each group.
 *
 * Empty groups are dropped, so a quiet week does not render three headings
 * over one row.
 */
function groupByAge(notifications, now = new Date()) {
  const dayInMs = 24 * 60 * 60 * 1000
  const groups = [
    { label: 'Today', items: [] },
    { label: 'This week', items: [] },
    { label: 'Earlier', items: [] },
  ]

  for (const notification of notifications) {
    const age = now.getTime() - new Date(notification.createdAt).getTime()
    const index = age < dayInMs ? 0 : age < 7 * dayInMs ? 1 : 2
    groups[index].items.push(notification)
  }

  return groups.filter((group) => group.items.length > 0)
}
