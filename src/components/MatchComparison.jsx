import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, History, Maximize2, X } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { MATCH_STATUSES, MATCH_STATUS_LABELS, PET_SIZE_LABELS, REPORT_TYPES, isRuledOut, speciesLabel } from '@/constants'
import { cn } from '@/utils/cn'
import { formatDate, formatShortDate } from '@/utils/date'
import { t } from '@/i18n'

/**
 * One lost-and-found pairing, drawn the same way everywhere it is decided on:
 * the owner's Possible Matches, the Staff Match Queue and Verification.
 *
 * Order matters: who is paired with whom and where it stands, then the two
 * photographs with the score between them, then the evidence. Whatever the
 * page adds — the owner's choice, a coordinator's decision — comes last, as
 * `children`.
 *
 * The score is shown as a *compatibility* score with the count of aligned
 * characteristics, beside a separate Possible / Confirmed label, so "100%" is
 * never read as proof. Nothing here recalculates anything: `score`, `matched`
 * and `detail` are the stored values.
 *
 * @param {Object} props
 * @param {Object} props.match
 * @param {Object} props.lost    The lost report.
 * @param {Object} props.found   The found report.
 * @param {React.ReactNode} props.badge  The stage label for this page's reader.
 * @param {'h2'|'h3'} [props.headingAs]
 * @param {React.ReactNode} [props.children]
 */
export function MatchPairCard({ match, lost, found, badge, headingAs: Heading = 'h2', children }) {
  const aligned = match.signals.filter((signal) => signal.matched).length
  const isConfirmed = match.status === MATCH_STATUSES.CONFIRMED
  const isHistory = isRuledOut(match.status)

  return (
    <article className="overflow-hidden rounded-card border border-border bg-panel shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-4">
        <Heading className="text-lg font-semibold text-fg">
          <PairingName lost={lost} found={found} />
        </Heading>
        {badge}
      </header>

      <div className="flex flex-col gap-6 p-5">
        {/* Three columns from `md`; on a phone it stacks as lost, score, found,
            and each side keeps its LOST / FOUND badge. */}
        <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <PairSide report={lost} />

          <div className="flex flex-col items-center gap-1 text-center md:w-40">
            <span className="text-3xl font-semibold text-fg tabular-nums">{match.score}%</span>
            <span className="text-sm font-medium text-fg">
              {isHistory ? t('matching.compatibilityWhenPaired') : t('matching.compatibility')}
            </span>
            <span className="text-sm text-fg-muted">
              {t(isHistory ? 'matching.alignedPast' : 'matching.align', {
                aligned,
                total: match.signals.length,
              })}
            </span>
            <span
              className={cn(
                'mt-1 rounded-pill px-2.5 py-0.5 text-xs font-medium',
                isConfirmed
                  ? 'bg-success-soft text-success-ink'
                  : isHistory
                    ? 'bg-status-closed-soft text-fg'
                    : 'bg-accent-soft text-lost',
              )}
            >
              {isConfirmed
                ? t('matching.confirmedMatch')
                : isHistory
                  ? t('matching.historical')
                  : t('matching.possibleMatch')}
            </span>
          </div>

          <PairSide report={found} />
        </div>

        {isHistory && <HistoricalNote />}
        <Evidence match={match} lost={lost} found={found} isHistory={isHistory} />

        {children}
      </div>
    </article>
  )
}

/**
 * Said above the evidence of a ruled-out pairing. The score and the reasons
 * are the ones recorded when the pairing was made and are kept as they were:
 * rewriting them from today's reports would falsify what was compared. The two
 * report cards beside them are today's, so the difference is said out loud.
 */
export function HistoricalNote({ className }) {
  return (
    <p className={cn('flex items-start gap-2 rounded-control bg-status-closed-soft px-3 py-2 text-sm text-fg', className)}>
      <History size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">{t('matching.historicalTitle')}</span> {t('matching.historicalBody')}
      </span>
    </p>
  )
}

/**
 * A pairing's stage, as staff see it: the stored status, one colour per
 * outcome, and always in words. Rejected and dismissed both read "Ruled out"
 * with who ruled it out, matching the Match Queue's tab.
 */
