import { Link } from 'react-router-dom'
import { ArrowRight, Flag, FolderTree, Heart, ListChecks, ShieldHalf, Users } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, Card, CardBody, CardHeader, LoadingSkeleton } from '@/components/ui'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { StatTile } from '@/components/StatTile'
import { StatusBadge } from '@/components/StatusBadge'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { BreakdownBars } from '@/components/BreakdownBars'
import { MonthlyReportsChart } from '@/components/MonthlyReportsChart'
import {
  CAPABILITIES,
  MODERATION_REASON_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_BARS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_ORDER,
  ROLE_LABELS,
  speciesLabel,
} from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser'
import { categoryService, moderationService, petService, userService } from '@/services'
import { can } from '@/utils/permissions'
import { formatCardDate } from '@/utils/date'
import { AccountStatusBadge } from './AdminBadges'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

async function loadAdminOverview() {
  const [users, reports, openCases, categories, stats] = await Promise.all([
    userService.getUsers(),
    petService.getReports(),
    moderationService.getCasesWithContext({ status: 'open' }),
    categoryService.getCategories(),
    // Counted by the database. The report list above is a page, not the table,
    // so it cannot answer "how many reports are there".
    petService.getReportStats(),
  ])

  return { users, reports, openCases, categories, stats }
}

/**
 * System oversight.
 *
 * Administration is about accounts, records, categories and moderation — not
 * day-to-day pet cases, which belong to the Pet Coordinators (CLAUDE.md §4.3).
 *
 * Read top to bottom: the numbers, then what needs an administrator, then the
 * analytics. Only the flag count is emphasised — it is the one number that
 * means someone has to act.
 */
export function AdminOverviewPage() {
  const { data, error, isLoading } = useAsync(loadAdminOverview)
  // Correction 6: account and category figures link to pages a Moderator
  // cannot open, so they are shown only to a level that can.
  const user = useWorkspaceUser()
  const mayManageAccounts = can(user, CAPABILITIES.MANAGE_ACCOUNTS)
  const mayManageCategories = can(user, CAPABILITIES.MANAGE_REFERENCE_DATA)

  const header = (
    <PageHeader
      icon={ShieldHalf}
      eyebrow={t('shell.access.eyebrow')}
      title={t('shell.workspace.admin')}
      description={t('admin.overview.description')}
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
          {t('admin.overview.failed', { message: errorText(error) })}
        </p>
      </div>
    )
  }

  const { users, reports, openCases, categories, stats } = data
  const suspended = users.filter((user) => user.accountStatus === 'suspended')

  const statusRows = REPORT_STATUS_ORDER.map((status) => ({
    key: status,
    label: REPORT_STATUS_LABELS[status],
    value: stats.totals[status],
    barClassName: REPORT_STATUS_BARS[status],
  }))

  // Already sorted most-reported-first by the API.
  const speciesRows = stats.bySpecies.map((row) => ({
    key: row.code,
    label: speciesLabel(row.code, row.label),
    value: row.total,
    barClassName: 'bg-brand',
  }))
  const recentlyClosed = reports
    .filter((report) => report.status === REPORT_STATUSES.CLOSED)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-8">
      {header}

      {/* Five counts, and the last one is the point of the whole system.
          The other four measure work in progress; "pets back home" measures
          whether any of it worked, which is the number worth having on an
          overview at all. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatTile
          icon={Flag}
          label={t('admin.overview.flags')}
          value={openCases.length}
          to="/admin/moderation"
          emphasis={openCases.length > 0}
        />
        {mayManageAccounts && <StatTile icon={Users} label={t('admin.overview.accounts')} value={users.length} to="/admin/users" />}
        <StatTile icon={ListChecks} label={t('dashboard.activeReports')} value={stats.totals.active} to="/admin/reports" />
        {/* Correction 4: reports filed but not yet published. Coordinators
            review them; the administrator sees how many are waiting. */}
        <StatTile
          icon={ListChecks}
          label={t('admin.overview.waitingReview')}
          value={stats.publication?.pending_review ?? 0}
          to="/admin/reports"
        />
        <StatTile
          icon={Heart}
          label={t('admin.overview.petsHome')}
          value={reports.filter((report) => report.status === REPORT_STATUSES.RETURNED).length}
          to="/admin/reports"
        />
        {mayManageCategories && (
          <StatTile icon={FolderTree} label={t('nav.categories')} value={categories.length} to="/admin/categories" />
        )}
      </div>

      <section aria-labelledby="attention-heading" className="flex flex-col gap-4">
        <h2 id="attention-heading" className="text-xl font-semibold text-fg">
          {t('staff.overview.attention')}
        </h2>

        <div className={mayManageAccounts ? 'grid gap-6 lg:grid-cols-2' : 'grid gap-6'}>
          <FlagsCard openCases={openCases} />
          {mayManageAccounts && <SuspendedCard suspended={suspended} />}
        </div>
      </section>

      {/* The analytics sit in a well: four white cards on the bare canvas
          read as four unrelated things rather than one report. */}
      <section
        aria-labelledby="activity-heading"
        className="flex flex-col gap-4 rounded-card bg-sunken/60 p-4 sm:p-5"
      >
        <h2 id="activity-heading" className="text-xl font-semibold text-fg">
          {t('admin.overview.activity')}
        </h2>

        <Card>
          <CardHeader
            title={t('admin.overview.filed')}
            subtitle={t('admin.overview.filedBody')}
          />
          <CardBody>
            <MonthlyReportsChart months={stats.monthly} />
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={t('staff.overview.byStatus')} subtitle={t('admin.overview.total', { count: stats.totals.total })} />
            <CardBody>
              <BreakdownBars rows={statusRows} total={stats.totals.total} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('admin.overview.animals')}
              subtitle={t('admin.overview.lostFound', { lost: stats.totals.lost, found: stats.totals.found })}
            />
            <CardBody>
              <BreakdownBars rows={speciesRows} total={stats.totals.total} />
            </CardBody>
          </Card>
        </div>

        <RecentlyClosed reports={recentlyClosed} />
      </section>
    </div>
  )
}

