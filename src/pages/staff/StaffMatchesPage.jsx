import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, CircleX, Heart, HeartHandshake, Hourglass, RotateCcw } from 'lucide-react'
import { Button, EmptyState, LoadingSkeleton, Textarea } from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { MatchPairCard, MatchStatusBadge, StatusStrip } from '@/components/MatchComparison'
import { MATCH_STATUSES, wasWithdrawn } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { matchService } from '@/services'
import { cn } from '@/utils/cn'
import { useRevealWhen } from '@/utils/reveal'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

// Each label is `staff.matches.tabs.<id>`, read when the tabs render.
const TABS = [
  { id: 'open', statuses: [MATCH_STATUSES.SUGGESTED] },
  {
    id: 'review',
    statuses: [MATCH_STATUSES.VERIFICATION_REQUESTED, MATCH_STATUSES.UNDER_REVIEW],
  },
  { id: 'confirmed', statuses: [MATCH_STATUSES.CONFIRMED] },
  {
    id: 'closed',
    statuses: [MATCH_STATUSES.REJECTED, MATCH_STATUSES.DISMISSED],
  },
]

const tabOf = (match) => TABS.find((tab) => tab.statuses.includes(match.status))?.id


const loadAllMatches = () => matchService.getMatchesWithReports()

/**
 * Every stored pairing in the system, for a coordinator to look through.
 *
 * Read-only: deciding on a pairing happens in Verification, so there is one
 * place where confirming or ruling out is done, with the reporters' details
 * to hand. Each card here says where its pairing stands and where to go next.
 */
