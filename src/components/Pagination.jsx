import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { t } from '@/i18n'

/**
 * Which page numbers to draw.
 *
 * Every page while there are few. Once there are more than seven, the first,
 * the last and the current page's neighbours, with the jumps marked by an
 * ellipsis — otherwise a large result set prints a row of a hundred links.
 */
function pageItems(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const wanted = [1, totalPages, current, current - 1, current + 1]
  const shown = [...new Set(wanted)]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  const items = []
  let previous = 0

  for (const page of shown) {
    if (page - previous > 1) items.push('gap')
    items.push(page)
    previous = page
  }

  return items
}

const buttonBase =
  'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-control border px-3 text-sm ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Numbered page links for a paged list.
 *
 * Renders nothing when everything fits on one page — a lone "1" tells the
 * reader nothing and only adds clutter.
 *
 * It is a `nav` with its own label because a page can hold more than one
 * navigation landmark, and "Pagination" is what distinguishes this one from the
 * site menu. The current page carries `aria-current`, so a screen reader
 * announces where it is rather than only what it can reach.
 *
 * @param {Object} props
 * @param {number} props.page        Current page, 1-based.
 * @param {number} props.totalPages
 * @param {(page: number) => void} props.onChange
 */
export function Pagination({ page, totalPages, onChange, className }) {
  if (totalPages <= 1) return null

  const items = pageItems(page, totalPages)

  return (
    <nav aria-label={t('ui.pagination.label')} className={cn('flex justify-center', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          <button
            type="button"
            onClick={() => onChange(page - 1)}
            disabled={page === 1}
            className={cn(buttonBase, 'border-border-strong bg-panel text-fg hover:bg-surface-muted')}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {/* The word is hidden on a phone, where the row has to stay on one
                line, but never removed — an icon-only control needs its name. */}
            <span className="sr-only sm:not-sr-only">{t('ui.pagination.previous')}</span>
          </button>
        </li>

        {items.map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-sm text-fg-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => onChange(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={t('ui.pagination.page', { page: item })}
                className={cn(
                  buttonBase,
                  item === page
                    ? 'border-brand bg-brand font-semibold text-fg-inverted'
                    : 'border-border-strong bg-panel text-fg hover:bg-surface-muted',
                )}
              >
                {item}
              </button>
            </li>
          ),
        )}

        <li>
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={page === totalPages}
            className={cn(buttonBase, 'border-border-strong bg-panel text-fg hover:bg-surface-muted')}
          >
            <span className="sr-only sm:not-sr-only">{t('ui.pagination.next')}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
