import { PET_SIZE_LABELS, REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, colourLabel, speciesLabel } from '@/constants'
import { t } from '@/i18n'
import { formatDate } from '@/utils/date'

/**
 * How each search filter describes itself once it is switched on — the chips
 * above Explore's results and the "Filters applied" line on a printed list
 * (Correction 7) say the same thing, in the language showing.
 */
const DESCRIBERS = {
  text: (value) => t('ui.chips.search', { value }),
  reportType: (value) => t('ui.chips.type', { value: REPORT_TYPE_LABELS[value] }),
  species: (value) => t('ui.chips.species', { value: speciesLabel(value) }),
  size: (value) => t('ui.chips.size', { value: PET_SIZE_LABELS[value] }),
  color: (value) => t('ui.chips.colour', { value: colourLabel(value) }),
  // The wording arrives with the name ("Province: Cebu", or just "Metro
  // Manila"), because Metro Manila is not a province.
  areaCode: (value, name) => name ?? '…',
  cityCode: (value, name) => t('ui.chips.city', { value: name ?? '…' }),
  city: (value) => t('ui.chips.city', { value }),
  status: (value) => t('ui.chips.status', { value: REPORT_STATUS_LABELS[value] }),
  dateFrom: (value) => t('ui.chips.from', { value: formatDate(value) }),
  dateTo: (value) => t('ui.chips.to', { value: formatDate(value) }),
}

/**
 * One filter, said as a short phrase.
 *
 * @param {string} field
 * @param {string} value
 * @param {string} [name]  The name behind a code (area, city).
 */
export function describeFilter(field, value, name) {
  return DESCRIBERS[field]?.(value, name) ?? `${field}: ${value}`
}

/** Every filter that is switched on, as phrases. */
export function describeFilters(filters, names = {}) {
  return Object.entries(filters)
    .filter(([, value]) => value !== '' && value != null)
    .map(([field, value]) => describeFilter(field, value, names[field]))
}
