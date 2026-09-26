import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, CircleCheck, Hourglass, HeartHandshake, Info } from 'lucide-react'
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { MatchPairCard, StatusStrip } from '@/components/MatchComparison'
import { MATCH_STATUSES } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { matchService, petService, userService } from '@/services'
import { cn } from '@/utils/cn'
import emptyNoMatches from '@/assets/empty-no-matches.webp'

/**
 * The three stages a pairing moves through, from the owner's side. Built from
 * the stored match statuses — nothing new is stored:
 *
 *   Needs attention  suggested                          — waiting on you
 *   Under review     verification_requested, under_review — with a coordinator
 *   Confirmed        confirmed                           — reunited
 *
 * Rejected and dismissed pairings are already left out by the service.
 */
const GROUPS = [
  { id: 'attention', label: 'Needs attention', statuses: [MATCH_STATUSES.SUGGESTED] },
  {
    id: 'review',
    label: 'Under review',
    statuses: [MATCH_STATUSES.VERIFICATION_REQUESTED, MATCH_STATUSES.UNDER_REVIEW],
  },
  { id: 'confirmed', label: 'Confirmed', statuses: [MATCH_STATUSES.CONFIRMED] },
]

const groupOf = (match) => GROUPS.find((group) => group.statuses.includes(match.status))?.id

async function loadMatches() {
  const user = await userService.getCurrentUser()
  const suggestions = await matchService.getSuggestionsForUser(user.id)

  // Each suggestion names two reports; fetch them once each.
  const reportIds = [
    ...new Set(suggestions.flatMap((item) => [item.lostReportId, item.foundReportId])),
  ]
  const reports = await Promise.all(reportIds.map((id) => petService.getReportById(id)))
  const byId = Object.fromEntries(reports.map((report) => [report.id, report]))

  return { user, suggestions, byId }
}

