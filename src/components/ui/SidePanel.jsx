import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * A panel that opens beside a list, for reading one row without leaving the
 * list.
 *
 * Deliberately NOT a modal, and that is the whole point of it. `Modal` stops
 * the page: it takes focus, dims what is behind it and demands an answer,
 * which is right for "suspend this account?" and wrong for "who is this
 * person?". Going through a modal to read a row, closing it, and opening the
 * next one loses your place in the table every time.
 *
 * So the table stays lit and stays clickable. Choosing another row swaps the
 * panel's contents rather than stacking a second one, which is how somebody
 * actually works through a queue.
 *
 * Because it is not modal, three things are handled by hand:
 *
 *   * Escape closes it — expected of anything that opens over a page.
 *   * Focus moves in when it opens, so a keyboard user is not left behind in
 *     the table reading a panel they cannot reach.
 *   * Focus goes back to whatever opened it on close, or the tab order
 *     restarts at the top of the document.
 *
 * Destructive actions inside a panel still open a `ConfirmDialog` on top. A
 * decision that cannot be undone should interrupt.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {string} props.title        Names the panel for assistive technology.
 * @param {React.ReactNode} [props.eyebrow]  Small line above the title.
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.children
 */
export function SidePanel({ isOpen, title, eyebrow, onClose, children }) {
  const titleId = useId()
  const panelRef = useRef(null)
  // Whatever had focus when the panel opened, so it can be handed back.
  const openerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    // Captured now rather than read in the cleanup: by the time the panel
    // closes, React may already have taken the node out of the document.
    const panel = panelRef.current
    openerRef.current = document.activeElement

    // The panel itself, not the close button: a screen reader then reads the
    // heading first rather than announcing "Close" with no idea what closes.
    panel?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Only if focus is still inside the panel. If somebody has already
      // clicked back into the table, yanking them to the old row is worse
      // than leaving them where they chose to be.
      if (panel?.contains(document.activeElement)) {
        openerRef.current?.focus?.()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(
        'fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-panel shadow-raised outline-none',
        'sm:max-w-md',
        // Slides in from the edge it belongs to. The reduced-motion rule in
        // index.css collapses this to 0.01ms, so it simply appears.
        'animate-[panel-in_180ms_ease-out]',
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-medium tracking-wide text-fg-muted uppercase">{eyebrow}</p>
          )}
          <h2 id={titleId} className="truncate text-lg font-semibold text-fg">
            {title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="-m-1 shrink-0 rounded-control p-1 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
        >
          <X size={20} aria-hidden="true" />
          <span className="sr-only">Close this panel</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
    </div>
  )
}
