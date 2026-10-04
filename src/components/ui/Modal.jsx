import { Children, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from './Button'
import { t } from '@/i18n'

/**
 * Dialog built on the native `<dialog>` element.
 *
 * Using the platform element rather than a hand-rolled overlay gives us the
 * focus trap, the inert background, Escape-to-close and correct dialog
 * semantics for free — which is both more accessible and far easier for the
 * team to explain than a custom implementation (CLAUDE.md §15).
 *
 * The parent owns `isOpen`; this component only reflects it.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose  Called on Escape, backdrop click, and the
 *   close button. Must actually flip `isOpen`, or the dialog reopens.
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.footer] Action row, usually Buttons.
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {'centre'|'sheet'} [props.placement]  `sheet` docks the dialog to the
 *   bottom of the screen at full width — for something long on a phone, like
 *   a filter panel, where a centred box wastes the space it has and puts its
 *   controls out of thumb's reach.
 */
const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ isOpen, ...props }) {
  // Only in the page while open, like PhotoLightbox: nothing — no close button,
  // no backdrop — can be left showing when a dialog is closed.
  if (!isOpen) return null
  return <OpenModal {...props} />
}

function OpenModal({
  onClose,
  title,
  description,
  footer,
  size = 'md',
  placement = 'centre',
  className,
  children,
}) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  // Opened before the first paint, and focus handed back to whatever opened
  // it afterwards. Not closed in the cleanup: `close()` fires the close event,
  // and under React's development double-mount that shut the dialog the
  // moment it opened. Unmounting ends the modal state without an event.
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    if (!dialog.open) dialog.showModal()
    // A confirmation puts `data-autofocus` on its safe button (Cancel), so
    // Enter straight after opening never commits the action.
    dialog.querySelector('[data-autofocus]')?.focus()
    return () => opener?.focus?.()
  }, [])

  // The browser fires `close` for Escape too, so this covers every exit route.
  useEffect(() => {
    const dialog = dialogRef.current
    const handleClose = () => onClose?.()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  // A click that lands on the dialog element itself is a click on the backdrop:
  // the panel inside stops it from reaching here.
  const handleBackdropClick = (event) => {
    if (event.target === dialogRef.current) onClose?.()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={handleBackdropClick}
      className={cn(
        // `m-auto` is what centres it. A native dialog is centred by the browser's
        // own `margin: auto`, and Tailwind's reset sets `margin: 0` on every
        // element — which silently pinned every dialog to the top-left corner.
        placement === 'sheet'
          ? // Docked to the bottom edge, full width, rounded only along the
            // top — `mt-auto` is what pins it there, the same way `m-auto`
            // centres the ordinary one.
            'mt-auto mb-0 ml-0 max-h-[88dvh] w-full max-w-none rounded-t-card rounded-b-none border border-b-0 border-border bg-panel p-0 text-fg shadow-lg'
          : 'm-auto w-[calc(100%-2rem)] rounded-card border border-border bg-panel p-0 text-fg shadow-lg',
        // Opens with a gentle fade and a 2% rise. Never a spring, and the
        // base layer turns it off for anyone who asked for reduced motion.
        placement === 'sheet'
          ? 'motion-safe:animate-[sheet-in_200ms_ease-out] motion-safe:backdrop:animate-[backdrop-in_160ms_ease-out]'
          : 'motion-safe:animate-[dialog-in_160ms_ease-out] motion-safe:backdrop:animate-[backdrop-in_160ms_ease-out]',
        // A tall dialog scrolls inside itself instead of running off a short
        // screen. `overflow-x-hidden` is required, not decoration: a box with
        // `auto` on one axis promotes `visible` on the other to `auto` too,
        // which put a stray horizontal scrollbar along the bottom.
        placement === 'sheet' ? 'overflow-x-hidden overflow-y-auto' : 'max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto',
        'backdrop:bg-black/40',
        placement === 'sheet' ? undefined : SIZES[size],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-0.5 text-sm text-fg-muted">
              {description}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('ui.closeDialog')}>
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      {/* Only when there is something to put in it. A dialog made of a title,
          a description and buttons (the coordinator's Confirm match) otherwise
          carried an empty padded strip between them. */}
      {Children.toArray(children).length > 0 && <div className="px-4 py-4">{children}</div>}

      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
          {footer}
        </div>
      )}
    </dialog>
  )
}
