import { Link } from 'react-router-dom'
import { ArrowRight, HandHeart, Heart, PawPrint, TriangleAlert } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { RadarOrnament } from '@/components/Ornament'
import { PetCard } from '@/components/PetCard'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { MATCH_STATUSES, REPORT_STATUSES, REPORT_TYPES, speciesLabel } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { petService } from '@/services'
import { cn } from '@/utils/cn'
import { formatDate, formatShortDate } from '@/utils/date'
import { loadDashboardSummary } from './dashboardSummary'
import companions from '@/assets/img-020-companions.webp'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

/** How many timeline entries the Overview shows. It summarises; it is not the log. */
const TIMELINE_LIMIT = 5

async function loadOverview() {
  const summary = await loadDashboardSummary()

  const [activity, matchReports, returnedDetails] = await Promise.all([
    // Asked for directly: a report in the list does not carry its own history,
    // so this feed cannot be assembled from `reports`.
    petService.getRecentActivity(TIMELINE_LIMIT),
    // Each open match names two reports; fetch them once each.
    Promise.all(
      [...new Set(summary.openMatches.flatMap((m) => [m.lostReportId, m.foundReportId]))].map(
        (id) => petService.getReportById(id),
      ),
    ),
    // The list view has no history, and the reunion cards need the date the
    // case was returned. There are only ever a handful.
    Promise.all(summary.returnedReports.map((report) => petService.getReportById(report.id))),
  ])

  return {
    ...summary,
    activity,
    byId: Object.fromEntries(matchReports.map((report) => [report.id, report])),
    returnedDetails,
  }
}

/**
 * The customer's home in the system.
 *
 * Built to answer three questions in order, at a glance: do I have open
 * reports, has the system found anything, and is there something I need to do?
 * So it opens on a small personal summary, then the possible matches — the only
 * thing here that can be waiting on the owner — and only then the reports
 * themselves. Filing a new report is a quick action, not the headline: someone
 * with cases open has usually come to check on them.
 */
