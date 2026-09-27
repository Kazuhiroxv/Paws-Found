import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * A small disclosure menu for the header — used by "Report" and by the account
 * control.
 *
 * Hand-written rather than pulled from a library, because the behaviour a menu
 * actually needs is short enough to read in one sitting (CLAUDE.md §15):
 * it opens on click, closes on Escape, on a click outside, and after the person
 * follows a link inside it.
 *
 * Opens on click and not on hover: a hover menu is unusable on a touchscreen
 * and awkward for anyone using a keyboard.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.label     What the trigger shows.
 * @param {boolean} [props.isActive]        Highlight the trigger, e.g. when a
 *   child route is the current page.
 * @param {string} [props.triggerClassName] Styling for the trigger button.
 * @param {'left'|'right'} [props.align]    Which edge the panel lines up with.
 * @param {boolean} [props.showChevron]     Off for an icon-only trigger such as
 *   a "More" button, where the icon already says it opens something.
 * @param {string} [props.panelClassName]   Extra styling for the open panel,
 *   e.g. a wider minimum for the account menu's name and email.
 * @param {(close: () => void) => React.ReactNode} props.children  Rendered with
 *   a `close` function, so an item can dismiss the menu when it is chosen.
 */
export function NavDropdown({
  label,
  isActive = false,
  triggerClassName,
  align = 'left',
  showChevron = true,
  panelClassName,
  children,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={menuId}
        className={cn(triggerClassName, isActive && 'text-fg')}
      >
        {label}
        {/* One chevron style for every header menu. It used to take its
            colour from the label, so "Report" and the account name had two
            different chevrons side by side. */}
        {showChevron && (
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={cn('shrink-0 text-fg-muted transition-transform', isOpen && 'rotate-180')}
          />
        )}
      </button>

      {isOpen && (
        <div
          id={menuId}
          className={cn(
            'absolute top-full z-50 mt-2 min-w-52 rounded-card border border-border bg-panel p-1.5 shadow-raised',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children(() => setIsOpen(false))}
        </div>
      )}
    </div>
  )
}

/** One row inside a NavDropdown. */
export function NavDropdownItem({ as: Component = 'button', className, ...rest }) {
  return (
    <Component
      className={cn(
        'flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-fg-muted transition-colors',
        'hover:bg-surface-muted hover:text-fg',
        className,
      )}
      {...rest}
    />
  )
}
