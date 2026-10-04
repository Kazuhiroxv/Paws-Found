import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Rich } from '@/i18n/Rich'
import { cn } from '@/utils/cn'

/**
 * The short form of the disclaimer where two people may meet (Correction 7):
 * on a report's possible matches and on a person's own matches. A public
 * place, check the pet, never pay — and Paws&Found cannot vouch for who
 * anybody is. Links to the full guidance rather than repeating it.
 */
export function HandoverNotice({ className }) {
  return (
    <p
      data-handover-notice=""
      className={cn(
        'flex items-start gap-2 rounded-control border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-fg',
        className,
      )}
    >
      <ShieldAlert size={16} className="mt-0.5 shrink-0 text-lost" aria-hidden="true" />
      <span>
        <Rich
          k="disclaimer.short.handover"
          tags={{
            link: (text) => (
              <Link to="/disclaimer#disclaimer-safety" className="font-medium text-brand underline">
                {text}
              </Link>
            ),
          }}
        />
      </span>
    </p>
  )
}