export function MyMatchesPage() {
  const { data, error, isLoading, reload } = useAsync(loadMatches)
  const [busyId, setBusyId] = useState(null)
  const [chosenTab, setChosenTab] = useState(null)
  const { hash } = useLocation()

  // The Overview links each match here as /dashboard/matches#match-3. The
  // router does not scroll to a fragment itself, and the card does not exist
  // until the data has loaded, so this waits for both.
  useEffect(() => {
    if (!data || !hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [data, hash])

  const header = (
    <PageHeader
      title="Possible matches"
      description="Reports that share characteristics with yours. A possible match is a suggestion, not a confirmation."
      breadcrumb={[{ label: 'My dashboard', to: '/dashboard' }, { label: 'Possible matches' }]}
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
          Your matches could not be loaded: {error.message}
        </p>
      </div>
    )
  }

  const { user, suggestions, byId } = data

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
illustration={emptyNoMatches}          title="No possible matches yet"
          description="When a report is filed that shares enough characteristics with one of yours, it will appear here with an explanation of what lines up."
          action={
            <Button as={Link} to="/dashboard/reports" variant="secondary">
              See my reports
            </Button>
          }
        />
      </div>
    )
  }

  const grouped = Object.fromEntries(
    GROUPS.map((group) => [group.id, suggestions.filter((match) => groupOf(match) === group.id)]),
  )
  // Which tab is showing: the one you picked; else the one holding a match a
  // link pointed at; else the first stage with anything in it.
  const linked = hash.startsWith('#match-')
    ? suggestions.find((match) => `#match-${match.id}` === hash)
    : null
  const tab =
    chosenTab ??
    (linked && groupOf(linked)) ??
    GROUPS.find((group) => grouped[group.id].length > 0).id
  const visible = grouped[tab]

  const act = async (suggestion, action) => {
    setBusyId(suggestion.id)
    try {
      await action(suggestion)
      reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {/* The stages, with their counts — "1 under review", "1 confirmed" — as
          the tabs themselves, so the summary and the filter are one control. */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Match stage">
        {GROUPS.map((group) => {
          const count = grouped[group.id].length
          const selected = tab === group.id

          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              id={`stage-${group.id}`}
              aria-selected={selected}
              aria-controls="matches-panel"
              onClick={() => setChosenTab(group.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-sm transition-colors',
                selected
                  ? 'border-brand-soft bg-brand-soft font-medium text-brand-hover'
                  : 'border-border-strong bg-panel text-fg-muted hover:text-fg',
              )}
            >
              {group.label}
              <span
                className={cn(
                  'min-w-5 rounded-pill px-1.5 text-center text-xs font-semibold tabular-nums',
                  selected ? 'bg-panel text-brand-hover' : 'bg-surface-muted text-fg-muted',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div id="matches-panel" role="tabpanel" aria-labelledby={`stage-${tab}`}>
        {visible.length === 0 ? (
          <StageEmptyState stage={tab} />
        ) : (
          <ul className="flex flex-col gap-6">
            {visible.map((suggestion) => (
              <li key={suggestion.id} id={`match-${suggestion.id}`} className="scroll-mt-24">
                <OwnerMatchCard
                  match={suggestion}
                  lost={byId[suggestion.lostReportId]}
                  found={byId[suggestion.foundReportId]}
                  userId={user.id}
                  isBusy={busyId === suggestion.id}
                  onRequestVerification={() =>
                    act(suggestion, (match) => matchService.requestVerification(match, user.id))
                  }
                  onDismiss={() => act(suggestion, matchService.dismissMatch)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * One pairing, as the owner sees it: the shared comparison, with the owner's
 * own stage label and the owner's next step underneath.
 */
function OwnerMatchCard({ match, lost, found, userId, isBusy, onRequestVerification, onDismiss }) {
  const iAmFinder = Number(found.reporterId) === Number(userId)

  return (
    <MatchPairCard match={match} lost={lost} found={found} badge={<StageBadge status={match.status} />}>
      <StagePanel
        match={match}
        iAmFinder={iAmFinder}
        isBusy={isBusy}
        onRequestVerification={onRequestVerification}
        onDismiss={onDismiss}
      />
    </MatchPairCard>
  )
}

function StageBadge({ status }) {
  const styles = {
    [MATCH_STATUSES.SUGGESTED]: ['bg-accent-soft text-lost', 'Needs your review'],
    [MATCH_STATUSES.VERIFICATION_REQUESTED]: ['bg-brand-soft text-brand-hover', 'Verification requested'],
    [MATCH_STATUSES.UNDER_REVIEW]: ['bg-brand-soft text-brand-hover', 'More information requested'],
    [MATCH_STATUSES.CONFIRMED]: ['bg-success-soft text-success-ink', 'Confirmed · Reunited'],
  }
  const [style, label] = styles[status] ?? ['bg-surface-muted text-fg-muted', status]

  return (
    <span className={cn('rounded-pill px-3 py-1 text-sm font-medium', style)}>{label}</span>
  )
}

/**
 * What happens next. An open pairing keeps the reminder that a match is only a
 * suggestion; a confirmed one replaces it — saying "not a confirmation" beside
 * "Confirmed" contradicted itself.
 */
function StagePanel({ match, iAmFinder, isBusy, onRequestVerification, onDismiss }) {
  const suggestionNote = (
    <p className="rounded-control bg-accent-soft px-3 py-2 text-sm text-fg">
      This is a suggestion, not a confirmation. A Pet Coordinator helps verify ownership before any
      handover is arranged.
    </p>
  )

  if (match.status === MATCH_STATUSES.CONFIRMED) {
    return (
      <StatusStrip tone="success" icon={HeartHandshake} title="Reunited successfully">
        Ownership was verified and this case has been confirmed.
      </StatusStrip>
    )
  }

  if (match.status === MATCH_STATUSES.VERIFICATION_REQUESTED) {
    return (
      <div className="flex flex-col gap-3">
        <StatusStrip tone="info" icon={Hourglass} title="Verification requested">
          A Pet Coordinator is reviewing this pairing. You will be notified when its status
          changes.
        </StatusStrip>
        {suggestionNote}
      </div>
    )
  }

  if (match.status === MATCH_STATUSES.UNDER_REVIEW) {
    return (
      <div className="flex flex-col gap-3">
        <StatusStrip tone="info" icon={Info} title="A Pet Coordinator asked for more information">
          Their note is in your{' '}
          <Link to="/dashboard/notifications" className="font-medium underline">
            notifications
          </Link>
          . The pairing stays under review until they decide.
        </StatusStrip>
        {suggestionNote}
      </div>
    )
  }

  // Suggested: the one stage where the owner decides what happens next.
  return (
    <div className="flex flex-col gap-3">
      {suggestionNote}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRequestVerification} isLoading={isBusy}>
          {iAmFinder ? 'This could be the same pet' : 'This could be my pet'}
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
        <Button variant="ghost" onClick={onDismiss} disabled={isBusy}>
          {iAmFinder ? 'Not the same pet' : 'Not my pet'}
        </Button>
      </div>
    </div>
  )
}

function StageEmptyState({ stage }) {
  const copy = {
    attention: {
      icon: CircleCheck,
      title: 'Nothing needs your review',
      description:
        'New suggestions appear here when a report lines up with one of yours. You decide whether to ask a Pet Coordinator to verify them.',
    },
    review: {
      icon: Hourglass,
      title: 'Nothing is being verified right now',
      description:
        'When you ask for a pairing to be verified, it waits here while a Pet Coordinator reviews it.',
    },
    confirmed: {
      icon: HeartHandshake,
      title: 'No confirmed matches yet',
      description: 'Pairings a Pet Coordinator confirms — pets back home — are kept here.',
    },
  }[stage]

  return <EmptyState icon={copy.icon} title={copy.title} description={copy.description} />
}

