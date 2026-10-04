import { Link } from 'react-router-dom'
import { ArrowRight, FileText, Heart, PawPrint, ShieldCheck } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, LoadingSkeleton } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { StatTile } from '@/components/StatTile'
import { MatchStatusBadge, PairingName } from '@/components/MatchComparison'
import { StatusBadge } from '@/components/StatusBadge'
import { BreakdownBars } from '@/components/BreakdownBars'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { MATCH_STATUSES, MATCH_STATUSES_AWAITING_STAFF, REPORT_STATUS_BARS, REPORT_STATUS_LABELS, REPORT_STATUS_ORDER, REPORT_STATUSES, speciesLabel, wasWithdrawn } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { matchService, petService } from '@/services'
import { formatRelativeTime } from '@/utils/date'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

async function loadStaffOverview() {
  const [reports, suggested, awaiting] = await Promise.all([
    petService.getReports(),
    // With their reports, not bare: the queue shows the two animals, and a
    // coordinator judging a pairing wants to see them before the wording.
    matchService.getMatchesWithReports({ status: MATCH_STATUSES.SUGGESTED }),
    matchService.getMatchesWithReports({ statuses: MATCH_STATUSES_AWAITING_STAFF }),
  ])

  return { reports, suggested, awaiting }
}

export function StaffOverviewPage() {
  const { data, error, isLoading } = useAsync(loadStaffOverview)

  const header = (
    <PageHeader
      icon={ShieldCheck}
      eyebrow={t('staff.eyebrow')}
      title={t('shell.workspace.staff')}
      description={t('staff.overview.description')}
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
          {t('staff.overview.failed', { message: errorText(error) })}
        </p>
      </div>
    )
  }

  const { reports, suggested, awaiting } = data
  const active = reports.filter((report) => report.status === REPORT_STATUSES.ACTIVE)
  const returned = reports.filter((report) => report.status === REPORT_STATUSES.RETURNED)

  // Most recently touched first — where a coordinator picks up from.
  const recentlyUpdated = [...reports].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 6)

  return (
    <div className="flex flex-col gap-8">
      {header}

      {/* The first two numbers are work; the last two are context. They are
          sized accordingly rather than presented as four equal figures. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          icon={ShieldCheck}
          label={t('staff.overview.verification')}
          value={awaiting.length}
          to="/staff/verification"
          emphasis
        />
        <StatTile
          icon={Heart}
          label={t('dashboard.matchesTitle')}
          value={suggested.length}
          to="/staff/matches"
          emphasis
        />
        <StatTile icon={FileText} label={t('dashboard.activeReports')} value={active.length} to="/staff/reports" />
        <StatTile icon={PawPrint} label={t('dashboard.petsReturned', { count: 2 })} value={returned.length} />
      </div>

      <NeedsAttention awaiting={awaiting} suggested={suggested} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-fg">{t('staff.overview.recent')}</h2>
          <Button as={Link} to="/staff/reports" variant="ghost" size="sm">
            {t('staff.overview.seeQueue')}
          </Button>
        </div>

        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-panel">
          {recentlyUpdated.map((report) => (
            // The whole row opens the report: the name is a stretched link.
            <li
              key={report.id}
              className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-surface has-[a:focus-visible]:bg-surface"
            >
              <ReportThumb report={report} />
              <ReportTypeBadge reportType={report.reportType} size="sm" />
              <Link
                to={`/pet/${report.id}`}
                className="text-sm font-medium text-fg after:absolute after:inset-0 hover:underline"
              >
                {report.petName ?? t('matching.sideFound', { species: speciesLabel(report.species).toLowerCase() })}
              </Link>
              <StatusBadge status={report.status} variant="pill" />
              <span className="ml-auto text-sm whitespace-nowrap text-fg-muted">
                {report.location.city} · {formatRelativeTime(report.updatedAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <StatusBreakdown reports={reports} />
    </div>
  )
}

/**
 * The one section a coordinator should read first: everything that is blocked
 * on them, newest first, with the action attached to each row.
 */
function NeedsAttention({ awaiting, suggested }) {
  const total = awaiting.length + suggested.length

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-fg">
        {t('staff.overview.attention')}
        {total > 0 && (
          <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-lost tabular-nums">
            {total}
            <span className="sr-only"> {t('shell.workspace.item', { count: total })}</span>
          </span>
        )}
      </h2>

      {total === 0 ? (
        <p className="rounded-card border border-border bg-panel px-4 py-5 text-fg-muted">
          {t('staff.overview.nothing')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-panel">
          {/* Waiting on a decision first, with the stronger button; then open
              pairings nobody has looked at. */}
          {awaiting.map((item) => (
            <AttentionRow
              key={item.match.id}
              {...item}
              to={`/staff/verification#match-${item.match.id}`}
              actionLabel={t('staff.overview.verify')}
              primary
            />
          ))}
          {suggested.map((item) => (
            <AttentionRow
              key={item.match.id}
              {...item}
              to={`/staff/matches#match-${item.match.id}`}
              actionLabel={t('staff.overview.review')}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function AttentionRow({ match, lostReport, foundReport, to, actionLabel, primary = false }) {
  return (
    // A grid on phones so the button drops under the text and lines up with it;
    // beside the text it squeezed each line to two or three words.
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 px-4 py-4 sm:flex sm:items-center sm:gap-4">
      {/* The two animals. A coordinator decides these by looking; the words on
          every row are similar, the photographs are not. */}
      <span className="mt-0.5 flex shrink-0 -space-x-3 sm:mt-0">
        <ReportThumb report={lostReport} />
        <ReportThumb report={foundReport} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <MatchStatusBadge
            status={match.status}
            withdrawn={wasWithdrawn(match.status, lostReport, foundReport)}
            className="px-2.5 py-0.5 text-xs"
          />
          <span className="text-sm text-fg-muted">
            <span className="font-semibold text-fg tabular-nums">{match.score}%</span> {t('matching.compatibility')}
          </span>
        </div>
        <p className="font-medium text-fg">
          <PairingName lost={lostReport} found={foundReport} />
        </p>
        <p className="text-sm text-fg-muted">
          {foundReport.location.city} · {formatRelativeTime(match.updatedAt)}
        </p>
      </div>

      <Button
        as={Link}
        to={to}
        size="sm"
        variant={primary ? 'primary' : 'secondary'}
        className="col-start-2 justify-self-start sm:shrink-0"
      >
        {actionLabel}
        <ArrowRight size={14} aria-hidden="true" />
      </Button>
    </li>
  )
}

/** One report's photograph, sized for a queue row. */
function ReportThumb({ report }) {
  const photo = report.photos.find((item) => item.isPrimary) ?? report.photos[0]

  return (
    <img
      src={photo?.url ?? photoPlaceholder}
      alt=""
      loading="lazy"
      className="size-11 rounded-control border-2 border-panel bg-surface-muted object-cover"
    />
  )
}

/**
 * Where every report currently sits.
 *
 * The bars are plain divs sized by percentage — a chart library for four
 * numbers would be a dependency the project has to justify at a defence.
 */
function StatusBreakdown({ reports }) {
  const rows = REPORT_STATUS_ORDER.map((status) => ({
    key: status,
    label: REPORT_STATUS_LABELS[status],
    value: reports.filter((report) => report.status === status).length,
    barClassName: REPORT_STATUS_BARS[status],
  }))

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-fg">{t('staff.overview.byStatus')}</h2>
      <BreakdownBars rows={rows} total={reports.length} className="rounded-card border border-border bg-panel p-5" />
    </section>
  )
}