export function DashboardOverviewPage() {
  // Defined at module scope, so its identity is already stable.
  const { data, error, isLoading } = useAsync(loadOverview)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('dashboard.title')} compact />
        <LoadingSkeleton lines={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('dashboard.title')} compact />
        <p role="alert" className="text-sm text-danger">
          {t('dashboard.failed', { message: errorText(error) })}
        </p>
      </div>
    )
  }

  const { user, reports, openReports, openMatches, returnedDetails, unread, activity, byId } =
    data

  return (
    <div className="flex flex-col gap-10">
      {/* A warm welcome band with the two things somebody might have come to
          do inside it, rather than a heading followed by a "Quick actions"
          strip three sections down. This is the customer's own room: it should
          greet them and then get out of the way. */}
      <section className="hero-ground relative isolate overflow-hidden rounded-[1.5rem] border border-accent/20 px-5 py-6 sm:px-8 sm:py-8">
        <RadarOrnament tone="amber" size={420} strength={2.6} className="-top-24 -right-20" />

        {/* Two rows on the left: the greeting, then the two actions on a row of
            their own. They used to share one line with the greeting, which
            squeezed "Welcome back, Maria." onto two lines and the buttons into
            the middle. The companions have the right-hand side to themselves. */}
        <div className="flex items-center justify-between gap-8">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance text-fg sm:text-[2.4rem]">
                {t('dashboard.welcome', { name: user.fullName.split(' ')[0] })}
              </h1>
              <p className="text-lg text-fg-muted">{t('dashboard.lead')}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button as={Link} to="/report/lost" variant="accent" size="lg">
                <TriangleAlert size={18} aria-hidden="true" />
                {t('nav.reportLost')}
              </Button>
              <Button as={Link} to="/report/found" size="lg">
                <HandHeart size={18} aria-hidden="true" />
                {t('nav.reportFound')}
              </Button>
            </div>
          </div>

          {/* IMG-020. Decoration with a subject rather than content — no alt
              text, because it says nothing the heading beside it does not.
              From `md`, now that the buttons no longer need its room. */}
          <img
            src={companions}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="hidden h-36 w-auto shrink-0 md:block lg:h-44"
          />
        </div>
      </section>

      {/* 1. Summary — small personal status, not analytics. Each tile goes to
          the page that explains it. The unread tile appears only when there is
          something unread; a permanent "0" would just be noise. */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          {t('dashboard.summary')}
        </h2>
        <ul
          className={cn(
            'grid grid-cols-2 gap-3',
            unread > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
          )}
        >
          <SummaryTile value={openReports.length} label={t('dashboard.activeReports')} to="/dashboard/reports" />
          <SummaryTile
            value={openMatches.length}
            label={t('dashboard.possibleMatches', { count: openMatches.length })}
            to="/dashboard/matches"
            highlight={openMatches.length > 0}
          />
          <SummaryTile
            value={returnedDetails.length}
            label={t('dashboard.petsReturned', { count: returnedDetails.length })}
            to="/dashboard/reports"
          />
          {unread > 0 && (
            <SummaryTile value={unread} label={t('dashboard.unread')} to="/dashboard/notifications" />
          )}
        </ul>
      </section>

      {/* 3. Possible matches — the actionable part of the page. */}
      <Section
        title={t('dashboard.matchesTitle')}
        description={t('dashboard.matchesBody')}
        action={
          openMatches.length > 0 && (
            <Button as={Link} to="/dashboard/matches" variant="ghost" size="sm">
              {t('dashboard.seeAll')}
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
          )
        }
      >
        {openMatches.length === 0 ? (
          <p className="rounded-card border border-border bg-panel px-4 py-4 text-fg-muted">
            {t('dashboard.noMatches')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 rounded-card border border-accent/40 bg-accent-soft/40 p-2 sm:p-3">
            {openMatches.slice(0, 3).map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                lost={byId[match.lostReportId]}
                found={byId[match.foundReportId]}
                userId={user.id}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* 4. Active reports — three across when there is room, so a typical
          owner's open cases sit side by side above the fold. */}
      <Section
        title={t('dashboard.activeTitle')}
        description={t('dashboard.activeBody')}
        action={
          reports.length > 0 && (
            <Button as={Link} to="/dashboard/reports" variant="ghost" size="sm">
              {t('dashboard.seeAllReports')}
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
          )
        }
      >
        {openReports.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title={reports.length === 0 ? t('dashboard.noReports') : t('dashboard.nothingOpen')}
            description={reports.length === 0 ? t('dashboard.noReportsBody') : t('dashboard.nothingOpenBody')}
            action={
              <Button as={Link} to="/report/lost" variant="accent">
                {t('nav.reportLost')}
              </Button>
            }
          />
        ) : (
          <>
            {/* Phones: compact rows. Three full-height photo cards were about
                1,300px of scrolling before anything else on the page. */}
            <ul className="flex flex-col gap-2 sm:hidden">
              {openReports.slice(0, 6).map((report) => (
                <li key={report.id}>
                  <ReportRow report={report} />
                </li>
              ))}
            </ul>
            <ul className="hidden gap-5 sm:grid sm:grid-cols-2 xl:grid-cols-3">
              {openReports.slice(0, 6).map((report) => (
                <li key={report.id} className="flex">
                  <PetCard report={report} statusVariant="pill" className="w-full" />
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* 5. Recent updates — the newest few events, written as sentences. */}
      <Section title={t('dashboard.recent')} description={t('dashboard.recentBody')}>
        {activity.length === 0 ? (
          <p className="text-fg-muted">{t('dashboard.noActivity')}</p>
        ) : (
          <ol className="flex flex-col">
            {activity.slice(0, TIMELINE_LIMIT).map((entry, index, list) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                userName={user.fullName}
                isLast={index === list.length - 1}
              />
            ))}
          </ol>
        )}
      </Section>

      {/* 6. Returned pets — a finished case is an accomplishment. */}
      {returnedDetails.length > 0 && (
        <Section title={t('dashboard.returned')} description={t('dashboard.returnedBody')}>
          <ul className="grid gap-4 md:grid-cols-2">
            {returnedDetails.map((report) => (
              <ReunionCard key={report.id} report={report} />
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

/**
 * A titled block of the dashboard. Local to this page — it exists only so the
 * sections cannot drift apart in spacing and heading size.
 */
function Section({ title, description, action, children }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h2>
          {description && <p className="text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function SummaryTile({ value, label, to, highlight = false }) {
  return (
    <li className="flex">
      <Link
        to={to}
        className={cn(
          'flex w-full flex-col gap-0.5 rounded-card border px-4 py-3 transition-colors',
          highlight
            ? 'border-accent/40 bg-accent-soft/60 hover:border-accent'
            : 'border-border bg-panel hover:border-border-strong',
        )}
      >
        <span className="text-2xl font-semibold text-fg tabular-nums">{value}</span>
        <span className="text-sm text-fg-muted">{label}</span>
      </Link>
    </li>
  )
}

/**
 * One open match, as a single link to where it is decided. The score is shown
 * as "compatibility", the word every screen uses for it, beside a separate
 * "Possible match" state, so "100%" cannot be read as "100% this is your pet".
 * The score itself is untouched.
 */
function MatchRow({ match, lost, found, userId }) {
  const mine = Number(lost.reporterId) === Number(userId) ? lost : found
  const theirs = mine === lost ? found : lost
  const theirLabel = t(theirs.reportType === REPORT_TYPES.FOUND ? 'dashboard.aFound' : 'dashboard.aLost', {
    species: speciesLabel(theirs.species).toLowerCase(),
  })
  const waitingOnCoordinator = match.status === MATCH_STATUSES.VERIFICATION_REQUESTED

  return (
    <li>
      <Link
        to={`/dashboard/matches#match-${match.id}`}
        // A grid on phones, so "View match" drops under the text instead of
        // squeezing it to three words a line; one row from `sm` up.
        className="card-interactive group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-card bg-panel p-3 shadow-card sm:flex sm:gap-4"
      >
        <span className="flex shrink-0 -space-x-2 self-start sm:self-center">
          <Thumb report={lost} />
          <Thumb report={found} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-lost">
              {t('matching.possibleMatch')}
            </span>
            <span className="text-sm text-fg-muted">
              <span className="font-semibold text-fg tabular-nums">{match.score}%</span> {t('matching.compatibility')}
            </span>
          </span>
          <span className="font-medium text-fg">
            {mine.petName ?? t('dashboard.yourFound', { species: speciesLabel(mine.species).toLowerCase() })}
            <span className="text-fg-muted" aria-hidden="true">
              {' '}
              ↔{' '}
            </span>
            <span className="sr-only"> {t('matching.and')} </span>
            {theirLabel}
          </span>
          <span className="text-sm text-fg-muted">
            {theirs.location.city}
            {waitingOnCoordinator && ` · ${t('dashboard.coordinatorReviewing')}`}
          </span>
        </span>

        <span className="col-start-2 inline-flex items-center gap-1 text-sm font-medium text-brand group-hover:underline sm:ml-auto">
          {waitingOnCoordinator ? t('dashboard.viewMatch') : t('dashboard.reviewMatch')}
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </li>
  )
}

/** A compact report row for phones: thumbnail, name, what it is, status. */
function ReportRow({ report }) {
  const name = report.petName ?? t('common.nameUnknown', { species: speciesLabel(report.species) })

  return (
    <Link
      to={`/pet/${report.id}`}
      className="card-interactive flex items-center gap-3 rounded-card border border-border bg-panel p-2.5 shadow-card"
    >
      <img
        src={primaryPhotoUrl(report) ?? photoPlaceholder}
        alt=""
        className="size-16 shrink-0 rounded-control bg-surface-muted object-cover object-[50%_35%]"
        loading="lazy"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-semibold text-fg">{name}</span>
        <span className="truncate text-sm text-fg-muted">
          {report.breed || speciesLabel(report.species)} · {report.location.city}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <ReportTypeBadge reportType={report.reportType} size="sm" />
          <StatusBadge status={report.status} variant="pill" />
        </span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-fg-subtle" aria-hidden="true" />
    </Link>
  )
}

function Thumb({ report }) {
  return (
    <img
      src={primaryPhotoUrl(report) ?? photoPlaceholder}
      alt=""
      className="size-12 rounded-control border-2 border-panel bg-surface-muted object-cover"
      loading="lazy"
    />
  )
}

/** Status → marker colour on the timeline. Decorative; the sentence carries it. */
const TIMELINE_DOTS = {
  [REPORT_STATUSES.ACTIVE]: 'bg-status-active',
  [REPORT_STATUSES.POSSIBLE_MATCH]: 'bg-status-match',
  [REPORT_STATUSES.RETURNED]: 'bg-status-returned',
  [REPORT_STATUSES.CLOSED]: 'bg-status-closed',
}

function TimelineEntry({ entry, userName, isLast }) {
  const { title, detail } = describeActivity(entry)
  const byOther = entry.actorName && entry.actorName !== userName

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* The rail between markers. */}
      {!isLast && (
        <span className="absolute top-4 bottom-0 left-[5px] w-px bg-border" aria-hidden="true" />
      )}
      <span
        className={cn(
          'relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-surface',
          TIMELINE_DOTS[entry.status] ?? 'bg-status-closed',
        )}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link to={`/pet/${entry.reportId}`} className="font-medium text-fg hover:underline">
          {title}
        </Link>
        {detail && <p className="text-sm text-fg-muted">{detail}</p>}
        <p className="text-sm text-fg-muted">
          {formatShortDate(entry.createdAt)}
          {byOther && ` · ${t('dashboard.by', { name: entry.actorName })}`}
        </p>
      </div>
    </li>
  )
}

/**
 * A status change, as a sentence. Presentation only — the feed is the same one
 * the API has always returned.
 */
function describeActivity(entry) {
  const named = entry.reportType !== REPORT_TYPES.FOUND
  const name = entry.reportLabel
  const note = entry.note?.trim()
  // "Report created." restates the title; everything else adds something.
  const detail = note && note !== 'Report created.' ? note : ''

  switch (entry.status) {
    case REPORT_STATUSES.POSSIBLE_MATCH:
      return {
        title: named ? t('dashboard.activity.matchNamed', { name }) : t('dashboard.activity.match'),
        detail,
      }
    case REPORT_STATUSES.RETURNED:
      return {
        title: named ? t('dashboard.activity.returnedNamed', { name }) : t('dashboard.activity.returned'),
        detail,
      }
    case REPORT_STATUSES.CLOSED:
      return { title: named ? t('dashboard.activity.closedNamed', { name }) : t('dashboard.activity.closed'), detail }
    default:
      if (!entry.previousStatus) {
        return { title: named ? t('dashboard.activity.createdNamed', { name }) : t('dashboard.activity.created'), detail }
      }
      return {
        title: named ? t('dashboard.activity.activeNamed', { name }) : t('dashboard.activity.active'),
        detail,
      }
  }
}

function ReunionCard({ report }) {
  const returned = report.statusHistory.findLast?.(
    (item) => item.status === REPORT_STATUSES.RETURNED,
  )
  const name = report.petName ?? speciesLabel(report.species)

  return (
    <li className="flex">
      <Link
        to={`/pet/${report.id}`}
        className="card-interactive group flex w-full items-center gap-4 rounded-card border border-border bg-panel p-3 shadow-card"
      >
        <img
          src={primaryPhotoUrl(report) ?? photoPlaceholder}
          alt=""
          className="size-20 shrink-0 rounded-control bg-surface-muted object-cover"
          loading="lazy"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-semibold text-fg">
            <Heart size={15} className="shrink-0 text-success" aria-hidden="true" />
            {t('home.storyNamed', { name })}
          </span>
          {returned && (
            <span className="text-sm text-fg-muted">{t('dashboard.returnedOn', { date: formatDate(returned.createdAt) })}</span>
          )}
          <span className="text-sm text-fg-muted">{report.location.city}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand group-hover:underline">
            {t('dashboard.viewCase')}
            <ArrowRight size={14} aria-hidden="true" />
          </span>
        </span>
      </Link>
    </li>
  )
}

function primaryPhotoUrl(report) {
  const photo = report.photos.find((item) => item.isPrimary) ?? report.photos[0]
  return photo?.url
}
