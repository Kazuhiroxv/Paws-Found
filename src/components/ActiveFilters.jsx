import { X } from 'lucide-react'
import { describeFilter } from '@/utils/filterDescriptions'
import { t } from '@/i18n'

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
            {describeFilter(field, value, names[field])}
            <X size={14} aria-hidden="true" />
            <span className="sr-only">{t('ui.chips.remove')}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
