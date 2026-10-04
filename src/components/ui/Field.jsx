import { cn } from '@/utils/cn'
import { t } from '@/i18n'

/**
 * Label + hint + error wrapper shared by every form control.
 *
 * Centralising this is what keeps form accessibility consistent (CLAUDE.md
 * §13): the label is always bound to the control, the hint and the error are
 * always announced through `aria-describedby`, and the error is never colour
 * alone — it carries text and `role="alert"`.
 *
 * Input/Textarea/Select use this internally; use it directly only when you are
 * wrapping a control this folder does not provide yet. The matching styles and
 * `aria-describedby` helper live in `./formControl`.
 *
 * @param {Object} props
 * @param {string} props.id            Id of the control being labelled.
 * @param {string} props.label
 * @param {boolean} [props.required]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {boolean} [props.hideLabel]  Keeps the label for screen readers but
 *   hides it — for a control inside a table cell, where the column header is
 *   already saying what it is and seven repeated labels would be noise.
 * @param {React.ReactNode} props.children
 */
export function Field({
  id,
  label,
  required = false,
  hint,
  error,
  hideLabel = false,
  className,
  children,
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-sm font-medium text-fg', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <>
            {' '}
            <span className="text-danger" aria-hidden="true">
              *
            </span>
            <span className="sr-only">{t('ui.required')}</span>
          </>
        )}
      </label>

      {children}

      {/* Hint and error both sit under the control.
          With the hint above it, a hinted field pushed its own input box down,
          so two fields side by side in a grid row no longer lined up — one box
          sat a line lower than its neighbour. Underneath, every control in a
          row starts at the same height whether it has a hint or not. Screen
          readers are unaffected: both are still bound by `aria-describedby`. */}
      {hint && (
        <p id={`${id}-hint`} className="text-sm leading-relaxed text-fg-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm leading-relaxed text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
