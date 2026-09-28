import { useEffect, useState } from 'react'
import {
  ChevronDown,
  Flag,
  HandHeart,
  Handshake,
  KeyRound,
  Lock,
  MessageSquareOff,
  Search,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Users,
} from 'lucide-react'
import helpHero from '@/assets/img-028b-help-hero.webp'
import { Container } from '@/components/ui'
import { PatternVeil } from '@/components/PatternVeil'
import { PageHeader } from '@/components/PageHeader'
import { SectionHeading } from '@/components/SectionHeading'

/**
 * Every help topic, with its questions.
 *
 * Kept as data rather than markup so the topic cards at the top and the
 * sections below cannot fall out of step — they are built from the same list.
 */
const TOPICS = [
  {
    id: 'reporting-lost',
    icon: TriangleAlert,
    title: 'Reporting a lost pet',
    summary: 'What to include so a stranger can recognise your pet.',
    faqs: [
      {
        q: 'What details actually help?',
        a: 'The ones a stranger could check on the spot: colour and markings, size, collar, and anything unusual such as a scar, a bent ear or a short tail. Give the area rather than an exact address, plus the date and approximate time.',
      },
      {
        q: 'Do I need a photo?',
        a: 'No, but it is the single most useful thing you can add. A clear, well-lit picture of the whole animal is what people recognise, and what a coordinator compares against a found report.',
      },
      {
        q: 'Can I edit a report after filing it?',
        a: 'Yes. Your reports are listed in My Reports, and you can update the details or mark the pet returned at any time.',
      },
    ],
  },
  {
    id: 'reporting-found',
    icon: HandHeart,
    title: 'Reporting a found pet',
    summary: 'Filing a sighting, even with nothing to go on.',
    faqs: [
      {
        q: 'The pet has no collar and no name. Can I still report it?',
        a: 'Yes. A found report never asks for a pet name — the finder is not expected to know it. Species, colour, size and where you found it are enough to be useful.',
      },
      {
        q: 'Should I include everything I noticed?',
        a: 'Almost. Keep one identifying detail to yourself — something only the real owner would know — so ownership can be checked later. Everything else helps.',
      },
    ],
  },
  {
    id: 'possible-matches',
    icon: Search,
    title: 'Possible matches',
    summary: 'What a match suggestion is, and what it is not.',
    faqs: [
      {
        q: 'How does the system find a match?',
        a: 'It compares structured details between a lost and a found report: species, breed, colour, size, how close the two locations are, how close the dates are, and distinctive characteristics. There is no image recognition and no AI involved.',
      },
      {
        q: 'Does a possible match mean you found my pet?',
        a: 'No. A possible match is a suggestion, never a conclusion. Every match shows exactly which details lined up and which did not, so you can judge it yourself.',
      },
    ],
  },
  {
    id: 'verifying-ownership',
    icon: ShieldCheck,
    title: 'Verifying ownership',
    summary: 'How a claim is checked before anything is arranged.',
    faqs: [
      {
        q: 'What happens after I respond to a match?',
        a: 'The match goes to a Pet Coordinator, who compares both reports and helps confirm ownership before a handover is coordinated. Confirming a match closes both reports as returned.',
      },
      {
        q: 'What counts as proof of ownership?',
        a: 'Earlier photographs, veterinary records, or a description of a detail that was never published — which is why finders are asked to hold one back.',
      },
      {
        q: 'Who can see verification information?',
        a: 'Only the coordinator handling the case. It is never shown on a public report page.',
      },
    ],
  },
  {
    id: 'safe-handovers',
    icon: Handshake,
    title: 'Safe handovers',
    summary: 'Meeting someone to return or collect a pet.',
    faqs: [
      {
        q: 'Where should we meet?',
        a: 'A public place, during daylight, with someone else along. There is no reason a handover needs to happen at anybody’s home.',
      },
      {
        q: 'What should make me cautious?',
        a: 'Anyone who claims a pet without being able to describe it, who cannot answer a question about a detail that was never published, or who pushes to move the conversation off the platform.',
      },
    ],
  },
  {
    id: 'privacy',
    icon: Lock,
    title: 'Privacy',
    summary: 'What a public report page shows about you.',
    faqs: [
      {
        q: 'Is my phone number or email shown?',
        a: 'Only if you choose to share it, report by report. Otherwise the report says you prefer to be reached through a Pet Coordinator, who can see how to contact you when checking a possible match. There is no messaging between members.',
      },
      {
        q: 'Does the map show where I live?',
        a: 'No. Report locations are approximate areas, not addresses, and the detail page draws a circle around the pin so the imprecision is visible rather than implied.',
      },
    ],
  },
  {
    id: 'reporting-abuse',
    icon: Flag,
    title: 'Reporting abuse',
    summary: 'Flagging a listing that should not be there.',
    faqs: [
      {
        q: 'How do I report a listing?',
        a: 'Every report page has a “Report this listing” action. You will be asked to pick a reason: false report, spam, scam, harassment, inappropriate content, duplicate report, or other.',
      },
      {
        q: 'What happens to a flag?',
        a: 'It goes to an administrator for review. They can dismiss it, remove the content, warn the user, or suspend the account.',
      },
    ],
  },
]