export function StaffMatchesPage() {
  const [chosenTab, setChosenTab] = useState(null)
  const { data, error, isLoading, reload } = useAsync(loadAllMatches)
  const { hash } = useLocation()

  // A reopened pairing moves to another tab, so its card simply vanishes from
  // the one in front of the coordinator. Say what happened, where they are.
  const [reopened, setReopened] = useState(0)
  const reopenedRef = useRevealWhen(reopened)
  const onReopened = async () => {
    await reload()
    setReopened((count) => count + 1)
  }

  // Links from the Overview and Notifications arrive as #match-3. The card
  // exists only once the data has loaded and its tab is showing.
  useEffect(() => {
    if (!data || !hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [data, hash])

  const header = (
    <PageHeader
      icon={Heart}
      eyebrow={t('staff.eyebrow')}
      title={t('staff.matches.title')}
      description={t('staff.matches.description')}
      breadcrumb={[{ label: t('shell.workspace.staff'), to: '/staff' }, { label: t('staff.matches.title') }]}
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
          {t('staff.matches.failed', { message: errorText(error) })}
        </p>
      </div>
    )
  }

  const countFor = (statuses) => data.filter((item) => statuses.includes(item.match.status)).length
  // The tab you picked; else the one holding the match a link pointed at;
  // else "With a coordinator", the work in hand.
  const linked = hash.startsWith('#match-')
    ? data.find((item) => `#match-${item.match.id}` === hash)
    : null
  const tab = chosenTab ?? (linked && tabOf(linked.match)) ?? 'review'
  const activeTab = TABS.find((item) => item.id === tab)
  const visible = data.filter((item) => activeTab.statuses.includes(item.match.status))

  return (
    <div className="flex flex-col gap-6">
      {header}

      {reopened > 0 && (
        <div ref={reopenedRef} tabIndex={-1} role="status" className="scroll-mt-24 outline-none">
          <StatusStrip tone="brand" icon={RotateCcw} title={t('staff.matches.reopened')}>
            {t('staff.matches.reopenedBody')}
          </StatusStrip>
        </div>
      )}

      <StageTabs
        tabs={TABS.map((item) => ({ ...item, label: t(`staff.matches.tabs.${item.id}`), count: countFor(item.statuses) }))}
        selected={tab}
        onSelect={setChosenTab}
      />

      <div id="match-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {visible.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={t(`staff.matches.empty.${tab}`)}
            description={t(`staff.matches.empty.${tab}Body`)}
          />
        ) : (
          <ul className="flex flex-col gap-6">
            {visible.map(({ match, lostReport, foundReport }) => (
              <li key={match.id} id={`match-${match.id}`} className="scroll-mt-24">
                <MatchPairCard
                  match={match}
                  lost={lostReport}
                  found={foundReport}
                  badge={<MatchStatusBadge status={match.status} withdrawn={wasWithdrawn(match.status, lostReport, foundReport)} />}
                >
                  <QueueOutcome match={match} lost={lostReport} found={foundReport} onReopened={onReopened} />
                </MatchPairCard>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * Where a pairing goes from here. No decision buttons: those live in
 * Verification, beside the contact details and the case note. The one action
 * here undoes a coordinator's own decision (a rejection or a confirmation)
 * and sends the pairing back to Verification.
 */
function QueueOutcome({ match, lost, found, onReopened }) {
  const reportLinks = (
    <div className="flex flex-wrap gap-2">
      <Button as={Link} to={`/pet/${lost.id}`} variant="secondary" size="sm">
        {t('staff.matches.viewLost')}
      </Button>
      <Button as={Link} to={`/pet/${found.id}`} variant="secondary" size="sm">
        {t('staff.matches.viewFound')}
      </Button>
    </div>
  )

  switch (match.status) {
    case MATCH_STATUSES.VERIFICATION_REQUESTED:
    case MATCH_STATUSES.UNDER_REVIEW:
      return (
        <div className="flex flex-col gap-3">
          <p className="rounded-control bg-accent-soft px-3 py-2 text-sm text-fg">
            {t('staff.matches.suggestion')}
          </p>
          <Button as={Link} to={`/staff/verification#match-${match.id}`} className="self-start">
            {t('staff.matches.reviewPairing')}
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )
    case MATCH_STATUSES.CONFIRMED:
      return (
        <div className="flex flex-col gap-3">
          <StatusStrip tone="success" icon={HeartHandshake} title={t('myMatches.confirmedTitle')}>
            {t('staff.matches.confirmedBody')}
          </StatusStrip>
          <ReopenAction match={match} onReopened={onReopened} />
        </div>
      )
    case MATCH_STATUSES.REJECTED:
    case MATCH_STATUSES.DISMISSED:
      return (
        <div className="flex items-start gap-3 rounded-card border border-border bg-surface px-4 py-3">
          <CircleX size={20} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold text-fg">
              {wasWithdrawn(match.status, lost, found) ? t('staff.matches.withdrawn') : t('staff.matches.ruledOut')}
            </p>
            <p className="text-sm text-fg">
              {match.status === MATCH_STATUSES.REJECTED
                ? t('staff.matches.rejectedBody')
                : wasWithdrawn(match.status, lost, found)
                  ? t('staff.matches.withdrawnBody')
                  : t('staff.matches.dismissedBody')}
            </p>
            {/* A rejection, or a reporter's "Not my pet" pressed by mistake,
                can be reopened. A withdrawal cannot: its case has ended. */}
            {!wasWithdrawn(match.status, lost, found) && (
              <div className="mt-2">
                <ReopenAction match={match} onReopened={onReopened} />
              </div>
            )}
          </div>
        </div>
      )
    default:
      // Suggested: nobody has asked for it to be verified yet.
      return (
        <div className="flex flex-col gap-3">
          <StatusStrip tone="info" icon={Hourglass} title={t('staff.matches.waiting')}>
            {t('staff.matches.waitingBody')}
          </StatusStrip>
          {reportLinks}
        </div>
      )
  }
}

/**
 * Undo a decision made in error: the pairing goes back to Verification and
 * both reports back to Possible Match, with both reporters told why. The
 * server refuses if a report has been closed since, or has changed so that the
 * stored comparison no longer describes it; the refusal is shown in the dialog.
 */
function ReopenAction({ match, onReopened }) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState(null)
  const confirmed = match.status === MATCH_STATUSES.CONFIRMED

  const close = () => {
    setIsOpen(false)
    setReason('')
    setError(null)
  }

  const reopen = async () => {
    setIsBusy(true)
    setError(null)
    try {
      await matchService.reopenMatch(match.id, reason.trim())
      close()
      await onReopened()
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)} className="self-start">
        <RotateCcw size={15} aria-hidden="true" />
        {t('staff.matches.reopen')}
      </Button>
      <ConfirmDialog
        isOpen={isOpen}
        onCancel={close}
        onConfirm={reopen}
        title={t('staff.matches.reopenTitle')}
        confirmLabel={t('staff.matches.reopen')}
        tone="primary"
        isBusy={isBusy}
        confirmDisabled={reason.trim() === ''}
        error={error}
      >
        <p>
          {confirmed ? t('staff.matches.reopenConfirmed') : t('staff.matches.reopenRejected')}{' '}
          {t('staff.matches.reopenTold')}
        </p>
        <p className="text-fg-muted">{t('staff.matches.reopenLimit')}</p>
        <Textarea
          label={t('staff.matches.reopenWhy')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={255}
          required
          rows={3}
        />
      </ConfirmDialog>
    </>
  )
}

/** Stage tabs with their counts, in the same pill style as the owner's page. */
function StageTabs({ tabs, selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('staff.matches.stage')}>
      {tabs.map((item) => {
        const isSelected = selected === item.id

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={isSelected}
            aria-controls="match-panel"
            onClick={() => onSelect(item.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-sm transition-colors',
              isSelected
                ? 'border-brand-soft bg-brand-soft font-medium text-brand-hover'
                : 'border-border-strong bg-panel text-fg-muted hover:text-fg',
            )}
          >
            {item.label}
            <span
              className={cn(
                'min-w-5 rounded-pill px-1.5 text-center text-xs font-semibold tabular-nums',
                isSelected ? 'bg-panel text-brand-hover' : 'bg-surface-muted text-fg',
              )}
            >
              {item.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
