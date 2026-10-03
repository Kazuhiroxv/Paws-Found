import { X } from 'lucide-react'
import {
  PET_SIZE_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  speciesLabel,
} from '@/constants'
import { formatDate } from '@/utils/date'

/**
 * How each filter describes itself once it is switched on. Keeping the labels
 * here means a chip reads like a sentence ("Species: Dog") instead of exposing
 * the field name.
 */
const DESCRIBERS = {
  text: (value) => `Search: "${value}"`,
  reportType: (value) => `Type: ${REPORT_TYPE_LABELS[value]}`,
  species: (value) => `Species: ${speciesLabel(value)}`,
  size: (value) => `Size: ${PET_SIZE_LABELS[value]}`,
  color: (value) => `Colour: ${value}`,
  // The wording arrives with the name ("Province: Cebu", or just "Metro
  // Manila"), because Metro Manila is not a province.
  areaCode: (value, name) => name ?? '…',
  cityCode: (value, name) => `City: ${name ?? '…'}`,
  city: (value) => `City: ${value}`,
  status: (value) => `Status: ${REPORT_STATUS_LABELS[value]}`,
  dateFrom: (value) => `From ${formatDate(value)}`,
  dateTo: (value) => `To ${formatDate(value)}`,
}

/**
 * Chips for every filter currently applied, each removable on its own.
 *
 * Without these, a filter set on mobile — where the panel is behind a dialog —
 * is invisible, and an empty result looks like a bug rather than a narrow
 * search.
 *
 * @param {Object} props
 * @param {Object} props.filters
 * @param {Record<string, string|undefined>} [props.names]  The names behind
 *   filters held as codes (area and city), for the chip to say.
 * @param {(field: string) => void} props.onRemove
 */
export function ActiveFilters({ filters, names = {}, onRemove }) {
  const active = Object.entries(filters).filter(([, value]) => value !== '')

  if (active.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2">
      {active.map(([field, value]) => (
        <li key={field}>
          <button
            type="button"
            onClick={() => onRemove(field)}
            className="inline-flex items-center gap-1 rounded-control bg-brand-soft px-2 py-1 text-sm text-brand-hover hover:bg-brand-soft/70"
          >
            {DESCRIBERS[field]?.(value, names[field]) ?? `${field}: ${value}`}
            <X size={14} aria-hidden="true" />
            <span className="sr-only">Remove this filter</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
