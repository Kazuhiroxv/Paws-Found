/**
 * The full-name rule, as the server states it (api/helpers.php,
 * `validate_full_name()`), said sooner. Used by registration and the profile.
 *
 * Human names: letters from any language (with their accents), spaces,
 * apostrophes, hyphens and periods, and at least two letters. Not "first name
 * plus surname" — plenty of people have one name, or several.
 */
export const NAME_MAX = 120

/** Trimmed, with runs of spaces made one: how the server stores it. */
export const cleanName = (raw) => raw.replace(/\s+/g, ' ').trim()

/** What is wrong with a name, in the server's words, or null. */
export function nameProblem(raw) {
  const name = cleanName(raw)

  if (name === '') return 'Enter your name.'
  if ([...name].length > NAME_MAX) return 'That name is too long (120 characters maximum).'
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return 'Enter a real name with at least 2 letters.'
  if (!/^[\p{L}\p{M} '’.-]+$/u.test(name)) return 'Use letters, spaces, apostrophes, hyphens and periods only.'

  return null
}
