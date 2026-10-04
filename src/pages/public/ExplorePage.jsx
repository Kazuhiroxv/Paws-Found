import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { List, Map as MapIcon, Printer, Search, SlidersHorizontal } from 'lucide-react'
import emptyReportsImage from '@/assets/empty-no-reports.png'
import exploreHero from '@/assets/img-030-explore-hero.webp'
import { Button, Container, EmptyState, LoadingSkeleton, Modal } from '@/components/ui'
import { PetCard } from '@/components/PetCard'
import { Pagination } from '@/components/Pagination'
import { ReportMap } from '@/components/LazyMaps'
import { cn } from '@/utils/cn'
import { hasCoordinates } from '@/utils/location'
import { FilterPanel } from '@/components/FilterPanel'
import { RadarOrnament } from '@/components/Ornament'
import { ActiveFilters } from '@/components/ActiveFilters'
import { PrintReportList } from '@/components/PrintReportList'
import { speciesLabel } from '@/constants'
import { describeFilters } from '@/utils/filterDescriptions'
import { errorText } from '@/i18n/apiErrors'
import { useAsync } from '@/hooks/useAsync'
import { categoryService, petService, referenceService } from '@/services'
import { t } from '@/i18n'

/** Every filter, empty. Also the shape used to detect "nothing is filtered". */
const EMPTY_FILTERS = {
  text: '',
  reportType: '',
  species: '',
  size: '',
  color: '',
  // The place lists (Correction 3), by PSGC code.
  areaCode: '',
  cityCode: '',
  // A city named in a link (?city=Makati); there is no box for it any more.
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

/** At most this many pages of 50 go on one printout (1,000 reports). */
const PRINT_PAGE_LIMIT = 20

const loadActiveCategories = () => categoryService.getActiveCategories()
const loadColours = () => referenceService.getColours()
const loadAreas = () => referenceService.getAreas()

/**
 * What the place chip says: "Province: Cebu" for one of PSA's provinces, and
 * the name alone for Metro Manila or the Special Geographic Area, which are
 * not provinces (Correction 3A).
 */
function chipForArea(area) {
  if (!area) return undefined
  return area.type === 'province' ? t('explore.province', { name: area.name }) : area.name
}

/**
 * The search placeholder, sized to the field. Below 640px (`sm`) the input sits
 * beside the Search button and the full hint was cut off mid-word; below 360px
 * (the narrowest common phone) there is room for about eight characters, so it
 * steps down once more. The words change, not the text size. The 640px step
 * matches the Help page's search. Two small copies, kept apart on purpose: they
 * are the only two, and each reads on its own (CLAUDE.md §15).
 *
 * No "markings" in the hint: a guest's search does not look in them.
 */
const PLACEHOLDERS = [
  ['(min-width: 640px)', 'explore.placeholderWide'],
  ['(min-width: 360px)', 'explore.placeholderMedium'],
]
const PLACEHOLDER_NARROWEST = 'explore.placeholderNarrow'

// A key, not the words: they are read when shown, in the language showing.
function currentPlaceholder() {
  const match = PLACEHOLDERS.find(([query]) => window.matchMedia(query).matches)
  return match ? match[1] : PLACEHOLDER_NARROWEST
}

function useSearchPlaceholder() {
  const [placeholder, setPlaceholder] = useState(currentPlaceholder)

  useEffect(() => {
    const queries = PLACEHOLDERS.map(([query]) => window.matchMedia(query))
    const update = () => setPlaceholder(currentPlaceholder())
    queries.forEach((query) => query.addEventListener('change', update))
    return () => queries.forEach((query) => query.removeEventListener('change', update))
  }, [])

  return placeholder
}

export function ExplorePage({ role }) {
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
  const placeholder = useSearchPlaceholder()

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
    label: speciesLabel(category.id, category.label),
  }))

  // Print / Save as PDF (Correction 7). Every matching report, not only this
  // page of cards: the same search, the same order, asked for in the API's
  // largest pages. What prints is what this person could page through.
  const [printRows, setPrintRows] = useState(null)
  const [isPreparingPrint, setIsPreparingPrint] = useState(false)
  const [printError, setPrintError] = useState(null)
  const endPrint = useCallback(() => setPrintRows(null), [])
  const preparePrint = async () => {
    setIsPreparingPrint(true)
    setPrintError(null)
    try {
      const rows = []
      for (let next = 1, pages = 1; next <= pages && next <= PRINT_PAGE_LIMIT; next += 1) {
        const result = await petService.getReportsPage({ ...filters, sort, page: next, perPage: MAP_RESULT_LIMIT })
        rows.push(...result.reports)
        pages = result.totalPages
      }
      setPrintRows(rows)
    } catch (caught) {
      setPrintError(caught)
    } finally {
      setIsPreparingPrint(false)
    }
  }

  // The colour and place lists come from the database, like the report form's.
  const { data: colours } = useAsync(loadColours)
  const { data: areas } = useAsync(loadAreas)
  const loadCities = useCallback(
    () => referenceService.getCities(filters.areaCode),
    [filters.areaCode],
  )
  const { data: cities } = useAsync(loadCities)
  const listOptions = {
    colourOptions: (colours ?? []).map((colour) => ({ value: colour.name, label: colour.name })),
    areaOptions: (areas ?? []).map((area) => ({ value: area.code, label: area.name })),
    cityOptions: (cities ?? []).map((city) => ({ value: city.code, label: city.name })),
  }
  // What the place chips say: a name, never a code.
  const placeNames = {
    areaCode: chipForArea(areas?.find((area) => area.code === filters.areaCode)),
    cityCode: cities?.find((city) => city.code === filters.cityCode)?.name,
  }

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value !== '').length,
    [filters],
  )
  const hasActiveFilters = activeFilterCount > 0

  const changeFilter = (field, value) => {
    // A city belongs to one area, so a new (or no) area clears it.
    setFilters((current) =>
      field === 'areaCode'
        ? { ...current, areaCode: value, cityCode: '' }
        : { ...current, [field]: value },
    )
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
      <title>{`${t('explore.title')} · Paws&Found`}</title>

      {/* A contained panel, lined up with the filters and the map below it, so
          the hero and the results read as one working surface. About and Help
          are full-bleed; this is deliberately not a third of those.

          From `lg`: IMG-030 behind it: dog and cat on the right, the
          neighbourhood and its pins in the middle, cream on the left for the
          heading and search. The source is 2000x689 (about 2.9:1) and the
          panel is about 5:1, so filling the width would have cut ~40% of the
          height and the pets with it. Instead the art is scaled to the
          panel's height and anchored right: 697x240, nothing cropped. The
          panel is the art's own cream (warm-band), and the image's left edge,
          already plain cream, fades into it, so there is no seam to see.

          Below `lg`: no art, as before. The words and the search use the full
          width there, and the results matter more than a picture above them. */}
      <section className="relative isolate overflow-hidden rounded-card bg-brand-soft/60 lg:bg-warm-band">
        {/* Search sweeps behind the tinted band on tablets. From `lg` the art
            carries the search motif itself, and the rings would compete. */}
        <RadarOrnament tone="teal" size={460} className="-top-28 -left-24 lg:hidden" />
        <img
          src={exploreHero}
          alt=""
          className="absolute inset-y-0 right-0 hidden h-full w-auto max-w-none [mask-image:linear-gradient(to_right,transparent,black_28%)] lg:block"
          fetchPriority="high"
        />

        {/* A short fade into the canvas, which ties the panel to the results
            below it. Short on purpose: taller, it greyed out the pets' paws. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-surface"
        />

        <div className="relative flex flex-col gap-4 px-6 py-6 sm:px-8 sm:py-7 lg:min-h-60 lg:justify-center">
          <div className="flex flex-col gap-1.5 lg:max-w-[54%]">
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance text-fg sm:text-[2.25rem]">
              {t('explore.title')}
            </h1>
            {/* Full-strength ink, not `fg-muted`: on the tinted band muted text
                measures 4.31:1, and no usable tint strength gets it to AA. */}
            <p className="text-lg text-fg">
              {t('explore.lead')}
            </p>
          </div>

          <form onSubmit={submitSearch} className="flex gap-2 lg:max-w-[58%]">
            <div className="relative flex-1">
              <label htmlFor="explore-search" className="sr-only">
                {t('explore.searchLabel')}
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
                placeholder={t(placeholder)}
                className="h-13 w-full rounded-control border border-border-strong bg-panel pr-4 pl-11 text-base text-fg shadow-raised placeholder:text-fg-muted"
              />
            </div>
            {/* The field is 52px, the large button's height, so the two meet
                edge to edge; it was 48px beside a 52px button. */}
            <Button type="submit" size="lg" className="sm:min-w-30">
              {t('explore.search')}
            </Button>
          </form>
        </div>
      </section>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Desktop: a sidebar beside the results. Mobile: the same panel in a
            dialog. Not sticky: it used to hold at the top for the whole length
            of a 3,000–5,000px results page, which read as stuck. The chips
            above the results show what is applied, and the panel is one
            scroll back up. */}
        <aside className="hidden lg:block lg:w-65 lg:shrink-0">
          <FilterPanel
            filters={filters}
            onChange={changeFilter}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
            speciesOptions={speciesOptions}
            {...listOptions}
          />
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
              {isLoading ? t('explore.searching') : t('explore.found', { count: total })}
            </p>

            {/* Wraps: at 390px the view toggle, the Filters button and the sort
                control do not fit on one line, and without this the sort
                control pushed the page 16px wider than the screen. */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-control border border-border-strong bg-panel p-1" role="group" aria-label={t('explore.view')}>
                {[
                  { id: 'map', label: t('explore.map'), icon: MapIcon },
                  { id: 'list', label: t('explore.list'), icon: List },
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
                {t('filters.title')}
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 rounded-pill bg-brand px-1.5 text-xs text-fg-inverted">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              {/* Always offered now: the cards are on screen in both views,
                  so sorting always has something visible to act on. */}
              <label htmlFor="explore-sort" className="sr-only">
                {t('explore.sortLabel')}
              </label>
              <select
                id="explore-sort"
                value={sort}
                onChange={(event) => changeSort(event.target.value)}
                className="h-10 rounded-control border border-border-strong bg-panel px-3 text-sm text-fg"
              >
                <option value="newest">{t('explore.newest')}</option>
                <option value="oldest">{t('explore.oldest')}</option>
              </select>

              {/* Correction 7: the instructor's "iprint sa PDF". The browser's
                  own print dialog, which offers Save as PDF. */}
              <Button
                variant="secondary"
                size="sm"
                onClick={preparePrint}
                isLoading={isPreparingPrint}
                disabled={isLoading || total === 0}
                data-print-trigger=""
              >
                <Printer size={16} aria-hidden="true" />
                {t('print.button')}
              </Button>
            </div>
          </div>

          <ActiveFilters
            filters={filters}
            names={placeNames}
            onRemove={(field) => changeFilter(field, '')}
          />

          {isLoading && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              <span className="sr-only">{t('explore.loading')}</span>
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
              {t('explore.failed', { message: errorText(error) })}
            </p>
          )}

          {printError && (
            <p role="alert" className="text-sm text-danger">
              {t('print.failed', { message: errorText(printError) })}
            </p>
          )}

          {!isLoading && !error && visibleReports.length === 0 && (
            <EmptyState
              illustration={emptyReportsImage}
              title={hasActiveFilters ? t('explore.noMatch') : t('explore.none')}
              description={hasActiveFilters ? t('explore.noMatchBody') : t('explore.noneBody')}
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    {t('filters.clearAllFilters')}
                  </Button>
                ) : (
                  <Button as={Link} to="/report/lost" variant="accent">
                    {t('nav.reportLost')}
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
                  guest={!role}
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
                    <span className="text-fg">{t('labels.reportType.lost')}</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full bg-found ring-2 ring-found-soft"
                    />
                    <span className="text-fg">{t('labels.reportType.found')}</span>
                  </li>
                </ul>
              </div>

              {unpinnedCount > 0 && (
                <p className="-mt-1 text-sm text-fg-muted">
                  {t('explore.unpinned', { count: unpinnedCount, total: visibleReports.length })}
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
                    {t('explore.showing', {
                      from: (page - 1) * PAGE_SIZE + 1,
                      to: (page - 1) * PAGE_SIZE + visibleReports.length,
                      total,
                      page,
                      pages: totalPages,
                    })}
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
        title={t('filters.title')}
        footer={
          <Button onClick={() => setIsFilterDialogOpen(false)}>
            {t('explore.showResults', { count: total })}
          </Button>
        }
      >
        <FilterPanel
          filters={filters}
          onChange={changeFilter}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
          speciesOptions={speciesOptions}
          {...listOptions}
        />
      </Modal>

      {printRows && (
        <PrintReportList
          title={t('print.exploreTitle')}
          filters={[...describeFilters(filters, placeNames), t('print.sortedBy', { sort: t(`explore.${sort}`) })]}
          reports={printRows}
          onDone={endPrint}
        />
      )}
    </Container>
  )
}
