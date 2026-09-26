import { useCallback, useEffect, useRef, useState } from 'react'
import { userService } from '@/services'

/**
 * How often the browser asks the server who it is signed in as.
 *
 * This is not what keeps the system secure — the API re-reads the account from
 * the database on every single request, so an administrator who was demoted a
 * second ago is already refused. This is what stops the *screen* from lying
 * about it for as long as nobody happens to press refresh.
 *
 * Ten seconds is chosen for the demonstration: change a role on one device and
 * the other two catch up while everybody is still looking at them.
 */
const POLL_INTERVAL_MS = 10_000

/**
 * Who is signed in, kept honest.
 *
 * `undefined` means the question has not been answered yet, and is different
 * from `null`, which means nobody. A guarded route must not decide "signed
 * out" while the answer is still in flight, or every refresh bounces a
 * signed-in person to the sign-in page.
 *
 * The answer is re-checked:
 *   * once on load;
 *   * whenever the window regains focus, or the tab becomes visible again —
 *     which is the moment somebody looks back at device B;
 *   * whenever a route changes (`refresh` is handed to the layout);
 *   * and on a timer, so a device nobody is touching still catches up.
 *
 * When a re-check finds that the role changed, or that the session is gone,
 * `notice` describes it so the interface can say so out loud rather than
 * silently rearranging itself.
 */
export function useSession() {
  const [user, setUser] = useState(undefined)
  const [notice, setNotice] = useState(null)

  // The last answer, readable without making `refresh` depend on it — a
  // dependency there would rebuild the timer on every change.
  const known = useRef(undefined)

  // One request at a time. The timer, the focus handler and a route change can
  // easily land together.
  const inFlight = useRef(false)

  /**
   * Store a new answer.
   *
   * `announce` is false for sign-in and sign-out, where the person already
   * knows what they did, and true for a background re-check, where the change
   * arrived from somewhere else and is worth a word.
   */
  const apply = useCallback((next, { announce }) => {
    const previous = known.current
    known.current = next
    setUser(next)

    if (!announce || previous === undefined || previous === null) return

    if (next === null) {
      setNotice({ kind: 'signed-out' })
    } else if (next.role !== previous.role) {
      setNotice({ kind: 'role', from: previous.role, to: next.role })
    }
  }, [])

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true

    try {
      apply(await userService.getCurrentUser(), { announce: true })
    } catch {
      // The server could not be reached, which is not the same as being signed
      // out. On the very first attempt there is nothing to fall back on, so the
      // app has to assume nobody; afterwards the previous answer is kept, or a
      // dropped connection would look exactly like a suspension.
      if (known.current === undefined) apply(null, { announce: false })
    } finally {
      inFlight.current = false
    }
  }, [apply])

  /** Sign-in and registration: the answer is already known, so no re-check. */
  const setSignedInUser = useCallback((next) => apply(next, { announce: false }), [apply])

  const signOut = useCallback(async () => {
    await userService.signOut()
    apply(null, { announce: false })
  }, [apply])

  useEffect(() => {
    // The lint rule guards against a state update made synchronously while an
    // effect runs, which cascades renders. That is not what happens here:
    // `refresh` awaits the network before it sets anything, so the update lands
    // in a later task exactly as it does for the three listeners below. The
    // first check has to be started from somewhere, and this is it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()

    const onFocus = () => refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(refresh, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [refresh])

  return {
    user,
    notice,
    dismissNotice: useCallback(() => setNotice(null), []),
    refresh,
    setSignedInUser,
    signOut,
  }
}
