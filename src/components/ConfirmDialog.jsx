import { Button, Modal } from '@/components/ui'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

/**
 * "Are you sure?" for an action that is hard to take back.
 *
 * Always names the action on its button ("Suspend account", never "OK"), says
 * what will happen in the body, and opens with the focus on Cancel so a stray
 * Enter changes nothing. Escape, the backdrop and Cancel all back out — except
 * while the action is running.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onCancel
 * @param {() => void} props.onConfirm
 * @param {string} props.title         e.g. "Suspend Rico Panganiban?"
 * @param {string} props.confirmLabel  The action, in words.
 * @param {string} [props.cancelLabel]  The way back, in words. "Cancel" by default.
 * @param {'ghost'|'primary'} [props.cancelVariant]  "primary" when going back is the
 *   recommended choice (e.g. adding a photo), so it is the strongest button.
 * @param {'danger'|'primary'} [props.tone]  Red for anything destructive.
 * @param {boolean} [props.isBusy]
 * @param {boolean} [props.confirmDisabled]
 * @param {Error|null} [props.error]  Shown inside, so a failure is seen where
 *   the decision was made.
 * @param {React.ReactNode} props.children  The consequences.
 */
export function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  confirmLabel,
  cancelLabel,
  cancelVariant = 'ghost',
  tone = 'danger',
  isBusy = false,
  confirmDisabled = false,
  error = null,
  children,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isBusy && onCancel()}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant={cancelVariant} onClick={onCancel} disabled={isBusy} data-autofocus>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant={tone} isLoading={isBusy} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-fg">
        {children}
        {error && (
          <p role="alert" className="text-danger">
            {t('ui.notSaved', { message: errorText(error) })}
          </p>
        )}
      </div>
    </Modal>
  )
}
