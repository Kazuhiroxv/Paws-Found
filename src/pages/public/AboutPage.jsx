import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  MapPin,
  PawPrint,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import aboutIntro from '@/assets/img-007-about-intro.jpg'
import aboutHero from '@/assets/img-029-about-community-hero.webp'
import { Container } from '@/components/ui'
import { PatternVeil } from '@/components/PatternVeil'
import { RouteOrnament } from '@/components/Ornament'
import { SectionHeading } from '@/components/SectionHeading'
import { t } from '@/i18n'

export function AboutPage() {
  return (
    // RootLayout pads <main>; this page runs its own full-bleed bands, so the
    // padding is cancelled and each section supplies its own.
    <div className="-my-8 flex flex-col">
      <AboutHero />
      <WhyItExists />
      <ProblemAndChange />
      <BuiltForHere />
      <WhoUsesIt />
      <StudentProject />
    </div>
  )
}

/**
 * The page's opening.
 *
 * About used to start on "Why Paws&Found exists", which is a chapter, not an
 * introduction — the page began mid-sentence while Explore and Help both
 * announced themselves. This says what the project is; the section below it
 * says why it was needed.
 *
 * Deliberately not built like Help. Help's band has a hard lower edge with a
 * search field straddling it, because Help is somewhere you do something.
 * Nothing here is a control: an eyebrow, a sentence set large, two lines of
 * explanation, and a band that dissolves into the page rather than ending on
 * an edge.
 */
function AboutHero() {
  return (
    <section className="relative isolate overflow-hidden bg-warm-band">
      {/* IMG-029 from `lg`, where the text is capped clear of the scene. The
          artwork's left half is open sky, which is where the words go. Below
          `lg` it is hidden and the band keeps the cream on its own — the
          neighbourhood is on the right-hand third and would sit under the
          heading at any narrower width. */}
      <img
        src={aboutHero}
        alt=""
        className="absolute inset-0 hidden size-full object-cover object-[72%_50%] lg:block"
        fetchPriority="high"
      />

      {/* The same scrim the homepage hero uses, for the same reason: IMG-029's
          bottom-left corner is a stand of dark leaves, and at 1366px the
          paragraph lands on them and reads 1.17:1. Lightening only the left
          fixes it without touching the picture. Measured at 390, 768, 1366 and
          1920 — see docs/design-system.md. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(253,247,236,0.97)_0%,rgba(253,247,236,0.94)_30%,rgba(253,247,236,0.70)_48%,rgba(253,247,236,0.22)_62%,transparent_74%)] lg:block"
      />

      {/* Hands the band back to the canvas instead of stopping on a line. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-surface"
      />

      <Container className="relative flex flex-col justify-center py-14 sm:py-16 lg:min-h-[24rem] lg:py-20">
        <div className="flex flex-col gap-5 lg:max-w-[52%]">
          <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">
            {t('about.eyebrow')}
          </p>
          <h1 className="text-[2.25rem] leading-[1.1] font-semibold tracking-tight text-balance text-fg sm:text-[2.75rem] lg:text-[3.25rem]">
            {t('about.title')}
          </h1>
          {/* `fg`, not `fg-muted`: the right end of this paragraph reaches the
              foliage at the left of IMG-029, which the scrim lightens but does
              not erase. Muted ink measured 3.02:1 there at 1366px. */}
          <p className="max-w-prose text-lg leading-relaxed text-fg">
            {t('about.lead')}
          </p>
        </div>
      </Container>
    </section>
  )
}

function WhyItExists() {
  // Scaled down now that the hero is above it: this is the first chapter of
  // the page, not a second opening.
  return (
    <section className="hero-ground relative isolate py-12 sm:py-16">
      <PatternVeil />
      <Container className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* A section heading, not a PageHeader: the hero above owns the
              page's only `h1` now, and two of them is the heading-order fault
              axe was catching before the redesign. */}
          <SectionHeading
            title={t('about.whyTitle')}
            description={t('about.whyBody')}
          />
          <p className="text-lg leading-relaxed text-fg-muted">
            {t('about.whyP1')}
          </p>
          <p className="text-lg leading-relaxed text-fg-muted">
            {t('about.whyP2')}
          </p>
        </div>

        <img
          src={aboutIntro}
          alt={t('about.introAlt')}
          // Capped at the width the source can actually fill. Left uncapped it
          // stretched to the full container between `sm` and `lg` and was being
          // upscaled past its 800px source.
          className="aspect-square w-full max-w-xs shrink-0 self-center rounded-[1.25rem] bg-surface-muted object-cover shadow-raised ring-1 ring-black/5 lg:w-[21rem] lg:max-w-none xl:w-[24rem]"
        />
      </Container>
    </section>
  )
}

// Keys, not words: each is read from `about.*` when the page renders.
const PROBLEMS = ['scattered', 'incomplete', 'hidden']

const CHANGES = [
  { icon: Scale, key: 'central' },
  { icon: MapPin, key: 'location' },
  { icon: Sparkles, key: 'matches' },
  { icon: ShieldCheck, key: 'verify' },
]

