import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  FilePen,
  FilePlus2,
  HandHeart,
  Heart,
  MapPin,
  MoreHorizontal,
  PawPrint,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, EmptyState, LoadingSkeleton, Modal } from '@/components/ui'
import { NavDropdown, NavDropdownItem } from '@/components/NavDropdown'
import { PageHeader } from '@/components/PageHeader'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { PublicationBadge, StatusBadge } from '@/components/StatusBadge'
import { MATCH_STATUSES, PUBLICATION_STATUSES, REPORT_STATUSES, REPORT_TYPES, speciesLabel } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { matchService, petService, userService } from '@/services'
import { formatDate } from '@/utils/date'
import { cn } from '@/utils/cn'

const OPEN_STATUSES = [REPORT_STATUSES.ACTIVE, REPORT_STATUSES.POSSIBLE_MATCH]

/** A match is still something to review until it is confirmed, rejected or dismissed. */
const SETTLED_MATCHES = [MATCH_STATUSES.CONFIRMED, MATCH_STATUSES.REJECTED, MATCH_STATUSES.DISMISSED]

/**
 * Lifecycle groups, in the site's own words. "Returned" is the status name used
 * everywhere else and fits both sides — an owner's pet home, a found pet handed
 * back. The cards still show the precise status (Active, Possible Match).
 */
const TABS = [
  // Correction 4: unfinished, and filed but not yet public — each its own
  // place, never mixed into Open or Closed.
  { id: 'drafts', label: 'Drafts' },
  { id: 'review', label: 'In review' },
  { id: 'open', label: 'Open' },
  { id: 'returned', label: 'Returned' },
  { id: 'closed', label: 'Closed' },
  // Removed by an administrator. Not Closed: the case did not end, the
  // report was taken down. Listed only when there is one.
  { id: 'removed', label: 'Removed', onlyIfAny: true },
]

const PUBLISHED = PUBLICATION_STATUSES.PUBLISHED

/**
 * The page's secondary button look, for the menu triggers built on NavDropdown.
 * Horizontal padding is left to each trigger: `cn` joins classes without
 * resolving conflicts, so a second `px-*` would not reliably win.
 */
const outlineTrigger =
  'inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-panel py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-muted'

async function loadMyReports() {
  const user = await userService.getCurrentUser()
  const [reports, matches, drafts] = await Promise.all([
    petService.getReportsByUser(user.id),
    matchService.getMatchesForUser(user.id),
    petService.getDrafts(),
  ])
  return { user, reports, matches, drafts }
}

