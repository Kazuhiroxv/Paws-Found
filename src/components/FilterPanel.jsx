import { useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Dog,
  MapPin,
  PawPrint,
  Ruler,
} from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { cn } from '@/utils/cn'
import {
  PET_SIZE_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_ORDER,
  REPORT_TYPE_LABELS,
} from '@/constants'
import { optionsFromLabels, orderedOptionsFromLabels } from '@/utils/options'
import { todayAsInputValue } from '@/utils/date'

const ANY = ''

/**
 * The filter controls for Explore.
 *
 * Presentational as far as the FILTERS are concerned — it holds none of them,
 * so the page can render this panel in the desktop rail and inside the mobile
 * dialog without the two getting out of step. Each group does own whether it
 * is expanded, which is disclosure, not data: two instances disagreeing about
 * that is correct.
 *
 * Report type and species stay open because they are the two filters people
 * actually reach for. The rest collapse — seven open groups made the rail as
 * tall as the results beside it, and most of them are never touched.
 *
 * A collapsed group that is doing something says so, in a number and a word.
 * Otherwise a filter set on a previous visit, or arriving through a link,
 * would quietly cut the results with nothing on screen to explain it.
 *
 * @param {Object} props
 * @param {Object} props.filters
 * @param {(field: string, value: string) => void} props.onChange
 * @param {() => void} props.onClear
 * @param {boolean} props.hasActiveFilters
 * @param {{value: string, label: string}[]} props.speciesOptions  From
 *   `categoryService` — administrators manage the list.
 */
export function FilterPanel({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  speciesOptions = [],
}) {
  const setCount = (...fields) => fields.filter((field) => filters[field]).length

  return (
    // A tinted rail rather than a white card: filtering is the layer between
    // the canvas and the white report cards beside it, and three levels is
    // what stops the page reading as one flat plane. No shadow — it groups,
    // it does not lift.
    <div className="flex flex-col gap-4 rounded-card border border-border bg-layer p-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-lg font-semibold text-fg">Filters</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-brand hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Report type is three options and the most consequential filter on the
          page, so it is a visible choice rather than something hidden inside a
          dropdown — or behind a disclosure. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-0.5">
          <FilterLabel icon={PawPrint}>Report type</FilterLabel>
        </legend>
        <div className="flex rounded-control border border-border-strong bg-panel p-1">
          {[{ value: ANY, label: 'Both' }, ...optionsFromLabels(REPORT_TYPE_LABELS)].map(
            (option) => (
              <button
                key={option.value || 'any'}
                type="button"
                onClick={() => onChange('reportType', option.value)}
                aria-pressed={filters.reportType === option.value}
                className={cn(
                  'flex-1 rounded-[0.45rem] px-2 py-1.5 text-sm transition-colors',
                  filters.reportType === option.value
                    ? 'bg-brand-soft font-medium text-brand-hover'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {option.label}
              </button>
            ),
          )}
        </div>
      </fieldset>

      <Select
        label={<FilterLabel icon={Dog}>Species</FilterLabel>}
        value={filters.species}
        onChange={(event) => onChange('species', event.target.value)}
        options={[{ value: ANY, label: 'Any species' }, ...speciesOptions]}
      />

      <FilterGroup
        icon={Ruler}
        title="Size and colour"
        activeCount={setCount('size', 'color')}
      >
        <Select
          label="Size"
          value={filters.size}
          onChange={(event) => onChange('size', event.target.value)}
          options={[{ value: ANY, label: 'Any size' }, ...optionsFromLabels(PET_SIZE_LABELS)]}
        />
        <Input
          label="Colour"
          value={filters.color}
          onChange={(event) => onChange('color', event.target.value)}
          placeholder="e.g. brown"
        />
      </FilterGroup>

      <FilterGroup icon={MapPin} title="Place" activeCount={setCount('city')}>
        <Input
          label="City"
          value={filters.city}
          onChange={(event) => onChange('city', event.target.value)}
          placeholder="e.g. Makati"
        />
      </FilterGroup>

      <FilterGroup icon={CircleCheck} title="Status" activeCount={setCount('status')}>
        <Select
          label="Report status"
          value={filters.status}
          onChange={(event) => onChange('status', event.target.value)}
          options={[
            { value: ANY, label: 'Any status' },
            ...orderedOptionsFromLabels(REPORT_STATUS_LABELS, REPORT_STATUS_ORDER),
          ]}
        />
      </FilterGroup>

      <FilterGroup
        icon={CalendarDays}
        title="Date of incident"
        activeCount={setCount('dateFrom', 'dateTo')}
      >
        <Input
          label="From"
          type="date"
          value={filters.dateFrom}
          max={filters.dateTo || todayAsInputValue()}
          onChange={(event) => onChange('dateFrom', event.target.value)}
        />
        <Input
          label="To"
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          max={todayAsInputValue()}
          onChange={(event) => onChange('dateTo', event.target.value)}
        />
      </FilterGroup>

      <Button variant="secondary" onClick={onClear} disabled={!hasActiveFilters} fullWidth>
        Clear all filters
      </Button>
    </div>
  )
}

/**
 * One collapsible group of filters.
 *
 * A button with `aria-expanded` rather than `<details>`: React fights a
 * controlled `open` attribute, and this way the expanded state is ordinary
 * component state that opens itself when the group arrives with something
 * already set.
 *
 * The badge is a number and a word, never a bare dot — "1 set" survives being
 * read aloud and being looked at by somebody who cannot pick the tint out
 * from the rail behind it.
 */
function FilterGroup({ icon, title, activeCount, children }) {
  // Initial only. Once somebody has opened or closed a group, that is their
  // decision, and a filter changing underneath must not overrule it.
  const [isOpen, setIsOpen] = useState(activeCount > 0)

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <FilterLabel icon={icon}>{title}</FilterLabel>

        <span className="flex shrink-0 items-center gap-2">
          {activeCount > 0 && (
            <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-hover">
              {activeCount} set
            </span>
          )}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn('text-fg-muted transition-transform duration-150', isOpen && 'rotate-180')}
          />
        </span>
      </button>

      {isOpen && <div className="flex flex-col gap-4 pt-4">{children}</div>}
    </div>
  )
}

/**
 * A filter's label. The icon is decorative — it makes the panel scannable at a
 * glance, but the word is what carries the meaning.
 */
function FilterLabel({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fg">
      <Icon size={15} className="shrink-0 text-brand" aria-hidden="true" />
      {children}
    </span>
  )
}