/**
 * The four rules that matter most, lifted out of the FAQ.
 *
 * "Safe handovers" was topic five of seven, which buried the only advice on
 * this page that can keep somebody out of trouble. The page is called Help &
 * community safety; the safety half now has a band of its own rather than an
 * accordion halfway down.
 */
const SAFETY_RULES = [
  {
    icon: Users,
    title: 'Meet in public, and bring someone',
    body: 'A barangay hall, a vet clinic, a busy café. There is no reason a handover has to happen at anybody’s home.',
  },
  {
    icon: Sun,
    title: 'Daylight only',
    body: 'Arrange it for a time when the place you have chosen is open and there are other people around.',
  },
  {
    icon: KeyRound,
    title: 'Hold one detail back',
    body: 'If you found a pet, keep one identifying mark to yourself. The real owner will be able to name it.',
  },
  {
    icon: MessageSquareOff,
    title: 'Keep it on Paws&Found',
    body: 'Anyone pushing to move the conversation somewhere private before ownership is settled is a reason to slow down.',
  },
]

/**
 * The ground each topic section stands on, in page order.
 *
 * Not alternating two colours: three, cycled so that no two neighbours share
 * one and the eye registers "this is a different subject" on the way down.
 * Kept here rather than computed from the index so re-ordering TOPICS cannot
 * silently put two identical grounds next to each other.
 */
const TOPIC_GROUNDS = {
  'reporting-lost': 'bg-warm-band',
  'reporting-found': 'bg-surface-alt',
  'possible-matches': '',
  'verifying-ownership': 'bg-surface-alt',
  'safe-handovers': 'bg-warm-band',
  privacy: 'bg-surface-alt',
  'reporting-abuse': '',
}

/**
 * Topics are tinted by what they are about — filing, matching, or staying safe
 * — rather than all seven sharing one teal. Seven identical cards gave the eye
 * nothing to sort them by.
 */
const TOPIC_TINTS = {
  'reporting-lost': 'bg-accent-soft text-lost',
  'reporting-found': 'bg-found-soft text-found',
  'possible-matches': 'bg-brand-soft text-brand',
  'verifying-ownership': 'bg-brand-soft text-brand',
  'safe-handovers': 'bg-status-returned-soft text-success-ink',
  privacy: 'bg-status-returned-soft text-success-ink',
  'reporting-abuse': 'bg-danger-soft text-danger-hover',
}

/**
 * The same sorting, as ink rather than a chip: the section icon at the head of
 * each topic is drawn large and unboxed, so it needs a colour and no fill. The
 * pairs match TOPIC_TINTS above — a topic must not be amber in the card list
 * and teal in its own section.
 */
const TOPIC_ICON_INK = {
  'reporting-lost': 'text-lost',
  'reporting-found': 'text-found',
  'possible-matches': 'text-brand',
  'verifying-ownership': 'text-brand',
  'safe-handovers': 'text-success-ink',
  privacy: 'text-success-ink',
  'reporting-abuse': 'text-danger-hover',
}

