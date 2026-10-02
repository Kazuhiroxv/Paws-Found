import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Flag, Lock, ShieldCheck } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LoadingSkeleton,
  Textarea,
} from '@/components/ui'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { MODERATION_REASON_LABELS } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { moderationService, userService } from '@/services'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatCardDate } from '@/utils/date'
import { cn } from '@/utils/cn'
import { ModerationStatusBadge } from './AdminBadges'
import { StatusStrip } from '@/components/MatchComparison'
import { useRevealWhen } from '@/utils/reveal'

/** What each decision did, said where the administrator is looking. */
const OUTCOMES = {
  dismiss: (title) => ['Flag dismissed', `“${title}” stays published. The case is under Dismissed.`],
  warn: (title) => ['Report author warned', `About “${title}”. The case is under Actioned.`],
  remove: (title) => ['Report removed', `“${title}” is no longer public. The case is under Actioned.`],
  suspend: (title) => [
    'Report removed and account suspended',
    `“${title}” is no longer public and its author cannot sign in. The case is under Actioned.`,
  ],
}

const TABS = [
  { id: 'open', label: 'Awaiting review' },
  { id: 'actioned', label: 'Actioned' },
  { id: 'dismissed', label: 'Dismissed' },
]

/**
 * The four approved decisions (CLAUDE.md §6.9), in order of severity, with
 * what each one does. The two that change something are confirmed first: they
 * close someone's report, and one of them locks an account.
 */
const DECISIONS = {
  dismiss: { label: 'Dismiss flag', variant: 'secondary' },
  // "Report author", not "reporter": the person who flagged the listing
  // reported it too, and the warning goes to the other one.
  warn: { label: 'Warn report author', variant: 'secondary' },
  remove: {
    label: 'Remove the report',
    variant: 'danger',
    title: (report) => `Remove “${report}”?`,
    confirm: 'Remove report',
  },
  suspend: {
    label: 'Remove report and suspend account',
    variant: 'danger',
    title: (report, person) => `Remove “${report}” and suspend ${person}?`,
    confirm: 'Remove and suspend',
  },
}

async function loadModeration() {
  const [cases, admin] = await Promise.all([
    moderationService.getCasesWithContext(),
    userService.getCurrentUser(),
  ])
  return { cases, admin }
}

/**
 * Flags raised by the community, for an administrator to decide on.
 *
 * Only the four approved actions (CLAUDE.md §6.9). "Remove" closes a report
 * rather than deleting it — the record of what happened has to survive the
 * decision, and the reporter is always told the outcome.
 */
