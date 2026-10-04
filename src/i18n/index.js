/**
 * English and Filipino (Correction 7).
 *
 * One dictionary per language, the same keys in both (`npm run test:i18n`
 * compares them), and one function to read them: `t('nav.home')`. Nothing in
 * a component asks which language is showing; it asks for a key.
 *
 * The language is a presentation preference, not account state: it lives in
 * this browser (localStorage), defaults to English, and never reaches the
 * server. Stored values — `pending_review`, `lost`, `dog` — never change with
 * it; only the words they are shown with do.
 *
 * Why a module rather than only a React context: the label helpers in
 * `@/constants` (`REPORT_STATUS_LABELS[status]`, `speciesLabel()`) are plain
 * functions called from everywhere, and they must answer in the current
 * language too. `App` subscribes (`useLanguage`), so a change re-renders the
 * routes in place — same page, same form contents, nothing reloaded.
 */
import en from './en/index.js'
import fil from './fil/index.js'

export const DICTIONARIES = { en, fil }

/**
 * What the `lang` attribute says. `fil` is the ISO 639-2/639-3 code for
 * Filipino, the national language, and is a registered BCP 47 subtag;
 * `tl` is Tagalog, the language Filipino is based on. The interface is
 * written in Filipino, so it says `fil` (docs/localization.md).
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN', htmlLang: 'en', locale: 'en-PH' },
  { code: 'fil', label: 'Filipino', short: 'FIL', htmlLang: 'fil', locale: 'fil-PH' },
]

const STORAGE_KEY = 'paws:language'
const DEFAULT_LANGUAGE = 'en'

function readStoredLanguage() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    return DICTIONARIES[stored] ? stored : DEFAULT_LANGUAGE
  } catch {
    // A private window or blocked storage: English, every time.
    return DEFAULT_LANGUAGE
  }
}

let current = readStoredLanguage()
const listeners = new Set()

function applyHtmlLang() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = languageInfo().htmlLang
}

applyHtmlLang()

/** The language now showing: 'en' or 'fil'. */
export function getLanguage() {
  return current
}

/** Its code, label, `lang` attribute and the locale dates are formatted in. */
export function languageInfo(code = current) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0]
}

/** Switch language. Remembered in this browser; the page re-renders in place. */
export function setLanguage(code) {
  if (!DICTIONARIES[code] || code === current) return
  current = code
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, code)
  } catch {
    // Not remembered, but still switched for this visit.
  }
  applyHtmlLang()
  listeners.forEach((listener) => listener())
}

/** For useSyncExternalStore. */
export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function lookup(dictionary, key) {
  let node = dictionary
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined
    node = node[part]
  }
  return node
}

/** Whether a key exists — for labels that fall back to a stored name. */
export function hasKey(key) {
  return lookup(DICTIONARIES.en, key) !== undefined
}

function interpolate(text, vars) {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole))
}

/**
 * The words for a key in the current language, with `{name}` filled in.
 *
 * A key whose value is `{ one, other }` is a count: `vars.count` chooses.
 * Filipino rarely changes the noun, so its two are often the same; English
 * needs both ("1 record", "3 records").
 *
 * A key missing from Filipino falls back to English (never to a blank);
 * one missing from both returns the key itself, which the completeness check
 * would already have failed on.
 */
export function t(key, vars) {
  let value = lookup(DICTIONARIES[current], key)
  if (value === undefined) value = lookup(DICTIONARIES.en, key)
  if (value === undefined) return key

  if (value && typeof value === 'object' && 'other' in value) {
    value = vars?.count === 1 ? value.one : value.other
  }

  return typeof value === 'string' ? interpolate(value, vars) : value
}

/**
 * The raw value of a key — an array of paragraphs, a list of sections — for
 * the long pages (Privacy, Disclaimer, Help) whose content is structured.
 */
export function tList(key) {
  const value = t(key)
  return Array.isArray(value) ? value : []
}
