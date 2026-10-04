import { useSyncExternalStore } from 'react'
import { getLanguage, setLanguage, subscribe } from './index.js'

/**
 * The language now showing, and the way to change it.
 *
 * `App` calls this, so a change re-renders every route in place: the page,
 * its form contents and the session all stay where they were.
 */
export function useLanguage() {
  const language = useSyncExternalStore(subscribe, getLanguage, getLanguage)
  return { language, setLanguage }
}
