import { useCallback, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  Bird,
  CalendarDays,
  Cat,
  Check,
  ClipboardList,
  Clock,
  Dog,
  Flag,
  HandHeart,
  Heart,
  History,
  Link as LinkIcon,
  Link2,
  Lock,
  Maximize2,
  MapPin,
  Mail,
  PawPrint,
  Rabbit,
  Star,
  UserRound,
  MessageSquare,
  SearchX,
  TriangleAlert,
} from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  EmptyState,
  LoadingSkeleton,
  Textarea,
} from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { PatternVeil } from '@/components/PatternVeil'
import { RadarOrnament, RouteOrnament } from '@/components/Ornament'
import { Breadcrumb } from '@/components/Breadcrumb'
import { MatchCard } from '@/components/MatchCard'
import { ReportMap } from '@/components/LazyMaps'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { PublicationBadge, StatusBadge } from '@/components/StatusBadge'
import { PublicationPanel } from '@/components/PublicationPanel'
import { Timeline } from '@/components/Timeline'
import { FlagReportDialog } from '@/components/FlagReportDialog'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import {
  PET_SEX_LABELS,
  PET_SIZE_LABELS,
  PUBLICATION_STATUSES,
  REPORT_STATUSES,
  REPORT_TYPES,
  SPECIES,
  colourLabel,
  speciesLabel,
} from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { NotFoundError, matchService, petService, userService } from '@/services'
import { formatDate, formatTime12Hour } from '@/utils/date'
import { cn } from '@/utils/cn'
import { t } from '@/i18n'
import { HandoverNotice } from '@/components/HandoverNotice'
import { Rich } from '@/i18n/Rich'

/**
 * What the history says when a reporter closes a report without a reason.
 * Stored with the report, so it stays in English whatever the language
 * showing (Correction 7): what is saved does not depend on who saved it.
 */
const DEFAULT_CLOSE_REASON = 'Closed by the reporter.'

/**
 * The central case page for one report.
 *
 * Privacy (CLAUDE.md §14): the reporter's phone and email appear only if they
 * chose to share them, the location is the approximate area they described, and
 * staff notes on a match are never rendered here.
 *
 * @param {Object} props
 * @param {string|null} props.role  Current demo role, or null when signed out.
 */
