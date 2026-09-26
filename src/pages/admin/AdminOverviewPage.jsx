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
  MODERATION_REASON_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_BARS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_ORDER,
  ROLE_LABELS,
  speciesLabel,
} from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { categoryService, moderationService, petService, userService } from '@/services'
import { formatCardDate } from '@/utils/date'
import { AccountStatusBadge } from './AdminBadges'

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

  const header = (
    <PageHeader
      icon={ShieldHalf}
      eyebrow="Administrator"
      title="Administration"
      description="Accounts, records, categories and moderation."
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
          The overview could not be loaded: {error.message}
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
    label: row.label,
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
          label="Flags awaiting review"
          value={openCases.length}
          to="/admin/moderation"
          emphasis={openCases.length > 0}
        />
        <StatTile icon={Users} label="Accounts" value={users.length} to="/admin/users" />
        <StatTile icon={ListChecks} label="Active reports" value={stats.totals.active} to="/admin/reports" />
        <StatTile
          icon={Heart}
          label="Pets back home"
          value={reports.filter((report) => report.status === REPORT_STATUSES.RETURNED).length}
          to="/admin/reports"
        />
        <StatTile icon={FolderTree} label="Pet categories" value={categories.length} to="/admin/categories" />
      </div>

      <section aria-labelledby="attention-heading" className="flex flex-col gap-4">
        <h2 id="attention-heading" className="text-xl font-semibold text-fg">
          Needs your attention
        </h2>

        <div className="grid gap-6 lg:grid-cols-2">
          <FlagsCard openCases={openCases} />
          <SuspendedCard suspended={suspended} />
        </div>
      </section>

      {/* The analytics sit in a well: four white cards on the bare canvas
          read as four unrelated things rather than one report. */}
      <section
        aria-labelledby="activity-heading"
        className="flex flex-col gap-4 rounded-card bg-sunken/60 p-4 sm:p-5"
      >
        <h2 id="activity-heading" className="text-xl font-semibold text-fg">
          Activity
        </h2>

        <Card>
          <CardHeader
            title="Reports filed"
            subtitle="The last six months, counted by when each report was filed."
          />
          <CardBody>
            <MonthlyReportsChart months={stats.monthly} />
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Reports by status" subtitle={`${stats.totals.total} reports in total.`} />
            <CardBody>
              <BreakdownBars rows={statusRows} total={stats.totals.total} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Most reported animals"
              subtitle={`${stats.totals.lost} lost, ${stats.totals.found} found.`}
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
            Flags awaiting review
            {count > 0 && (
              <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-lost tabular-nums">
                {count}
              </span>
            )}
          </span>
        }
        subtitle={
          count > 0
            ? `${count === 1 ? 'A report was' : 'Reports were'} flagged by the community. Each needs a decision.`
            : undefined
        }
        action={
          <Button as={Link} to="/admin/moderation" size="sm" variant={count > 0 ? 'primary' : 'secondary'}>
            Open moderation
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        }
      />
      <CardBody className="py-2">
        {count === 0 ? (
          <p className="py-3 text-sm text-fg-muted">No flags are waiting. Nothing needs a decision.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {openCases.slice(0, 4).map(({ moderationCase, report, reportedBy }) => (
              <li key={moderationCase.id} className="flex flex-col gap-0.5 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-2">
                  <span className="font-semibold text-fg">
                    {MODERATION_REASON_LABELS[moderationCase.reason]}
                  </span>
                  <span className="text-fg-muted">on</span>
                  <Link to={`/pet/${report.id}`} className="font-medium text-brand hover:underline">
                    {report.petName ?? 'Found pet report'}
                  </Link>
                </p>
                <p className="text-fg-muted">
                  Flagged by {reportedBy.fullName} · {formatCardDate(moderationCase.createdAt)}
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
        title="Suspended accounts"
        subtitle={
          suspended.length > 0
            ? 'These people cannot sign in until an administrator reinstates them.'
            : undefined
        }
      />
      <CardBody className="py-2">
        {suspended.length === 0 ? (
          <p className="py-3 text-sm text-fg-muted">No accounts are suspended.</p>
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
                  aria-label={`Manage ${user.fullName}`}
                >
                  Manage
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
        title="Recently closed cases"
        action={
          <Button as={Link} to="/admin/reports?status=closed" variant="ghost" size="sm">
            All closed reports
          </Button>
        }
      />
      {reports.length === 0 ? (
        <CardBody>
          <p className="text-sm text-fg-muted">No cases have been closed yet.</p>
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
                  {report.petName ?? `Found ${speciesLabel(report.species).toLowerCase()}`}
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
