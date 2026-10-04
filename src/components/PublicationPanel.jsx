import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, EyeOff, Send, ShieldCheck, XCircle } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Textarea } from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PublicationBadge } from '@/components/StatusBadge'
import { CAPABILITIES, PUBLICATION_STATUSES, ROLES } from '@/constants'
import { can } from '@/utils/permissions'
import { petService } from '@/services'
import { formatDateTime } from '@/utils/date'
import { useRevealWhen } from '@/utils/reveal'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

/** What each publication move is called in the history. */
const EVENT_WORDS = {
  pending_review: (previous) => (previous ? t('publication.event.resubmitted') : t('publication.event.submitted')),
  published: () => t('publication.event.published'),
  rejected: () => t('publication.event.rejected'),
  removed: () => t('publication.event.removed'),
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
 * @param {(message: string) => void} props.onChanged  Called with what was done
 *   — a dictionary key, so it is said in the language showing (Correction 7);
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
  // Coordinators and administrators both see the publication state and its
  // history; only a coordinator decides (Correction 6A).
  const isStaffOrAdmin = viewer?.role === ROLES.STAFF || viewer?.role === ROLES.ADMIN
  const isCoordinator = viewer?.role === ROLES.STAFF
  // Removing a published report is moderation (Correction 6: every
  // administrator level has it; the server checks moderate_reports).
  const isAdmin = can(viewer, CAPABILITIES.MODERATE_REPORTS)

  // Published reports need no panel for their reporter or the public: the
  // page itself is the proof. Coordinators still see who approved it.
  if (publication === PUBLICATION_STATUSES.PUBLISHED && !isStaffOrAdmin && !notice) return null

  const latest = (state) => [...report.publicationHistory].reverse().find((entry) => entry.state === state)
  const rejection = latest(PUBLICATION_STATUSES.REJECTED)
  const removal = latest(PUBLICATION_STATUSES.REMOVED)

  // The pre-publication decision is the Pet Coordinator's alone: no
  // administrator level is offered it, and the server refuses it (403).
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
      setNoteError(action === 'reject' ? 'publication.noteReject' : 'publication.noteRemove')
      return
    }
    setIsBusy(true)
    setFailure(null)
    try {
      await petService.updatePublication(report.id, action, needsNote ? note.trim() : null)
      setDialog(null)
      onChanged(`publication.done.${action}`)
    } catch (caught) {
      setFailure(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Card data-publication-panel={publication}>
      <CardHeader titleAs="h2" title={t('publication.title')} />
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {publication === PUBLICATION_STATUSES.PUBLISHED ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-ink">
              <ShieldCheck size={15} aria-hidden="true" />
              {t('labels.publication.published')}
            </span>
          ) : (
            <PublicationBadge publication={publication} />
          )}
        </div>

        <p className="text-sm text-fg">
          {publication === PUBLICATION_STATUSES.PENDING_REVIEW &&
            (isOwner
              ? t('publication.pendingOwner')
              : isCoordinator
                ? t('publication.pendingCoordinator')
                : t('publication.pendingOther'))}
          {publication === PUBLICATION_STATUSES.REJECTED &&
            (isOwner
              ? t('publication.rejectedOwner')
              : t('publication.rejectedOther'))}
          {publication === PUBLICATION_STATUSES.REMOVED &&
            t('publication.removed')}
          {publication === PUBLICATION_STATUSES.PUBLISHED &&
            (report.publicationHistory.length === 0
              ? t('publication.publicLegacy')
              : t('publication.public'))}
        </p>

        {publication === PUBLICATION_STATUSES.REJECTED && rejection?.note && (
          <p className="rounded-control border border-border bg-surface-alt px-3 py-2 text-sm text-fg">
            <span className="font-medium">{t('publication.reasonLabel')} </span>
            {rejection.note}
          </p>
        )}
        {publication === PUBLICATION_STATUSES.REMOVED && removal?.note && (
          <p className="rounded-control border border-border bg-surface-alt px-3 py-2 text-sm text-fg">
            <span className="font-medium">{t('publication.reasonLabel')} </span>
            {removal.note}
          </p>
        )}

        {canReview && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act('approve')} isLoading={isBusy && !dialog}>
              <Check size={16} aria-hidden="true" />
              {t('publication.approve')}
            </Button>
            <Button variant="secondary" onClick={() => open('reject')} disabled={isBusy}>
              <XCircle size={16} aria-hidden="true" />
              {t('publication.rejectOpen')}
            </Button>
          </div>
        )}
        {canResubmit && (
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to={`/dashboard/reports/${report.id}/edit`} variant="secondary">
              {t('publication.edit')}
            </Button>
            <Button onClick={() => open('resubmit')}>
              <Send size={16} aria-hidden="true" />
              {t('publication.resubmit')}
            </Button>
          </div>
        )}
        {canRemove && (
          <Button variant="secondary" onClick={() => open('remove')} className="text-danger">
            <EyeOff size={16} aria-hidden="true" />
            {t('publication.removeOpen')}
          </Button>
        )}

        {failure && !dialog && (
          <p role="alert" className="text-sm text-danger">
            {t('publication.failed', { message: errorText(failure) })}
          </p>
        )}
        {notice && (
          <p ref={doneRef} tabIndex={-1} role="status" className="scroll-mt-24 text-sm font-medium text-fg outline-none">
            {t(notice)}
          </p>
        )}

        {report.publicationHistory.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-fg-muted">{t('publication.history')}</summary>
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
            ? t('publication.rejectTitle')
            : dialog === 'remove'
              ? t('publication.removeTitle')
              : t('publication.resubmitTitle')
        }
        confirmLabel={
          dialog === 'reject'
            ? t('publication.rejectConfirm')
            : dialog === 'remove'
              ? t('publication.removeConfirm')
              : t('publication.resubmitConfirm')
        }
        cancelLabel={t('publication.goBack')}
        tone={dialog === 'resubmit' ? 'primary' : 'danger'}
        isBusy={isBusy}
        error={failure}
        onCancel={() => !isBusy && setDialog(null)}
        onConfirm={() => act(dialog)}
      >
        {dialog === 'resubmit' ? (
          <p>{t('publication.resubmitBody')}</p>
        ) : (
          <>
            <p>
              {dialog === 'reject'
                ? t('publication.rejectBody')
                : t('publication.removeBody')}
            </p>
            <Textarea
              label={t('publication.reason')}
              required
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
                setNoteError(null)
              }}
              error={noteError && t(noteError)}
              rows={3}
              maxLength={255}
              hint={t('publication.reasonHint')}
            />
          </>
        )}
      </ConfirmDialog>
    </Card>
  )
}