export function PetDetailPage({ role }) {
  const { id } = useParams()
  const location = useLocation()
  const [isFlagOpen, setIsFlagOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [finishing, setFinishing] = useState(null) // 'returned' | 'closed' | null
  const [isFinishing, setIsFinishing] = useState(false)
  const [finishError, setFinishError] = useState(null)
  const [closeReason, setCloseReason] = useState('')
  // What a review decision just did. Kept here, not in the panel: the report
  // reloads after the decision, which remounts the panel.
  const [publicationNotice, setPublicationNotice] = useState(null)
  const openFinish = (kind) => {
    setFinishError(null)
    setCloseReason('')
    setFinishing(kind)
  }

  const loadCase = useCallback(async () => {
    const report = await petService.getReportById(id)

    const [matches, currentUser] = await Promise.all([
      matchService.getMatchesForReport(report.id),
      userService.getCurrentUser(),
    ])

    // Each match points at one other report — the other half of the pair.
    const counterparts = await Promise.all(
      matches.map((match) =>
        petService.getReportById(
          match.lostReportId === report.id ? match.foundReportId : match.lostReportId,
        ),
      ),
    )

    // The reporter and the names on the case history both arrive with the
    // report itself. The API decides what of a reporter's contact details may
    // be shown, so the page must not look them up separately — that would
    // route around the privacy rule (CLAUDE.md §14).
    const reporter = report.reporter ?? { full_name: t('detail.unknown'), phone: null, email: null }
    const actorNames = Object.fromEntries(
      report.statusHistory
        .filter((entry) => entry.actorName)
        .map((entry) => [entry.actorId, entry.actorName]),
    )

    return { report, reporter, matches, counterparts, currentUser, actorNames }
  }, [id])

  const { data, error, isLoading, reload } = useAsync(loadCase)

  // Stable single-item array, so the map does not re-centre on every render.
  const mapReports = useMemo(() => (data ? [data.report] : []), [data])

  if (isLoading) return <DetailSkeleton />

  // A guest reached a report from a card or a map pin. The list and the map are
  // public; the full report is for members (the API answers 401), so say so
  // and offer the way in. Sign-in brings them back here afterwards.
  if (error?.payload?.code === 'auth_required') {
    return <SignInGate from={location.pathname} />
  }

  if (error) {
    // A missing report and a broken server are different things, and used to
    // look identical here. Telling somebody whose pet is missing that their
    // report "does not exist" because the server is down is both wrong and
    // frightening, so the two are now separated.
    const missing = error instanceof NotFoundError

    return (
      <Container width="prose" className="flex flex-col gap-6">
        <PageHeader title={missing ? t('detail.notFound') : t('detail.loadFailed')} />
        <EmptyState
          icon={missing ? SearchX : TriangleAlert}
          title={missing ? t('detail.missing') : t('detail.ourEnd')}
          description={missing ? t('detail.missingBody') : t('detail.ourEndBody')}
          action={
            missing ? (
              <Button as={Link} to="/explore" variant="secondary">
                {t('detail.browseAll')}
              </Button>
            ) : (
              <Button onClick={reload} variant="secondary">
                {t('detail.tryAgain')}
              </Button>
            )
          }
        />
      </Container>
    )
  }

  const { report, reporter, matches, counterparts, currentUser, actorNames } = data
  const isOwner = Boolean(currentUser) && currentUser.id === report.reporterId
  // Not published: waiting for review, not approved, or removed (Correction
  // 4). Only its reporter and coordinators get this far — the API answers
  // 404 to anybody else — and none of the public's actions apply to it.
  const isPublished = report.publicationStatus === PUBLICATION_STATUSES.PUBLISHED
  // Set by the edit form when the details saved but a photo change did not.
  const photoWarning = location.state?.photoWarning
  const isFound = report.reportType === REPORT_TYPES.FOUND
  const heading = report.petName ?? t('common.nameUnknown', { species: speciesLabel(report.species) })

  // Passing a report around is how a search actually spreads, so this uses
  // the phone's own share sheet where there is one — into a group chat, which
  // is where the neighbours are — and falls back to the clipboard everywhere
  // else. A cancelled share is not an error.
  const shareLink = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title: `${heading} · Paws&Found`, url })
        return
      } catch (caught) {
        if (caught?.name === 'AbortError') return
      }
    }

    await navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Finishing a case is one-way: a returned or closed report can no longer be
  // edited or reopened, and any possible match still open on it is withdrawn.
  // So both actions ask first, show that they are working, and say so if they
  // fail — they used to fire on the first click, silently.
  const finish = async () => {
    setIsFinishing(true)
    setFinishError(null)
    try {
      if (finishing === 'returned') {
        await matchService.markReportReturned(report.id, currentUser.id)
      } else {
        await petService.updateReportStatus(report.id, REPORT_STATUSES.CLOSED, {
          actorId: currentUser.id,
          note: closeReason.trim() || DEFAULT_CLOSE_REASON,
        })
      }
      setFinishing(null)
      reload()
    } catch (caught) {
      setFinishError(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsFinishing(false)
    }
  }

  return (
    <Container className="relative isolate flex flex-col gap-8">
      <ConfirmDialog
        isOpen={Boolean(finishing)}
        title={
          finishing === 'returned'
            ? isFound
              ? t('detail.returnFoundTitle')
              : t('detail.returnTitle', { name: heading })
            : t('detail.closeTitle', { name: heading })
        }
        confirmLabel={
          finishing === 'returned'
            ? isFound
              ? t('detail.markReturnedOwner')
              : t('detail.markReturned')
            : t('detail.closeReport')
        }
        cancelLabel={t('publication.goBack')}
        tone={finishing === 'returned' ? 'primary' : 'danger'}
        isBusy={isFinishing}
        error={finishError}
        onCancel={() => !isFinishing && setFinishing(null)}
        onConfirm={finish}
      >
        {finishing === 'returned' ? (
          <>
            {/* A finder marks their own report finished, perhaps because the
                owner turned up some other way. It is the report's lifecycle,
                not a pairing's: nothing here says which owner, and a pairing a
                coordinator ruled out stays ruled out. */}
            {isFound && (
              <p>{t('detail.returnFoundBody')}</p>
            )}
            <p>{t('detail.returnBody')}</p>
          </>
        ) : (
          <>
            <p>{t('detail.closeBody')}</p>
            <Textarea
              label={t('detail.reasonOptional')}
              value={closeReason}
              onChange={(event) => setCloseReason(event.target.value)}
              rows={2}
              maxLength={255}
              hint={t('detail.reasonHint', { reason: DEFAULT_CLOSE_REASON })}
            />
          </>
        )}
      </ConfirmDialog>

      {photoWarning && isOwner && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-fg">
          {t('detail.photoWarning', { message: photoWarning })}
        </p>
      )}
      {/* The case header environment: the breadcrumb, the name and the
          photograph share one tinted ground — amber for a lost report, teal
          for a found one — which fades out before the details below it. It is
          a field, not a boxed hero. */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 -top-8 -z-10 h-[34rem] overflow-hidden',
          isFound ? 'case-ground-found' : 'case-ground-lost',
        )}
      >
        <RadarOrnament tone={isFound ? 'teal' : 'amber'} size={520} className="-top-24 -right-40" />
      </span>
      <PatternVeil className="-top-8 h-[26rem]" />

      {/* This page composes its own header rather than using PageHeader: the
          type and status badges belong directly under the name, which is the
          first thing anyone needs to read here. */}
      <title>{`${heading} · Paws&Found`}</title>

      {/* A committed case header rather than a name with two badges under it.
          The band is the report's own colour — amber for a lost pet, teal for
          a found one — so the page announces which kind of case this is before
          a word is read, and the plea sits opposite the name where the
          reference design puts the case reference.
          
          There is no case ID in the schema, so that line carries what we do
          have. It says "last updated" rather than "reported" because the
          detail endpoint does not return created_at — labelling the incident
          date as the filing date would have been a plausible-looking lie, and
          `updated_at` is both real and the more useful of the two on a case
          somebody is deciding whether to act on. */}
      <div className="flex flex-col gap-5 pb-2">
        <Breadcrumb
          items={[
            { label: t('nav.home'), to: '/' },
            { label: t('nav.explore'), to: '/explore' },
            { label: heading },
          ]}
        />

        <div
          className={cn(
            'relative isolate overflow-hidden rounded-[1.5rem] border px-5 py-6 sm:px-8 sm:py-7',
            isFound ? 'border-found/20 bg-found-soft/60' : 'border-lost/20 bg-lost-soft/60',
          )}
        >
          <RouteOrnament
            tone={isFound ? 'teal' : 'amber'}
            size={460}
            strength={2.6}
            className="-top-6 right-4 hidden lg:block"
          />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span
                className={cn(
                  'flex size-14 shrink-0 items-center justify-center rounded-full',
                  isFound ? 'bg-found/10 text-found' : 'bg-lost/10 text-lost',
                )}
              >
                <SpeciesMark species={report.species} size={28} />
              </span>

              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <ReportTypeBadge reportType={report.reportType} />
                  {isPublished && <StatusBadge status={report.status} />}
                  <PublicationBadge publication={report.publicationStatus} />
                </div>

                <h1 className="text-[2.25rem] leading-[1.05] font-semibold tracking-tight text-balance text-fg sm:text-[2.75rem]">
                  {heading}
                </h1>

                {(report.breed || report.species) && (
                  <p className="text-lg text-fg-muted">
                    {[speciesLabel(report.species), report.breed].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 lg:text-right">
              <p
                className={cn(
                  'text-sm font-medium',
                  isFound ? 'text-found' : 'text-lost',
                )}
              >
                {isFound
                  ? t('detail.helpFound', { name: report.petName ?? t('detail.thisPet') })
                  : t('detail.helpLost', { name: report.petName ?? t('detail.them') })}
              </p>
              <p className="mt-1 text-sm text-fg-muted">
                {t('detail.lastUpdated', { date: formatDate(report.updatedAt) })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <PhotoGallery photos={report.photos} petLabel={heading} />

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-fg">
              <MessageSquare size={22} className="shrink-0 text-brand" aria-hidden="true" />
              {isFound ? t('detail.finderSaid') : t('detail.whatHappened')}
            </h2>
            <p className="text-lg leading-relaxed text-fg-muted">{report.description}</p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-fg">
              <PawPrint size={22} className="shrink-0 text-brand" aria-hidden="true" />
              {t('reportForm.steps.details')}
            </h2>

            {/* Chips rather than a definition list: these are short facts, and
                a wall of label/value rows buries the one that matters. Each
                carries its own label for screen readers. */}
            <ul className="flex flex-wrap gap-2">
              {[
                [t('reportForm.details.species'), speciesLabel(report.species)],
                [t('reportForm.details.breed'), report.breed],
                [t('reportForm.details.size'), PET_SIZE_LABELS[report.size]],
                [t('reportForm.details.sex'), PET_SEX_LABELS[report.sex]],
                [t('reportForm.details.mainColour'), colourLabel(report.primaryColor)],
                [t('reportForm.details.otherColour'), colourLabel(report.secondaryColor)],
                isFound && [t('reportForm.review.collar'), collarLabel(report.hasCollar)],
              ]
                .filter((row) => row && row[1])
                .map(([label, value]) => (
                  <li
                    key={label}
                    className="rounded-pill border border-border bg-panel px-3.5 py-1.5 text-sm font-medium text-fg shadow-card"
                  >
                    <span className="sr-only">{label}: </span>
                    {value}
                  </li>
                ))}
            </ul>

            {report.distinctiveMarkings && (
              <div className="rounded-card border border-border bg-accent-soft/60 p-5">
                <h3 className="flex items-center gap-2 font-semibold text-fg">
                  <Star size={17} className="shrink-0 text-accent-hover" aria-hidden="true" />
                  {t('reportForm.details.features')}
                </h3>
                <p className="mt-1.5 text-fg-muted">{report.distinctiveMarkings}</p>
              </div>
            )}

            {isFound && report.condition && (
              <div className="rounded-card border border-border bg-panel p-5 shadow-card">
                <h3 className="flex items-center gap-2 font-semibold text-fg">
                  <Heart size={17} className="shrink-0 text-brand" aria-hidden="true" />
                  {t('detail.conditionFound')}
                </h3>
                <p className="mt-1.5 text-fg-muted">{report.condition}</p>
              </div>
            )}
          </section>

          <PossibleMatches report={report} matches={matches} counterparts={counterparts} />

          <section className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-fg">
              <MapPin size={22} className="shrink-0 text-brand" aria-hidden="true" />
              {isFound ? t('detail.whereFound') : t('reportForm.review.whereLost')}
            </h2>

            {/* The map leads edge to edge here rather than sitting inside a
                padded card — on a lost-pet page the area is the thing people
                actually study, and a boxed-in map reads as an afterthought. */}
            <div className="overflow-hidden rounded-card border border-border bg-panel shadow-card">
              {/* The circle makes the imprecision visible: this is the area the
                  reporter described, not an address. */}
              <ReportMap reports={mapReports} showApproximateArea height="h-80 sm:h-96" />

              <div className="flex flex-col gap-4 border-t border-border p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-start gap-2.5">
                    <MapPin
                      size={18}
                      className="mt-0.5 shrink-0 text-brand"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm text-fg-muted">{t('detail.area')}</p>
                      <p className="font-medium text-fg">{report.location.label}</p>
                      <p className="text-sm text-fg-muted">
                        {report.location.city}, {report.location.province}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CalendarDays
                      size={18}
                      className="mt-0.5 shrink-0 text-brand"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm text-fg-muted">{isFound ? t('detail.foundOn') : t('detail.lastSeen')}</p>
                      <p className="font-medium text-fg">{formatDate(report.incidentDate)}</p>
                    </div>
                  </div>

                  {report.incidentTime && (
                    <div className="flex items-start gap-2.5">
                      <Clock size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                      <div>
                        <p className="text-sm text-fg-muted">{t('detail.around')}</p>
                        <p className="font-medium text-fg">{formatTime12Hour(report.incidentTime)}</p>
                      </div>
                    </div>
                  )}
                </div>

                <p className="border-t border-border pt-4 text-sm text-fg-muted">
                  {t('detail.circle')}
                </p>
              </div>
            </div>
          </section>

          <Card>
            <CardHeader
              titleAs="h2"
              title={<HeadingWithIcon icon={History}>{t('detail.history')}</HeadingWithIcon>}
              subtitle={t('detail.historyHint')}
            />
            <CardBody>
              <Timeline entries={report.statusHistory} actorNames={actorNames} />
            </CardBody>
          </Card>
        </div>

        {/* The rail sticks, but the owner's view carries a third card and can
            grow taller than a laptop viewport — without the height cap the
            bottom card would sit permanently below the fold with no way to
            scroll to it. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
          {/* The page's one primary action, at the top where a primary action
              belongs.

              It used to have none. Somebody arriving here because they think
              they have seen this animal found a summary, a description and a
              Share button, and nothing that said what to do next — the whole
              point of the page had no affordance.

              What it offers is the thing the system actually does. There is no
              messaging feature, so there is no "Contact reporter" button to
              give: filing the opposite kind of report is what puts these two
              cases in front of the matching algorithm and a coordinator. That
              is the real path, so it is the one on the button. */}
          <PublicationPanel
            report={report}
            viewer={currentUser}
            // Keyed to the report, so it never follows somebody to another one.
            notice={publicationNotice?.reportId === report.id ? publicationNotice.message : null}
            onChanged={(message) => {
              setPublicationNotice({ reportId: report.id, message })
              reload()
            }}
          />

          {isPublished && !isOwner && report.status !== REPORT_STATUSES.CLOSED && (
            <NextStepCard report={report} />
          )}

          {/* The summary is the quieter surface beside the report: tinted, so
              the photographs and the description stay the white ones. */}
          <Card tone="layer">
            <CardHeader titleAs="h2" title={<HeadingWithIcon icon={ClipboardList}>{t('detail.summary')}</HeadingWithIcon>} />
            <CardBody className="flex flex-col gap-4">
              {/* A `dl` may contain `dt`/`dd` directly, or wrapped one level
                  deep in a `div` — not two. The icon used to force a second
                  wrapper, which left the terms and definitions outside any
                  list as far as assistive technology was concerned. A grid
                  puts the icon, the term and the definition on one level and
                  keeps the layout identical. */}
              <dl className="flex flex-col gap-3 text-sm">
                <div className="grid grid-cols-[auto_1fr] items-start gap-x-2.5">
                  <CalendarDays
                    size={16}
                    className="row-span-2 mt-0.5 shrink-0 text-fg-subtle"
                    aria-hidden="true"
                  />
                  <dt className="text-fg-muted">{isFound ? t('detail.foundOn') : t('detail.lastSeen')}</dt>
                  <dd className="font-medium text-fg">{formatDate(report.incidentDate)}</dd>
                </div>

                <div className="grid grid-cols-[auto_1fr] items-start gap-x-2.5">
                  <MapPin
                    size={16}
                    className="row-span-2 mt-0.5 shrink-0 text-fg-subtle"
                    aria-hidden="true"
                  />
                  <dt className="text-fg-muted">{t('detail.area')}</dt>
                  <dd className="font-medium text-fg">
                    {report.location.city}, {report.location.province}
                  </dd>
                </div>

                <div className="grid grid-cols-[auto_1fr] items-start gap-x-2.5">
                  <UserRound
                    size={16}
                    className="row-span-2 mt-0.5 shrink-0 text-fg-subtle"
                    aria-hidden="true"
                  />
                  <dt className="text-fg-muted">{t('detail.reportedBy')}</dt>
                  <dd className="font-medium text-fg">{reporter.full_name}</dd>
                </div>
              </dl>

              <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm">

              {/* No phone number, ever (Correction 3): the API does not send
                  one, and nothing here would show it if it did. */}
              {report.contactPreferences.showEmail && (
                <a
                  href={`mailto:${reporter.email}`}
                  className="flex items-center gap-2 break-all text-brand hover:underline"
                >
                  <Mail size={16} aria-hidden="true" />
                  {reporter.email}
                </a>
              )}

              {report.contactPreferences.allowPlatformContact ? (
                <p className="flex items-start gap-2 text-fg-muted">
                  <MessageSquare
                    size={16}
                    className="mt-0.5 shrink-0 text-fg-subtle"
                    aria-hidden="true"
                  />
                  {t('detail.viaCoordinator')}
                </p>
              ) : (
                !report.contactPreferences.showEmail && (
                  <p className="text-fg-muted">
                    {t('detail.noContact')}
                  </p>
                )
              )}
              </div>
            </CardBody>
          </Card>

          {isPublished && isOwner && report.status !== REPORT_STATUSES.CLOSED && (
            <Card>
              <CardHeader titleAs="h2" title={t('detail.yourReport')} />
              <CardBody className="flex flex-col gap-2">
                {report.status !== REPORT_STATUSES.RETURNED && (
                  <Button onClick={() => openFinish('returned')} fullWidth>
                    <Check size={16} aria-hidden="true" />
                    {isFound ? t('detail.markReturnedOwner') : t('detail.markReturned')}
                  </Button>
                )}
                <Button variant="secondary" fullWidth onClick={() => openFinish('closed')}>
                  {t('detail.closeThis')}
                </Button>
                <p className="text-sm text-fg-muted">
                  {t('detail.closeNote')}{' '}
                  {report.status === REPORT_STATUSES.POSSIBLE_MATCH
                    ? t('detail.lockedWhileMatch')
                    : t('detail.editOnMyReports')}
                </p>
              </CardBody>
            </Card>
          )}

          {isPublished && (
          <Card>
            <CardHeader titleAs="h2" title={<HeadingWithIcon icon={Link2}>{t('detail.actions')}</HeadingWithIcon>} />
            <CardBody className="flex flex-col gap-2">
              <Button variant="secondary" fullWidth onClick={shareLink}>
                <LinkIcon size={16} aria-hidden="true" />
                {copied ? t('detail.copied') : t('detail.share')}
              </Button>
              <p className="-mt-1 text-sm text-fg-muted">
                {t('detail.shareNote', { name: report.petName ?? t('detail.thisReport') })}
              </p>

              {role ? (
                <Button variant="ghost" fullWidth onClick={() => setIsFlagOpen(true)}>
                  <Flag size={16} aria-hidden="true" />
                  {t('flag.title')}
                </Button>
              ) : (
                <p className="text-sm text-fg-muted">
                  <Rich
                    k="detail.signInToFlag"
                    tags={{
                      link: (text) => (
                        <Link to="/login" className="text-brand underline">
                          {text}
                        </Link>
                      ),
                    }}
                  />
                </p>
              )}
            </CardBody>
          </Card>
          )}
        </aside>
      </div>

      {currentUser && (
        <FlagReportDialog
          isOpen={isFlagOpen}
          onClose={() => setIsFlagOpen(false)}
          reportId={report.id}
        />
      )}
    </Container>
  )
}

/**
 * What a guest sees instead of a report.
 *
 * The card or pin they followed showed a photo, the kind of pet, the area and
 * the date. The rest — description, markings, all the photos, the case
 * history, the reporter's name and any contact details they chose to share —
 * is for signed-in members, so the people and pets involved are not laid out
 * for anyone who happens past. Enforced by the API, not by this page.
 */
function SignInGate({ from }) {
  return (
    <Container width="prose" className="flex flex-col gap-6">
      <PageHeader title={t('detail.gateTitle')} />
      <EmptyState
        icon={Lock}
        title={t('detail.gateHeading')}
        description={t('detail.gateBody')}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            {/* `from` is what LoginPage returns to after a successful sign-in. */}
            <Button as={Link} to="/login" state={{ from }}>
              {t('auth.login.title')}
            </Button>
            <Button as={Link} to="/register" variant="secondary">
              {t('auth.register.title')}
            </Button>
          </div>
        }
      />
      <Link
        to="/explore"
        className="self-center text-sm font-medium text-brand hover:underline"
      >
        {t('detail.backToAll')}
      </Link>
    </Container>
  )
}

/** Large photo with thumbnails, or the shared placeholder when there are none. */
function PhotoGallery({ photos, petLabel }) {
  const ordered = [...photos].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  const [activeIndex, setActiveIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const active = ordered[activeIndex]
  const altText = active?.alt ?? t('detail.noPhotoAbout', { name: petLabel })

  return (
    <div className="flex flex-col gap-3">
      {/* Capped height: at full column width a 4:3 photo is tall enough to
          push the pet's details below the fold on a laptop. The full frame is
          a click away — identifying a pet means looking at scars, collars and
          coat patterns, which a cropped thumbnail hides. */}
      <div className="group/photo relative">
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="block w-full cursor-zoom-in"
        >
          {/* The whole photograph, never a crop. The frame is capped at 384px,
              which at column width made it about 2.2:1, and `object-cover`
              then cut 39% off the height of a 4:3 photo — usually the head.
              Now it is contained, and the gap either side is filled with a
              soft, blurred copy of the same photo rather than empty bars. */}
          <span className="relative block aspect-4/3 max-h-96 w-full overflow-hidden rounded-card bg-sunken shadow-raised">
            {active?.url && (
              <img
                src={active.url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl"
              />
            )}
            <img
              src={active?.url ?? photoPlaceholder}
              alt={altText}
              className="relative size-full object-contain"
            />
          </span>
          <span className="sr-only">{t('matching.viewFullPhoto')}</span>
        </button>

        {/* A hint that the photograph opens, without a caption over the pet:
            the corner control firms up and the image dims very slightly under
            the pointer. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-card bg-fg/0 transition-colors duration-200 group-hover/photo:bg-fg/6"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-3 right-3 flex size-9 items-center justify-center rounded-control bg-panel/80 text-fg shadow-card backdrop-blur-sm transition-all duration-200 group-hover/photo:bg-panel group-hover/photo:shadow-raised"
        >
          <Maximize2 size={16} />
        </span>

        {/* Only when there is something to count. A report filed without a
            photograph shows the placeholder, and the counter read "1 / 0". */}
        {ordered.length > 0 && (
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-pill bg-fg/70 px-2.5 py-1 text-xs font-medium text-fg-inverted">
            {activeIndex + 1} / {ordered.length}
          </span>
        )}
      </div>

      {ordered.length > 1 && (
        <ul className="flex flex-wrap gap-2">
          {ordered.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-current={index === activeIndex ? 'true' : undefined}
                className={
                  index === activeIndex
                    ? 'rounded-control ring-2 ring-brand'
                    : 'rounded-control opacity-70 hover:opacity-100'
                }
              >
                <img
                  src={photo.url ?? photoPlaceholder}
                  alt=""
                  className="size-16 rounded-control object-cover"
                />
                <span className="sr-only">{t('detail.showPhoto', { number: index + 1 })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <PhotoLightbox
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        src={active?.url ?? photoPlaceholder}
        alt={altText}
        index={activeIndex}
        total={ordered.length}
        onStep={(step) =>
          setActiveIndex((current) => (current + step + ordered.length) % ordered.length)
        }
      />
    </div>
  )
}

/**
 * Reports that could be the same animal.
 *
 * Wording rule (CLAUDE.md §6.5): these are always *possible* matches. The
 * comparison and verification workflow is Phase 7 — this only surfaces that a
 * suggestion exists and links to the other report. Staff notes are never shown.
 */
function PossibleMatches({ report, matches, counterparts }) {
  if (matches.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-lg font-semibold text-fg">
          <Heart size={18} className="shrink-0 text-brand" aria-hidden="true" />
          {t('detail.possibleMatches')}
        </h2>
        <p className="text-sm text-fg-muted">{t('detail.possibleMatchesBody')}</p>
        <HandoverNotice className="mt-2" />
      </div>

      <ul className="flex flex-col gap-4">
        {matches.map((match, index) => {
          const counterpart = counterparts[index]
          const isLost = report.reportType === REPORT_TYPES.LOST

          return (
            <li key={match.id}>
              <MatchCard
                match={match}
                lostReport={isLost ? report : counterpart}
                foundReport={isLost ? counterpart : report}
              />
            </li>
          )
        })}
      </ul>

      {report.status === REPORT_STATUSES.RETURNED && (
        <p className="text-sm text-success">{t('detail.reunited')}</p>
      )}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <Container className="flex flex-col gap-6">
      <span className="sr-only">{t('detail.loading')}</span>
      <LoadingSkeleton className="h-8 w-64" />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="flex-1 flex-col gap-4">
          <LoadingSkeleton className="mb-4 aspect-4/3 w-full" />
          <LoadingSkeleton lines={4} />
        </div>
        <div className="lg:w-80">
          <LoadingSkeleton lines={5} />
        </div>
      </div>
    </Container>
  )
}

function collarLabel(value) {
  if (value === true || value === 'yes') return t('common.yes')
  if (value === false || value === 'no') return t('common.no')
  return t('common.notSure')
}

/** Lucide has one icon per species we support; anything else gets a paw. */
const SPECIES_ICONS = {
  [SPECIES.DOG]: Dog,
  [SPECIES.CAT]: Cat,
  [SPECIES.BIRD]: Bird,
  [SPECIES.RABBIT]: Rabbit,
}

function SpeciesMark({ species, size = 20 }) {
  const Icon = SPECIES_ICONS[species] ?? PawPrint
  return <Icon size={size} aria-hidden="true" />
}

/**
 * A card heading with its icon. The icon is decorative — every heading still
 * reads correctly with images off or to a screen reader.
 */
function HeadingWithIcon({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-2.5">
      <Icon size={18} className="shrink-0 text-brand" aria-hidden="true" />
      {children}
    </span>
  )
}

/**
 * What to do about this report, for somebody who did not file it.
 *
 * The wording depends on which way round the case is, because the useful next
 * step is the opposite of whatever this report is:
 *
 *   * a LOST report — you may have seen the animal, so file a found report;
 *   * a FOUND report — it may be yours, so file a lost report.
 *
 * Either way the new report is compared against this one automatically, which
 * is the honest version of "get in touch": the system has no messaging, and a
 * button that implied it did would be a button that does nothing.
 */
function NextStepCard({ report }) {
  const isLost = report.reportType === REPORT_TYPES.LOST
  const name = report.petName ?? t('detail.thisPet')

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <h2 className="font-semibold text-fg">
          {isLost ? t('detail.seenTitle', { name }) : t('detail.yoursTitle')}
        </h2>

        <p className="text-sm text-fg-muted">
          {isLost
            ? t('detail.seenBody')
            : t('detail.yoursBody')}
        </p>

        <Button as={Link} to={isLost ? '/report/found' : '/report/lost'} fullWidth>
          {isLost ? (
            <>
              <HandHeart size={16} aria-hidden="true" />
              {t('nav.reportFound')}
            </>
          ) : (
            <>
              <SearchX size={16} aria-hidden="true" />
              {t('nav.reportLost')}
            </>
          )}
        </Button>
      </CardBody>
    </Card>
  )
}
