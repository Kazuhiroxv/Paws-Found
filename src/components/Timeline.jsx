import { REPORT_STATUSES, REPORT_STATUS_LABELS } from '@/constants'
import { formatDateTime } from '@/utils/date'
import { cn } from '@/utils/cn'

const DOT_COLOURS = {
  [REPORT_STATUSES.ACTIVE]: 'bg-status-active',
  [REPORT_STATUSES.POSSIBLE_MATCH]: 'bg-status-match',
  [REPORT_STATUSES.RETURNED]: 'bg-status-returned',
  [REPORT_STATUSES.CLOSED]: 'bg-status-closed',
}

/**
 * What each status means, for an entry that arrives without a note.
 *
 * Somebody who is not on the case gets the status and the date but not the
 * note written with it — the API withholds it (a closure or moderation reason
 * is for the reporter, not the neighbourhood). The line is derived from the
 * status alone, so it can never say more than the status does.
 */
const STATUS_COPY = {
  [REPORT_STATUSES.ACTIVE]: 'The report is open and being compared with new reports.',
  [REPORT_STATUSES.POSSIBLE_MATCH]: 'A possible match is being reviewed.',
  [REPORT_STATUSES.RETURNED]: 'Marked as returned home.',
  [REPORT_STATUSES.CLOSED]: 'The report was closed.',
}

/**
 * A report's history, oldest first.
 *
 * Rendered straight from `statusHistory`, which is appended to and never
 * overwritten (CLAUDE.md §6.7). That is what makes a case auditable: you can
 * see when it changed, who changed it and why, rather than only where it ended
 * up.
 *
 * @param {Object} props
 * @param {Array} props.entries  `report.statusHistory`.
 * @param {Record<string, string>} [props.actorNames]  User id → display name.
 */
export function Timeline({ entries, actorNames = {} }) {
  if (!entries || entries.length === 0) return null

  const ordered = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))

  return (
    <ol className="flex flex-col">
      {ordered.map((entry, index) => {
        const isLast = index === ordered.length - 1

        return (
          <li key={entry.id} className="flex gap-3">
            {/* Dot and connecting line. Decorative — the label carries meaning. */}
            <div className="flex flex-col items-center" aria-hidden="true">
              <span
                className={cn(
                  'mt-1.5 size-2.5 shrink-0 rounded-full',
                  DOT_COLOURS[entry.status] ?? 'bg-status-closed',
                )}
              />
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>

            <div className={cn('flex flex-col gap-0.5', isLast ? 'pb-0' : 'pb-5')}>
              <p className="text-sm font-medium text-fg">
                {REPORT_STATUS_LABELS[entry.status] ?? entry.status}
              </p>
              <p className="text-sm text-fg-muted">{entry.note || STATUS_COPY[entry.status]}</p>
              <p className="text-sm text-fg-muted">
                {formatDateTime(entry.createdAt)}
                {actorNames[entry.actorId] && ` · ${actorNames[entry.actorId]}`}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
