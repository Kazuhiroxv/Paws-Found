import { CircleCheck, Lightbulb, Lock } from 'lucide-react'
import { REPORT_TYPES } from '@/constants'

/**
 * What makes a report worth filing, beside the form that files it.
 *
 * The wizard validates; this teaches. They are different jobs, and the form
 * was doing only the first — somebody could fill every required field
 * correctly and still write "brown dog, lost yesterday", which passes
 * validation and helps nobody.
 *
 * Every tip here is about information the system genuinely uses: the matching
 * algorithm compares species, breed, colour, size, location and date, and
 * weights distinctive features. Nothing on this panel describes a capability
 * the system does not have.
 *
 * @param {Object} props
 * @param {'lost'|'found'} props.reportType
 */
export function ReportGuidance({ reportType }) {
  const isFound = reportType === REPORT_TYPES.FOUND
  const tips = isFound ? FOUND_TIPS : LOST_TIPS

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
      <section className="flex flex-col gap-3 rounded-card border border-accent/25 bg-warm-band p-5">
        <h2 className="flex items-center gap-2 font-semibold text-fg">
          <Lightbulb size={18} className="shrink-0 text-accent-hover" aria-hidden="true" />
          What makes a report work
        </h2>

        <ul className="flex flex-col gap-2.5 text-sm text-fg-muted">
          {tips.map((tip) => (
            <li key={tip} className="flex gap-2.5">
              <CircleCheck
                size={16}
                className="mt-0.5 shrink-0 text-accent-hover"
                aria-hidden="true"
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Two descriptions of the same animal. Telling somebody to "be
          specific" is advice; showing them the difference is a worked example,
          and it costs four lines. */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-panel p-5">
        <h2 className="font-semibold text-fg">The difference it makes</h2>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-fg-muted">Hard to match</p>
          <blockquote className="rounded-control border border-border bg-sunken px-3 py-2 text-sm text-fg-muted italic">
            “Brown dog, {isFound ? 'found' : 'lost'} yesterday.”
          </blockquote>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-fg">Easy to match</p>
          <blockquote className="rounded-control border border-brand/25 bg-brand-soft px-3 py-2 text-sm text-fg">
            {isFound
              ? '“Medium brown aspin, white patch on the chest and a torn left ear. Wearing a red collar with no tag. Came to our gate on Maginhawa Street around 7am.”'
              : '“Medium brown aspin, white patch on the chest and a torn left ear. Wearing a red collar with a bone-shaped tag. Slipped out of the gate on Maginhawa Street around 7am.”'}
          </blockquote>
        </div>

        <p className="text-sm text-fg-muted">
          The second one names things only this animal has. That is what a possible match is
          built from.
        </p>
      </section>

      <p className="flex items-start gap-2.5 px-1 text-sm text-fg-muted">
        <Lock size={16} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden="true" />
        <span>
          Your name appears on the report. Your phone number and email address do not, unless
          you choose to share them on the next step.
        </span>
      </p>
    </aside>
  )
}

const LOST_TIPS = [
  'Use a recent photograph, taken in daylight if you have one. It is the first thing anyone looks at.',
  'Name the markings only your pet has — a scar, a torn ear, an odd patch of colour. These are weighted most heavily when reports are compared.',
  'Say what your pet was wearing: collar, colour, tag.',
  'Give the area and the nearest landmark rather than your address. Reports are compared by how close they are to each other.',
  'Get the date and approximate time as right as you can. A day either way changes which found reports are worth comparing.',
]

const FOUND_TIPS = [
  'Photograph the animal from the front and the side if it will let you. An owner recognises a face.',
  'Describe markings before breed. Most people guess the breed wrong, and an honest guess is fine — the markings are what match.',
  'Note the collar, the tag, and anything written on it. Do not publish a phone number you read on a tag.',
  'Give the area and the nearest landmark where you found them, not your home address.',
  'Say what condition they were in — thin, limping, frightened. It helps an owner know it is theirs.',
]
