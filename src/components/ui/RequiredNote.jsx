/**
 * Says what the asterisk means.
 *
 * Every required control in this system is marked with a red `*` (see
 * `Field`), and every form that has one assumed the reader already knew what
 * that meant. Plenty of people do not — it is a convention, not a word — and a
 * first-time visitor filing a report about a missing pet is not in the mood to
 * work it out.
 *
 * Deliberately one plain sentence above the fields rather than a footnote
 * below them: it is only useful before somebody starts filling the form in.
 */
export function RequiredNote({ className }) {
  return (
    <p className={className}>
      Fields marked{' '}
      <span className="font-medium text-danger" aria-hidden="true">
        *
      </span>
      <span className="sr-only">with an asterisk</span> are required. Everything else is optional.
    </p>
  )
}
