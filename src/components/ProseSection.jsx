import { SectionHeading } from '@/components/SectionHeading'

/**
 * A titled section of a long reading page — the Privacy Notice and the
 * Disclaimer. Moved out of the Privacy page when the Disclaimer needed the
 * same two pieces (Correction 7).
 */
export function ProseSection({ id, title, children }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <SectionHeading title={title} />
      <div className="flex flex-col gap-4 leading-relaxed text-fg-muted">{children}</div>
    </section>
  )
}

/** A plain bulleted list of sentences. */
export function ProseList({ items }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
