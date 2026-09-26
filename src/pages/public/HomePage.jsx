import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bird,
  Cat,
  ClipboardList,
  Dog,
  Eye,
  Handshake,
  Heart,
  Lock,
  MapPin,
  PawPrint,
  Rabbit,
  Scale,
  Search,
  SearchCheck,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import heroImage from '@/assets/img-027-homepage-reunion.webp'
import heroEnvironment from '@/assets/img-018-hero-environment.webp'
import reunionImage from '@/assets/img-015-reunion-home.jpg'
import emptyReportsImage from '@/assets/empty-no-reports.png'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, Container, EmptyState, LoadingSkeleton, Select } from '@/components/ui'
import { PatternVeil, WovenVeil } from '@/components/PatternVeil'
import { RadarOrnament, RouteOrnament } from '@/components/Ornament'
import { SectionCurve } from '@/components/SectionCurve'
import { PetCard } from '@/components/PetCard'
import { SectionHeading } from '@/components/SectionHeading'
import { REPORT_STATUSES, REPORT_TYPE_LABELS, speciesLabel } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { categoryService, petService } from '@/services'
import { optionsFromLabels } from '@/utils/options'
import { formatDate } from '@/utils/date'
import { cn } from '@/utils/cn'

/**
 * Public homepage.
 *
 * This is the page a stranger lands on while their pet is missing, so it leads
 * with the two things they might need to do and proves the system works —
 * real recent reports, real reunions — rather than describing itself.
 *
 * The composition, top to bottom: an urgent line, one raised panel holding the
 * headline, the photograph, what the system promises and the search; a row of
 * species to jump straight into; then chapters that alternate between the warm
 * canvas, a pale teal band and a warm cream one. Everything on it is drawn from
 * the real reports — there are no invented numbers and no invented testimonials.
 */
export function HomePage() {
  return (
    <>
      <title>Paws&Found — Lost and Found Pets</title>

      {/* RootLayout pads <main>; the homepage runs its own full-bleed bands
          right up to the header and footer, so that padding is cancelled. */}
      <div className="-my-8 flex flex-col">
        {/* The richest environment on the site: two brand glows, the route
            pattern, and a search sweep running off the top-right corner. The
            hero panel is the foreground object standing on it. */}
        <div className="hero-ground relative isolate overflow-hidden pb-4">
          {/* IMG-018: the ground the opening stands on.
              
              Everything above this was an approximation of an illustration
              drawn with CSS — line art at four per cent opacity — and it was
              never going to read as a place. This is the place.
              
              The artwork's own left third is open sky, which is where the
              headline goes; the fade at the foot hands the page back to the
              canvas rather than stopping at a hard edge. Hidden below `sm`,
              where the hero stacks and the photograph is doing this job
              already. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[38rem] overflow-hidden sm:block"
          >
            <img
              src={heroEnvironment}
              alt=""
              className="size-full object-cover object-[60%_35%] opacity-90"
              fetchPriority="high"
            />
            {/* A scrim, not a filter.
            
                The headline, the paragraph and the announcement strip all sit
                over this photograph, and what is behind any one word depends
                on the crop — a mountain at one width, open sky at another.
                Darkening or blurring the whole image would fix that by
                throwing away the picture.
            
                This lightens only the left, where the text is, and is gone by
                the time it reaches the artwork that matters. Measured after
                the fact rather than guessed: see the contrast readings in
                docs/design-system.md. */}
            <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(251,249,246,0.97)_0%,rgba(251,249,246,0.93)_28%,rgba(251,249,246,0.66)_46%,rgba(251,249,246,0.18)_60%,transparent_72%)]" />
            <span className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-surface" />
          </div>

          <PatternVeil />
          {/* Halved, and pushed further out. IMG-018 is already a landscape; a radar
              sweep at full strength on top of it was two decorations arguing over
              the same corner while the headline tried to be read underneath. */}
          <RadarOrnament tone="teal" size={660} strength={1} className="-top-32 -right-44 opacity-50 lg:-right-28" />
          <UrgentLine />
          <Hero />
          <Promises />
          <SectionCurve to="surface" />
        </div>

        <RecentReports />
        <HowItWorks />
        <Reunions />
        <Safety />
        <ClosingCall />
      </div>
    </>
  )
}

