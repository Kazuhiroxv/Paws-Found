import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Flag, Heart, House, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { NOTIFICATION_TYPES } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { notificationService, userService } from '@/services'
import { formatRelativeTime, parseDateTime } from '@/utils/date'
import { cn } from '@/utils/cn'
import emptyNoNotifications from '@/assets/empty-no-notifications.webp'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

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
  [NOTIFICATION_TYPES.REPORT_SUBMITTED]: [ShieldCheck, 'bg-surface-muted text-fg-muted'],
  [NOTIFICATION_TYPES.REPORT_PUBLISHED]: [ShieldCheck, 'bg-success-soft text-success-ink'],
  [NOTIFICATION_TYPES.REPORT_REJECTED]: [XCircle, 'bg-surface-muted text-fg-muted'],
  [NOTIFICATION_TYPES.REPORT_REMOVED]: [Flag, 'bg-surface-muted text-fg-muted'],
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
  workspaceLabel,
  // Where "See the match" goes. A coordinator acts on pairings in the
  // verification workspace; a user reviews them on their matches page.
  matchPath = '/dashboard/matches',
}) {
  const { data, error, isLoading, reload } = useAsync(loadNotifications)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const header = (
    <PageHeader
      title={t('nav.notifications')}
      description={t('notifications.description')}
      breadcrumb={[
        { label: workspaceLabel ?? t('dashboard.title'), to: workspacePath },
        { label: t('nav.notifications') },
      ]}
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
          {t('notifications.failed', { message: errorText(error) })}
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

      {/* Underlined tabs, like My Reports and Possible Matches. The action sits
          on the same rule, lifted clear of it. */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div className="flex gap-1" role="tablist" aria-label={t('notifications.show')}>
          {[
            { id: 'all', label: t('notifications.all'), count: notifications.length, unreadOnly: false },
            { id: 'unread', label: t('notifications.unread'), count: unreadCount, unreadOnly: true },
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
                  '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
                  selected
                    ? 'border-brand font-medium text-brand-hover'
                    : 'border-transparent text-fg-muted hover:text-fg',
                )}
              >
                {tab.label}
                <span className="ml-1.5 text-fg-muted tabular-nums">{tab.count}</span>
              </button>
            )
          })}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={markAll}
          className="mb-2"
          disabled={unreadCount === 0}
          isLoading={isBusy}
        >
          {t('notifications.markAll')}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          illustration={emptyNoNotifications}
          title={showUnreadOnly ? t('notifications.caughtUp') : t('notifications.none')}
          description={showUnreadOnly ? t('notifications.caughtUpBody') : t('notifications.noneBody')}
        />
      ) : (
        // Grouped by age and packed into divided rows rather than a stack of
        // separate cards. A notification list is read top to bottom in one
        // pass; twelve bordered panels made that a scroll.
        <div className="flex flex-col gap-6">
          {groupByAge(visible).map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-fg-muted">{t(`notifications.groups.${group.key}`)}</h2>

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
                          {/* The notification's own words, written by the
                              server in English when it happened and stored
                              that way (Correction 7): marked as English, so a
                              screen reader reading the Filipino page says
                              them right. */}
                          <h3 lang="en" className={cn('text-fg', unread ? 'font-semibold' : 'font-medium')}>
                            {notification.title}
                          </h3>
                          {unread && (
                            <span className="rounded-pill bg-brand px-2 py-0.5 text-[0.6875rem] font-semibold text-fg-inverted">
                              {t('notifications.new')}
                            </span>
                          )}
                          {/* Beside the title from `sm` up; on a phone it
                              gets its own line under the message. */}
                          <span className="ml-auto hidden sm:inline">{date}</span>
                        </div>

                        {notification.body && (
                          <p lang="en" className="text-sm text-fg-muted">{notification.body}</p>
                        )}

                        <span className="sm:hidden">{date}</span>

                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                          {notification.reportId && (
                            <Link
                              to={`/pet/${notification.reportId}`}
                              onClick={readOnFollow}
                              className="py-1 text-sm font-medium text-brand hover:underline"
                            >
                              {t('map.viewReport')}
                            </Link>
                          )}
                          {notification.matchId && (
                            <Link
                              to={`${matchPath}#match-${notification.matchId}`}
                              onClick={readOnFollow}
                              className="py-1 text-sm font-medium text-brand hover:underline"
                            >
                              {t('notifications.seeMatch')}
                            </Link>
                          )}
                          {unread && (
                            <button
                              type="button"
                              onClick={() => markOne(notification.id)}
                              className="py-1 text-sm text-fg-muted hover:text-fg hover:underline"
                            >
                              {t('notifications.markRead')}
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
    { key: 'today', items: [] },
    { key: 'week', items: [] },
    { key: 'earlier', items: [] },
  ]

  for (const notification of notifications) {
    const age = now.getTime() - parseDateTime(notification.createdAt).getTime()
    const index = age < dayInMs ? 0 : age < 7 * dayInMs ? 1 : 2
    groups[index].items.push(notification)
  }

  return groups.filter((group) => group.items.length > 0)
}
