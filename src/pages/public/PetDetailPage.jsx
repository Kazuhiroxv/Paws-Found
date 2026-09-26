import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
  Maximize2,
  MapPin,
  Mail,
  PawPrint,
  Rabbit,
  Star,
  UserRound,
  MessageSquare,
  Phone,
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
} from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { PatternVeil } from '@/components/PatternVeil'
import { RadarOrnament, RouteOrnament } from '@/components/Ornament'
import { Breadcrumb } from '@/components/Breadcrumb'
import { MatchCard } from '@/components/MatchCard'
import { ReportMap } from '@/components/LazyMaps'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { Timeline } from '@/components/Timeline'
import { FlagReportDialog } from '@/components/FlagReportDialog'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import {
  SPECIES,
  PET_SEX_LABELS,
  PET_SIZE_LABELS,
  REPORT_STATUSES,
  REPORT_TYPES,
  speciesLabel,
} from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { NotFoundError, matchService, petService, userService } from '@/services'
import { formatDate } from '@/utils/date'
import { cn } from '@/utils/cn'

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
  const [isFlagOpen, setIsFlagOpen] = useState(false)
  const [copied, setCopied] = useState(false)

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
    const reporter = report.reporter ?? { full_name: 'Unknown', phone: null, email: null }
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

  if (error) {
    // A missing report and a broken server are different things, and used to
    // look identical here. Telling somebody whose pet is missing that their
    // report "does not exist" because the server is down is both wrong and
    // frightening, so the two are now separated.
    const missing = error instanceof NotFoundError

    return (
      <Container width="prose" className="flex flex-col gap-6">
        <PageHeader title={missing ? 'Report not found' : 'This report could not be loaded'} />
        <EmptyState
          icon={missing ? SearchX : TriangleAlert}
          title={missing ? 'This report does not exist' : 'Something went wrong at our end'}
          description={
            missing
              ? 'It may have been removed, or the address may be wrong.'
              : 'The report is still there — we just could not fetch it. Please try again in a moment.'
          }
          action={
            missing ? (
              <Button as={Link} to="/explore" variant="secondary">
                Browse all reports
              </Button>
            ) : (
              <Button onClick={reload} variant="secondary">
                Try again
              </Button>
            )
          }
        />
      </Container>
    )
  }

  const { report, reporter, matches, counterparts, currentUser, actorNames } = data
  const isOwner = Boolean(currentUser) && currentUser.id === report.reporterId
  const isFound = report.reportType === REPORT_TYPES.FOUND
  const heading = report.petName ?? `${speciesLabel(report.species)} (name unknown)`

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

  // Marking returned goes through matchService, because resolving a case can
  // also close the other half of a confirmed pairing.
  const markReturned = async () => {
    await matchService.markReportReturned(report.id, currentUser.id)
    reload()
  }

  const closeReport = async () => {
    await petService.updateReportStatus(report.id, REPORT_STATUSES.CLOSED, {
      actorId: currentUser.id,
      note: 'Closed by the reporter.',
    })
    reload()
  }

  return (
    <Container className="relative isolate flex flex-col gap-8">
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
            { label: 'Home', to: '/' },
            { label: 'Explore', to: '/explore' },
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
                  <StatusBadge status={report.status} />
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
                  ? `Help ${report.petName ?? 'this pet'} get home`
                  : `Help bring ${report.petName ?? 'them'} home`}
              </p>
              <p className="mt-1 text-sm text-fg-muted">
                Last updated {formatDate(report.updatedAt)}
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
              {isFound ? 'What the finder said' : 'What happened'}
            </h2>
            <p className="text-lg leading-relaxed text-fg-muted">{report.description}</p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-fg">
              <PawPrint size={22} className="shrink-0 text-brand" aria-hidden="true" />
              Pet details
            </h2>

            {/* Chips rather than a definition list: these are short facts, and
                a wall of label/value rows buries the one that matters. Each
                carries its own label for screen readers. */}
            <ul className="flex flex-wrap gap-2">
              {[
                ['Species', speciesLabel(report.species)],
                ['Breed', report.breed],
                ['Size', PET_SIZE_LABELS[report.size]],
                ['Sex', PET_SEX_LABELS[report.sex]],
                ['Main colour', report.primaryColor],
                ['Other colour', report.secondaryColor],
                isFound && ['Collar', collarLabel(report.hasCollar)],
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
                  Distinctive features
                </h3>
                <p className="mt-1.5 text-fg-muted">{report.distinctiveMarkings}</p>
              </div>
            )}

            {isFound && report.condition && (
              <div className="rounded-card border border-border bg-panel p-5 shadow-card">
                <h3 className="flex items-center gap-2 font-semibold text-fg">
                  <Heart size={17} className="shrink-0 text-brand" aria-hidden="true" />
                  Condition when found
                </h3>
                <p className="mt-1.5 text-fg-muted">{report.condition}</p>
              </div>
            )}
          </section>

          <PossibleMatches report={report} matches={matches} counterparts={counterparts} />

          <section className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-fg">
              <MapPin size={22} className="shrink-0 text-brand" aria-hidden="true" />
              {isFound ? 'Where they were found' : 'Where they went missing'}
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
                      <p className="text-sm text-fg-muted">Area</p>
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
                      <p className="text-sm text-fg-muted">{isFound ? 'Found on' : 'Last seen'}</p>
                      <p className="font-medium text-fg">{formatDate(report.incidentDate)}</p>
                    </div>
                  </div>

                  {report.incidentTime && (
                    <div className="flex items-start gap-2.5">
                      <Clock size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                      <div>
                        <p className="text-sm text-fg-muted">Around</p>
                        <p className="font-medium text-fg">{report.incidentTime}</p>
                      </div>
                    </div>
                  )}
                </div>

                <p className="border-t border-border pt-4 text-sm text-fg-muted">
                  The shaded circle is an approximate area, not an exact location.
                </p>
              </div>
            </div>
          </section>

          <Card>
            <CardHeader
              titleAs="h2"
              title={<HeadingWithIcon icon={History}>Case history</HeadingWithIcon>}
              subtitle="Every change to this report, oldest first."
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
          {!isOwner && report.status !== REPORT_STATUSES.CLOSED && (
            <NextStepCard report={report} />
          )}

          {/* The summary is the quieter surface beside the report: tinted, so
              the photographs and the description stay the white ones. */}
          <Card tone="layer">
            <CardHeader titleAs="h2" title={<HeadingWithIcon icon={ClipboardList}>Report summary</HeadingWithIcon>} />
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
                  <dt className="text-fg-muted">{isFound ? 'Found on' : 'Last seen'}</dt>
                  <dd className="font-medium text-fg">{formatDate(report.incidentDate)}</dd>
                </div>

                <div className="grid grid-cols-[auto_1fr] items-start gap-x-2.5">
                  <MapPin
                    size={16}
                    className="row-span-2 mt-0.5 shrink-0 text-fg-subtle"
                    aria-hidden="true"
                  />
                  <dt className="text-fg-muted">Area</dt>
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
                  <dt className="text-fg-muted">Reported by</dt>
                  <dd className="font-medium text-fg">{reporter.full_name}</dd>
                </div>
              </dl>

              <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm">

              {report.contactPreferences.showPhone && (
                <a
                  href={`tel:${reporter.phone.replace(/\s/g, '')}`}
                  className="flex items-center gap-2 text-brand hover:underline"
                >
                  <Phone size={16} aria-hidden="true" />
                  {reporter.phone}
                </a>
              )}

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
                  Prefers to be reached through a Pet Coordinator.
                </p>
              ) : (
                !report.contactPreferences.showPhone &&
                !report.contactPreferences.showEmail && (
                  <p className="text-fg-muted">
                    This reporter has not shared any contact details.
                  </p>
                )
              )}
              </div>
            </CardBody>
          </Card>

          {isOwner && report.status !== REPORT_STATUSES.CLOSED && (
            <Card>
              <CardHeader titleAs="h2" title="Your report" />
              <CardBody className="flex flex-col gap-2">
                {report.status !== REPORT_STATUSES.RETURNED && (
                  <Button onClick={markReturned} fullWidth>
                    <Check size={16} aria-hidden="true" />
                    Mark as returned
                  </Button>
                )}
                <Button variant="secondary" fullWidth onClick={closeReport}>
                  Close this report
                </Button>
                <p className="text-sm text-fg-muted">
                  Closing stops it being compared against new reports. It stays visible
                  with a Closed status. To change the details, use Edit on My Reports.
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader titleAs="h2" title={<HeadingWithIcon icon={Link2}>Actions</HeadingWithIcon>} />
            <CardBody className="flex flex-col gap-2">
              <Button variant="secondary" fullWidth onClick={shareLink}>
                <LinkIcon size={16} aria-hidden="true" />
                {copied ? 'Link copied' : 'Share this report'}
              </Button>
              <p className="-mt-1 text-sm text-fg-muted">
                The more people who have seen {report.petName ?? 'this report'}, the better
                the chances.
              </p>

              {role ? (
                <Button variant="ghost" fullWidth onClick={() => setIsFlagOpen(true)}>
                  <Flag size={16} aria-hidden="true" />
                  Report this listing
                </Button>
              ) : (
                <p className="text-sm text-fg-muted">
                  <Link to="/login" className="text-brand underline">
                    Sign in
                  </Link>{' '}
                  to report a problem with this listing.
                </p>
              )}
            </CardBody>
          </Card>
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

/** Large photo with thumbnails, or the shared placeholder when there are none. */
function PhotoGallery({ photos, petLabel }) {
  const ordered = [...photos].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  const [activeIndex, setActiveIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const active = ordered[activeIndex]
  const altText = active?.alt ?? `No photo was provided for this report about ${petLabel}`

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
          <img
            src={active?.url ?? photoPlaceholder}
            alt={altText}
            className="aspect-4/3 max-h-96 w-full rounded-card bg-surface-muted object-cover shadow-raised"
          />
          <span className="sr-only">View full photo</span>
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
                <span className="sr-only">Show photo {index + 1}</span>
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
          Possible matches
        </h2>
        <p className="text-sm text-fg-muted">
          These reports share characteristics with this one. A possible match is a
          suggestion, not a confirmation — a Pet Coordinator helps verify ownership before
          anything is arranged.
        </p>
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
        <p className="text-sm text-success">This pet has been reunited with its owner.</p>
      )}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <Container className="flex flex-col gap-6">
      <span className="sr-only">Loading report…</span>
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
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'Not sure'
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
  const name = report.petName ?? 'this pet'

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <h2 className="font-semibold text-fg">
          {isLost ? `Have you seen ${name}?` : `Is this your pet?`}
        </h2>

        <p className="text-sm text-fg-muted">
          {isLost
            ? 'File a found report with what you saw and where. It is compared against this one straight away, and a Pet Coordinator checks any pairing before anyone is put in touch.'
            : 'File a lost report describing your pet. It is compared against this one straight away, and a Pet Coordinator verifies ownership before arranging a handover.'}
        </p>

        <Button as={Link} to={isLost ? '/report/found' : '/report/lost'} fullWidth>
          {isLost ? (
            <>
              <HandHeart size={16} aria-hidden="true" />
              Report a found pet
            </>
          ) : (
            <>
              <SearchX size={16} aria-hidden="true" />
              Report a lost pet
            </>
          )}
        </Button>
      </CardBody>
    </Card>
  )
}