/**
 * The first line on the page, for the person who arrived in a hurry: what to
 * do, and how long it takes. Above the headline because for them it matters
 * more than the headline does.
 */
function UrgentLine() {
  return (
    <Container className="pt-6 sm:pt-8">
      {/* Its own pale surface rather than sitting straight on IMG-018.
          
          Measured: against the lightest part of the artwork this line reads at
          5.1:1, but a dark leaf drifting behind it at some widths takes it to
          2.4. Text on a picture cannot promise its own contrast, so it stops
          depending on the picture.

          `rounded-card` until `sm`, pill only once it fits on one line. A pill
          radius on a block that has wrapped to three lines is half its height,
          and the corner it cuts away reaches into the text: at 390px the
          "Report a lost pet" link began 18px outside its own background and
          was sitting on the page. Found by measuring, not by looking — it
          reads as a slightly odd corner until you check what is under the
          first two letters. */}
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-card bg-surface/95 px-4 py-2 text-sm text-fg backdrop-blur-sm sm:w-fit sm:rounded-pill">
        <span className="inline-flex items-center gap-2 rounded-pill bg-accent-soft px-3 py-1 font-medium text-lost">
          <span className="size-1.5 rounded-full bg-accent-hover" aria-hidden="true" />
          Lost a pet today?
        </span>
        Filing a report takes a few minutes, and it starts being compared against found
        reports straight away.
        <Link to="/report/lost" className="font-medium text-brand hover:underline">
          Report a lost pet
        </Link>
      </p>
    </Container>
  )
}

/** What the page can say about itself, counted from the real reports. */
const loadHeroStats = async () => {
  const reports = await petService.getReports()
  return {
    total: reports.length,
    reunited: reports.filter((report) => report.status === REPORT_STATUSES.RETURNED).length,
    cities: new Set(reports.map((report) => report.location.city)).size,
    species: new Set(reports.map((report) => report.species)).size,
  }
}

/** Three things the system actually does, over the photograph. */
const PROMISES = [
  {
    icon: Scale,
    title: 'Every match explains itself',
    body: 'You see which details lined up and which did not.',
  },
  {
    icon: ShieldCheck,
    title: 'A coordinator checks first',
    body: 'Ownership is verified before a handover is arranged.',
  },
  {
    icon: Lock,
    title: 'Your details stay private',
    body: 'Contact information is never on a public report.',
  },
]

/**
 * One raised panel holding the whole opening: the headline and the two things
 * you might have come to do on the left, the photograph filling the right, and
 * the search across the bottom.
 *
 * It is one object rather than text beside an image — which is what lets the
 * page have a foreground standing on a background instead of two columns.
 */
