import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ClipboardCheck, MapPin } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { REPORT_TYPES, speciesLabel } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { petService } from '@/services'
import { formatDate, formatRelativeTime, formatTime12Hour } from '@/utils/date'

const loadQueue = () => petService.getReportsForReview()

/**
 * Report review (Correction 4): every report waiting for a Pet Coordinator
 * before it may be published, oldest first — whoever has waited longest is
 * next. "pet coordinator muna sa reports bago mapost."
 *
 * Each opens the full report — photographs, description, distinctive
 * features, place and time, who filed it — with Approve and Not approved
 * beside it (PublicationPanel). A decision is made on the whole report, not
 * on this summary.
 */
export function StaffReviewPage() {
  const { data: reports, error, isLoading } = useAsync(loadQueue)

  const header = (
    <PageHeader
      icon={ClipboardCheck}
      eyebrow="Pet Coordinator"
      title="Report review"
      description="New reports wait here until a Pet Coordinator approves them. Nothing here is public, and nothing here is compared with other reports yet."
      breadcrumb={[{ label: 'Staff workspace', to: '/staff' }, { label: 'Report review' }]}
    />
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingSkeleton lines={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p role="alert" className="text-sm text-danger">
          The review queue could not be loaded: {error.message}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <p className="text-sm text-fg-muted" aria-live="polite">
        {reports.length === 0
          ? 'Nothing is waiting for review.'
          : `${reports.length} ${reports.length === 1 ? 'report is' : 'reports are'} waiting, oldest first.`}
      </p>

      {reports.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="All caught up"
          description="When somebody submits a report, it appears here for review before anyone else can see it."
        />
      ) : (
        <ul className="flex flex-col gap-4" data-review-queue>
          {reports.map((report) => (
            <ReviewItem key={report.id} report={report} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReviewItem({ report }) {
  const isFound = report.reportType === REPORT_TYPES.FOUND
  const photo = report.photos[0]
  const name = report.petName ?? `${speciesLabel(report.species)} (name unknown)`
  const looks = [speciesLabel(report.species), report.breed, report.size && `${report.size}`, report.primaryColor]
    .filter(Boolean)
    .join(' · ')

  return (
    <li>
      <article className="flex flex-col gap-4 rounded-card border border-border bg-panel p-4 shadow-card sm:flex-row sm:items-center sm:gap-5">
        <img
          src={photo?.url ?? photoPlaceholder}
          alt={photo ? photo.alt || '' : 'No photo was provided for this report'}
          loading="lazy"
          className="aspect-16/9 w-full shrink-0 rounded-control bg-surface-muted object-cover sm:aspect-square sm:size-24"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <ReportTypeBadge reportType={report.reportType} size="sm" />
            <span className="text-xs text-fg-muted">
              Waiting since {formatRelativeTime(report.updatedAt)}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-fg">{name}</h2>
          <p className="text-sm text-fg-muted">{looks}</p>
          <p className="flex items-center gap-1.5 text-sm text-fg-muted">
            <MapPin size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
            {report.location.city}, {report.location.province}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-fg-muted">
            <CalendarDays size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
            {isFound ? 'Found' : 'Last seen'} {formatDate(report.incidentDate)}
            {report.incidentTime && `, around ${formatTime12Hour(report.incidentTime)}`}
          </p>
        </div>
        <Button as={Link} to={`/pet/${report.id}`} size="sm" className="sm:shrink-0">
          Review
          <ArrowRight size={14} aria-hidden="true" />
        </Button>
      </article>
    </li>
  )
}
