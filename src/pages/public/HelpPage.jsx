import { useEffect, useState } from 'react'
import {
  ChevronDown,
  Flag,
  HandHeart,
  Handshake,
  Info,
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
import { PROJECT_ADMINISTRATOR_NAME, PROJECT_CONTACT_EMAIL } from '@/constants'
import { t, tList } from '@/i18n'

/**
 * Every help topic: its id and icon. The words — title, summary and each
 * question with its answer — are `help.topics.<id>` in the dictionaries
 * (Correction 7), read when the page renders.
 *
 * Kept as data rather than markup so the topic cards at the top and the
 * sections below cannot fall out of step — they are built from the same list.
 */
const TOPIC_ICONS = [
  { id: 'reporting-lost', icon: TriangleAlert },
  { id: 'reporting-found', icon: HandHeart },
  { id: 'possible-matches', icon: Search },
  { id: 'verifying-ownership', icon: ShieldCheck },
  { id: 'safe-handovers', icon: Handshake },
  { id: 'privacy', icon: Lock },
  { id: 'reporting-abuse', icon: Flag },
  // Correction 7: what Paws&Found is — academic, no money, no affiliation.
  { id: 'about-service', icon: Info },
]

/** The topics in the language showing. */
function helpTopics() {
  return TOPIC_ICONS.map(({ id, icon }) => ({
    id,
    icon,
    title: t(`help.topics.${id}.title`),
    summary: t(`help.topics.${id}.summary`),
    faqs: tList(`help.topics.${id}.faqs`).map((faq) => ({
      q: faq.q,
      a: faq.a.replace('{name}', PROJECT_ADMINISTRATOR_NAME).replace('{email}', PROJECT_CONTACT_EMAIL),
    })),
  }))
}

/**
 * The four rules that matter most, lifted out of the FAQ.
 *
 * "Safe handovers" was topic five of seven, which buried the only advice on
 * this page that can keep somebody out of trouble. The page is called Help &
 * community safety; the safety half now has a band of its own rather than an
 * accordion halfway down.
 */
const SAFETY_RULES = [
  { icon: Users, key: 'public' },
  { icon: Sun, key: 'daylight' },
  { icon: KeyRound, key: 'holdBack' },
  { icon: MessageSquareOff, key: 'onPlatform' },
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
  'about-service': 'bg-warm-band',
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
  'about-service': 'bg-brand-soft text-brand',
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
  'about-service': 'text-brand',
}

/**
 * The search placeholder, sized to the field. The full example did not fit a
 * phone-width input and was cut off mid-word; shrinking the text to make it
 * fit would have made the field harder to read, so the words change instead.
 * 640px is Tailwind's `sm`, where the field is wide enough for the long one.
 */
const WIDE_ENOUGH = '(min-width: 640px)'
const PLACEHOLDER_LONG = 'help.placeholderLong'
const PLACEHOLDER_SHORT = 'help.placeholderShort'

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

  const allTopics = helpTopics()
  const topics = allTopics.filter(matches)

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
              {t('help.eyebrow')}
            </p>
            <PageHeader
              title={t('help.title')}
              description={t('help.description')}
              onArtwork
            />

            <label className="relative block">
              <span className="sr-only">{t('help.searchLabel')}</span>
              <Search
                size={18}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t(placeholder)}
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
          <nav aria-label={t('help.topicsLabel')}>
            <p className="sr-only" aria-live="polite">
              {needle
                ? t('help.topicsMatch', { count: topics.length, query })
                : t('help.topicsCount', { count: allTopics.length })}
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
            title={t('help.safetyTitle')}
            description={t('help.safetyBody')}
          />

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SAFETY_RULES.map((rule) => {
              const Icon = rule.icon

              return (
                <li
                  key={rule.key}
                  className="flex flex-col gap-3 rounded-card border border-border bg-panel p-5 shadow-card"
                >
                  <span className="flex size-11 items-center justify-center rounded-control bg-status-returned-soft text-success-ink">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="leading-snug font-semibold text-fg">{t(`help.rules.${rule.key}`)}</h3>
                  <p className="text-sm leading-relaxed text-fg-muted">{t(`help.rules.${rule.key}Body`)}</p>
                </li>
              )
            })}
          </ul>

          <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
            {t('help.custody')}
          </p>
        </Container>
      </section>

      {/* Seven sections, each one a heading with a 500px column of accordions
          under it — on a 1920px canvas that left two thirds of every section
          empty and made a two-question topic as tall as a five-question one.

          Now the section title, its sentence and its icon hold the left third
          and the questions have the rest. The height comes from the questions:
          `py-12` and nothing fixed beyond it, so a short topic is short. */}
      {allTopics.map((topic) => {
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
