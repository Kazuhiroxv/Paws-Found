import { t } from '@/i18n'
/**
 * The password rule, as the server states it (api/helpers.php,
 * `password_policy_error()`), said sooner.
 *
 * Kept here so the form and the API cannot drift, and held to the PHP copy by
 * scripts/report-form-contract.test.mjs. The server still decides.
 *
 *   - at least 15 characters
 *   - at most 72 BYTES: bcrypt ignores everything past 72 bytes, and an
 *     accented letter or an emoji is more than one, so this counts bytes
 *   - not one of the obvious long passwords (a local list of high-risk
 *     choices, not a database of breached passwords)
 *   - at registration, not simply the person's email address, and not
 *     containing their first or last name anywhere (see `namePieces`)
 *
 * No rule about capitals, digits or symbols: those produce "Password1!", and
 * length does more. The strength label below is guidance only; the checks are
 * what decide.
 */
export const PASSWORD_RULES = { min: 15, maxBytes: 72 }

/** The same list as COMMON_PASSWORD_WORDS in api/helpers.php. */
export const COMMON_PASSWORD_WORDS = [
  'password', 'passw0rd', 'qwerty', 'qwertyuiop', 'asdfgh', 'zxcvbn', 'iloveyou', 'letmein',
  'admin', 'administrator', 'welcome', 'abc123', 'monkey', 'dragon', 'football', 'baseball',
  'sunshine', 'princess', 'master', 'shadow', 'superman', 'batman', 'trustno1', 'hello',
  'freedom', 'whatever', 'qazwsx', 'starwars', 'pokemon', 'secret', 'changeme', 'login',
  'user', 'test', 'guest', 'default', 'pawsandfound', 'pawsfound', 'paws', 'mahalkita',
]

const RUNS = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm']
const LOOK_ALIKE = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' }

export const utf8Bytes = (value) => new TextEncoder().encode(value).length

const lettersAndDigits = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const readLookAlike = (value) => value.replace(/[013457]/g, (digit) => LOOK_ALIKE[digit])
const onlyDigits = (value) => /^[0-9]+$/.test(value)

/**
 * A long password that is still one of the obvious ones: one piece repeated,
 * a straight run along the digits, alphabet or keyboard, or a common word with
 * nothing but digits added. Narrow on purpose, so it never refuses a real
 * passphrase ("password-after-lock" is fine; "passwordpassword" is not).
 */
export function isCommonPassword(password) {
  const plain = lettersAndDigits(password.toLowerCase().replace(/@/g, 'a').replace(/\$/g, 's'))
  if (plain === '') return false

  if (/^(.+?)\1+$/u.test(plain)) return true

  for (const run of RUNS) {
    const loop = run.repeat(Math.floor(plain.length / run.length) + 2)
    if (loop.includes(plain) || [...loop].reverse().join('').includes(plain)) return true
  }

  return COMMON_PASSWORD_WORDS.some((word) => {
    if (plain.length <= word.length) return false
    const wordRead = readLookAlike(word)
    return (
      (readLookAlike(plain.slice(0, word.length)) === wordRead && onlyDigits(plain.slice(word.length))) ||
      (readLookAlike(plain.slice(-word.length)) === wordRead && onlyDigits(plain.slice(0, -word.length)))
    )
  })
}

/** Exactly the person's email or its part before the @ — an equality rule. */
function isEmail(password, { email = '' } = {}) {
  const mine = lettersAndDigits(password)
  const address = email.trim().toLowerCase()
  const identity = [address, lettersAndDigits(address), lettersAndDigits(address.split('@')[0])].filter(Boolean)
  return identity.includes(password.toLowerCase()) || (mine !== '' && identity.includes(mine))
}

/**
 * The pieces of a person's name a password may not contain: each name split
 * on anything that is not a letter, lower-cased, pieces of two letters or more.
 * "Anne-Marie" gives "anne" and "marie"; "Dela Cruz" gives "dela" and "cruz".
 * The same as `password_name_pieces()` in api/helpers.php.
 */
export function namePieces({ firstName = '', lastName = '' } = {}) {
  const pieces = [firstName, lastName]
    .flatMap((name) => name.toLowerCase().split(/[^\p{L}\p{M}]+/u))
    .filter((piece) => [...piece].length >= 2)
  return [...new Set(pieces)]
}

/**
 * Does the password contain the first or last name anywhere, ignoring case?
 * A substring rule by instructor requirement: for "Ja", "123jaabcdefghijk" is
 * refused. Deterministic — no misspellings, no look-alikes.
 */
function containsName(password, identity) {
  const lowered = password.toLowerCase()
  return namePieces(identity).some((piece) => lowered.includes(piece))
}

/**
 * The requirements, each one met or not.
 *
 * @param {{ confirm?: boolean, identity?: { email: string, firstName: string, lastName: string } | null }} [options]
 *   `identity` only where the form knows who is choosing (registration); a
 *   reset link does not, and the server checks it there against the account.
 */
export function passwordChecks(password, confirmation, { confirm = true, identity = null } = {}) {
  const typed = password !== ''
  const checks = [
    { id: 'min', label: t('password.min', { min: PASSWORD_RULES.min }), met: [...password].length >= PASSWORD_RULES.min },
    {
      id: 'max',
      label: t('password.max', { max: PASSWORD_RULES.maxBytes }),
      met: typed && utf8Bytes(password) <= PASSWORD_RULES.maxBytes,
    },
    { id: 'common', label: t('password.common'), met: typed && !isCommonPassword(password) },
  ]

  if (identity) {
    checks.push({
      id: 'name',
      label: t('password.name'),
      met: typed && !containsName(password, identity),
    })
    checks.push({ id: 'email', label: t('password.email'), met: typed && !isEmail(password, identity) })
  }
  if (confirm) {
    checks.push({ id: 'match', label: t('password.match'), met: typed && password === confirmation })
  }

  return checks
}

/**
 * Every requirement met, apart from the confirmation matching. The point at
 * which the Confirm password box may appear (instructor requirement), and the
 * test for clearing it again if the password stops being acceptable.
 */
export function passwordRequirementsMet(password, { identity = null } = {}) {
  return passwordChecks(password, '', { confirm: false, identity }).every((check) => check.met)
}

/**
 * Guidance, never a second rule: 'weak' while a requirement is not met,
 * 'fair' once every one is (and fair may be submitted), 'strong' when it is
 * also long or varied. Null before anything is typed.
 *
 * Strong: every requirement met, at least 8 different characters, and either
 * 20+ characters, or 16+ with three kinds of character among lower case,
 * upper case, digits and everything else (spaces, punctuation).
 */
export function passwordStrength(password, { identity = null } = {}) {
  if (password === '') return null

  const requirements = passwordChecks(password, '', { confirm: false, identity })
  if (!requirements.every((check) => check.met)) return 'weak'

  const characters = [...password]
  const kinds = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((kind) => kind.test(password)).length
  const varied = new Set(characters).size >= 8

  if (varied && (characters.length >= 20 || (characters.length >= 16 && kinds >= 3))) return 'strong'
  return 'fair'
}
