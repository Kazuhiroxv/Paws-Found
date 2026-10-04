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
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

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
  { id: 'drafts' },
  { id: 'review' },
  { id: 'open' },
  { id: 'returned' },
  { id: 'closed' },
  // Removed by an administrator. Not Closed: the case did not end, the
  // report was taken down. Listed only when there is one.
  { id: 'removed', onlyIfAny: true },
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
        note: 'Closed by the reporter.', // i18n: stored with the report
      })
      setClosing(null)
      reload()
    } finally {
      setIsClosingBusy(false)
    }
  }

  const header = (
    <PageHeader
      title={t('myReports.title')}
      description={t('myReports.description')}
      breadcrumb={[{ label: t('dashboard.title'), to: '/dashboard' }, { label: t('myReports.title') }]}
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
          {t('myReports.failed', { message: errorText(error) })}
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
            {t(`myReports.tabs.${item.id}`)}
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
        title={t('myReports.deleteTitle')}
        description={t('myReports.deleteBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingDraft(null)} disabled={isDeletingBusy} data-autofocus>
              {t('myReports.keepIt')}
            </Button>
            <Button variant="danger" onClick={confirmDeleteDraft} isLoading={isDeletingBusy}>
              {t('myReports.deleteDraft')}
            </Button>
          </>
        }
      />

      <Modal
        isOpen={Boolean(closing)}
        onClose={() => !isClosingBusy && setClosing(null)}
        size="sm"
        title={closing ? t('detail.closeTitle', { name: reportName(closing) }) : ''}
        description={t('myReports.closeBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setClosing(null)} disabled={isClosingBusy} data-autofocus>
              {t('myReports.keepOpen')}
            </Button>
            <Button variant="danger" onClick={confirmClose} isLoading={isClosingBusy}>
              {t('detail.closeReport')}
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
          {t('myReports.newReport')}
        </>
      }
      triggerClassName={cn(outlineTrigger, 'px-3')}
    >
      {(close) => (
        <>
          <NavDropdownItem as={Link} to="/report/lost" onClick={close}>
            <TriangleAlert size={15} className="text-lost" aria-hidden="true" />
            {t('nav.reportLost')}
          </NavDropdownItem>
          <NavDropdownItem as={Link} to="/report/found" onClick={close}>
            <HandHeart size={15} className="text-found" aria-hidden="true" />
            {t('nav.reportFound')}
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
      {t('dashboard.reviewMatch')}
    </Button>
  ) : (
    <Button as={Link} to={`/pet/${report.id}`} size="sm" className="relative">
      {t('map.viewReport')}
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
          alt={photo ? photo.alt || '' : t('ui.noPhoto')}
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
            {isFound ? t('detail.foundOn') : t('detail.lastSeen')} {formatDate(report.incidentDate)}
          </p>

          {openMatches.length > 0 && (
            <p className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-control bg-accent-soft px-2.5 py-1 text-sm font-medium text-lost">
              <Heart size={14} aria-hidden="true" />
              {t('myReports.matchesAvailable', { count: openMatches.length })}
            </p>
          )}
          {report.publicationStatus === PUBLICATION_STATUSES.PENDING_REVIEW && (
            <p className="mt-1 text-sm text-fg">
              {t('myReports.pending')}
            </p>
          )}
          {report.publicationStatus === PUBLICATION_STATUSES.REJECTED && (
            <p className="mt-1 text-sm text-fg">
              {t('myReports.rejected')}
            </p>
          )}
          {report.publicationStatus === PUBLICATION_STATUSES.REMOVED && (
            <p className="mt-1 text-sm text-fg">
              {t('myReports.removed')}
            </p>
          )}
          {isPublished && report.status === REPORT_STATUSES.RETURNED && (
            <p className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-success-ink">
              <CircleCheck size={14} aria-hidden="true" />
              {isFound ? t('myReports.returnedOwner') : t('myReports.backHome')}
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
                {t('common.edit')}
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
              {t('detail.closeReport')}
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
                  <span className="sr-only">{t('myReports.moreActions', { name })}</span>
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
                      {t('myReports.editReport')}
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
                        {t('detail.closeReport')}
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
        title={t('myReports.empty.drafts')}
        description={t('myReports.empty.draftsBody')}
      />
    )
  }

  if (tab === 'review') {
    return (
      <EmptyState
        icon={FilePen}
        title={t('myReports.empty.review')}
        description={t('myReports.empty.reviewBody')}
      />
    )
  }

  if (tab === 'removed') {
    return <EmptyState icon={XCircle} title={t('myReports.empty.removed')} description="" />
  }

  if (tab === 'open') {
    return (
      <EmptyState
        icon={PawPrint}
        title={t('myReports.empty.open')}
        description={t('myReports.empty.openBody')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button as={Link} to="/report/lost" variant="accent">
              {t('nav.reportLost')}
            </Button>
            <Button as={Link} to="/report/found">
              {t('nav.reportFound')}
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
        title={t('myReports.empty.returned')}
        description={t('myReports.empty.returnedBody')}
        action={
          <Button as={Link} to="/explore?type=found" variant="secondary">
            <Search size={16} aria-hidden="true" />
            {t('shell.footer.browseFound')}
          </Button>
        }
      />
    )
  }

  return (
    <EmptyState
      icon={XCircle}
      title={t('myReports.empty.closed')}
      description={t('myReports.empty.closedBody')}
    />
  )
}

function reportName(report) {
  return (
    report.petName ??
    t(report.reportType === REPORT_TYPES.FOUND ? 'matching.sideFound' : 'matching.sideLost', {
      species: speciesLabel(report.species).toLowerCase(),
    })
  )
}

/**
 * An unfinished report (Correction 4): continue it, or delete it. Not public,
 * not compared with anything, and nobody else can see it.
 */
function DraftCard({ draft, onDelete }) {
  const isFound = draft.reportType === REPORT_TYPES.FOUND
  const title = draft.petName || t(isFound ? 'myReports.unfinishedFound' : 'myReports.unfinishedLost')
  const kind = [draft.species && speciesLabel(draft.species), draft.breed].filter(Boolean).join(' · ')

  return (
    <li>
      <article className="flex flex-col gap-3 rounded-card border border-dashed border-border-strong bg-panel p-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <ReportTypeBadge reportType={draft.reportType} size="sm" />
            <span className="inline-flex items-center rounded-pill border border-dashed border-border-strong px-2.5 py-0.5 text-xs font-medium text-fg">
              {t('labels.publication.draft')}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          {kind && <p className="text-sm text-fg-muted">{kind}</p>}
          <p className="text-sm text-fg-muted">
            {t('myReports.saved', { date: formatDate(draft.updatedAt) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Button as={Link} to={`/report/${draft.reportType}?draft=${draft.id}`} size="sm">
            <FilePen size={14} aria-hidden="true" />
            {t('myReports.continue')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger">
            <Trash2 size={14} aria-hidden="true" />
            {t('myReports.deleteDraft')}
          </Button>
        </div>
      </article>
    </li>
  )
}
