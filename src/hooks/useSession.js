import { useCallback, useEffect, useRef, useState } from 'react'
import { userService } from '@/services'
import { SESSION_CHECK_EVENT } from '@/services/api'

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
 *   * whenever a request comes back "signed out" (SESSION_CHECK_EVENT);
 *   * and on a timer, so a device nobody is touching still catches up.
 *
 * When a re-check finds that the role changed, or that the session is gone,
 * `notice` describes it — with the server's reason when it gave one — so the
 * interface can say so out loud rather than silently rearranging itself.
 */
export function useSession() {
  const [user, setUser] = useState(undefined)
  const [notice, setNotice] = useState(null)

  // The last answer, readable without making `refresh` depend on it — a
  // dependency there would rebuild the timer on every change.
  const known = useRef(undefined)

  // The check that is running, if one is, and whether another was asked for
  // while it ran.
  //
  // Before Correction 5 a request made while a check was in flight was simply
  // dropped. So: tab A starts a check; tab B signs out; tab A regains focus
  // and asks again — dropped; the first check returns "still signed in",
  // answered before the sign-out. Tab A then showed the private report until
  // the next poll, ten seconds later. Now the request is remembered and one
  // more check runs as soon as the first finishes: never lost, never more
  // than one extra however many arrive.
  const running = useRef(null)
  const again = useRef(false)

  // Bumped by signing in and out here. A check that started before either
  // cannot overwrite what they set: its answer describes a session that no
  // longer exists in this tab.
  const generation = useRef(0)

  /**
   * Store a new answer.
   *
   * `announce` is false for sign-in, where the person already knows what they
   * did, and true for a background re-check, where the change arrived from
   * somewhere else and is worth a word.
   */
  const apply = useCallback((next, { announce, reason = null }) => {
    const previous = known.current
    known.current = next
    setUser(next)

    if (!announce || previous === undefined || previous === null) return

    if (next === null) {
      setNotice({ kind: 'signed-out', reason })
    } else if (next.role !== previous.role) {
      setNotice({ kind: 'role', from: previous.role, to: next.role })
    }
  }, [])

  const refresh = useCallback(() => {
    if (running.current) {
      again.current = true
      return running.current
    }

    const check = async () => {
      do {
        again.current = false
        const started = generation.current

        try {
          const { user: next, endedReason } = await userService.checkSession()
          if (started === generation.current) apply(next, { announce: true, reason: endedReason })
        } catch {
          // The server could not be reached, which is not the same as being
          // signed out. On the very first attempt there is nothing to fall
          // back on, so the app has to assume nobody; afterwards the previous
          // answer is kept, or a dropped connection would look exactly like a
          // suspension.
          if (known.current === undefined && started === generation.current) {
            apply(null, { announce: false })
          }
        }
      } while (again.current)
    }

    running.current = check().finally(() => {
      running.current = null
    })
    return running.current
  }, [apply])

  /** Sign-in and registration: the answer is already known, so no re-check. */
  const setSignedInUser = useCallback(
    (next) => {
      generation.current += 1
      setNotice(null)
      apply(next, { announce: false })
    },
    [apply],
  )

  /** Sign out here. The person pressed it, but the page still says it happened. */
  const signOut = useCallback(async () => {
    generation.current += 1
    await userService.signOut()
    generation.current += 1
    apply(null, { announce: false })
    setNotice({ kind: 'signed-out', reason: 'logout' })
  }, [apply])

  useEffect(() => {
    // The first check. `refresh` awaits the network before it sets anything,
    // so the update lands in a later task exactly as it does for the
    // listeners below.
    refresh()

    const onFocus = () => refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener(SESSION_CHECK_EVENT, onFocus)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(refresh, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(SESSION_CHECK_EVENT, onFocus)
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
