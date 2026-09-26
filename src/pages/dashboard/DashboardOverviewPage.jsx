import { Link } from 'react-router-dom'
import { ArrowRight, HandHeart, Heart, PawPrint, TriangleAlert } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { RadarOrnament } from '@/components/Ornament'
import { PetCard } from '@/components/PetCard'
import { MATCH_STATUSES, REPORT_STATUSES, REPORT_TYPES, speciesLabel } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { petService } from '@/services'
import { cn } from '@/utils/cn'
import { formatDate, formatShortDate } from '@/utils/date'
import { loadDashboardSummary } from './dashboardSummary'
import companions from '@/assets/img-020-companions.webp'

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
        <PageHeader title="My dashboard" compact />
        <LoadingSkeleton lines={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My dashboard" compact />
        <p role="alert" className="text-sm text-danger">
          Your dashboard could not be loaded: {error.message}
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

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance text-fg sm:text-[2.4rem]">
              Welcome back, {user.fullName.split(' ')[0]}.
            </h1>
            <p className="text-lg text-fg-muted">Here is where your cases stand today.</p>
          </div>

          <div className="flex shrink-0 items-center gap-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button as={Link} to="/report/lost" variant="accent" size="lg">
                <TriangleAlert size={18} aria-hidden="true" />
                Report a lost pet
              </Button>
              <Button as={Link} to="/report/found" size="lg">
                <HandHeart size={18} aria-hidden="true" />
                Report a found pet
              </Button>
            </div>

            {/* IMG-020, at the far end of the greeting. Decoration with a
                subject rather than content — it carries no alt text because it
                says nothing the heading beside it does not. Shown from `xl`
                only: below that the buttons need the width. */}
            <img
              src={companions}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="hidden h-32 w-auto shrink-0 xl:block"
            />
          </div>
        </div>
      </section>

      {/* 1. Summary — small personal status, not analytics. Each tile goes to
          the page that explains it. The unread tile appears only when there is
          something unread; a permanent "0" would just be noise. */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          Summary
        </h2>
        <ul
          className={cn(
            'grid grid-cols-2 gap-3',
            unread > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
          )}
        >
          <SummaryTile value={openReports.length} label="Active reports" to="/dashboard/reports" />
          <SummaryTile
            value={openMatches.length}
            label={openMatches.length === 1 ? 'Possible match' : 'Possible matches'}
            to="/dashboard/matches"
            highlight={openMatches.length > 0}
          />
          <SummaryTile
            value={returnedDetails.length}
            label={returnedDetails.length === 1 ? 'Pet returned' : 'Pets returned'}
            to="/dashboard/reports"
          />
          {unread > 0 && (
            <SummaryTile value={unread} label="Unread updates" to="/dashboard/notifications" />
          )}
        </ul>
      </section>

      {/* 3. Possible matches — the actionable part of the page. */}
      <Section
        title="Possible matches"
        description="Reports that share characteristics with yours. A suggestion, never a confirmation."
        action={
          openMatches.length > 0 && (
            <Button as={Link} to="/dashboard/matches" variant="ghost" size="sm">
              See all
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
          )
        }
      >
        {openMatches.length === 0 ? (
          <p className="rounded-card border border-border bg-panel px-4 py-4 text-fg-muted">
            Nothing to review right now. When a report is filed that lines up with one of yours,
            it will appear here with an explanation of what matches.
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
        title="Your active reports"
        description="Cases that are still open."
        action={
          reports.length > 0 && (
            <Button as={Link} to="/dashboard/reports" variant="ghost" size="sm">
              See all reports
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
          )
        }
      >
        {openReports.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title={reports.length === 0 ? 'You have not filed a report yet' : 'Nothing open'}
            description={
              reports.length === 0
                ? 'When you report a lost or found pet, it will appear here so you can follow it.'
                : 'None of your reports are currently active. Closed and recovered cases are on the My Reports page.'
            }
            action={
              <Button as={Link} to="/report/lost" variant="accent">
                Report a lost pet
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {openReports.slice(0, 6).map((report) => (
              <li key={report.id} className="flex">
                <PetCard report={report} statusVariant="pill" className="w-full" />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 5. Recent updates — the newest few events, written as sentences. */}
      <Section title="Recent updates" description="The latest changes across your reports.">
        {activity.length === 0 ? (
          <p className="text-fg-muted">Nothing has happened on your reports yet.</p>
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
        <Section title="Returned pets" description="Cases that ended the way they should.">
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
 * as a *match score*, beside a separate "Possible match" state, so "100%"
 * cannot be read as "100% this is your pet". The score itself is untouched.
 */
function MatchRow({ match, lost, found, userId }) {
  const mine = Number(lost.reporterId) === Number(userId) ? lost : found
  const theirs = mine === lost ? found : lost
  const theirLabel = `${theirs.reportType === REPORT_TYPES.FOUND ? 'found' : 'lost'} ${speciesLabel(
    theirs.species,
  ).toLowerCase()}`
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
              Possible match
            </span>
            <span className="text-sm text-fg-muted">
              <span className="font-semibold text-fg tabular-nums">{match.score}%</span> match score
            </span>
          </span>
          <span className="font-medium text-fg">
            {mine.petName ?? `Your found ${speciesLabel(mine.species).toLowerCase()}`}
            <span className="text-fg-muted" aria-hidden="true">
              {' '}
              ↔{' '}
            </span>
            <span className="sr-only"> and </span>a {theirLabel}
          </span>
          <span className="text-sm text-fg-muted">
            {theirs.location.city}
            {waitingOnCoordinator && ' · A Pet Coordinator is reviewing it'}
          </span>
        </span>

        <span className="col-start-2 inline-flex items-center gap-1 text-sm font-medium text-brand group-hover:underline sm:ml-auto">
          {waitingOnCoordinator ? 'View match' : 'Review match'}
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </li>
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
          {byOther && ` · by ${entry.actorName}`}
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
        title: named ? `Possible match found for ${name}` : 'Possible match found for a pet you found',
        detail,
      }
    case REPORT_STATUSES.RETURNED:
      return {
        title: named ? `${name} was returned home` : 'A pet you found was returned to its owner',
        detail,
      }
    case REPORT_STATUSES.CLOSED:
      return { title: named ? `${name}'s report was closed` : 'Your found-pet report was closed', detail }
    default:
      if (!entry.previousStatus) {
        return { title: named ? `${name}'s report was created` : 'You reported a found pet', detail }
      }
      return {
        title: named ? `${name}'s report is active again` : 'Your found-pet report is active again',
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
            {name} is home
          </span>
          {returned && (
            <span className="text-sm text-fg-muted">Returned {formatDate(returned.createdAt)}</span>
          )}
          <span className="text-sm text-fg-muted">{report.location.city}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand group-hover:underline">
            View case
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