export function MyReportsPage() {
  const [tab, setTab] = useState('open')
  const [closing, setClosing] = useState(null)
  const [isClosingBusy, setIsClosingBusy] = useState(false)
  const [deletingDraft, setDeletingDraft] = useState(null)
  const [isDeletingBusy, setIsDeletingBusy] = useState(false)
  const { data, error, isLoading, reload } = useAsync(loadMyReports)

  // A draft is deleted for real: it was never published, so there is nothing
  // to keep, and it is never recorded as a closure.
  const confirmDeleteDraft = async () => {
    setIsDeletingBusy(true)
    try {
      await petService.deleteDraft(deletingDraft.id)
      setDeletingDraft(null)
      reload()
    } finally {
      setIsDeletingBusy(false)
    }
  }

  // Same status change as before — only now it asks first.
  const confirmClose = async () => {
    setIsClosingBusy(true)
    try {
      await petService.updateReportStatus(closing.id, REPORT_STATUSES.CLOSED, {
        actorId: data.user.id,
        note: 'Closed by the reporter.',
      })
      setClosing(null)
      reload()
    } finally {
      setIsClosingBusy(false)
    }
  }

  const header = (
    <PageHeader
      title="My reports"
      description="Every lost and found report you have filed, and where each one stands."
      breadcrumb={[{ label: 'My dashboard', to: '/dashboard' }, { label: 'My reports' }]}
      actions={<NewReportMenu />}
    />
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingSkeleton lines={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p role="alert" className="text-sm text-danger">
          Your reports could not be loaded: {error.message}
        </p>
      </div>
    )
  }

  const { reports, matches, drafts } = data
  const published = reports.filter((report) => report.publicationStatus === PUBLISHED)
  const grouped = {
    drafts,
    review: reports.filter((report) =>
      [PUBLICATION_STATUSES.PENDING_REVIEW, PUBLICATION_STATUSES.REJECTED].includes(report.publicationStatus),
    ),
    open: published.filter((report) => OPEN_STATUSES.includes(report.status)),
    returned: published.filter((report) => report.status === REPORT_STATUSES.RETURNED),
    closed: published.filter((report) => report.status === REPORT_STATUSES.CLOSED),
    removed: reports.filter((report) => report.publicationStatus === PUBLICATION_STATUSES.REMOVED),
  }
  const tabs = TABS.filter((item) => !item.onlyIfAny || grouped[item.id].length > 0)
  const visible = grouped[tab] ?? []

  const openMatchesFor = (reportId) =>
    matches.filter(
      (match) =>
        (match.lostReportId === reportId || match.foundReportId === reportId) &&
        !SETTLED_MATCHES.includes(match.status),
    )

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="reports-panel"
            onClick={() => setTab(item.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              tab === item.id
                ? 'border-brand font-medium text-brand-hover'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {item.label}
            <span className="ml-1.5 text-fg-muted">{grouped[item.id].length}</span>
          </button>
        ))}
      </div>

      <div id="reports-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {visible.length === 0 ? (
          <GroupEmptyState tab={tab} />
        ) : tab === 'drafts' ? (
          <ul className="flex flex-col gap-4">
            {visible.map((draft) => (
              <DraftCard key={draft.id} draft={draft} onDelete={() => setDeletingDraft(draft)} />
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-4">
            {visible.map((report) => (
              <ReportCaseCard
                key={report.id}
                report={report}
                openMatches={openMatchesFor(report.id)}
                onClose={() => setClosing(report)}
              />
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={Boolean(deletingDraft)}
        onClose={() => !isDeletingBusy && setDeletingDraft(null)}
        size="sm"
        title="Delete this draft?"
        description="The draft is deleted for good. It was never submitted, so nothing else changes."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingDraft(null)} disabled={isDeletingBusy} data-autofocus>
              Keep it
            </Button>
            <Button variant="danger" onClick={confirmDeleteDraft} isLoading={isDeletingBusy}>
              Delete draft
            </Button>
          </>
        }
      />

      <Modal
        isOpen={Boolean(closing)}
        onClose={() => !isClosingBusy && setClosing(null)}
        size="sm"
        title={closing ? `Close ${reportName(closing)}?` : ''}
        description="Closing marks the case as finished. It will no longer be compared against new reports for possible matches. It stays visible with a Closed status, and you can still open it from the Closed tab."
        footer={
          <>
            <Button variant="ghost" onClick={() => setClosing(null)} disabled={isClosingBusy} data-autofocus>
              Keep it open
            </Button>
            <Button variant="danger" onClick={confirmClose} isLoading={isClosingBusy}>
              Close report
            </Button>
          </>
        }
      />
    </div>
  )
}

/**
 * "New report" rather than a lone "Report a lost pet": this page holds both
 * kinds, so neither should be the default. Same two routes as the navbar's
 * Report menu.
 */
function NewReportMenu() {
  return (
    <NavDropdown
      align="right"
      label={
        <>
          <FilePlus2 size={16} aria-hidden="true" />
          New report
        </>
      }
      triggerClassName={cn(outlineTrigger, 'px-3')}
    >
      {(close) => (
        <>
          <NavDropdownItem as={Link} to="/report/lost" onClick={close}>
            <TriangleAlert size={15} className="text-lost" aria-hidden="true" />
            Report a lost pet
          </NavDropdownItem>
          <NavDropdownItem as={Link} to="/report/found" onClick={close}>
            <HandHeart size={15} className="text-found" aria-hidden="true" />
            Report a found pet
          </NavDropdownItem>
        </>
      )}
    </NavDropdown>
  )
}

/**
 * One report as a case: photo, what it is, where and when, and the next thing
 * to do. The whole card opens the report — the name is a stretched link — and
 * the buttons sit above that link so they stay separately clickable.
 */
function ReportCaseCard({ report, openMatches, onClose }) {
  const name = reportName(report)
  const isFound = report.reportType === REPORT_TYPES.FOUND
  const photo = report.photos.find((item) => item.isPrimary) ?? report.photos[0]
  const firstMatch = openMatches[0]
  const isPublished = report.publicationStatus === PUBLISHED
  // Only a published report has a case to close (Correction 4).
  const canClose = isPublished && report.status !== REPORT_STATUSES.CLOSED
  // Only an Active report is editable. A finished case keeps its details, and
  // one with an open possible match is frozen so the pairing's score and
  // signals keep describing the report being verified. The API refuses both
  // with a 409; offering a button that can only fail is worse than not
  // offering it. Close stays available either way.
  //
  // Correction 4: a report waiting for review is frozen too, so the
  // coordinator approves what they read; one that was not approved is
  // editable, then submitted again from its page; a removed one is not.
  const canEdit =
    (isPublished && report.status === REPORT_STATUSES.ACTIVE) ||
    report.publicationStatus === PUBLICATION_STATUSES.REJECTED
  const kind = [speciesLabel(report.species), report.breed].filter(Boolean).join(' · ')

  const primary = firstMatch ? (
    <Button as={Link} to={`/dashboard/matches#match-${firstMatch.id}`} size="sm" className="relative">
      <Heart size={14} aria-hidden="true" />
      Review match
    </Button>
  ) : (
    <Button as={Link} to={`/pet/${report.id}`} size="sm" className="relative">
      View report
      <ArrowRight size={14} aria-hidden="true" />
    </Button>
  )

  return (
    <li>
      <article
        className={cn(
          'card-interactive relative flex flex-col gap-4 rounded-card border bg-panel p-4 shadow-card sm:flex-row sm:items-start sm:gap-5',
          'has-[.case-link:focus-visible]:ring-2 has-[.case-link:focus-visible]:ring-brand',
          firstMatch ? 'border-accent/50' : 'border-border',
        )}
      >
        {/* Across the top on a phone, a 112px square beside the details from
            `sm` up. object-cover crops rather than stretching the photo. */}
        <img
          src={photo?.url ?? photoPlaceholder}
          alt={photo ? photo.alt || '' : 'No photo was provided for this report'}
          loading="lazy"
          className="aspect-16/9 w-full shrink-0 rounded-control bg-surface-muted object-cover object-[50%_35%] sm:aspect-square sm:size-28"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ReportTypeBadge reportType={report.reportType} size="sm" />
            {/* Before publication there is no case to show a status for. */}
            {isPublished && <StatusBadge status={report.status} variant="pill" />}
            <PublicationBadge publication={report.publicationStatus} />
          </div>

          <h2 className="text-lg font-semibold text-fg">
            <Link
              to={`/pet/${report.id}`}
              className="case-link rounded-control after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
            >
              {name}
            </Link>
          </h2>

          {kind && <p className="text-sm text-fg-muted">{kind}</p>}

          <p className="flex items-center gap-1.5 text-sm text-fg-muted">
            <MapPin size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
            {report.location.city}
            {report.location.province && `, ${report.location.province}`}
          </p>

          <p className="flex items-center gap-1.5 text-sm text-fg-muted">
            <CalendarDays size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
            {isFound ? 'Found on' : 'Last seen'} {formatDate(report.incidentDate)}
          </p>

          {openMatches.length > 0 && (
            <p className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-control bg-accent-soft px-2.5 py-1 text-sm font-medium text-lost">
              <Heart size={14} aria-hidden="true" />
              {openMatches.length} possible {openMatches.length === 1 ? 'match' : 'matches'} available
            </p>
          )}
          {report.publicationStatus === PUBLICATION_STATUSES.PENDING_REVIEW && (
            <p className="mt-1 text-sm text-fg">
              Waiting for a Pet Coordinator to review it. It is not public yet.
            </p>
          )}
          {report.publicationStatus === PUBLICATION_STATUSES.REJECTED && (
            <p className="mt-1 text-sm text-fg">
              Not approved. Open it to see why, edit it, and submit it again.
            </p>
          )}
          {report.publicationStatus === PUBLICATION_STATUSES.REMOVED && (
            <p className="mt-1 text-sm text-fg">
              Removed by an administrator. Open it to see the reason.
            </p>
          )}
          {isPublished && report.status === REPORT_STATUSES.RETURNED && (
            <p className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-success-ink">
              <CircleCheck size={14} aria-hidden="true" />
              {isFound ? 'Returned to its owner' : 'Back home'}
            </p>
          )}
        </div>

        {/* Actions. `relative` lifts them above the stretched link, without a
            z-index — a z-index would make each card its own stacking context
            and trap the More menu underneath the next card. */}
        <div className="relative flex flex-wrap items-center gap-2 sm:shrink-0 sm:self-center">
          {primary}

          {/* Edit sits beside the main action from `sm` up; on a phone it
              moves into More, so the row is one button and a menu. The
              visibility lives on a wrapper: `cn` does not resolve conflicting
              utilities, and the Button's own `inline-flex` beat `hidden`. */}
          {canEdit && (
            <span className="hidden sm:contents">
              <Button
                as={Link}
                to={`/dashboard/reports/${report.id}/edit`}
                variant="secondary"
                size="sm"
              >
                <Pencil size={14} aria-hidden="true" />
                Edit
              </Button>
            </span>
          )}

          {/* A returned report has one thing left to do, Close, so it is a
              button of its own. Behind a More menu it was a single item in a
              panel that, on a phone, hung over the next card. The quiet
              secondary look, not the page's main action. */}
          {canClose && !canEdit && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              <XCircle size={14} className="text-danger" aria-hidden="true" />
              Close report
            </Button>
          )}

          {/* The menu holds the phone-only Edit and, when it applies, Close. A
              closed report has neither, and a returned one has only Close
              (above), so the menu goes with them. */}
          <div className={cn(!(canClose && canEdit) && 'hidden')}>
            <NavDropdown
              align="right"
              showChevron={false}
              label={
                <>
                  <MoreHorizontal size={16} aria-hidden="true" />
                  <span className="sr-only">More actions for {name}</span>
                </>
              }
              triggerClassName={cn(outlineTrigger, 'px-2.5')}
            >
              {(close) => (
                <>
                  {canEdit && (
                    <NavDropdownItem
                      as={Link}
                      to={`/dashboard/reports/${report.id}/edit`}
                      onClick={close}
                      className="sm:hidden"
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Edit report
                    </NavDropdownItem>
                  )}
                  {canClose && (
                    <NavDropdownItem
                      as="button"
                      type="button"
                      onClick={() => {
                        close()
                        onClose()
                      }}
                    >
                      {/* The colour sits on the contents, not the item, which
                          already sets its own text colour. */}
                      <span className="flex items-center gap-2 text-danger">
                        <XCircle size={15} aria-hidden="true" />
                        Close report
                      </span>
                    </NavDropdownItem>
                  )}
                </>
              )}
            </NavDropdown>
          </div>
        </div>
      </article>
    </li>
  )
}

function GroupEmptyState({ tab }) {
  if (tab === 'drafts') {
    return (
      <EmptyState
        icon={FilePen}
        title="No drafts"
        description="Start a report and choose Save draft to finish it later, here or on another device."
      />
    )
  }

  if (tab === 'review') {
    return (
      <EmptyState
        icon={FilePen}
        title="Nothing waiting for review"
        description="A report you submit waits here until a Pet Coordinator approves it. Then it is public, and moves to Open."
      />
    )
  }

  if (tab === 'removed') {
    return <EmptyState icon={XCircle} title="No removed reports" description="" />
  }

  if (tab === 'open') {
    return (
      <EmptyState
        icon={PawPrint}
        title="No open reports"
        description="When you file a lost or found report, it stays here until the pet is returned or you close it."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button as={Link} to="/report/lost" variant="accent">
              Report a lost pet
            </Button>
            <Button as={Link} to="/report/found">
              Report a found pet
            </Button>
          </div>
        }
      />
    )
  }

  if (tab === 'returned') {
    return (
      <EmptyState
        icon={CircleCheck}
        title="No returned pets yet"
        description="When a Pet Coordinator confirms a match, or you mark a pet as returned, the report moves here."
        action={
          <Button as={Link} to="/explore?type=found" variant="secondary">
            <Search size={16} aria-hidden="true" />
            Browse found pets
          </Button>
        }
      />
    )
  }

  return (
    <EmptyState
      icon={XCircle}
      title="No closed reports"
      description="Reports you close are kept here, with their history, for as long as you need them."
    />
  )
}

function reportName(report) {
  return (
    report.petName ??
    `${report.reportType === REPORT_TYPES.FOUND ? 'Found' : 'Lost'} ${speciesLabel(report.species).toLowerCase()}`
  )
}

/**
 * An unfinished report (Correction 4): continue it, or delete it. Not public,
 * not compared with anything, and nobody else can see it.
 */
function DraftCard({ draft, onDelete }) {
  const isFound = draft.reportType === REPORT_TYPES.FOUND
  const title = draft.petName || `Unfinished ${isFound ? 'found' : 'lost'} pet report`
  const kind = [draft.species && speciesLabel(draft.species), draft.breed].filter(Boolean).join(' · ')

  return (
    <li>
      <article className="flex flex-col gap-3 rounded-card border border-dashed border-border-strong bg-panel p-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <ReportTypeBadge reportType={draft.reportType} size="sm" />
            <span className="inline-flex items-center rounded-pill border border-dashed border-border-strong px-2.5 py-0.5 text-xs font-medium text-fg">
              Draft
            </span>
          </div>
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          {kind && <p className="text-sm text-fg-muted">{kind}</p>}
          <p className="text-sm text-fg-muted">
            Saved {formatDate(draft.updatedAt)}. Not submitted — nobody else can see it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Button as={Link} to={`/report/${draft.reportType}?draft=${draft.id}`} size="sm">
            <FilePen size={14} aria-hidden="true" />
            Continue editing
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger">
            <Trash2 size={14} aria-hidden="true" />
            Delete draft
          </Button>
        </div>
      </article>
    </li>
  )
}