function Hero() {
  const { data: stats } = useAsync(loadHeroStats)

  return (
    <section className="pt-4 pb-10 sm:pt-6 lg:pb-14">
      <Container className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-14">
        {/* Left: the claim, then the one object that does something about it. */}
        <div className="flex min-w-0 flex-col gap-6">
          <h1 className="text-[2.75rem] leading-[1.03] font-semibold tracking-tight text-balance text-fg sm:text-[3.4rem] xl:text-[3.75rem]">
            Every lost pet has{' '}
            <span className="text-brand">someone looking for them.</span>
          </h1>

          {/* `fg`, not `fg-muted`. Measured over the scrimmed photograph at
              1366px the muted ink reads 4.46:1 — under AA by four hundredths,
              which is not a rounding error, it is a fail. A darker neutral
              costs nothing here and does not depend on where the crop lands. */}
          <p className="max-w-lg text-lg leading-relaxed text-fg">
            Lost and found reports in one place, compared on the details that identify a pet —
            so the search stops depending on who saw which post.
          </p>

          {/* The action card. Everything somebody might have arrived to do is
              on this one raised surface: look for a pet, report one, or see
              how much is already here. It floats on the environment rather
              than the whole hero being a panel — which is what lets the
              photograph run to the edge behind it. */}
          <div className="flex flex-col gap-5 rounded-[1.5rem] border border-border/70 bg-panel/90 p-5 shadow-raised backdrop-blur-sm sm:p-6">
            <SearchBand />

            <div className="grid gap-3 sm:grid-cols-2">
              <Button as={Link} to="/report/lost" variant="accent" size="lg" fullWidth>
                <TriangleAlert size={18} aria-hidden="true" />
                Report a lost pet
              </Button>
              <Button as={Link} to="/report/found" variant="primary" size="lg" fullWidth>
                <PawPrint size={18} aria-hidden="true" />
                I found a pet
              </Button>
            </div>

            {/* Counted from the reports actually in the database. The
                reference design shows four-figure numbers; ours are the real
                ones, and a real 32 is worth more than an invented 1,284. */}
            {stats && (
              <dl className="grid grid-cols-3 gap-2 border-t border-border/70 pt-4">
                <HeroFigure value={stats.total} label="reports filed" />
                <HeroFigure value={stats.reunited} label="pets back home" />
                <HeroFigure value={stats.cities} label="cities covered" />
              </dl>
            )}
          </div>
        </div>

        {/* Right: IMG-027, large and unboxed.
        
            IMG-006 was a fine photograph of a person with two pets, which is
            not what this site is about — it showed ownership, not the moment
            the site exists for. This one is the reunion: the dog is arriving,
            the owner is crouched and reaching, and their face is out of frame
            so the animal is what you look at. The crop is centred on the dog's
            head, which sits just right of centre in the source. */}
        <div className="relative order-first lg:order-none">
          <img
            src={heroImage}
            alt="A brown Aspin leaning into the hands of its owner, who is crouched beside it on a Philippine residential street in late-afternoon light"
            className="h-64 w-full rounded-[1.5rem] object-cover object-[52%_42%] shadow-raised ring-1 ring-black/5 sm:h-80 lg:h-[30rem]"
            fetchPriority="high"
          />
        </div>
      </Container>
    </section>
  )
}

/** One real number and what it counts. */
function HeroFigure({ value, label }) {
  return (
    <div className="flex flex-col">
      <dt className="sr-only">{label}</dt>
      <dd className="text-[1.6rem] leading-none font-semibold text-fg tabular-nums">{value}</dd>
      <dd aria-hidden="true" className="mt-1 text-sm leading-snug text-fg-muted">
        {label}
      </dd>
    </div>
  )
}

/**
 * What the system promises, on a strip of its own under the hero.
 *
 * It used to sit inside the hero panel. The panel is gone — the photograph
 * needed the room — so the three promises became a band on the canvas, which
 * is also where the eye goes next.
 */
