import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, EyeOff, Send, ShieldCheck, XCircle } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Textarea } from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PublicationBadge } from '@/components/StatusBadge'
import { PUBLICATION_STATUSES, ROLES } from '@/constants'
import { petService } from '@/services'
import { formatDateTime } from '@/utils/date'
import { useRevealWhen } from '@/utils/reveal'

/** What each publication move is called in the history. */
const EVENT_WORDS = {
  pending_review: (previous) => (previous ? 'Submitted for review again' : 'Submitted for review'),
  published: () => 'Approved and published',
  rejected: () => 'Not approved',
  removed: () => 'Removed from public view',
}

/**
 * A report's publication, for the people it concerns (Correction 4): its
 * reporter, Pet Coordinators and administrators. Says whether the public can
 * see it, why not, and who decided — and offers the one move each of them
 * may make from here. The server holds the same rules; this only shows them.
 *
 *   a coordinator, on a report waiting for review   Approve · Not approved…
 *   the reporter, on a report not approved          Submit for review again
 *   an administrator, on a published report         Remove from public view…
 *
 * There is no "Cancel" decision: what Ma'am meant by it is not yet known
 * (register item 16). The dialogs' own "Go back" only closes the dialog.
 *
 * @param {Object} props
 * @param {Object} props.report
 * @param {Object|null} props.viewer   The signed-in account.
 * @param {(message: string) => void} props.onChanged  Called with what was done;
 *   the page keeps it, because it reloads the report and remounts this panel.
 * @param {string|null} [props.notice]  What was just done, to say and reveal.
 */