function ProblemAndChange() {
  return (
    <section className="relative isolate border-y border-border/60 bg-surface-alt py-12 sm:py-16">
      <PatternVeil />
      <Container className="flex flex-col gap-10">
        <SectionHeading
          title={t('about.changesTitle')}
          description={t('about.changesBody')}
          centered
        />

        <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-stretch lg:gap-6">
          {/* Centred against the taller column opposite: there are three
              problems and four answers, and top-aligning both left a column of
              nothing under the last problem. */}
          <div className="flex flex-1 flex-col gap-4 lg:justify-center">
            <h3 className="text-lg font-semibold text-fg-muted">{t('about.today')}</h3>
            <ul className="flex flex-col gap-3">
              {PROBLEMS.map((item) => (
                <li
                  key={item}
                  // Dashed and unlifted, against the solid, shadowed cards
                  // opposite. The two stacks were the same weight before, so
                  // nothing said which one was the problem and which was the
                  // answer.
                  className="rounded-card border border-dashed border-border-strong bg-surface-muted p-5"
                >
                  <p className="font-medium text-fg">{t(`about.problems.${item}`)}</p>
                  {/* `fg` rather than `fg-muted`: on `surface-muted` the muted
                      ink measures 4.30:1, under AA. Same fix the table header
                      labels already carry (design-system.md). */}
                  <p className="mt-1 text-fg">{t(`about.problems.${item}Body`)}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* One route running the height of both stacks, with the arrow on
              it, rather than a lone badge floating in the gap. Everything on
              the left crosses this line and becomes everything on the right —
              which is what the section is called. Turns horizontal, pointing
              down, once the columns stack. */}
          <div
            aria-hidden="true"
            className="relative flex shrink-0 items-center justify-center lg:w-14"
          >
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-border-strong lg:inset-x-auto lg:inset-y-4 lg:left-1/2 lg:-translate-x-1/2 lg:translate-y-0 lg:border-t-0 lg:border-l lg:border-dashed" />
            <span className="relative flex size-11 items-center justify-center rounded-full border border-border bg-panel text-brand shadow-card">
              <ArrowDown size={20} className="lg:hidden" />
              <ArrowRight size={20} className="hidden lg:block" />
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <h3 className="text-lg font-semibold text-fg">{t('about.withUs')}</h3>
            <ul className="flex flex-col gap-3">
              {CHANGES.map((item) => {
                const Icon = item.icon

                return (
                  <li
                    key={item.key}
                    className="flex gap-4 rounded-card border border-border bg-panel p-5 shadow-card"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-medium text-fg">{t(`about.changes.${item.key}`)}</p>
                      <p className="mt-1 text-fg-muted">{t(`about.changes.${item.key}Body`)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  )
}

/**
 * What "built for the Philippine community" actually means, as three things
 * the system does rather than one paragraph claiming it does them.
 *
 * The copy is the copy that was already in the section — it had been written
 * as two paragraphs beside a list of user roles, which is why the heading and
 * what sat under it were describing different subjects.
 */
const LOCAL_DESIGN = [
  { icon: MapPin, key: 'barangay' },
  { icon: PawPrint, key: 'terms' },
  { icon: Smartphone, key: 'mobile' },
]

const ROLES = ['members', 'coordinators', 'administrators']

/** How a report moves, in the order it happens (Correction 7). */
const FLOW = ['submit', 'review', 'publish', 'verify']

function BuiltForHere() {
  return (
    // The heading promised Philippine-specific design and the section under it
    // explained user roles — two different subjects sharing one title. The
    // three principles now answer the heading, and the roles have a section of
    // their own below.
    <section className="relative isolate overflow-hidden py-12 sm:py-16">
      <RouteOrnament tone="teal" size={620} className="-top-24 -right-40 rotate-6" />
      <Container className="flex flex-col gap-10">
        <SectionHeading
          title={t('about.localTitle')}
          description={t('about.localBody')}
          centered
        />

        <ul className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          {LOCAL_DESIGN.map((item) => {
            const Icon = item.icon

            return (
              <li key={item.key} className="flex flex-col items-center gap-3 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon size={26} aria-hidden="true" strokeWidth={1.75} />
                </span>
                <h3 className="text-lg font-semibold text-fg">{t(`about.local.${item.key}`)}</h3>
                <p className="max-w-xs leading-relaxed text-fg-muted">{t(`about.local.${item.key}Body`)}</p>
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}

function WhoUsesIt() {
  return (
    <section className="border-t border-border/60 bg-surface-alt py-10 sm:py-12">
      <Container className="flex flex-col gap-6">
        <SectionHeading
          title={t('about.rolesTitle')}
          description={t('about.rolesBody')}
        />

        <ul className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((role) => (
            <li key={role} className="rounded-card border border-border bg-panel p-5 shadow-card">
              <p className="font-medium text-fg">{t(`about.roles.${role}`)}</p>
              <p className="mt-1 text-fg-muted">{t(`about.roles.${role}Body`)}</p>
            </li>
          ))}
        </ul>

        {/* Correction 7: the order a report moves in, now that the review
            belongs to the Pet Coordinator alone. */}
        <div className="flex flex-col gap-3" data-about-flow="">
          <h3 className="text-lg font-semibold text-fg">{t('about.flowTitle')}</h3>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-card border border-border bg-panel p-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-fg-inverted">
                  {index + 1}
                </span>
                <span className="text-fg">{t(`about.flow.${step}`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  )
}

function StudentProject() {
  return (
    <section className="closing-ground relative isolate bg-surface-alt py-9 sm:py-10">
      <PatternVeil />
      <Container width="prose" className="flex flex-col gap-3 text-center">
        <h2 className="text-xl font-semibold text-fg">{t('about.buildTitle')}</h2>
        <p className="text-fg-muted">{t('about.buildBody')}</p>
        {/* Correction 7: academic, non-commercial, no money, no affiliation —
            and where to read the rest. */}
        <p className="text-fg-muted" data-about-academic="">
          {t('about.academic')}{' '}
          <Link to="/disclaimer" className="font-medium text-brand underline">
            {t('about.readDisclaimer')}
          </Link>
          {' · '}
          <Link to="/help" className="font-medium text-brand underline">
            {t('about.readSafety')}
          </Link>
        </p>
      </Container>
    </section>
  )
}
