import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, CircleCheck, HeartHandshake, Hourglass, Info, ShieldAlert } from 'lucide-react'
import { Button, EmptyState, LoadingSkeleton, Textarea } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { MatchPairCard, StatusStrip } from '@/components/MatchComparison'
import { MATCH_STATUSES, NOTIFICATION_TYPES } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { matchService, notificationService, petService, userService } from '@/services'
import { PROVIDE_INFORMATION_MAX } from '@/services/matchService'
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
  const [reports, notifications] = await Promise.all([
    Promise.all(reportIds.map((id) => petService.getReportById(id))),
    notificationService.getNotifications(user.id),
  ])
  const byId = Object.fromEntries(reports.map((report) => [report.id, report]))

  // The coordinator's question for each pairing, from this person's own
  // notifications: `staff_reviewed` is only ever raised by "request more
  // information", and the list is newest first, so the first per pairing is
  // the latest. Nothing new is fetched from anywhere else.
  const questions = {}
  for (const notification of notifications) {
    if (notification.type === NOTIFICATION_TYPES.STAFF_REVIEWED && notification.matchId) {
      questions[notification.matchId] ??= notification.body
    }
  }

  return { user, suggestions, byId, questions }
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

  const { user, suggestions, byId, questions } = data

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
          the tabs themselves, so the summary and the filter are one control.
          Underlined, like My Reports and Notifications: one tab style across
          the customer's pages.

          One row that scrolls sideways on a narrow phone instead of wrapping:
          wrapped, "Confirmed" dropped under the rule on its own. A scrolling
          row clips whatever pokes out of it, so the rule is drawn inside it
          (an inset shadow the active underline paints over) rather than as a
          border the tabs overlap, and the focus ring is drawn inside each tab. */}
      <div
        className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]"
        role="tablist"
        aria-label="Match stage"
      >
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
              // A tab reached with Tab on a narrow phone can sit half outside
              // the scrolling row, and the browser leaves a partly visible
              // element where it is. Bring the whole tab into view.
              onFocus={(event) =>
                event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
              }
              className={cn(
'shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors focus-visible:-outline-offset-2',
                selected
                  ? 'border-brand font-medium text-brand-hover'
                  : 'border-transparent text-fg-muted hover:text-fg',
              )}
            >
              {group.label}
              <span className="ml-1.5 text-fg-muted tabular-nums">{count}</span>
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
                  question={questions[suggestion.id]}
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
function OwnerMatchCard({ match, lost, found, userId, question, isBusy, onRequestVerification, onDismiss }) {
  const iAmFinder = Number(found.reporterId) === Number(userId)

  return (
    <MatchPairCard match={match} lost={lost} found={found} badge={<StageBadge status={match.status} />}>
      <StagePanel
        match={match}
        question={question}
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
function StagePanel({ match, question, iAmFinder, isBusy, onRequestVerification, onDismiss }) {
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
          {question ? (
            <>
              <span className="block font-medium text-fg">“{question}”</span>
              Answer below. The pairing stays under review until they decide.
            </>
          ) : (
            <>
              Their note is in your{' '}
              <Link to="/dashboard/notifications" className="font-medium underline">
                notifications
              </Link>
              . Answer below; the pairing stays under review until they decide.
            </>
          )}
        </StatusStrip>
        <InformationReply matchId={match.id} />
        {suggestionNote}
      </div>
    )
  }

  // Suggested: the one stage where the owner decides what happens next.
  return (
    <div className="flex flex-col gap-3">
      {suggestionNote}
      {/* Said here, where the decision is, rather than only on the Help page.
          Somebody about to claim a pet is about to be asked to prove it, and
          the useful moment to mention that proof is private is before they
          post it somewhere it is not. */}
      <p className="flex items-start gap-2 rounded-control border border-border bg-sunken/70 p-3 text-sm text-fg-muted">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
        <span>
          A Pet Coordinator checks this before anyone meets. Keep photographs, records and
          anything else that proves the pet is yours between you and them — never on a
          public page.
        </span>
      </p>
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

/**
 * The answer to a coordinator's question, sent from where the question is.
 *
 * It goes to the Pet Coordinators and to nobody else: the other person in this
 * pairing never sees it. The server keeps no copy here to show again, so after
 * sending, this says it went and offers to send more; it does not pretend to be
 * a conversation. 255 characters at most, counted as you type, never cut short.
 */
function InformationReply({ matchId }) {
  const [answer, setAnswer] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent
  const [error, setError] = useState(null)

  const length = answer.trim().length
  const tooLong = answer.length > PROVIDE_INFORMATION_MAX

  const send = async (event) => {
    event.preventDefault()
    if (length === 0 || tooLong) return
    setState('sending')
    setError(null)

    try {
      await matchService.provideInformation(matchId, answer.trim())
      setAnswer('')
      setState('sent')
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)))
      setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-success/30 bg-success-soft px-3 py-2.5">
        <p role="status" className="flex items-center gap-2 text-sm text-success-ink">
          <CircleCheck size={16} className="shrink-0" aria-hidden="true" />
          Sent to the Pet Coordinators. Only they can read it.
        </p>
        <Button size="sm" variant="ghost" onClick={() => setState('idle')}>
          Add more
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-2 rounded-control border border-border bg-panel p-3">
      <Textarea
        label="Your answer"
        hint="Goes to the Pet Coordinators only. The other person in this pairing will not see it."
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        rows={3}
        error={
          error?.fields?.note
          ?? (tooLong ? `Keep it to ${PROVIDE_INFORMATION_MAX} characters.` : undefined)
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={cn('text-sm tabular-nums', tooLong ? 'font-medium text-danger' : 'text-fg-muted')}
          aria-live="polite"
        >
          {answer.length} / {PROVIDE_INFORMATION_MAX}
        </span>
        <Button type="submit" size="sm" isLoading={state === 'sending'} disabled={length === 0 || tooLong}>
          {state === 'sending' ? 'Sending…' : 'Send information'}
        </Button>
      </div>
      {error && !error.fields && (
        <p role="alert" className="text-sm text-danger">
          It could not be sent: {error.message}
        </p>
      )}
    </form>
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

