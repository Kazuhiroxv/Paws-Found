import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { speciesLabel } from '@/constants'
import { formatCardDate } from '@/utils/date'
import { cn } from '@/utils/cn'
import { ReportTypeBadge } from './ReportTypeBadge'
import { StatusBadge } from './StatusBadge'
import { t } from '@/i18n'

/**
 * THE card for a pet report. Use it everywhere a report appears in a list —
 * homepage, explore grid, dashboard, staff queues. Extend it with a prop
 * rather than forking it (docs/ui-inventory.md).
 *
 * The photograph is the point, so it gets the whole width and carries the two
 * facts you scan for — is this lost or found, and how recent is it — as
 * overlays. Everything below is the identifying detail, in the order someone
 * actually reads it: who, what, where.
 *
 * @param {Object} props
 * @param {Object} props.report  A report from petService.
 * @param {'dot'|'pill'} [props.statusVariant]  How the status reads; the
 *   customer dashboard uses the filled pill, public listings the quieter dot.
 */
export function PetCard({ report, statusVariant = 'dot', className }) {
  const primaryPhoto = report.photos.find((photo) => photo.isPrimary) ?? report.photos[0]
  const hasPhoto = Boolean(primaryPhoto?.url)

  // A found report has no name — the finder does not know it — so the species
  // stands in as the headline.
  const heading = report.petName ?? t('common.nameUnknown', { species: speciesLabel(report.species) })

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card border border-border bg-panel shadow-card',
        // Level 3 at rest, level 4 under the pointer: lifting is how a card
        // says it can be clicked (see `card-interactive` in index.css).
        'card-interactive hover:border-border-strong',
        'focus-within:-translate-y-0.5 focus-within:border-border-strong focus-within:shadow-hover',
        className,
      )}
    >
      <div className="relative">
        <img
          src={hasPhoto ? primaryPhoto.url : photoPlaceholder}
          // The placeholder says nothing about this particular pet, so it is
          // announced as such rather than reusing the report's own alt text.
          alt={hasPhoto ? primaryPhoto.alt : t('ui.noPhoto')}
          // Cropped a little above centre: a pet's face is usually in the
          // upper half of the frame, and a dead-centre crop of a portrait
          // phone photo takes the ears off. Same bias on every card thumbnail.
          className="aspect-4/3 w-full bg-surface-muted object-cover object-[50%_35%] transition-transform duration-200 group-hover:scale-[1.02]"
          loading="lazy"
        />

        <ReportTypeBadge
          reportType={report.reportType}
          className="absolute top-3 left-3 shadow-card"
        />

        <span className="absolute top-3 right-3 rounded-pill bg-panel/90 px-3 py-1 text-sm font-medium text-fg shadow-card backdrop-blur-sm">
          {formatCardDate(report.incidentDate)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h3 className="text-lg leading-snug font-semibold text-fg">
          {/* Stretched link: the whole card is clickable, but only the name is
              announced as the link target. */}
          <Link to={`/pet/${report.id}`} className="after:absolute after:inset-0">
            {heading}
          </Link>
        </h3>

        <p className="text-sm text-fg-muted">
          {speciesLabel(report.species)}
          {report.breed && ` · ${report.breed}`}
        </p>

        <p className="mt-auto flex items-center gap-1.5 pt-2 text-sm text-fg-muted">
          <MapPin size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
          <span className="truncate">
            {report.location.city}, {report.location.province}
          </span>
        </p>

        <div className="mt-2">
          <StatusBadge status={report.status} variant={statusVariant} />
        </div>
      </div>
    </article>
  )
}
