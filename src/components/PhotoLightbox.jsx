import { useEffect, useLayoutEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { t } from '@/i18n'

/**
 * A report photograph at full size — used by the report page and the Possible
 * Matches comparison.
 *
 * Built on the native `<dialog>` for the same reason `Modal` is: Escape, the
 * focus trap and the inert background come from the platform rather than from
 * a library. It is not `Modal` itself because that draws a titled white panel,
 * which is the wrong frame for a photograph.
 *
 * It is only in the page while it is open. It used to sit in the page closed,
 * relying on the browser to hide a closed `<dialog>`; mounting it only when
 * needed means no close button or backdrop can ever be left showing on a
 * normal page. When it closes, focus goes back to whatever opened it.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose  Called on Escape, the close button and a
 *   click on the backdrop. Must set `isOpen` to false.
 * @param {string} props.src
 * @param {string} props.alt
 * @param {number} [props.index]  Zero-based position, when there are several.
 * @param {number} [props.total]
 * @param {(step: 1|-1) => void} [props.onStep]  Wired to the arrow controls,
 *   the left and right arrow keys, and a horizontal swipe.
 */
export function PhotoLightbox({ isOpen, ...props }) {
  if (!isOpen) return null
  return <LightboxDialog {...props} />
}

function LightboxDialog({ onClose, src, alt, index = 0, total = 1, onStep }) {
  const dialogRef = useRef(null)
  const touchStart = useRef(null)
  const hasMany = total > 1 && Boolean(onStep)

  // The arrow keys move between photographs. Escape is the platform's own and
  // is left alone.
  useEffect(() => {
    if (!hasMany) return

    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onStep(-1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onStep(1)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [hasMany, onStep])

  // Swipe, for a phone. A drag has to be mostly sideways and long enough to
  // be deliberate, or scrolling a tall photograph would change it.
  const onTouchStart = (event) => {
    const touch = event.changedTouches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event) => {
    if (!hasMany || !touchStart.current) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return
    onStep(dx < 0 ? 1 : -1)
  }

  // A layout effect, so showModal() runs before the first paint: with a plain
  // effect the dialog could appear for one frame before it became modal.
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    // Remembered before the dialog takes focus, so it can be handed back.
    const opener = document.activeElement
    if (!dialog.open) dialog.showModal()

    // Not dialog.close(): that fires `close`, which tells the parent the
    // photo was dismissed. React's development check mounts, cleans up and
    // mounts again, so closing here shut the viewer the moment it opened.
    // Unmounting removes the element, which ends the modal state without an
    // event.
    return () => opener?.focus?.()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-label={alt || t('ui.photo')}
      // Escape closes the dialog natively; the resulting `close` event tells
      // the parent, which then removes it.
      onClose={onClose}
      // A click that lands on the dialog itself is a click on the backdrop —
      // the image and controls are children and stop it here.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 flex size-full max-h-none max-w-none items-center justify-center bg-transparent p-0 backdrop:bg-fg/85"
    >
      <div className="relative flex max-h-full max-w-full flex-col items-center gap-3 p-2 sm:p-4">
        <img
          src={src}
          alt={alt}
          className="max-h-[82vh] max-w-[97vw] rounded-card object-contain sm:max-w-[92vw]"
        />

        {hasMany && (
          <>
            {/* Beside the photograph on a laptop, under it on a phone, where
                a control at the edge of the screen is awkward to reach. */}
            <StepButton side="left" onClick={() => onStep(-1)} />
            <StepButton side="right" onClick={() => onStep(1)} />

            <p className="rounded-pill bg-fg/70 px-3 py-1 text-sm font-medium text-fg-inverted tabular-nums">
              {index + 1} / {total}
              <span className="sr-only">
                {' '}
                — use the arrow keys, or swipe, to move between photos
              </span>
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full bg-panel text-fg shadow-raised hover:bg-surface-muted"
      >
        <X size={20} aria-hidden="true" />
        <span className="sr-only">{t('ui.closePhoto')}</span>
      </button>
    </dialog>
  )
}

/** One of the two arrows beside the photograph. */
function StepButton({ side, onClick }) {
  const isLeft = side === 'left'
  const Icon = isLeft ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-panel/90 text-fg shadow-raised transition-colors hover:bg-panel sm:flex ${
        isLeft ? 'left-2 sm:left-4' : 'right-2 sm:right-4'
      }`}
    >
      <Icon size={22} aria-hidden="true" />
      <span className="sr-only">{isLeft ? t('ui.previousPhoto') : t('ui.nextPhoto')}</span>
    </button>
  )
}