export function AdminModerationPage() {
  const { data, error, isLoading, reload } = useAsync(loadModeration)
  const [tab, setTab] = useState('open')
  // A decided case leaves "Awaiting review" when the list reloads, so its
  // card simply vanishes. The outcome is said here instead, and brought into
  // view with focus (see reveal.js).
  const [outcome, setOutcome] = useState(null)
  const outcomeRef = useRevealWhen(outcome)

  const header = (
    <PageHeader
      icon={Flag}
      eyebrow="Administrator"
      title="Moderation"
      description="Reports flagged by the community, and what was decided."
      breadcrumb={[{ label: 'Administration', to: '/admin' }, { label: 'Moderation' }]}
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
          The moderation queue could not be loaded: {error.message}
        </p>
      </div>
    )
  }

  const { cases, admin } = data
  const countFor = (id) => cases.filter((item) => item.moderationCase.status === id).length
  const visible = cases.filter((item) => item.moderationCase.status === tab)

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Moderation queue">
        {TABS.map((item) => {
          const isSelected = tab === item.id

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls="moderation-panel"
              onClick={() => setTab(item.id)}
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
                {countFor(item.id)}
              </span>
            </button>
          )
        })}
      </div>

      {outcome && (
        <div ref={outcomeRef} tabIndex={-1} role="status" className="scroll-mt-24 outline-none">
          <StatusStrip tone="success" icon={ShieldCheck} title={outcome.title}>
            {outcome.detail}
          </StatusStrip>
        </div>
      )}

      <div id="moderation-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {visible.length === 0 ? (
          <EmptyState
            icon={tab === 'open' ? ShieldCheck : Flag}
            title={
              tab === 'open'
                ? 'Nothing awaiting review'
                : tab === 'actioned'
                  ? 'Nothing has been actioned'
                  : 'Nothing has been dismissed'
            }
            description={
              tab === 'open'
                ? 'When someone flags a report, it will appear here for a decision.'
                : 'Decisions you make will be recorded in this group.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-6">
            {visible.map(({ moderationCase, report, reporter, reportedBy }) => (
              <li key={moderationCase.id}>
                <ModerationCase
                  moderationCase={moderationCase}
                  report={report}
                  reporter={reporter}
                  reportedBy={reportedBy}
                  admin={admin}
                  onDone={async (action, title) => {
                    await reload()
                    const [heading, detail] = OUTCOMES[action](title)
                    setOutcome({ title: heading, detail, at: Date.now() })
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ModerationCase({ moderationCase, report, reporter, reportedBy, admin, onDone }) {
  const [note, setNote] = useState(moderationCase.resolutionNote ?? '')
  const [busyAction, setBusyAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [asking, setAsking] = useState(null) // 'remove' | 'suspend' | null

  const isOpen = moderationCase.status === 'open'
  const reportTitle = report.petName ?? 'Found pet report'

  const decide = async (action) => {
    setBusyAction(action)
    setActionError(null)

    try {
      await moderationService.applyDecision(moderationCase.id, {
        action,
        adminId: admin.id,
        note,
      })
      setAsking(null)
      onDone(action, reportTitle)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught : new Error(String(caught)))
      setAsking(null)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <Card>
      <CardHeader
        titleAs="h2"
        title={MODERATION_REASON_LABELS[moderationCase.reason]}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            Flagged by
            <Avatar name={reportedBy.fullName} size="sm" />
            {reportedBy.fullName} · {formatCardDate(moderationCase.createdAt)}
          </span>
        }
        action={<ModerationStatusBadge status={moderationCase.status} />}
      />

      <CardBody className="flex flex-col gap-5">
        {/* Whose words these are has to be unmistakable: this is the flagger's
            complaint, not anything the report itself says. */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-fg">
            What {reportedBy.fullName} said
          </h3>
          <blockquote className="rounded-control border-l-2 border-accent bg-accent-soft px-3 py-2 text-sm text-fg">
            {moderationCase.details || 'No further detail was given.'}
          </blockquote>
        </div>

        {/* The content being complained about. An administrator should be able
            to judge a flag without leaving the queue, so the photograph and the
            opening of the description come with it. */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-fg">The flagged report</h3>

          <div className="relative flex gap-4 rounded-control border border-border p-3 transition-colors hover:bg-surface has-[a:focus-visible]:bg-surface">
            <img
              src={primaryPhotoOf(report)}
              alt=""
              className="size-20 shrink-0 rounded-control bg-surface-muted object-cover"
              loading="lazy"
            />

            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <ReportTypeBadge reportType={report.reportType} size="sm" />
                <StatusBadge status={report.status} variant="pill" />
              </div>
              {/* The whole preview opens the report. */}
              <Link
                to={`/pet/${report.id}`}
                className="font-semibold text-fg after:absolute after:inset-0 hover:underline"
              >
                {reportTitle}
              </Link>
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
                Filed by
                <Avatar name={reporter.fullName} size="sm" />
                {reporter.fullName}
                {reporter.accountStatus === 'suspended' && (
                  <span className="font-medium text-danger">· account suspended</span>
                )}
              </p>
              <p className="line-clamp-2 text-sm text-fg-muted">{report.description}</p>
              {/* A link of its own. As a positioned span it sat above the
                  title's stretched overlay and swallowed the click while doing
                  nothing itself. `relative` keeps it above the overlay; it is a
                  sibling of the title link, never inside it. */}
              <Link
                to={`/pet/${report.id}`}
                className="relative self-start text-sm font-medium text-brand hover:underline"
              >
                Open the full report
                <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        {isOpen ? (
          <>
            <Textarea
              label="Decision note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={255}
              placeholder="Explain what you decided and why."
              hint="The decision is sent to the person who filed the pet report; the person who flagged it is not notified. Required to remove the report."
            />

            {actionError && (
              <p role="alert" className="text-sm text-danger">
                That could not be saved: {actionError.message}
              </p>
            )}

            {/* Three levels, in three groups: leaving the report alone, warning
                its author, and closing it. The most severe action is last,
                widest apart, and says both of the things it does. */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  isLoading={busyAction === 'dismiss'}
                  disabled={Boolean(busyAction)}
                  onClick={() => decide('dismiss')}
                >
                  {DECISIONS.dismiss.label}
                </Button>
                <Button
                  variant="secondary"
                  isLoading={busyAction === 'warn'}
                  disabled={Boolean(busyAction)}
                  onClick={() => decide('warn')}
                >
                  {DECISIONS.warn.label}
                </Button>
              </div>

              <div className="flex flex-col gap-2 border-t border-danger/20 pt-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
                  <AlertTriangle size={15} className="shrink-0 text-danger" aria-hidden="true" />
                  These close the report
                </p>
                {/* The same rule as suspending from Users, and the server
                    enforces it: removal needs a reason the reporter can read. */}
                {!note.trim() && (
                  <p className="text-sm text-fg-muted">Write a decision note above to remove the report.</p>
                )}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <Button
                    variant="danger"
                    disabled={Boolean(busyAction) || !note.trim()}
                    onClick={() => setAsking('remove')}
                  >
                    {DECISIONS.remove.label}
                  </Button>
                  {/* Set apart from "Remove the report", and spelled out: the
                      two used to sit side by side in the same red. */}
                  <Button
                    variant="danger"
                    disabled={Boolean(busyAction) || !note.trim()}
                    onClick={() => setAsking('suspend')}
                    className="sm:ml-auto"
                  >
                    <Lock size={16} aria-hidden="true" />
                    {DECISIONS.suspend.label}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-sm text-fg-muted">
              Removing closes the report rather than deleting it, so the record of what
              happened survives. The person who filed it is told either way.
            </p>

            {asking && (
              <ConfirmDialog
                isOpen
                title={DECISIONS[asking].title(reportTitle, reporter.fullName)}
                confirmLabel={DECISIONS[asking].confirm}
                isBusy={busyAction === asking}
                onCancel={() => setAsking(null)}
                onConfirm={() => decide(asking)}
              >
                <p>
                  The report will be closed and removed from active use. It is not deleted: the
                  record, its history and this case stay in the system.
                </p>
                {asking === 'suspend' && (
                  <p>
                    <span className="font-medium">{reporter.fullName}</span> will also be
                    suspended and will not be able to sign in until an administrator reinstates
                    the account.
                  </p>
                )}
                <p className="text-fg-muted">Your decision note is sent to them.</p>
              </ConfirmDialog>
            )}
          </>
        ) : (
          <DecisionRecord
            moderationCase={moderationCase}
            reportedBy={reportedBy}
          />
        )}
      </CardBody>
    </Card>
  )
}

/**
 * A decided case, read-only: no buttons, because the server refuses a second
 * decision on the same case anyway.
 *
 * Which of the three actions was taken is not stored — the case records only
 * that it was actioned or dismissed — so this does not guess at one.
 */
function DecisionRecord({ moderationCase, reportedBy }) {
  const dismissed = moderationCase.status === 'dismissed'

  return (
    <div className="flex flex-col gap-2 rounded-control border border-border bg-surface px-4 py-3">
      <h3 className="text-sm font-semibold text-fg">Decision</h3>
      <ol className="flex flex-col gap-2 text-sm">
        <li className="flex gap-2">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-status-match" aria-hidden="true" />
          <span>
            <span className="font-medium text-fg">Flagged</span>
            <span className="text-fg-muted">
              {' '}
              by {reportedBy.fullName} · {formatCardDate(moderationCase.createdAt)}
            </span>
          </span>
        </li>
        <li className="flex gap-2">
          <span
            className={cn(
              'mt-1.5 size-2 shrink-0 rounded-full',
              dismissed ? 'bg-status-closed' : 'bg-status-returned',
            )}
            aria-hidden="true"
          />
          <span>
            <span className="font-medium text-fg">{dismissed ? 'Dismissed' : 'Actioned'}</span>
            <span className="text-fg-muted">
              {' '}
              by an administrator
              {moderationCase.resolvedAt && ` · ${formatCardDate(moderationCase.resolvedAt)}`}
            </span>
            {moderationCase.resolutionNote && (
              <span className="mt-1 block text-fg">“{moderationCase.resolutionNote}”</span>
            )}
          </span>
        </li>
      </ol>
    </div>
  )
}

function primaryPhotoOf(report) {
  const photo = report.photos.find((item) => item.isPrimary) ?? report.photos[0]
  return photo?.url ?? photoPlaceholder
}