/** Open flags: the queue's first few, and the way into it. */
function FlagsCard({ openCases }) {
  const count = openCases.length

  return (
    <Card className={count > 0 ? 'border-accent/50' : undefined}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {t('admin.overview.flags')}
            {count > 0 && (
              <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-lost tabular-nums">
                {count}
              </span>
            )}
          </span>
        }
        subtitle={
          count > 0
            ? t('admin.overview.flagged', { count })
            : undefined
        }
        action={
          <Button as={Link} to="/admin/moderation" size="sm" variant={count > 0 ? 'primary' : 'secondary'}>
            {t('admin.overview.openModeration')}
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        }
      />
      <CardBody className="py-2">
        {count === 0 ? (
          <p className="py-3 text-sm text-fg-muted">{t('admin.overview.noFlags')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {openCases.slice(0, 4).map(({ moderationCase, report, reportedBy }) => (
              <li key={moderationCase.id} className="flex flex-col gap-0.5 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-2">
                  <span className="font-semibold text-fg">
                    {MODERATION_REASON_LABELS[moderationCase.reason]}
                  </span>
                  <span className="text-fg-muted">{t('admin.overview.on')}</span>
                  <Link to={`/pet/${report.id}`} className="font-medium text-brand hover:underline">
                    {report.petName ?? t('editReport.foundReport')}
                  </Link>
                </p>
                <p className="text-fg-muted">
                  {t('admin.overview.flaggedBy', { name: reportedBy.fullName })} · {formatCardDate(moderationCase.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

function SuspendedCard({ suspended }) {
  return (
    <Card>
      <CardHeader
        title={t('admin.overview.suspended')}
        subtitle={suspended.length > 0 ? t('admin.overview.suspendedBody') : undefined}
      />
      <CardBody className="py-2">
        {suspended.length === 0 ? (
          <p className="py-3 text-sm text-fg-muted">{t('admin.overview.noSuspended')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {suspended.map((user) => (
              <li key={user.id} className="flex items-center gap-3 py-3 text-sm">
                <Avatar name={user.fullName} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium break-words text-fg">{user.fullName}</span>
                  <span className="flex flex-wrap items-center gap-2 text-fg-muted">
                    {ROLE_LABELS[user.role]}
                    <AccountStatusBadge status={user.accountStatus} />
                  </span>
                </div>
                <Button
                  as={Link}
                  to="/admin/users?status=suspended"
                  variant="secondary"
                  size="sm"
                  aria-label={t('admin.overview.manageName', { name: user.fullName })}
                >
                  {t('admin.overview.manage')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

/** A compact activity preview, not a list of report cards. */
function RecentlyClosed({ reports }) {
  return (
    <Card>
      <CardHeader
        title={t('admin.overview.closed')}
        action={
          <Button as={Link} to="/admin/reports?status=closed" variant="ghost" size="sm">
            {t('admin.overview.allClosed')}
          </Button>
        }
      />
      {reports.length === 0 ? (
        <CardBody>
          <p className="text-sm text-fg-muted">{t('admin.overview.noClosed')}</p>
        </CardBody>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {reports.map((report) => {
            const photo = report.photos.find((item) => item.isPrimary) ?? report.photos[0]

            return (
              // The whole row opens the report: the name is a stretched link.
              <li
                key={report.id}
                className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 transition-colors hover:bg-surface has-[a:focus-visible]:bg-surface"
              >
                <img
                  src={photo?.url ?? photoPlaceholder}
                  alt=""
                  loading="lazy"
                  className="size-9 shrink-0 rounded-control bg-surface-muted object-cover"
                />
                <ReportTypeBadge reportType={report.reportType} size="sm" />
                <Link
                  to={`/pet/${report.id}`}
                  className="text-sm font-medium text-fg after:absolute after:inset-0 hover:underline"
                >
                  {report.petName ?? t('matching.sideFound', { species: speciesLabel(report.species).toLowerCase() })}
                </Link>
                <StatusBadge status={report.status} variant="pill" />
                <span className="ml-auto text-sm whitespace-nowrap text-fg-muted">
                  {report.location.city} · {formatCardDate(report.updatedAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
