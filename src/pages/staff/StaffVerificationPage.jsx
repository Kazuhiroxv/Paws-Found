import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  BadgeCheck,
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  HeartHandshake,
  Lock,
  Mail,
  Phone,
  X,
} from 'lucide-react'
import { Button, EmptyState, LoadingSkeleton, Modal, Textarea } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { MatchPairCard, MatchStatusBadge, PairingName, StatusStrip } from '@/components/MatchComparison'
import { MATCH_STATUSES_AWAITING_STAFF } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { matchService, userService } from '@/services'
import { hasCoordinates } from '@/utils/location'
import emptyQueueClear from '@/assets/empty-queue-clear.webp'

async function loadVerificationQueue() {
  const [staff, pairings] = await Promise.all([
    userService.getCurrentUser(),
    matchService.getMatchesWithReports({ statuses: MATCH_STATUSES_AWAITING_STAFF }),
  ])

  // Reporters on both sides, so a coordinator can actually contact them.
  const reporterIds = [
    ...new Set(pairings.flatMap((p) => [p.lostReport.reporterId, p.foundReport.reporterId])),
  ]
  const reporters = await Promise.all(reporterIds.map((id) => userService.getUserById(id)))

  return {
    staff,
    pairings,
    reportersById: Object.fromEntries(reporters.map((user) => [user.id, user])),
  }
}

/** What each decision does, as the confirmation dialogs describe it. */
const DECISIONS = {
  confirm: {
    title: 'Confirm this match?',
    description:
      'Both reports will be marked Returned, and both reporters will be notified that ownership was verified. This is the end of the case.',
    button: 'Confirm match',
    variant: 'primary',
  },
  reject: {
    title: 'Rule this pairing out?',
    description:
      'The pairing will be marked as not the same pet and both reporters will be notified. Each report goes back to Active — unless it has another open pairing — so the search continues.',
    button: 'Not the same pet',
    variant: 'danger',
  },
}

/**
 * Where a Pet Coordinator decides whether two reports are the same animal.
 *
 * The comparison is the same one the reporters see — a coordinator should be
 * looking at exactly what they were shown. Added below it is the part only
 * staff get: contact details for both sides, the case note, and the decision.
 *
 * A decided pairing leaves the queue, so the outcome is kept on the page for
 * the rest of the visit rather than the card simply vanishing.
 */
