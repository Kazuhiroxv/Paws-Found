import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { List, Map as MapIcon, Search, SlidersHorizontal } from 'lucide-react'
import emptyReportsImage from '@/assets/empty-no-reports.png'
import headerIllustration from '@/assets/img-008-explore-header-illustration.jpg'
import { Button, Container, EmptyState, LoadingSkeleton, Modal } from '@/components/ui'
import { PetCard } from '@/components/PetCard'
import { Pagination } from '@/components/Pagination'
import { ReportMap } from '@/components/LazyMaps'
import { cn } from '@/utils/cn'
import { hasCoordinates } from '@/utils/location'
import { FilterPanel } from '@/components/FilterPanel'
import { RadarOrnament } from '@/components/Ornament'
import { ActiveFilters } from '@/components/ActiveFilters'
import { useAsync } from '@/hooks/useAsync'
import { categoryService, petService } from '@/services'

/** Every filter, empty. Also the shape used to detect "nothing is filtered". */
const EMPTY_FILTERS = {
  text: '',
  reportType: '',
  species: '',
  size: '',
  color: '',
  city: '',
  status: '',
  dateFrom: '',
  dateTo: '',
}

/** Cards per page in the list view. Matches the API's own default. */
const PAGE_SIZE = 9

/**
 * The map draws every matching report rather than one page, so it asks for the
 * largest page the API allows. 50 is that cap (`MAX_PAGE_SIZE` in the API's
 * config); beyond it the map would need its own endpoint.
 */
const MAP_RESULT_LIMIT = 50

const loadActiveCategories = () => categoryService.getActiveCategories()