// A function, not a constant: the words are read in the language showing.
const staffStages = () => ({
  [MATCH_STATUSES.SUGGESTED]: ['bg-accent-soft text-lost', MATCH_STATUS_LABELS[MATCH_STATUSES.SUGGESTED]],
  [MATCH_STATUSES.VERIFICATION_REQUESTED]: [
    'bg-brand-soft text-brand-hover',
    MATCH_STATUS_LABELS[MATCH_STATUSES.VERIFICATION_REQUESTED],
  ],
  [MATCH_STATUSES.UNDER_REVIEW]: ['bg-brand-soft text-brand-hover', t('matching.moreInfoRequested')],
  [MATCH_STATUSES.CONFIRMED]: ['bg-success-soft text-success-ink', MATCH_STATUS_LABELS[MATCH_STATUSES.CONFIRMED]],
  [MATCH_STATUSES.REJECTED]: ['bg-status-closed-soft text-fg', t('matching.ruledOutCoordinator')],
  [MATCH_STATUSES.DISMISSED]: ['bg-status-closed-soft text-fg', t('matching.ruledOutReporter')],
})

export function MatchStatusBadge({ status, withdrawn = false, className }) {
  const [style, label] = withdrawn
    ? ['bg-status-closed-soft text-fg', t('matching.withdrawn')]
    : (staffStages()[status] ?? ['bg-surface-muted text-fg-muted', status])
  return (
    <span className={cn('rounded-pill px-3 py-1 text-sm font-medium', style, className)}>{label}</span>
  )
}

/** "Milo <-> Found dog", read aloud as "Milo and Found dog". */
export function PairingName({ lost, found }) {
  return (
    <>
      {sideName(lost)}
      <span className="text-fg-muted" aria-hidden="true">
        {' '}
        ↔{' '}
      </span>
      <span className="sr-only"> {t('matching.and')} </span>
      {sideName(found)}
    </>
  )
}

function PairSide({ report }) {
  const [isOpen, setIsOpen] = useState(false)
  const photo = report.photos.find((item) => item.isPrimary) ?? report.photos[0]
  const alt = photo?.alt || t('matching.photoOf', { name: sideName(report).toLowerCase() })
  const isFound = report.reportType === REPORT_TYPES.FOUND

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative">
        {/* Capped at 320px so the evidence is reachable without scrolling a
            whole screen. The full, uncropped frame is one click away — markings
            are what identify a pet, and a crop can hide them. */}
        {photo ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="block w-full cursor-zoom-in rounded-card"
          >
            {/* Contained, not cropped: two photos are being compared, and a
                crop that hides an ear or a marking on one side defeats the
                point. The blurred copy fills the frame's spare width. */}
            <span className="relative block h-56 w-full overflow-hidden rounded-card bg-sunken sm:h-72 lg:h-80">
              <img
                src={photo.url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl"
                loading="lazy"
              />
              <img
                src={photo.url}
                alt={alt}
                className="relative size-full object-contain"
                loading="lazy"
              />
            </span>
            <span className="sr-only">{t('matching.viewFullPhoto')}</span>
          </button>
        ) : (
          <img
            src={photoPlaceholder}
            alt={t('ui.noPhoto')}
            className="h-56 w-full rounded-card bg-surface-muted object-contain sm:h-72 lg:h-80"
          />
        )}
        {photo && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-3 right-3 flex size-8 items-center justify-center rounded-control bg-panel/90 text-fg shadow-card"
          >
            <Maximize2 size={15} />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <ReportTypeBadge reportType={report.reportType} size="sm" className="self-start" />
        <Link to={`/pet/${report.id}`} className="font-semibold text-fg hover:underline">
          {sideName(report)}
        </Link>
        <p className="text-sm text-fg-muted">
          {[speciesLabel(report.species), report.breed].filter(Boolean).join(' · ')}
        </p>
        <p className="text-sm text-fg-muted">
          {report.location.city} ·{' '}
          {t(isFound ? 'matching.foundOn' : 'matching.lastSeenOn', { date: formatDate(report.incidentDate) })}
        </p>
      </div>

      {photo && (
        <PhotoLightbox isOpen={isOpen} onClose={() => setIsOpen(false)} src={photo.url} alt={alt} />
      )}
    </div>
  )
}