export function PublicationPanel({ report, viewer, onChanged, notice = null }) {
  const [dialog, setDialog] = useState(null) // 'reject' | 'remove' | 'resubmit' | null
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(null)
  const [isBusy, setIsBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const doneRef = useRevealWhen(Boolean(notice))

  const publication = report.publicationStatus
  const isOwner = Boolean(viewer) && viewer.id === report.reporterId
  const isCoordinator = viewer?.role === ROLES.STAFF || viewer?.role === ROLES.ADMIN
  const isAdmin = viewer?.role === ROLES.ADMIN

  // Published reports need no panel for their reporter or the public: the
  // page itself is the proof. Coordinators still see who approved it.
  if (publication === PUBLICATION_STATUSES.PUBLISHED && !isCoordinator && !notice) return null

  const latest = (state) => [...report.publicationHistory].reverse().find((entry) => entry.state === state)
  const rejection = latest(PUBLICATION_STATUSES.REJECTED)
  const removal = latest(PUBLICATION_STATUSES.REMOVED)

  const canReview = isCoordinator && !isOwner && publication === PUBLICATION_STATUSES.PENDING_REVIEW
  const canResubmit = isOwner && publication === PUBLICATION_STATUSES.REJECTED
  const canRemove = isAdmin && publication === PUBLICATION_STATUSES.PUBLISHED

  const open = (kind) => {
    setNote('')
    setNoteError(null)
    setFailure(null)
    setDialog(kind)
  }

  const act = async (action) => {
    const needsNote = action === 'reject' || action === 'remove'
    if (needsNote && !note.trim()) {
      setNoteError(
        action === 'reject'
          ? 'Write why it is not approved. The reporter is told this, so they can fix it.'
          : 'Write why it is being removed. The reporter is told this.',
      )
      return
    }
    setIsBusy(true)
    setFailure(null)
    try {
      await petService.updatePublication(report.id, action, needsNote ? note.trim() : null)
      setDialog(null)
      onChanged(
        {
          approve: 'Approved. The report is now public, and it is being compared with other reports.',
          reject: 'Marked as not approved. The reporter has been told why.',
          resubmit: 'Submitted for review again. A Pet Coordinator will check it before it appears publicly.',
          remove: 'Removed from public view. The reporter has been told why.',
        }[action],
      )
    } catch (caught) {
      setFailure(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Card data-publication-panel={publication}>
      <CardHeader titleAs="h2" title="Publication" />
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {publication === PUBLICATION_STATUSES.PUBLISHED ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-ink">
              <ShieldCheck size={15} aria-hidden="true" />
              Published
            </span>
          ) : (
            <PublicationBadge publication={publication} />
          )}
        </div>

        <p className="text-sm text-fg">
          {publication === PUBLICATION_STATUSES.PENDING_REVIEW &&
            (isOwner
              ? 'Waiting for a Pet Coordinator to review it. Nobody else can see it until it is approved, and it is not compared with other reports yet.'
              : 'Waiting for review. Check it is a genuine, appropriate report before it goes public.')}
          {publication === PUBLICATION_STATUSES.REJECTED &&
            (isOwner
              ? 'Not approved, so it is not public. Edit it to address the reason below, then submit it again.'
              : 'Not approved. The reporter can edit it and submit it again.')}
          {publication === PUBLICATION_STATUSES.REMOVED &&
            'Removed by an administrator. It is not public and is no longer compared with other reports. It is kept, with its history.'}
          {publication === PUBLICATION_STATUSES.PUBLISHED &&
            (report.publicationHistory.length === 0
              ? 'Public. Filed before reports were reviewed, so it has no review record.'
              : 'Public, and compared with other reports.')}
        </p>

        {publication === PUBLICATION_STATUSES.REJECTED && rejection?.note && (
          <p className="rounded-control border border-border bg-surface-alt px-3 py-2 text-sm text-fg">
            <span className="font-medium">Reason: </span>
            {rejection.note}
          </p>
        )}
        {publication === PUBLICATION_STATUSES.REMOVED && removal?.note && (
          <p className="rounded-control border border-border bg-surface-alt px-3 py-2 text-sm text-fg">
            <span className="font-medium">Reason: </span>
            {removal.note}
          </p>
        )}

        {canReview && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act('approve')} isLoading={isBusy && !dialog}>
              <Check size={16} aria-hidden="true" />
              Approve and publish
            </Button>
            <Button variant="secondary" onClick={() => open('reject')} disabled={isBusy}>
              <XCircle size={16} aria-hidden="true" />
              Not approved…
            </Button>
          </div>
        )}
        {canResubmit && (
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to={`/dashboard/reports/${report.id}/edit`} variant="secondary">
              Edit the report
            </Button>
            <Button onClick={() => open('resubmit')}>
              <Send size={16} aria-hidden="true" />
              Submit for review again
            </Button>
          </div>
        )}
        {canRemove && (
          <Button variant="secondary" onClick={() => open('remove')} className="text-danger">
            <EyeOff size={16} aria-hidden="true" />
            Remove from public view…
          </Button>
        )}

        {failure && !dialog && (
          <p role="alert" className="text-sm text-danger">
            That did not work: {failure.message}
          </p>
        )}
        {notice && (
          <p ref={doneRef} tabIndex={-1} role="status" className="scroll-mt-24 text-sm font-medium text-fg outline-none">
            {notice}
          </p>
        )}

        {report.publicationHistory.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-fg-muted">Review history</summary>
            <ol className="mt-2 flex flex-col gap-2">
              {report.publicationHistory.map((entry) => (
                <li key={entry.id} className="border-l-2 border-border pl-3">
                  <p className="font-medium text-fg">{EVENT_WORDS[entry.state]?.(entry.previous) ?? entry.state}</p>
                  <p className="text-fg-muted">
                    {formatDateTime(entry.createdAt)}
                    {entry.actor ? ` · ${entry.actor}` : ''}
                  </p>
                  {entry.note && <p className="text-fg">{entry.note}</p>}
                </li>
              ))}
            </ol>
          </details>
        )}
      </CardBody>

      <ConfirmDialog
        isOpen={dialog !== null}
        title={
          dialog === 'reject'
            ? 'Not approve this report?'
            : dialog === 'remove'
              ? 'Remove this report from public view?'
              : 'Submit this report for review again?'
        }
        confirmLabel={dialog === 'reject' ? 'Not approved' : dialog === 'remove' ? 'Remove from public view' : 'Submit again'}
        cancelLabel="Go back"
        tone={dialog === 'resubmit' ? 'primary' : 'danger'}
        isBusy={isBusy}
        error={failure}
        onCancel={() => !isBusy && setDialog(null)}
        onConfirm={() => act(dialog)}
      >
        {dialog === 'resubmit' ? (
          <p>A Pet Coordinator will review it again before it appears publicly.</p>
        ) : (
          <>
            <p>
              {dialog === 'reject'
                ? 'The report stays private. The reporter is told the reason and can edit and submit it again.'
                : 'The report stops being public and stops being compared with other reports. It is not Closed: it is kept, with its history, and the reporter is told the reason.'}
            </p>
            <Textarea
              label="Reason"
              required
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
                setNoteError(null)
              }}
              error={noteError}
              rows={3}
              maxLength={255}
              hint="The reporter sees this."
            />
          </>
        )}
      </ConfirmDialog>
    </Card>
  )
}
