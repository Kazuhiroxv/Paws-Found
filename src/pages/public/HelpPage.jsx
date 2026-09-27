import { useState } from 'react'
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
import helpIllustration from '@/assets/img-028-help-safety.webp'
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
        a: 'Only if you choose to share it. Otherwise the page offers to pass a message through Paws&Found instead.',
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

export function HelpPage() {
  const [query, setQuery] = useState('')
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
      {/* Three pages, three compositions, so none of them reads as a copy of
          another:
            About   — a warm cream band with the scene full-bleed behind the text
            Explore — a rounded tinted panel with the illustration faded in on
                      the right
            Help    — this: a pale teal band, the heading and search on the
                      left, and the illustration framed as a picture on the
                      right, like a page from a guide.
          Teal rather than cream because this page is instructions and safety,
          not the community story.

          The frame is a 4:3 slot sized for IMG-028b (1600×1200, see
          docs/image-requirements.md). Until that exists it crops the current
          IMG-028 banner to its right-hand scene. Hidden below `md`: on a phone
          the search and the answers matter more than a picture above them. */}
      <section className="relative isolate overflow-hidden border-b border-border bg-surface-alt">
        <PatternVeil />
        <Container className="grid items-center gap-8 py-10 sm:py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:py-14">
          <div className="flex min-w-0 flex-col gap-6">
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
                placeholder="Search help — try “collar”, “match” or “handover”"
                className="h-14 w-full rounded-control border border-border-strong bg-panel pr-4 pl-12 text-base text-fg shadow-raised placeholder:text-fg-muted"
              />
            </label>
          </div>

          <img
            src={helpIllustration}
            alt=""
            className="hidden aspect-4/3 w-full rounded-[1.25rem] bg-warm-band object-cover object-[80%_50%] shadow-raised ring-1 ring-black/5 md:block"
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
