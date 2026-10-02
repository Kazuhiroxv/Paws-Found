import { useEffect, useRef } from 'react'

/**
 * Bring a result into view and put the keyboard there.
 *
 * Post-defense correction (team observation T1, and "no feedback after Submit"
 * in the recording): Ma'am submitted a form from the bottom of the page and the
 * confirmation appeared above, out of sight. It looked as though nothing had
 * happened. A result the person cannot see is not feedback.
 *
 * So after a submit, whatever answers it — a success message, an error
 * summary, the first field that is wrong — is scrolled to and focused.
 * Focus matters as much as the scroll: a screen reader announces where focus
 * lands, and a keyboard user continues from there instead of from the button
 * at the bottom. The target needs `tabIndex={-1}` if it is not a control, and
 * `scroll-mt-24` so the sticky 72px navbar does not cover it on arrival.
 *
 * Smooth scrolling only when the person has not asked for reduced motion.
 */
export function reveal(element) {
  if (!element) return

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  // preventScroll, because the scroll above has already chosen where to land;
  // letting focus scroll as well would jump straight past the smooth one.
  element.focus({ preventScroll: true })
}

/** The first field marked invalid inside `container`, revealed and focused. */
export function revealFirstInvalid(container) {
  reveal(container?.querySelector('[aria-invalid="true"]'))
}

/**
 * A ref whose element is revealed whenever `trigger` changes to something
 * truthy. Pass the success state, or a submit counter, as the trigger:
 *
 *   const sentRef = useRevealWhen(sent)
 *   <div ref={sentRef} tabIndex={-1} className="scroll-mt-24 outline-none">…
 *
 * Runs after the element is on the page, which a plain call in the submit
 * handler cannot guarantee — the confirmation is rendered by the state change
 * that handler makes.
 */
export function useRevealWhen(trigger) {
  const ref = useRef(null)

  useEffect(() => {
    if (trigger) reveal(ref.current)
  }, [trigger])

  return ref
}
