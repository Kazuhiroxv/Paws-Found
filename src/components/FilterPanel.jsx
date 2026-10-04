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
  areaLabel,
  PET_SIZE_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_ORDER,
  REPORT_TYPE_LABELS,
} from '@/constants'
import { optionsFromLabels, orderedOptionsFromLabels } from '@/utils/options'
import { todayAsInputValue } from '@/utils/date'
import { t } from '@/i18n'

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
 * @param {{value: string, label: string}[]} props.colourOptions  The colour
 *   list, from `referenceService`, the same one the report form uses.
 * @param {{value: string, label: string}[]} props.areaOptions  The 82
 *   provinces, Metro Manila and the Special Geographic Area.
 * @param {{value: string, label: string}[]} props.cityOptions  The cities of
 *   the chosen area; empty until one is chosen.
 */
export function FilterPanel({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  speciesOptions = [],
  colourOptions = [],
  areaOptions = [],
  cityOptions = [],
}) {
  const setCount = (...fields) => fields.filter((field) => filters[field]).length

  return (
    // A tinted rail rather than a white card: filtering is the layer between
    // the canvas and the white report cards beside it, and three levels is
    // what stops the page reading as one flat plane. No shadow — it groups,
    // it does not lift.
    <div className="flex flex-col gap-4 rounded-card border border-border bg-layer p-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-lg font-semibold text-fg">{t('filters.title')}</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-brand hover:underline"
          >
            {t('filters.clearAll')}
          </button>
        )}
      </div>

      {/* Report type is three options and the most consequential filter on the
          page, so it is a visible choice rather than something hidden inside a
          dropdown — or behind a disclosure. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-0.5">
          <FilterLabel icon={PawPrint}>{t('filters.reportType')}</FilterLabel>
        </legend>
        <div className="flex rounded-control border border-border-strong bg-panel p-1">
          {[{ value: ANY, label: t('filters.both') }, ...optionsFromLabels(REPORT_TYPE_LABELS)].map(
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
        label={<FilterLabel icon={Dog}>{t('filters.species')}</FilterLabel>}
        value={filters.species}
        onChange={(event) => onChange('species', event.target.value)}
        options={[{ value: ANY, label: t('filters.anySpecies') }, ...speciesOptions]}
      />

      {/* Date sits directly under species and starts open. At the defense it
          was the last group and closed, so on a laptop it was one click away
          and below 1024px two (behind the Filters button, then the group) —
          and it was not found at all. "Lost dogs, but only recent ones" is
          the second thing anyone asks, after the species. */}
      <FilterGroup
        icon={CalendarDays}
        title={t('filters.date')}
        activeCount={setCount('dateFrom', 'dateTo')}
        defaultOpen
      >
        <Input
          label={t('filters.from')}
          type="date"
          value={filters.dateFrom}
          max={filters.dateTo || todayAsInputValue()}
          onChange={(event) => onChange('dateFrom', event.target.value)}
        />
        <Input
          label={t('filters.to')}
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          max={todayAsInputValue()}
          onChange={(event) => onChange('dateTo', event.target.value)}
        />
      </FilterGroup>

      <FilterGroup
        icon={Ruler}
        title={t('filters.sizeColour')}
        activeCount={setCount('size', 'color')}
      >
        <Select
          label={t('filters.size')}
          value={filters.size}
          onChange={(event) => onChange('size', event.target.value)}
          options={[{ value: ANY, label: t('filters.anySize') }, ...optionsFromLabels(PET_SIZE_LABELS)]}
        />
        <Select
          label={t('filters.colour')}
          value={filters.color}
          onChange={(event) => onChange('color', event.target.value)}
          options={[{ value: ANY, label: t('filters.anyColour') }, ...colourOptions]}
          hint={t('filters.colourHint')}
        />
      </FilterGroup>

      <FilterGroup
        icon={MapPin}
        title={t('filters.place')}
        activeCount={setCount('areaCode', 'cityCode', 'city')}
      >
        <Select
          label={areaLabel()}
          value={filters.areaCode}
          onChange={(event) => onChange('areaCode', event.target.value)}
          options={[{ value: ANY, label: t('filters.anywhere') }, ...areaOptions]}
        />
        <Select
          label={t('labels.city')}
          value={filters.cityCode}
          onChange={(event) => onChange('cityCode', event.target.value)}
          disabled={!filters.areaCode}
          options={[
            { value: ANY, label: filters.areaCode ? t('filters.anyCity') : t('filters.areaFirst') },
            ...cityOptions,
          ]}
        />
      </FilterGroup>

      <FilterGroup icon={CircleCheck} title={t('filters.status')} activeCount={setCount('status')}>
        <Select
          label={t('filters.reportStatus')}
          value={filters.status}
          onChange={(event) => onChange('status', event.target.value)}
          options={[
            { value: ANY, label: t('filters.anyStatus') },
            ...orderedOptionsFromLabels(REPORT_STATUS_LABELS, REPORT_STATUS_ORDER),
          ]}
        />
      </FilterGroup>

      <Button variant="secondary" onClick={onClear} disabled={!hasActiveFilters} fullWidth>
        {t('filters.clearAllFilters')}
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
function FilterGroup({ icon, title, activeCount, defaultOpen = false, children }) {
  // Initial only. Once somebody has opened or closed a group, that is their
  // decision, and a filter changing underneath must not overrule it.
  const [isOpen, setIsOpen] = useState(defaultOpen || activeCount > 0)

  return (
    <div className="border-t border-border pt-2">
      {/* 44px tall: a touch target, not just a line of text. At 20px these
          were the smallest controls on Explore at laptop widths, and on a
          touchscreen laptop they are exactly what gets tapped. The padding
          above is trimmed to match, so the panel barely grows. */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <FilterLabel icon={icon}>{title}</FilterLabel>

        <span className="flex shrink-0 items-center gap-2">
          {activeCount > 0 && (
            <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-hover">
              {t('filters.set', { count: activeCount })}
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
