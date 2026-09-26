import { Heart, Scale, ShieldCheck } from 'lucide-react'
import authImage from '@/assets/img-017-auth-community.jpg'
import { Container } from '@/components/ui'
import { PatternVeil } from '@/components/PatternVeil'

/**
 * Three things this system actually does, beside the form that gets you into
 * it. Each one is a claim the rest of the application can be held to.
 */
const REASONS = [
  {
    icon: Heart,
    title: 'A kinder community',
    body: 'Neighbours looking out for each other’s pets, in one place.',
  },
  {
    icon: Scale,
    title: 'Every match explains itself',
    body: 'You see which details lined up, and which did not.',
  },
  {
    icon: ShieldCheck,
    title: 'A coordinator checks first',
    body: 'Ownership is verified before a handover is arranged.',
  },
]

/**
 * The frame around signing in and registering.
 *
 * The story is on the left and the form on the right, which is the way round
 * the reference design has it and the way round that works: the eye lands on
 * the claim, then travels to the thing that acts on it. The form used to be
 * on the left with the photograph as a tall afterthought beside it.
 *
 * The form column is capped at 30rem and the story column takes the rest, so
 * the page reads as a welcome with a form in it rather than a form with a
 * picture stuck to one side.
 *
 * Nothing is written on top of the photograph. The reference lays its headline
 * over the artwork; a photograph cannot promise its own contrast, so the words
 * sit on the canvas above it instead and the picture carries no text at all.
 *
 * Below `lg` the whole story column is dropped rather than stacked. On a phone
 * it would push the form under the fold, and somebody opening this page came
 * to sign in.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children  The form column.
 */
export function AuthShell({ children }) {
  return (
    <Container className="relative isolate grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-16">
      <PatternVeil className="-top-8 h-80" />

      <div className="hidden min-w-0 flex-col gap-7 lg:flex">
        <h2 className="text-[2.5rem] leading-[1.06] font-semibold tracking-tight text-balance text-fg">
          Together, we help lost pets <span className="text-brand">find their way home.</span>
        </h2>

        <ul className="flex flex-col gap-4">
          {REASONS.map((reason) => {
            const Icon = reason.icon

            return (
              <li key={reason.title} className="flex items-start gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold text-fg">{reason.title}</span>
                  <span className="text-fg-muted">{reason.body}</span>
                </span>
              </li>
            )
          })}
        </ul>

        <img
          src={authImage}
          alt="A cat at the open door of a home, with somebody crouched beside it."
          width="1200"
          height="900"
          loading="lazy"
          decoding="async"
          className="h-72 w-full rounded-[1.25rem] object-cover shadow-raised ring-1 ring-black/5 xl:h-80"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </Container>
  )
}
