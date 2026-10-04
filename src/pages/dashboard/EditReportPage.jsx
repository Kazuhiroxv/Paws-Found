import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Button, Container, EmptyState, LoadingSkeleton } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ReportForm } from '@/components/report-form/ReportForm'
import { useAsync } from '@/hooks/useAsync'
import { REPORT_STATUS_LABELS, REPORT_STATUSES } from '@/constants'
import { petService, userService } from '@/services'
import { t } from '@/i18n'

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
        <PageHeader title={t('editReport.title')} />
        <LoadingSkeleton lines={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('detail.notFound')} />
        <EmptyState
          icon={Lock}
          title={t('detail.missing')}
          description={t('detail.missingBody')}
          action={
            <Button as={Link} to="/dashboard/reports" variant="secondary">
              {t('editReport.backToMine')}
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
        <PageHeader title={t('shell.access.title')} />
        <EmptyState
          icon={Lock}
          title={t('editReport.notYours')}
          description={t('editReport.notYoursBody')}
          action={
            <Button as={Link} to={`/pet/${report.id}`} variant="secondary">
              {t('editReport.view')}
            </Button>
          }
        />
      </div>
    )
  }

  // Paused, not finished: while a possible match is open the report is frozen,
  // so the pairing's score and reasons keep describing what is being verified.
  // The API answers 409 as well; this says why and where to go instead.
  if (report.status === REPORT_STATUSES.POSSIBLE_MATCH) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('editReport.paused')} />
        <EmptyState
          icon={Lock}
          title={t('editReport.openMatch')}
          description={t('editReport.openMatchBody')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button as={Link} to="/dashboard/matches">
                {t('editReport.reviewMatch')}
              </Button>
              <Button as={Link} to={`/pet/${report.id}`} variant="secondary">
                {t('editReport.view')}
              </Button>
            </div>
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
        <PageHeader title={t('editReport.finished')} />
        <EmptyState
          icon={Lock}
          title={t('editReport.shows', { status: word })}
          description={t('editReport.finishedBody')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button as={Link} to={`/pet/${report.id}`} variant="secondary">
                {t('editReport.view')}
              </Button>
              <Button as={Link} to="/dashboard/reports" variant="ghost">
                {t('editReport.backToMine')}
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const heading = report.petName ?? t('editReport.foundReport')

  return (
    // The same width as the report pages, because it is the same wizard; the
    // narrow form width left its fields about 300px wide.
    <Container width="page" className="flex flex-col gap-6 px-0 sm:px-0 lg:px-0">
      <PageHeader
        title={t('editReport.editName', { name: heading })}
        description={t('editReport.description')}
        breadcrumb={[
          { label: t('dashboard.title'), to: '/dashboard' },
          { label: t('myReports.title'), to: '/dashboard/reports' },
          { label: t('common.edit') },
        ]}
      />
      <ReportForm report={report} />
    </Container>
  )
}