export function StaffVerificationPage() {
  const { data, error, isLoading, reload } = useAsync(loadVerificationQueue)
  const [decided, setDecided] = useState([])
  const { hash } = useLocation()
  const decidedRef = useRef(null)

  // The decision is made at the bottom of a long card, and its outcome is
  // shown at the top of the list, so bring it into view.
  useEffect(() => {
    if (decided.length) decidedRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [decided.length])

  useEffect(() => {
    if (!data || !hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [data, hash])

  const header = (
    <PageHeader
      icon={BadgeCheck}
      eyebrow="Pet Coordinator"
      title="Verification"
      description="Compare a lost report against a found report before a handover is arranged."
      breadcrumb={[{ label: 'Staff workspace', to: '/staff' }, { label: 'Verification' }]}
    />
  )

  // Only on the first load; a reload after a decision keeps the page in place.
  if (isLoading && !data) {
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
          The verification queue could not be loaded: {error.message}
        </p>
      </div>
    )
  }

  const { staff, pairings, reportersById } = data
  const decidedIds = new Set(decided.map((item) => item.match.id))
  const waiting = pairings.filter((item) => !decidedIds.has(item.match.id))

  const onDecided = (item, outcome) => {
    setDecided((current) => [{ ...item, outcome }, ...current])
    reload()
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {decided.length > 0 && (
        <section
          ref={decidedRef}
          aria-label="Decided just now"
          className="flex scroll-mt-24 flex-col gap-3"
        >
          {decided.map(({ match, lostReport, foundReport, outcome }) => (
            <DecidedStrip key={match.id} lost={lostReport} found={foundReport} outcome={outcome} />
          ))}
        </section>
      )}

      {waiting.length === 0 ? (
        <EmptyState
          illustration={emptyQueueClear}
          title="Nothing waiting"
          description="When a reporter asks for a possible match to be checked, it will appear here."
        />
      ) : (
        <ul className="flex flex-col gap-10">
          {waiting.map((item) => (
            <li key={item.match.id} id={`match-${item.match.id}`} className="scroll-mt-24">
              {/* Case on the left, inspector on the right.
                  
                  The decision used to sit UNDER the comparison, full width, so
                  deciding meant scrolling past the evidence and then scrolling
                  back up to check it. A coordinator reads and decides in the
                  same breath; the two belong side by side. */}
              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <MatchPairCard
                  match={item.match}
                  lost={item.lostReport}
                  found={item.foundReport}
                  badge={<MatchStatusBadge status={item.match.status} />}
                />

                <DecisionPanel
                  match={item.match}
                  staff={staff}
                  lost={item.lostReport}
                  found={item.foundReport}
                  owner={reportersById[item.lostReport.reporterId]}
                  finder={reportersById[item.foundReport.reporterId]}
                  onDecided={(outcome) => onDecided(item, outcome)}
                  onUpdated={reload}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DecisionPanel({ match, staff, lost, found, owner, finder, onDecided, onUpdated }) {
  const [note, setNote] = useState(match.staffNotes ?? '')
  const [busyAction, setBusyAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [asking, setAsking] = useState(null) // 'confirm' | 'reject' | null

  const run = async (name, action, after) => {
    setBusyAction(name)
    setActionError(null)
    try {
      await action()
      setAsking(null)
      after()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught : new Error(String(caught)))
      setAsking(null)
    } finally {
      setBusyAction(null)
    }
  }

  const decide = (kind) =>
    run(
      kind,
      () =>
        kind === 'confirm'
          ? matchService.confirmMatch(match.id, { actorId: staff.id, staffId: staff.id, note: note.trim() })
          : matchService.rejectMatch(match.id, { staffId: staff.id, note: note.trim() }),
      () => onDecided(kind),
    )

  return (
    <section
      aria-labelledby={`decision-${match.id}`}
      className="flex flex-col gap-5 rounded-card border border-border-strong bg-panel p-4 shadow-card sm:p-5 xl:sticky xl:top-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h3 id={`decision-${match.id}`} className="text-lg font-semibold text-fg">
          Coordinator decision
        </h3>
        <MatchStatusBadge status={match.status} className="px-2.5 py-0.5 text-xs" />
      </div>

      <p className="rounded-control bg-accent-soft px-3 py-2 text-sm text-fg">
        This is a suggestion, not a confirmation. Check ownership with both people before any
        handover is arranged.
      </p>

      <Completeness lost={lost} found={found} match={match} />

      {/* Contact details: staff only. */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-fg">Coordination details</h4>
        <p className="flex items-start gap-2 rounded-control border border-danger/25 bg-danger-soft px-3 py-2 text-sm font-medium text-fg">
          <Lock size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
          Visible to staff only. Do not pass either person&apos;s details to the other.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          <ContactCard role="Lost report · owner" person={owner} />
          <ContactCard role="Found report · finder" person={finder} />
        </ul>
      </div>

      <Textarea
        label="Case note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        maxLength={500}
        placeholder="e.g. Asked the owner to describe the collar tag before contact details are shared."
        hint="Sent to both reporters when you request more information. Otherwise it stays on the case, for staff."
      />

      {actionError && (
        <p role="alert" className="text-sm text-danger">
          That could not be saved: {actionError.message}
        </p>
      )}

      {/* Confirm and ask sit together on the left; ruling out sits apart on
          the right from `sm`, and below a divider on a phone, so it is never
          a slip away from Confirm. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => setAsking('confirm')} disabled={Boolean(busyAction)}>
            <Check size={16} aria-hidden="true" />
            Confirm match
          </Button>
          <Button
            variant="secondary"
            isLoading={busyAction === 'info'}
            disabled={Boolean(busyAction) || !note.trim()}
            onClick={() =>
              run(
                'info',
                () => matchService.requestMoreInformation(match.id, { staffId: staff.id, note: note.trim() }),
                onUpdated,
              )
            }
          >
            Request more information
          </Button>
        </div>
        <div className="border-t border-border pt-3 sm:ml-auto sm:border-0 sm:pt-0">
          <Button
            variant="danger"
            onClick={() => setAsking('reject')}
            disabled={Boolean(busyAction)}
            className="w-full sm:w-auto"
          >
            <X size={16} aria-hidden="true" />
            Not the same pet
          </Button>
        </div>
      </div>
      {!note.trim() && (
        <p className="-mt-2 text-sm text-fg-muted">
          Write a case note to request more information — it is what the reporters receive.
        </p>
      )}

      <Modal
        isOpen={Boolean(asking)}
        onClose={() => !busyAction && setAsking(null)}
        size="sm"
        title={asking ? DECISIONS[asking].title : ''}
        description={asking ? DECISIONS[asking].description : ''}
        footer={
          asking && (
            <>
              <Button variant="ghost" onClick={() => setAsking(null)} disabled={Boolean(busyAction)}>
                Go back
              </Button>
              <Button
                variant={DECISIONS[asking].variant}
                isLoading={busyAction === asking}
                onClick={() => decide(asking)}
              >
                {DECISIONS[asking].button}
              </Button>
            </>
          )
        }
      />
    </section>
  )
}

function ContactCard({ role, person }) {
  return (
    <li className="flex flex-col gap-1 rounded-control border border-border bg-panel p-3 text-sm">
      <p className="text-xs font-medium tracking-wide text-fg-muted uppercase">{role}</p>
      <p className="font-semibold text-fg">{person?.fullName ?? 'Unknown'}</p>
      <p className="flex min-w-0 items-center gap-1.5 text-fg-muted">
        <Mail size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
        <span className="break-all">{person?.email || '—'}</span>
      </p>
      <p className="flex items-center gap-1.5 text-fg-muted">
        <Phone size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
        {person?.phone || '—'}
      </p>
    </li>
  )
}

/** The outcome of a decision made on this visit, once its card has left the queue. */
function DecidedStrip({ lost, found, outcome }) {
  if (outcome === 'confirm') {
    return (
      <StatusStrip tone="success" icon={HeartHandshake} title="Match confirmed">
        <PairingName lost={lost} found={found} />: ownership was verified and both reports are now
        Returned. Both reporters have been notified.
      </StatusStrip>
    )
  }

  return (
    <div role="status" className="flex items-start gap-3 rounded-card border border-border bg-surface px-4 py-3">
      <CircleX size={20} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold text-fg">Pairing ruled out</p>
        <p className="text-sm text-fg">
          <PairingName lost={lost} found={found} />: marked as not the same pet. Both reporters have
          been notified, and the reports carry on being searched.
        </p>
      </div>
    </div>
  )
}

/**
 * What the system can actually tell a coordinator about this pairing before
 * they decide.
 *
 * Every line is computed from the two reports in front of it. The reference
 * design puts a verification checklist in this position with items like
 * "auto-screening completed" and "contact verified" — we have neither of
 * those, and a tick beside a check nobody ran would be worse than no panel at
 * all. So the composition is kept and filled with what is true:
 *
 *   * whether each side has a photograph — the one thing an owner recognises;
 *   * whether each side has a map pin, or only a city;
 *   * whether anyone has given contact details, which decides whether a
 *     handover can be arranged at all;
 *   * how many characteristics the matching algorithm found aligned, which
 *     is already stored per signal in `match_signals`.
 *
 * "Needs a look" is amber and never red: none of these is a failure. A found
 * report with no photograph is still a real sighting, and the panel's job is
 * to say where the thin evidence is, not to grade it.
 */
function Completeness({ lost, found, match }) {
  const aligned = match.signals.filter((signal) => signal.matched).length
  const bothPinned = hasCoordinates(lost.location) && hasCoordinates(found.location)
  const photoCount = [lost, found].filter((report) => report.photos.length > 0).length
  const contactable = [lost, found].filter(
    (report) =>
      report.contactPreferences.showPhone ||
      report.contactPreferences.showEmail ||
      report.contactPreferences.allowPlatformContact,
  ).length

  const checks = [
    {
      ok: photoCount === 2,
      label: 'Photographs on both reports',
      detail:
        photoCount === 2
          ? 'Both sides can be compared by eye.'
          : photoCount === 1
            ? 'Only one side has a photograph — ask the other for one.'
            : 'Neither side has a photograph.',
    },
    {
      ok: bothPinned,
      label: 'Both locations mapped',
      detail: bothPinned
        ? `${lost.location.city} and ${found.location.city}, both pinned.`
        : 'At least one side gave a city but no map pin, so distance is approximate.',
    },
    {
      ok: contactable === 2,
      label: 'Both reporters reachable',
      detail:
        contactable === 2
          ? 'Both agreed to be contacted, at least through a coordinator.'
          : 'One side has shared no way of being reached.',
    },
    {
      ok: aligned >= 5,
      label: `${aligned} of ${match.signals.length} characteristics align`,
      detail:
        aligned >= 5
          ? 'The algorithm found broad agreement across the details.'
          : 'Fewer details agree than usual — read the comparison carefully.',
    },
  ]

  return (
    <div className="flex flex-col gap-2.5">
      <h4 className="text-sm font-semibold text-fg">What we can check automatically</h4>

      <ul className="flex flex-col gap-2.5">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-2.5">
            {check.ok ? (
              <CircleCheck
                size={17}
                className="mt-0.5 shrink-0 text-success"
                aria-hidden="true"
              />
            ) : (
              <CircleAlert size={17} className="mt-0.5 shrink-0 text-lost" aria-hidden="true" />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-fg">
                {check.label}
                {/* The word, not only the icon and its colour. */}
                <span className="sr-only">{check.ok ? ' — fine' : ' — needs a look'}</span>
              </span>
              <span className="text-sm text-fg-muted">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-fg-muted">
        None of this proves ownership. It only says where the evidence is thin.
      </p>
    </div>
  )
}
