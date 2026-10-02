/**
 * The name rule, as the server states it (api/helpers.php,
 * `validate_name_part()`), said sooner. Used by registration and the profile.
 *
 * First name and last name are asked for separately since the post-defense
 * corrections (migration 008). Each: letters from any language with their
 * accents, plus spaces, apostrophes (straight or curly), hyphens and periods —
 * "Ma.", "Anne-Marie", "D'Angelo", "O’Connor", "Dela Cruz" — and at least two
 * letters, which refuses "A", "1", "!!!!" and "-" but allows "Jo" and "Li".
 *
 * Held to the PHP copy, case by case, by scripts/identity-rules.test.mjs.
 */
export const NAME_PART_MAX = 60

/** Trimmed, with runs of spaces made one: how the server stores it. */
export const cleanName = (raw) => raw.replace(/\s+/g, ' ').trim()

/**
 * What is wrong with a first or last name, in the server's words, or null.
 *
 * @param {string} raw
 * @param {'first' | 'last'} which
 */
export function nameProblem(raw, which = 'first') {
  const label = which === 'last' ? 'last name' : 'first name'
  const name = cleanName(raw)

  if (name === '') return `Enter your ${label}.`
  if ([...name].length > NAME_PART_MAX) return `That ${label} is too long (${NAME_PART_MAX} characters maximum).`
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return `Enter a real ${label} with at least 2 letters.`
  if (!/^[\p{L}\p{M} '’.-]+$/u.test(name)) return 'Use letters, spaces, apostrophes, hyphens and periods only.'

  return null
}