function Promises() {
  return (
    <section className="pb-14 sm:pb-16">
      <Container>
        <ul className="grid gap-x-6 gap-y-4 rounded-card border border-border/60 bg-panel/70 px-5 py-5 backdrop-blur-sm sm:px-7 md:grid-cols-3">
          {PROMISES.map((promise) => {
            const Icon = promise.icon

            return (
              <li key={promise.title} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-fg">{promise.title}</span>
                  <span className="text-sm text-fg-muted">{promise.body}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}

/** Lucide has a face for the species we actually carry; anything else gets a paw. */
const SPECIES_ICONS = { dog: Dog, cat: Cat, bird: Bird, rabbit: Rabbit }

/**
 * Browse by pet.
 *
 * This row used to sit on its own between the promises strip and the recent
 * reports, belonging to neither — a line of controls with nothing above or
 * below explaining what they filtered. It now opens the section it actually
 * acts on, under a label that says so.
 *
 * Chips, not buttons. They are a way of narrowing what is listed underneath,
 * and dressing them like the Lost and Found actions said they were the same
 * kind of thing. "All reports" carries the filled state because it is where
 * the section already stands.
 */
function SpeciesRow() {
  const { data: categories } = useAsync(loadActiveCategories)
  if (!categories) return null

  // Dogs and cats first, because that is most of what gets reported, and
  // "Other" left out: it is the catch-all on the report form, not somewhere
  // anybody sets out to browse.
  const order = ['dog', 'cat']
  const shown = categories
    .filter((category) => category.id !== 'other')
    .sort((a, b) => {
      const rank = (id) => (order.indexOf(id) === -1 ? order.length : order.indexOf(id))
      return rank(a.id) - rank(b.id) || a.label.localeCompare(b.label)
    })

  const chip =
    'inline-flex h-11 shrink-0 items-center gap-2 rounded-pill border px-4 text-sm font-medium whitespace-nowrap transition-colors'

  return (
    <nav aria-label="Browse reports by pet" className="flex flex-col gap-2.5">
      <h3 className="text-sm font-medium text-fg-muted">Browse by pet</h3>
      {/* Scrolls rather than wraps on a phone: five chips on two lines pushed
          the first report card off the fold, and none of them may disappear. */}
      <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <li className="snap-start">
          <Link to="/explore" className={cn(chip, 'border-brand/30 bg-brand-soft text-brand-hover')}>
            <Search size={16} aria-hidden="true" />
            All reports
          </Link>
        </li>
        {shown.map((category) => {
          const Icon = SPECIES_ICONS[category.id] ?? PawPrint

          return (
            <li key={category.id} className="snap-start">
              <Link
                to={`/explore?species=${category.id}`}
                className={cn(chip, 'border-border-strong bg-panel text-fg hover:bg-surface-muted')}
              >
                <Icon size={16} className="text-brand" aria-hidden="true" />
                {category.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * The numbers, counted from the reports themselves rather than written into
 * the page — if the seed changes, these change with it.
 */
/** The last thing on the page is the first thing somebody came to do. */
function ClosingCall() {
  return (
    <section className="relative isolate overflow-hidden bg-brand px-0 py-14 text-fg-inverted sm:py-16">
      <RouteOrnament tone="teal" size={560} className="-top-16 -right-32 opacity-40" />
      <Container className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-[1.75rem] leading-tight font-semibold text-balance sm:text-[2rem]">
            A report is the fastest thing you can do right now.
          </h2>
          <p className="mt-2 text-[1.0625rem] text-fg-inverted">
            Lost or found, it goes into the same place and starts being compared against
            everything else that has been reported.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button as={Link} to="/report/lost" variant="accent" size="lg">
            <TriangleAlert size={18} aria-hidden="true" />
            Report a lost pet
          </Button>
          <Button
            as={Link}
            to="/report/found"
            size="lg"
            className="border border-white/70 bg-white/10 text-fg-inverted hover:bg-white/20"
          >
            <PawPrint size={18} aria-hidden="true" />
            I found a pet
          </Button>
        </div>
      </Container>
    </section>
  )
}

const loadActiveCategories = () => categoryService.getActiveCategories()

/**
 * Quick search.
 *
 * Hands off to Explore through the URL rather than duplicating the filter
 * logic, so there is still one search implementation and the result is
 * shareable.
 */
function SearchBand() {
  const navigate = useNavigate()
  const { data: categories } = useAsync(loadActiveCategories)
  const [species, setSpecies] = useState('')
  const [city, setCity] = useState('')
  const [type, setType] = useState('')

  const submit = (event) => {
    event.preventDefault()

    const params = new URLSearchParams()
    if (species) params.set('species', species)
    if (city.trim()) params.set('city', city.trim())
    if (type) params.set('type', type)

    navigate(`/explore${params.toString() ? `?${params}` : ''}`)
  }

  return (
    // Inside the hero's action card. Two rows rather than the old four-across
    // strip: the card is half the page wide, and four controls on one line
    // squeezed each of them below a usable width.
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <SearchCheck size={18} className="shrink-0 text-brand" aria-hidden="true" />
        <h2 className="font-semibold text-fg">Find a pet near you</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="home-city" className="text-sm font-medium text-fg">
            Location
          </label>
          <div className="relative">
            <MapPin
              size={17}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle"
              aria-hidden="true"
            />
            <input
              id="home-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City or barangay"
              className="h-11 w-full rounded-control border border-border-strong bg-panel pr-3 pl-10 text-base text-fg placeholder:text-fg-muted"
            />
          </div>
        </div>

        <Select
          label="Species"
          value={species}
          onChange={(event) => setSpecies(event.target.value)}
          options={[
            { value: '', label: 'All species' },
            ...(categories ?? []).map((c) => ({ value: c.id, label: c.label })),
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Select
          label="Report type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          options={[
            { value: '', label: 'Lost & found' },
            ...optionsFromLabels(REPORT_TYPE_LABELS),
          ]}
        />

        <Button type="submit" size="lg" className="sm:min-w-32">
          <Search size={18} aria-hidden="true" />
          Search
        </Button>
      </div>
    </form>
  )
}

const loadRecentReports = () => petService.getRecentReports(4)

function RecentReports() {
  const { data: reports, error, isLoading } = useAsync(loadRecentReports)

  return (
    <section className="pb-16 sm:pb-24">
      {/* A sunken well behind the grid: the canvas dips, the cards stay white,
          and the group reads as one collection without another card around it. */}
      <Container className="flex flex-col gap-6">
        <SectionHeading
          title="Recently reported"
          description="The newest lost and found reports from the community."
          action={
            <Link
              to="/explore"
              className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-hover hover:underline"
            >
              View all reports
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />

        <SpeciesRow />

        {isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
            <span className="sr-only">Loading recent reports…</span>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-card border border-border bg-panel p-4">
                <LoadingSkeleton className="mb-4 aspect-4/3 w-full" />
                <LoadingSkeleton lines={3} />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-danger">
            Recent reports could not be loaded: {error.message}
          </p>
        )}

        {!isLoading && !error && reports?.length === 0 && (
          <EmptyState
            illustration={emptyReportsImage}
            title="No reports yet"
            description="When someone files a lost or found report, it will appear here."
            action={
              <Button as={Link} to="/report/lost" variant="accent">
                Report a lost pet
              </Button>
            }
          />
        )}

        {/* A sunken well behind the grid: the canvas dips, the cards stay
            white, and the group reads as one collection without another card
            drawn around it. */}
        {!isLoading && !error && reports?.length > 0 && (
          <ul className="grid gap-5 rounded-card bg-sunken/70 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
            {reports.map((report) => (
              <li key={report.id} className="flex">
                <PetCard report={report} className="w-full" />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  )
}

const STEPS = [
  {
    icon: ClipboardList,
    title: 'File a report',
    body: 'Share the species, breed, colour, size and markings, plus the date and area.',
  },
  {
    icon: SearchCheck,
    title: 'Get possible matches',
    body: 'Lost and found reports are compared on characteristics and location to find leads.',
  },
  {
    icon: ShieldCheck,
    title: 'Verify with a coordinator',
    body: 'A Pet Coordinator reviews both reports and helps confirm ownership securely.',
  },
  {
    icon: Handshake,
    title: 'Bring them home',
    body: 'Once verified, both reports are closed and another reunion story begins.',
  },
]

function HowItWorks() {
  return (
    // A compact band: the four steps are a reference, not the reason anyone
    // came. The padding was spending more height than the content did.
    <section className="relative isolate overflow-hidden bg-surface-alt py-12 sm:py-16">
      {/* The one band where the routes should be legible: this section is the
          search journey, so the pattern comes closer and the four steps are
          joined by a route rather than a dotted rule. */}
      <PatternVeil scale="near" fade={false} className="opacity-90" />
      <RadarOrnament tone="teal" size={460} className="-bottom-40 -left-40" />
      <Container className="flex flex-col gap-8">
        <SectionHeading
          title="How Paws&Found works"
          description="Four steps from a missing pet to a confirmed reunion."
          centered
        />

        <div className="relative">
          {/* The journey itself, drawn once across the row: a route that dips
              and rises between the four stops rather than three straight
              rules. Desktop only — stacked steps have nothing to connect. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="pointer-events-none absolute top-6 left-0 hidden h-20 w-full lg:block"
          >
            <path
              d="M150 44C300 44 330 92 450 92s180-64 300-64 180 56 300 56"
              fill="none"
              stroke="#0e5d5b"
              strokeOpacity="0.2"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="2 9"
            />
          </svg>

          <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step) => {
            const Icon = step.icon

            return (
              <li key={step.title} className="relative flex flex-col items-center text-center">

                <span className="relative z-10 flex size-20 items-center justify-center rounded-full border border-border bg-panel text-brand shadow-card">
                  <Icon size={32} aria-hidden="true" />
                </span>

                <h3 className="mt-4 flex items-center gap-2 text-lg font-semibold text-fg">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-fg-inverted">
                    {STEPS.indexOf(step) + 1}
                  </span>
                  {step.title}
                </h3>

                <p className="mt-1.5 max-w-56 text-fg-muted">{step.body}</p>
              </li>
            )
          })}
          </ol>
        </div>
      </Container>

      <SectionCurve to="warm-band" flip />
    </section>
  )
}

/**
 * Real reunions, from the seed data.
 *
 * Deliberately not invented testimonials: these are reports that actually
 * reached `returned`, with their own photographs, so the section cannot drift
 * away from what the system did.
 */
const loadReunions = async () => {
  const reports = await petService.getReports({ status: REPORT_STATUSES.RETURNED, limit: 3 })
  return reports
}

function Reunions() {
  const { data: reunions, isLoading } = useAsync(loadReunions)

  if (isLoading || !reunions || reunions.length === 0) return null

  // Three, so the row is even. "See all reunions" is where the rest live.
  const stories = reunions.slice(0, 3)

  return (
    <section className="reunion-ground relative isolate overflow-hidden bg-warm-band py-14 sm:py-20">
      <WovenVeil />
      <RouteOrnament tone="amber" size={520} className="-right-40 -bottom-16 rotate-6" />
      <Container className="flex flex-col gap-10">
        {/* The chapter opening: what these cases are, and one photograph of
            what one looks like afterwards.

            IMG-015 used to be half the width and taller than the text beside
            it, which made it compete with the stories below for the same job.
            It is shallower now and clearly editorial — the stories are the
            cards; this is the picture at the top of the page. */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
          <div className="min-w-0 lg:w-[55%]">
            <SectionHeading
              title={
                <span className="inline-flex items-center gap-2.5">
                  <Heart size={26} className="shrink-0 text-success" aria-hidden="true" />
                  Reunited
                </span>
              }
              description="Cases that ended the way everybody wanted."
              action={
                <Link
                  to="/explore?status=returned"
                  className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-hover hover:underline"
                >
                  See all reunions
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              }
            />

            <p className="mt-4 max-w-prose text-fg-muted">
              Every one of these began as two separate reports — a lost pet and a found one —
              that the system paired on their characteristics and a Pet Coordinator verified
              before anybody met.
            </p>
          </div>

          <img
            src={reunionImage}
            alt="A dog back home, lying on the floor while somebody kneels beside it."
            width="1400"
            height="1050"
            loading="lazy"
            decoding="async"
            className="aspect-16/9 w-full rounded-card object-cover object-center shadow-raised lg:w-[45%]"
          />
        </div>

        {/* Three of the same card. The featured-plus-two arrangement gave one
            case a photograph four times the size of the others for no reason
            anybody could point at — and on a page being marked, an
            inconsistency reads as an accident rather than as editing. */}
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((report) => (
            <li key={report.id}>
              <ReunionStory report={report} />
            </li>
          ))}
        </ul>
      </Container>
      <SectionCurve to="surface-alt" />
    </section>
  )
}

/**
 * One reunion: the same photograph, the same heading, the same summary and the
 * same link, in the same order, at the same height as the two beside it.
 */
function ReunionStory({ report }) {
  const photo = report.photos.find((p) => p.isPrimary) ?? report.photos[0]
  // A found pet often has no name, and two unnamed cats both read "Cat is
  // home", which looks like the same story told twice. The city separates
  // them, and it is the next thing anybody wants to know anyway.
  const heading = report.petName
    ? `${report.petName} is home`
    : `A ${speciesLabel(report.species).toLowerCase()} in ${report.location.city} is home`
  const days = daysToReunion(report)

  return (
    <Link
      to={`/pet/${report.id}`}
      className="card-interactive group flex h-full flex-col overflow-hidden rounded-card border border-border bg-panel shadow-card"
    >
      <img
        src={photo?.url ?? photoPlaceholder}
        alt=""
        className="aspect-16/10 w-full shrink-0 bg-surface-muted object-cover"
        loading="lazy"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
        <p className="flex items-start gap-2 text-lg font-semibold text-fg">
          <Heart size={17} className="mt-1 shrink-0 text-success" aria-hidden="true" />
          {heading}
        </p>

        <p className="text-sm text-fg-muted">
          Reported {REPORT_TYPE_LABELS[report.reportType].toLowerCase()} in{' '}
          {report.location.city} on {formatDate(report.incidentDate)}, and reunited after a
          coordinator confirmed the match.
        </p>

        {/* `mt-auto` is what keeps this row on the same line across all three
            when one summary runs longer than the others. */}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3">
          {days !== null && (
            <span className="rounded-pill bg-success-soft px-2.5 py-0.5 text-sm font-medium text-success-ink">
              Reunited in {days} {days === 1 ? 'day' : 'days'}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand group-hover:underline">
            Read {report.petName ? `${report.petName}'s` : 'the'} story
            <ArrowRight size={14} aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  )
}

/**
 * How long the case took, from the report date to the entry that marked it
 * returned. Read straight off `statusHistory`, so it cannot disagree with the
 * timeline on the report itself.
 */
function daysToReunion(report) {
  const returned = report.statusHistory.find(
    (entry) => entry.status === REPORT_STATUSES.RETURNED,
  )
  if (!returned) return null

  const ms = new Date(returned.createdAt) - new Date(report.incidentDate)
  if (Number.isNaN(ms) || ms < 0) return null
  return Math.max(1, Math.round(ms / 86400000))
}

const SAFETY = [
  {
    icon: Lock,
    title: 'Keep one detail private',
    body: 'Hold back one detail you did not publish. It is the simplest way to check a claimant is really the owner.',
  },
  {
    icon: MapPin,
    title: 'Meet somewhere public',
    body: 'Arrange handovers in daylight, in a public place, and bring someone with you.',
  },
  {
    icon: Eye,
    title: 'Trust your instincts',
    body: 'If something feels off, stop and contact a Pet Coordinator rather than pressing ahead.',
  },
]

function Safety() {
  return (
    // The closing band: the page eases into the footer rather than stopping
    // at a hairline.
    <section className="closing-ground relative isolate overflow-hidden bg-surface-alt py-14 sm:py-16">
      <PatternVeil />
      <RadarOrnament tone="teal" size={560} className="-top-28 -right-44" />
      <Container className="flex flex-col gap-8">
        <SectionHeading
          title="Helping is easier when everyone stays safe"
          description="A few simple precautions keep this working for the people who need it."
        />

        <ul className="grid gap-5 md:grid-cols-3">
          {SAFETY.map((point) => {
            const Icon = point.icon

            return (
              <li
                key={point.title}
                className="rounded-card border border-border bg-panel p-7 shadow-card"
              >
                <span className="flex size-13 items-center justify-center rounded-control bg-brand-soft text-brand">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-fg">{point.title}</h3>
                <p className="mt-2 text-fg-muted">{point.body}</p>
              </li>
            )
          })}
        </ul>

        <Link
          to="/help"
          className="inline-flex items-center gap-1.5 self-start font-medium text-brand hover:text-brand-hover hover:underline"
        >
          Read the full safety guidance
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </Container>
    </section>
  )
}

/** Shared section heading, so every band on the page lines up the same way. */
