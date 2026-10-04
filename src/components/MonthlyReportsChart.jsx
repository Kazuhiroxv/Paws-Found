import { t } from '@/i18n'
import { formatMonthShort } from '@/utils/date'
/**
 * Reports filed per month, lost beside found.
 *
 * Drawn with plain elements rather than a charting library: six months of two
 * numbers does not justify a dependency, and every part of this is something a
 * member can explain during the defence (CLAUDE.md §15).
 *
 * Bars are measured against the tallest single value rather than the tallest
 * month, so the two series stay comparable to each other.
 *
 * The drawing is `aria-hidden` and the same figures are given as a table for
 * screen readers — a chart with no text alternative is not readable at all.
 *
 * @param {Object} props
 * @param {{month: string, label: string, lost: number, found: number, total: number}[]} props.months
 */
export function MonthlyReportsChart({ months }) {
  // Never zero, or every bar would divide by it.
  const peak = Math.max(1, ...months.map((month) => Math.max(month.lost, month.found)))
  const height = (value) => `${(value / peak) * 100}%`

  const filed = months.reduce((sum, month) => sum + month.total, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* The legend names each bar's position as well as its colour, and
          every bar carries its own number, so nothing depends on telling
          amber from teal. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 text-fg-muted">
          <span aria-hidden="true" className="size-2.5 rounded-xs bg-lost" />
          {t('chart.lost')} <span className="text-fg-muted">{t('chart.leftBar')}</span>
        </span>
        <span className="flex items-center gap-1.5 text-fg-muted">
          <span aria-hidden="true" className="size-2.5 rounded-xs bg-found" />
          {t('chart.found')} <span className="text-fg-muted">{t('chart.rightBar')}</span>
        </span>
      </div>

      <div aria-hidden="true" className="flex items-end gap-1 border-b border-border sm:gap-4">
        {months.map((month) => (
          <div key={month.month} className="flex flex-1 flex-col items-center">
            {/* Numbers sit above the bars; a month with no reports draws no
                bar, which is the honest reading, but still shows its 0. */}
            <div className="flex h-36 w-full items-end justify-center gap-1 sm:gap-1.5">
              <Bar value={month.lost} height={height(month.lost)} className="bg-lost" />
              <Bar value={month.found} height={height(month.found)} className="bg-found" />
            </div>
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="-mt-2 flex gap-1 sm:gap-4">
        {months.map((month) => (
          <div key={month.month} className="flex flex-1 flex-col items-center">
            <span className="text-xs text-fg-muted">{formatMonthShort(month.month) || month.label}</span>
            <span className="text-sm font-semibold text-fg tabular-nums">{month.total}</span>
          </div>
        ))}
      </div>

      {/* The same figures as text. Wrapped rather than `sr-only` on the
          table itself: the caption escaped the clip and pushed a phone 5px
          wider than the screen. */}
      <div className="sr-only">
      <table>
        <caption>{t('chart.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('chart.month')}</th>
            <th scope="col">{t('chart.lost')}</th>
            <th scope="col">{t('chart.found')}</th>
            <th scope="col">{t('chart.total')}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <th scope="row">{month.month}</th>
              <td>{month.lost}</td>
              <td>{month.found}</td>
              <td>{month.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <p className="text-sm text-fg-muted">
        {t('chart.totalsNote')}{' '}
        <span className="font-medium text-fg">{t('chart.reports', { count: filed })}</span>{' '}
        {t('chart.filed')}
      </p>
    </div>
  )
}

/** One bar with its value above it. */
function Bar({ value, height, className }) {
  return (
    <div className="flex h-full w-3.5 flex-col items-center justify-end gap-1 sm:w-5">
      <span className="text-[11px] leading-none text-fg-muted tabular-nums">{value}</span>
      {/* `max-h` leaves room for the number above a full-height bar. */}
      <span className={`block max-h-[calc(100%-1rem)] w-full rounded-t-xs ${className}`} style={{ height }} />
    </div>
  )
}