/**
 * The seven characteristics as one scannable list: the category, a check or a
 * cross with the word for it, the two values side by side where there are
 * values to show, and the engine's own explanation underneath. Nothing is
 * recalculated here — `matched` and `detail` are the stored signal.
 */
const EVIDENCE_ORDER = ['species', 'breed', 'size', 'color', 'location', 'date', 'characteristics']

/**
 * For a ruled-out pairing only what was recorded is shown: each stored verdict,
 * in the past tense, with its stored sentence. The side-by-side values come
 * from today's reports, so beside a verdict from another day they would put
 * two moments in one line ("Dog ↔ Other: aligns"). The report cards above
 * still show today's details.
 */
function Evidence({ match, lost, found, isHistory = false }) {
  const signals = [...match.signals].sort(
    (a, b) => EVIDENCE_ORDER.indexOf(a.key) - EVIDENCE_ORDER.indexOf(b.key),
  )

  return (
    <section aria-label={t('matching.evidence')} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-fg">{t('matching.whyPaired')}</h3>
      <ul className="divide-y divide-border rounded-card border border-border">
        {signals.map((signal) => {
          const values = isHistory ? null : compareValues(signal.key, lost, found)

          return (
            <li
              key={signal.key}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 px-4 py-2.5 sm:grid-cols-[auto_11rem_minmax(0,1fr)]"
            >
              <span
                className={cn(
                  'mt-0.5 flex size-5 items-center justify-center rounded-full',
                  signal.matched ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger',
                )}
              >
                {signal.matched ? (
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                ) : (
                  <X size={12} strokeWidth={3} aria-hidden="true" />
                )}
              </span>

              <span className="text-sm">
                <span className="font-medium text-fg">{signal.label}</span>
                <span
                  className={cn(
                    'block text-xs',
                    signal.matched ? 'text-success-ink' : 'text-danger',
                  )}
                >
                  {isHistory
                    ? signal.matched ? t('matching.alignedWhenPaired') : t('matching.didNotAlign')
                    : signal.matched ? t('matching.aligns') : t('matching.doesNotAlign')}
                </span>
              </span>

              <span className="col-start-2 text-sm sm:col-start-3">
                {values && (
                  <span className="block font-medium text-fg">
                    {values[0]}
                    <span className="text-fg-muted" aria-hidden="true">
                      {' '}
                      ↔{' '}
                    </span>
                    <span className="sr-only"> {t('matching.comparedWith')} </span>
                    {values[1]}
                  </span>
                )}
                {/* Written by the server when the pairing was scored, in English. */}
                <span lang="en" className="text-fg-muted">{signal.detail}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The two values being compared, where the reports carry them. */
function compareValues(key, lost, found) {
  const pair = (fn) => [fn(lost) || '—', fn(found) || '—']
  switch (key) {
    case 'species':
      return pair((r) => speciesLabel(r.species))
    case 'breed':
      return pair((r) => r.breed)
    case 'size':
      return pair((r) => PET_SIZE_LABELS[r.size])
    case 'color':
      return pair((r) => [r.primaryColor, r.secondaryColor].filter(Boolean).join(' / '))
    case 'location':
      return pair((r) => r.location.city)
    case 'date':
      return pair((r) => formatShortDate(r.incidentDate))
    default:
      return null
  }
}

export function StatusStrip({ tone, icon: Icon, title, children }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card border px-4 py-3',
        tone === 'success' ? 'border-success/30 bg-success-soft' : 'border-brand/25 bg-brand-soft',
      )}
    >
      <Icon
        size={20}
        className={cn('mt-0.5 shrink-0', tone === 'success' ? 'text-success-ink' : 'text-brand-hover')}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5">
        <p className={cn('font-semibold', tone === 'success' ? 'text-success-ink' : 'text-brand-hover')}>
          {title}
        </p>
        <p className="text-sm text-fg">{children}</p>
      </div>
    </div>
  )
}

function sideName(report) {
  return (
    report.petName ??
    t(report.reportType === REPORT_TYPES.FOUND ? 'matching.sideFound' : 'matching.sideLost', {
      species: speciesLabel(report.species).toLowerCase(),
    })
  )
}