/**
 * The search placeholder, sized to the field. The full example did not fit a
 * phone-width input and was cut off mid-word; shrinking the text to make it
 * fit would have made the field harder to read, so the words change instead.
 * 640px is Tailwind's `sm`, where the field is wide enough for the long one.
 */
const WIDE_ENOUGH = '(min-width: 640px)'
const PLACEHOLDER_LONG = 'Search help topics, e.g. collar, match or handover'
const PLACEHOLDER_SHORT = 'Search help topics'

function useSearchPlaceholder() {
  const [isWide, setIsWide] = useState(() => window.matchMedia(WIDE_ENOUGH).matches)

  useEffect(() => {
    const query = window.matchMedia(WIDE_ENOUGH)
    const update = () => setIsWide(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return isWide ? PLACEHOLDER_LONG : PLACEHOLDER_SHORT
}

export function HelpPage() {
  const [query, setQuery] = useState('')
  const placeholder = useSearchPlaceholder()
  const needle = query.trim().toLowerCase()

  // Matches a topic by its own words or by any of its questions, so typing
  // "collar" finds the question rather than nothing.
  const matches = (topic) =>
    !needle ||
    [topic.title, topic.summary, ...topic.faqs.flatMap((faq) => [faq.q, faq.a])]
      .join(' ')
      .toLowerCase()
      .includes(needle)

  const topics = TOPICS.filter(matches)

  return (
    <div className="-my-8 flex flex-col">
      {/* IMG-028b, the Help hero, drawn for this page: a wide scene with the
          left 45% left empty for the heading, and a man greeting a cat on the
          right. It carries no text; the heading, copy and search are the
          page's own, so they stay selectable, translatable and readable by a
          screen reader.

          The same family as About (a full-bleed illustrated band with the
          words on the open side of the picture) but not a copy of it: a
          different scene, the search field in the hero, and teal carrying the
          accents where About's are warm.

          From `lg` the art is the band itself. Its source is 3:1 and the band
          is always wider than 3:1 at these sizes, so `object-cover` trims only
          a little top and bottom and never the sides; the floor heights keep
          the man's head and the cat's feet inside the frame at 1024-1920px.
          Below `lg` the words come first in normal flow and the art follows as
          its own picture, cropped to the man and the cat. The whole 3:1 image
          at 390px would make them a few pixels tall. */}
      <section className="relative isolate overflow-hidden border-b border-border bg-warm-band">
        <img
          src={helpHero}
          alt=""
          className="absolute inset-0 hidden size-full object-cover object-[80%_55%] lg:block"
          fetchPriority="high"
        />
        {/* A light hand on the left only, for the route ribbon and the leaves
            that drift under the paragraph at some widths. Gone before the
            scene begins, so the artwork keeps its own colours. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(253,247,236,0.92)_0%,rgba(253,247,236,0.82)_32%,rgba(253,247,236,0.35)_46%,transparent_58%)] lg:block"
        />

        <Container className="relative flex flex-col justify-center gap-8 py-10 sm:py-12 lg:min-h-[26rem] lg:py-14 xl:min-h-[30rem]">
          <div className="flex min-w-0 flex-col gap-6 lg:max-w-[40%]">
            <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">
              Guidance &amp; safety
            </p>
            <PageHeader
              title="Help & community safety"
              description="How to file a report that helps, how a match is checked, and how to stay safe arranging a handover."
              onArtwork
            />

            <label className="relative block">
              <span className="sr-only">Search help</span>
              <Search
                size={18}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                className="h-14 w-full rounded-control border border-border-strong bg-panel pr-4 pl-12 text-base text-fg shadow-raised placeholder:text-fg-muted"
              />
            </label>
          </div>

          {/* Phones and tablets: the scene as its own picture, below the words.
              5:4 on a phone and 16:9 from `sm` both keep x ~1075-2000 of the
              source, where the cat and the man are. */}
          <img
            src={helpHero}
            alt=""
            className="aspect-5/4 w-full rounded-card object-cover object-[92%_55%] sm:aspect-video lg:hidden"
          />
        </Container>
      </section>

      <section className="hero-ground relative isolate border-b border-border pt-10 pb-12">
        <PatternVeil />
        <Container className="flex flex-col gap-10">
          {/* Jump links rather than a search box: with seven topics, scanning
              them is faster than typing, and there is no index to search. */}
          <nav aria-label="Help topics">
            <p className="sr-only" aria-live="polite">
              {needle
                ? `${topics.length} ${topics.length === 1 ? 'topic' : 'topics'} match ${query}`
                : `${TOPICS.length} topics`}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => {
                const Icon = topic.icon

                return (
                  <li key={topic.id}>
                    <a
                      href={`#${topic.id}`}
                      className="card-interactive flex h-full gap-4 rounded-card border border-border bg-panel p-5 shadow-card"
                    >
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-control ${TOPIC_TINTS[topic.id]}`}
                      >
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="font-medium text-fg">{topic.title}</span>
                        <span className="text-sm text-fg-muted">{topic.summary}</span>
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        </Container>
      </section>

      {/* Safety, given the weight the page title promises it. */}
      <section className="relative isolate border-b border-border bg-surface-alt py-12 sm:py-16">
        <PatternVeil />
        <Container className="flex flex-col gap-8">
          <SectionHeading
            title="Before you meet anyone"
            description="Four things worth settling before a handover is arranged. They apply whether you are collecting a pet or returning one."
          />

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SAFETY_RULES.map((rule) => {
              const Icon = rule.icon

              return (
                <li
                  key={rule.title}
                  className="flex flex-col gap-3 rounded-card border border-border bg-panel p-5 shadow-card"
                >
                  <span className="flex size-11 items-center justify-center rounded-control bg-status-returned-soft text-success-ink">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="leading-snug font-semibold text-fg">{rule.title}</h3>
                  <p className="text-sm leading-relaxed text-fg-muted">{rule.body}</p>
                </li>
              )
            })}
          </ul>

          <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
            Paws&amp;Found does not take custody of any animal and does not attend handovers. A Pet
            Coordinator helps confirm ownership before contact details are exchanged, but the
            meeting itself is between the two of you — which is why these four are worth reading.
          </p>
        </Container>
      </section>

      {/* Seven sections, each one a heading with a 500px column of accordions
          under it — on a 1920px canvas that left two thirds of every section
          empty and made a two-question topic as tall as a five-question one.

          Now the section title, its sentence and its icon hold the left third
          and the questions have the rest. The height comes from the questions:
          `py-12` and nothing fixed beyond it, so a short topic is short. */}
      {TOPICS.map((topic) => {
        const Icon = topic.icon

        return (
          <section
            key={topic.id}
            id={topic.id}
            // Clears the sticky navbar when jumped to from the list above.
            className={`scroll-mt-24 border-b border-border/60 py-12 ${TOPIC_GROUNDS[topic.id]}`}
          >
            <Container className="grid gap-8 lg:grid-cols-[35fr_65fr] lg:gap-12">
              <div className="flex flex-col gap-4">
                <Icon
                  size={40}
                  aria-hidden="true"
                  className={`shrink-0 ${TOPIC_ICON_INK[topic.id]}`}
                  strokeWidth={1.5}
                />
                <SectionHeading title={topic.title} description={topic.summary} />
              </div>

              <ul className="flex flex-col gap-3">
                {topic.faqs.map((faq) => (
                  <li key={faq.q}>
                    <Faq question={faq.q} answer={faq.a} />
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        )
      })}
    </div>
  )
}

/**
 * One question and its answer.
 *
 * Native `<details>` — it opens, closes, is keyboard operable and is announced
 * correctly without a line of JavaScript or a component library.
 */
function Faq({ question, answer }) {
  return (
    <details className="group rounded-card border border-border bg-panel shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-medium text-fg [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="shrink-0 text-fg-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <p className="px-5 pb-5 text-fg-muted">{answer}</p>
    </details>
  )
}
