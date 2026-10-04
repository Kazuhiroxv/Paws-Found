import { useState } from 'react'
import { Button, Modal, Select, Textarea } from '@/components/ui'
import { MODERATION_REASONS, MODERATION_REASON_LABELS } from '@/constants'
import { moderationService } from '@/services'
import { optionsFromLabels } from '@/utils/options'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

/**
 * "Report this listing" — raises a moderation case for an administrator to
 * review in Phase 11.
 *
 * Flagging only records a concern. It does not hide the report, and it never
 * tells the reporter who flagged them.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.reportId
 */
export function FlagReportDialog({ isOpen, onClose, reportId }) {
  const [reason, setReason] = useState(MODERATION_REASONS.FALSE_REPORT)
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [isDone, setIsDone] = useState(false)

  const close = () => {
    onClose()
    // Reset after closing so reopening starts clean, without the form visibly
    // resetting while the dialog is still on screen.
    setTimeout(() => {
      setIsDone(false)
      setDetails('')
      setError(null)
    }, 200)
  }

  const submit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      await moderationService.createCase({
        reportId,
        reason,
        details: details.trim(),
      })
      setIsDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={isDone ? t('flag.thanks') : t('flag.title')}
      description={
        isDone
          ? undefined
          : t('flag.description')
      }
      footer={
        isDone ? (
          <Button onClick={close}>{t('common.close')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={submit} isLoading={isSubmitting}>
              {isSubmitting ? t('flag.sending') : t('flag.send')}
            </Button>
          </>
        )
      }
    >
      {isDone ? (
        <p className="text-sm text-fg-muted">
          {t('flag.done')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            label={t('flag.reason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            options={optionsFromLabels(MODERATION_REASON_LABELS)}
          />

          <Textarea
            label={t('flag.details')}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t('flag.detailsPlaceholder')}
          />

          {error && (
            <p role="alert" className="text-sm text-danger">
              {t('flag.failed', { message: errorText(error) })}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
