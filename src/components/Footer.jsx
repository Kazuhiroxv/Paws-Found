import { Link } from 'react-router-dom'
import { ArrowRight, Users } from 'lucide-react'
import logoLockup from '@/assets/pawsfound-logo-horizontal.webp'
import { Button, Container } from '@/components/ui'
import { WovenVeil } from '@/components/PatternVeil'
import { RouteOrnament } from '@/components/Ornament'
import footerHorizon from '@/assets/img-019-footer-horizon.webp'

/**
 * Site footer.
 *
 * Grouped into columns that mirror what people came to do — explore, report,
 * understand, get help — rather than one undifferentiated row of links.
 */
const COLUMNS = [
  {
    heading: 'Explore',
    links: [
      { to: '/explore?type=lost', label: 'Browse lost pets' },
      { to: '/explore?type=found', label: 'Browse found pets' },
      { to: '/explore', label: 'Search all reports' },
    ],
  },
  {
    heading: 'Report',
    links: [
      { to: '/report/lost', label: 'Report a lost pet' },
      { to: '/report/found', label: 'Report a found pet' },
    ],
  },
  {
    heading: 'About',
    links: [
      { to: '/about', label: 'About Paws&Found' },
      { to: '/about', label: 'How it works' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { to: '/help', label: 'Help & safety' },
      { to: '/help', label: 'Safe handovers' },
      { to: '/privacy', label: 'Privacy Notice' },
    ],
  },
]

export function Footer() {
  return (
    // The page ends on a horizon: the links sit on the warm layer, and the
    // illustrated band closes the page underneath them — hills, a dog and a
    // cat watching a low sun. IMG-019's sky is transparent, so the wave along
    // its top edge meets the warm fill above it instead of cutting a white
    // rectangle out of the page.
    <footer className="relative isolate mt-auto overflow-hidden border-t border-border bg-surface-warm">
      <WovenVeil />
      <RouteOrnament tone="teal" size={520} className="-top-10 -right-32 rotate-3" />
      {/* Phones: the four link groups sit two by two, tablets four across, with
          the brand block and the call-to-action card spanning the row. Stacked
          one above another they made the footer longer than a phone screen. */}
      <Container className="relative grid grid-cols-2 gap-x-8 gap-y-7 py-9 sm:grid-cols-4 lg:grid-cols-[1.7fr_repeat(4,1fr)_1.5fr]">
        <div className="col-span-2 flex flex-col gap-2.5 sm:col-span-4 lg:col-span-1">
          <Link to="/" className="flex w-fit items-center">
            <img src={logoLockup} alt="Paws&Found" className="h-10 w-auto" />
          </Link>
          <p className="text-sm text-fg-muted">
            A community platform that helps lost pets and the people looking for them find
            each other.
          </p>

        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h2 className="text-sm font-semibold text-fg">{column.heading}</h2>
            <ul className="mt-2 flex flex-col gap-0.5">
              {column.links.map((link) => (
                <li key={link.to + link.label}>
                  <Link
                    to={link.to}
                    className="inline-block py-1 text-sm text-fg-muted underline decoration-border-strong underline-offset-4 transition-colors hover:text-brand hover:decoration-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* The one thing in the footer that asks for an action, so it is the
            one thing that lifts off it. */}
        <div className="col-span-2 self-start rounded-card border border-brand/15 bg-brand-soft p-4 shadow-card sm:col-span-4 lg:col-span-1">
          <p className="flex items-start gap-2 text-sm font-semibold text-fg">
            <Users size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            Together, we can bring them home.
          </p>
          {/* `fg` rather than `fg-muted`: this card sits on `brand-soft`,
              where the muted ink measures 4.14:1 — the lowest reading in the
              interface and the furthest under AA. */}
          <p className="mt-1.5 text-sm text-fg">
            Every report helps somebody find the pet they are looking for.
          </p>
          <Button as={Link} to="/explore" size="sm" className="mt-3">
            Report or search now
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </Container>

      {/* The horizon, and the copyright line sitting on it.

          One block rather than an image with text under it: the band carries
          its own dark ground, so the line reads as part of the scene instead
          of a caption beneath a picture. `aria-hidden` because it says
          nothing — the words are the words below it.

          The footer used to run to most of a viewport, and the height was not
          the artwork: IMG-019's top 23% was fully transparent, so it rendered
          as a field of empty cream as tall as the navigation above it. That is
          trimmed out of the file now, and the band is pulled up under the
          links so the wave begins where the navigation ends. What is left is
          the picture.

          Hidden below `sm`: at 390px a 4:1 band is a sliver of mud, and the
          phone footer is long enough already. */}
      <div className="relative isolate -mt-4 hidden sm:block lg:-mt-10">
        <img
          src={footerHorizon}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="pointer-events-none w-full select-none"
        />
        <Container className="absolute inset-x-0 bottom-0 pb-4">
          <p className="text-sm text-fg-inverted/75">
            &copy; 2026 Paws&amp;Found. Academic project for Web Systems and Technologies 2.
            All pets, people and reports shown are fictional demonstration data.
          </p>
        </Container>
      </div>

      {/* Phones get the same words on the plain warm ground. */}
      <div className="border-t border-border sm:hidden">
        <Container className="py-4">
          <p className="text-sm text-fg-muted">
            &copy; 2026 Paws&amp;Found. Academic project for Web Systems and Technologies 2.
            All pets, people and reports shown are fictional demonstration data.
          </p>
        </Container>
      </div>
    </footer>
  )
}
