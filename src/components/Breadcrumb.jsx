import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { t } from '@/i18n'

/**
 * Trail of links back up to the current page.
 *
 * The last item is the current page and is not a link — it is marked
 * `aria-current="page"` instead.
 *
 * @param {Object} props
 * @param {{ label: string, to?: string }[]} props.items
 */
export function Breadcrumb({ items }) {
  if (!items || items.length === 0) return null

  return (
    <nav aria-label={t('ui.breadcrumb')}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={item.label} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight size={14} className="text-fg-subtle" aria-hidden="true" />
              )}

              {isLast || !item.to ? (
                <span aria-current={isLast ? 'page' : undefined} className="text-fg">
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="inline-block py-1 hover:text-fg hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