export function ExplorePage() {
  // The homepage search band hands off through the URL, so a search can also be
  // shared or bookmarked. Read once on mount: after that the page owns its own
  // filter state and does not fight the address bar.
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    text: searchParams.get('q') ?? '',
    reportType: searchParams.get('type') ?? '',
    species: searchParams.get('species') ?? '',
    city: searchParams.get('city') ?? '',
  }))
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('q') ?? '')
  const searchRef = useRef(null)

  // "/" puts the cursor in the search box, unless you are already typing
  // somewhere. This is a page people come back to repeatedly while a pet is
  // missing, and reaching for the mouse each time is the slow way.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      event.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  // Map by default: the map is now a band above the cards rather than a
  // replacement for them, so opening with it costs nothing and answers "is
  // any of this near me" before anybody has to ask for it.
  const [view, setView] = useState('map')

  // Re-runs whenever a filter, the sort or the page changes — no page reload,
  // which is the asynchronous behaviour this page is meant to demonstrate.
  //
  // Paging is done by the database (LIMIT/OFFSET), not by slicing a full list
  // in the browser: the point of paginating is to stop fetching rows nobody is
  // going to look at. The map is the exception — it needs every pin, so it asks
  // for one large page instead.
  const isMapView = view === 'map'
  const loadReports = useCallback(
    () =>
      petService.getReportsPage({
        ...filters,
        sort,
        page: isMapView ? 1 : page,
        perPage: isMapView ? MAP_RESULT_LIMIT : PAGE_SIZE,
      }),
    [filters, sort, page, isMapView],
  )
  const { data, error, isLoading } = useAsync(loadReports)

  const reports = data?.reports
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const { data: categories } = useAsync(loadActiveCategories)

  const speciesOptions = (categories ?? []).map((category) => ({
    value: category.id,
    label: category.label,
  }))

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value !== '').length,
    [filters],
  )
  const hasActiveFilters = activeFilterCount > 0

  const changeFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
    setPage(1) // A new filter means a new result set: start again.
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setSearchDraft('')
    setPage(1)
  }

  const changeSort = (value) => {
    setSort(value)
    setPage(1) // Page 3 of one ordering is not page 3 of another.
  }

  const submitSearch = (event) => {
    event.preventDefault()
    changeFilter('text', searchDraft.trim())
  }

  const visibleReports = reports ?? []
  const unpinnedCount = visibleReports.filter((report) => !hasCoordinates(report)).length

  // Moving to another page leaves you at the bottom of the previous one, which
  // reads as though nothing happened. Put the top of the results back in view —
  // but not on the first render, where the page has not moved.
  //
  // This waits for the arriving page rather than the button press, so the jump
  // lands against the finished layout rather than the loading state.
  //
  // The move is instant, not smoothed: an animated scroll would have to be
  // suppressed under `prefers-reduced-motion`, and there is nothing to see on
  // the way past a list you have already read.
  const resultsRef = useRef(null)
  const loadedPage = data?.page
  const hasPaged = useRef(false)

  useEffect(() => {
    if (loadedPage === undefined) return

    if (!hasPaged.current) {
      hasPaged.current = true
      return
    }

    resultsRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [loadedPage])

  return (
    <Container className="flex flex-col gap-6 pb-6 sm:pb-12">
      {/* The page composes its own header rather than using PageHeader: the
          title, the description and the search all sit together on one tinted
          band, which is what makes this read as a discovery page rather than a
          heading above a form. */}
      <title>Explore reports · Paws&Found</title>

      {/* IMG-008 is the whole band, not a cut-out: the cream-to-teal wave and
          the dog and cat are one 3:1 illustration, with the left side left
          clear for type. The text block is capped at half the width because
          past that the artwork darkens and muted text would fall below AA. */}
      <section className="relative isolate min-h-60 overflow-hidden rounded-card bg-brand-soft/60 lg:min-h-68">
        {/* Search sweeps behind the illustration, running off the band. */}
        <RadarOrnament tone="teal" size={460} className="-top-28 -left-24 lg:left-1/3" />
        {/* Shown from `lg` up only. The text column only narrows to half the
            band at `lg`; from `md` it ran straight across the dog and cat. The
            search row is capped too, or the input covers the animals' paws.
            Below `lg` the band keeps its tint and the type has it to itself. */}
        <img
          src={headerIllustration}
          alt=""
          className="absolute inset-0 hidden size-full object-cover object-center lg:block"
        />

        {/* The illustration fades into the canvas instead of stopping at a
            hard edge, so the search sits on the seam between the two. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-surface"
        />

        <div className="relative flex flex-col gap-6 px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col gap-2 lg:max-w-1/2">
            <h1 className="text-[2.25rem] leading-[1.08] font-semibold tracking-tight text-balance text-fg sm:text-[2.75rem]">
              Explore reports
            </h1>
            {/* Full-strength ink, not `fg-muted`: on the tinted band muted text
                measures 4.31:1, and no usable tint strength gets it to AA. */}
            <p className="text-lg text-fg">
              Search lost and found pets reported across the Philippines.
            </p>
          </div>

          <form onSubmit={submitSearch} className="flex gap-2 lg:max-w-[58%]">
            <div className="relative flex-1">
              <label htmlFor="explore-search" className="sr-only">
                Search reports
              </label>
              <Search
                size={18}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-subtle"
                aria-hidden="true"
              />
              <input
                id="explore-search"
                ref={searchRef}
                type="search"
                aria-keyshortcuts="/"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search by breed, colour, markings, pet name or place"
                className="h-12 w-full rounded-control border border-border-strong bg-panel pr-4 pl-11 text-base text-fg shadow-raised placeholder:text-fg-muted"
              />
            </div>
            <Button type="submit" size="lg" className="sm:min-w-30">
              Search
            </Button>
          </form>
        </div>
      </section>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Desktop: a persistent sidebar. Mobile: the same panel in a dialog. */}
        <aside className="hidden lg:block lg:w-65 lg:shrink-0">
          <div className="sticky top-24">
            <FilterPanel
              filters={filters}
              onChange={changeFilter}
              onClear={clearFilters}
              hasActiveFilters={hasActiveFilters}
              speciesOptions={speciesOptions}
            />
          </div>
        </aside>

        {/* Results sit directly on the canvas. They used to live in a tinted
            well with a pattern behind them, which put a third surface between
            the page and the cards and made the map look like it was inside a
            box. The cards are the raised objects here; nothing needs to be
            raised underneath them.
            
            scroll-mt clears the sticky header, or paging lands with the first
            row of cards hidden beneath it. */}
        <div ref={resultsRef} className="flex min-w-0 flex-1 scroll-mt-24 flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold text-fg" aria-live="polite">
              {/* The whole result set, not this page: "9 pets found" beside a
                  four-page pager would contradict itself. */}
              {isLoading ? 'Searching…' : `${total} ${total === 1 ? 'pet' : 'pets'} found`}
            </p>

            {/* Wraps: at 390px the view toggle, the Filters button and the sort
                control do not fit on one line, and without this the sort
                control pushed the page 16px wider than the screen. */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-control border border-border-strong bg-panel p-1" role="group" aria-label="View">
                {[
                  { id: 'map', label: 'Map', icon: MapIcon },
                  { id: 'list', label: 'List', icon: List },
                ].map((option) => {
                  const Icon = option.icon

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setView(option.id)}
                      aria-pressed={view === option.id}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-[0.45rem] px-3.5 py-1.5 text-sm transition-colors',
                        view === option.id
                          ? 'bg-brand-soft font-medium text-brand-hover shadow-card'
                          : 'text-fg-muted hover:text-fg',
                      )}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {option.label}
                    </button>
                  )
                })}
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsFilterDialogOpen(true)}
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 rounded-pill bg-brand px-1.5 text-xs text-fg-inverted">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              {/* Always offered now: the cards are on screen in both views,
                  so sorting always has something visible to act on. */}
              <label htmlFor="explore-sort" className="sr-only">
                Sort reports
              </label>
              <select
                id="explore-sort"
                value={sort}
                onChange={(event) => changeSort(event.target.value)}
                className="h-10 rounded-control border border-border-strong bg-panel px-3 text-sm text-fg"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>

          <ActiveFilters filters={filters} onRemove={(field) => changeFilter(field, '')} />

          {isLoading && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              <span className="sr-only">Loading reports…</span>
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="rounded-card border border-border bg-panel p-4">
                  <LoadingSkeleton className="mb-4 aspect-4/3 w-full" />
                  <LoadingSkeleton lines={3} />
                </div>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              Reports could not be loaded: {error.message}
            </p>
          )}

          {!isLoading && !error && visibleReports.length === 0 && (
            <EmptyState
              illustration={emptyReportsImage}
              title={hasActiveFilters ? 'No reports match those filters' : 'No reports yet'}
              description={
                hasActiveFilters
                  ? 'Try removing a filter or searching for a broader term — for example a colour rather than a breed.'
                  : 'When someone files a lost or found report, it will appear here.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                ) : (
                  <Button as={Link} to="/report/lost" variant="accent">
                    Report a lost pet
                  </Button>
                )
              }
            />
          )}

          {/* Map ABOVE the results, not instead of them.
              
              The two used to be mutually exclusive, which made somebody choose
              between knowing where the reports are and knowing what they are.
              They answer different halves of the same question, so the map is
              now a band across the top of the results and the cards continue
              underneath it. "List view" puts the map away for anyone who wants
              the cards alone.
              
              The map draws every matching report rather than the current page:
              a pin is cheap, and paging a map would be baffling. */}
          {!isLoading && !error && visibleReports.length > 0 && view === 'map' && (
            <>
              <div className="relative isolate">
                <ReportMap
                  reports={reports}
                  height="h-[22rem] lg:h-[26rem]"
                  className="shadow-raised"
                />

                {/* What the pin colours mean. The map has always drawn lost
                    and found in different colours and never said so anywhere,
                    which left the single most useful thing on it readable only
                    by people who could both see and guess. The words are the
                    signal; the swatches only repeat them. */}
                <ul className="pointer-events-none absolute top-3 right-3 z-[400] flex gap-3 rounded-control border border-border bg-panel/95 px-3 py-2 text-sm shadow-card backdrop-blur-sm">
                  <li className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full bg-lost ring-2 ring-lost-soft"
                    />
                    <span className="text-fg">Lost</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full bg-found ring-2 ring-found-soft"
                    />
                    <span className="text-fg">Found</span>
                  </li>
                </ul>
              </div>

              {unpinnedCount > 0 && (
                <p className="-mt-1 text-sm text-fg-muted">
                  {unpinnedCount} of these {visibleReports.length} reports{' '}
                  {unpinnedCount === 1 ? 'has' : 'have'} no map pin and{' '}
                  {unpinnedCount === 1 ? 'is' : 'are'} only in the list below.
                </p>
              )}
            </>
          )}

          {!isLoading && !error && visibleReports.length > 0 && (
            <>
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleReports.map((report) => (
                  <li key={report.id} className="flex">
                    <PetCard report={report} className="w-full" />
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-3 pt-2">
                  {/* Announced, because after pressing a page number the count
                      is the only thing that confirms the list moved. */}
                  <p role="status" className="text-sm text-fg-muted">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + visibleReports.length}{' '}
                    of {total} · page {page} of {totalPages}
                  </p>
                  <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* A sheet from the bottom edge rather than a centred box: the panel is
          tall, and on a phone its controls belong within reach of a thumb. */}
      <Modal
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        placement="sheet"
        title="Filters"
        footer={
          <Button onClick={() => setIsFilterDialogOpen(false)}>
            Show {total} results
          </Button>
        }
      >
        <FilterPanel
          filters={filters}
          onChange={changeFilter}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
          speciesOptions={speciesOptions}
        />
      </Modal>
    </Container>
  )
}
