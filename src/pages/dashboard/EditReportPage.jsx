import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Button, Container, EmptyState, LoadingSkeleton } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ReportForm } from '@/components/report-form/ReportForm'
import { useAsync } from '@/hooks/useAsync'
import { REPORT_STATUS_LABELS, REPORT_STATUSES } from '@/constants'
import { petService, userService } from '@/services'

/** The two states a report does not come back from. Mirrors REPORT_TRANSITIONS
 *  in api/reports.php, which is what actually enforces it. */
const FINISHED_STATUSES = [REPORT_STATUSES.RETURNED, REPORT_STATUSES.CLOSED]

/**
 * Edit one of your own reports.
 *
 * Reuses the reporting wizard rather than having a second form, so validation
 * and field rules cannot drift between creating and editing.
 */
export function EditReportPage() {
  const { id } = useParams()

  const loadReport = useCallback(async () => {
    const [report, user] = await Promise.all([
      petService.getReportById(id),
      userService.getCurrentUser(),
    ])
    return { report, user }
  }, [id])

  const { data, error, isLoading } = useAsync(loadReport)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit report" />
        <LoadingSkeleton lines={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Report not found" />
        <EmptyState
          icon={Lock}
          title="This report does not exist"
          description="It may have been removed, or the address may be wrong."
          action={
            <Button as={Link} to="/dashboard/reports" variant="secondary">
              Back to my reports
            </Button>
          }
        />
      </div>
    )
  }

  const { report, user } = data

  // Client-side only, like every other guard here — it keeps the interface
  // honest but is not security (CLAUDE.md §8).
  if (report.reporterId !== user?.id) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="No access" />
        <EmptyState
          icon={Lock}
          title="This is not your report"
          description="Only the person who filed a report can edit it. You can still view it and, if something is wrong with it, report the listing."
          action={
            <Button as={Link} to={`/pet/${report.id}`} variant="secondary">
              View the report
            </Button>
          }
        />
      </div>
    )
  }

  // A returned or closed case no longer accepts edits, and the API answers 409
  // if one is attempted. Reaching this page by typing the address is the only
  // way to get here now, so it explains rather than simply failing on save.
  if (FINISHED_STATUSES.includes(report.status)) {
    const word = REPORT_STATUS_LABELS[report.status]

    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="This case is finished" />
        <EmptyState
          icon={Lock}
          title={`This report shows “${word}”`}
          description="A finished report keeps the details it had when it was decided, so the case history beside it still describes what happened. If something about it is wrong, a Pet Coordinator can look at it — or file a new report if the pet is missing again."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button as={Link} to={`/pet/${report.id}`} variant="secondary">
                View the report
              </Button>
              <Button as={Link} to="/dashboard/reports" variant="ghost">
                Back to my reports
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const heading = report.petName ?? 'Found pet report'

  return (
    <Container width="form" className="flex flex-col gap-6 px-0 sm:px-0 lg:px-0">
      <PageHeader
        title={`Edit ${heading}`}
        description="Changes appear on the public report straight away."
        breadcrumb={[
          { label: 'My dashboard', to: '/dashboard' },
          { label: 'My reports', to: '/dashboard/reports' },
          { label: 'Edit' },
        ]}
      />
      <ReportForm report={report} />
    </Container>
  )
}
