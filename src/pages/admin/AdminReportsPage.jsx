import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, HandHeart, ListChecks, Search, TriangleAlert } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, EmptyState, LoadingSkeleton, Select, SidePanel } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { StatTile } from '@/components/StatTile'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { StatusBadge } from '@/components/StatusBadge'
import {
  PET_SEX_LABELS,
  PET_SIZE_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_ORDER,
  REPORT_TYPES,
  speciesLabel,
} from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { petService, userService } from '@/services'
import { orderedOptionsFromLabels } from '@/utils/options'
import { formatCardDate, formatShortDate } from '@/utils/date'

async function loadRecords() {
  const [reports, users] = await Promise.all([petService.getReports(), userService.getUsers()])
  return {
    reports,
    usersById: Object.fromEntries(users.map((user) => [user.id, user])),
  }
}

const PER_PAGE = 12

const SORTS = {
  updated: { label: 'Recently updated', by: (report) => report.updatedAt },
  incident: { label: 'Most recent incident', by: (report) => report.incidentDate },
}

/**
 * Record oversight.
 *
 * Read-only on purpose. Administrators review records and check who filed
 * what; acting on a specific pet case is a Pet Coordinator's job, and removing
 * a report happens through moderation, where a reason is recorded and the
 * reporter is told (CLAUDE.md §4.3).
 *
 * A dense table rather than a card per report: thirty-two cards was a page and
 * a half of scrolling to answer "how many of these are closed".
 */
export function AdminReportsPage() {
  const { data, error, isLoading } = useAsync(loadRecords)
  const [search, setSearch] = useState('')
  // The Overview's "All closed reports" link arrives as ?status=closed.
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const [type, setType] = useState('')
  const [species, setSpecies] = useState('')
  const [sort, setSort] = useState('updated')
  const [page, setPage] = useState(1)
  // The record being read. Opening one used to leave the page entirely, which
  // threw away the filters, the sort and which page of results you were on —
  // so checking three records meant setting the filters up three times.
  const [selected, setSelected] = useState(null)

  // Narrowing the list starts again at page one — otherwise a filter can leave
  // you on a page that no longer exists.
  const narrow = (set) => (value) => {
    set(value)
    setPage(1)
  }
  const setStatus = narrow((value) => setParams(value ? { status: value } : {}, { replace: true }))

  const header = (
    <PageHeader
      icon={ListChecks}
      eyebrow="Administrator"
      title="Reports"
      description="Every lost and found record in the system, and who filed it."
      breadcrumb={[{ label: 'Administration', to: '/admin' }, { label: 'Reports' }]}
    />
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingSkeleton lines={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p role="alert" className="text-sm text-danger">
          The records could not be loaded: {error.message}
        </p>
      </div>
    )
  }

  const { reports, usersById } = data
  const needle = search.trim().toLowerCase()
  const isFiltering = Boolean(needle || status || type || species)

  const visible = reports
    .filter((report) => {
      if (status && report.status !== status) return false
      if (type && report.reportType !== type) return false
      if (species && report.species !== species) return false
      if (!needle) return true

      const reporter = usersById[report.reporterId]
      return [report.petName, report.breed, report.location.city, reporter?.fullName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    })
    .sort((a, b) => (SORTS[sort].by(a) < SORTS[sort].by(b) ? 1 : -1))

  const speciesOptions = [...new Set(reports.map((report) => report.species))].map((value) => ({
    value,
    label: speciesLabel(value),
  }))

  const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE))
  const current = Math.min(page, totalPages)
  const shown = visible.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setType('')
    setSpecies('')
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {/* The shape of the whole record set, before any filter narrows it.
          Counted from `reports` rather than from the filtered view on purpose:
          these answer "what is in the system", and a total that moved every
          time somebody typed in the search box would answer nothing. */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li className="contents">
          <StatTile icon={ListChecks} label="Records" value={reports.length} />
        </li>
        <li className="contents">
          <StatTile
            icon={TriangleAlert}
            label="Lost reports"
            value={reports.filter((r) => r.reportType === REPORT_TYPES.LOST).length}
          />
        </li>
        <li className="contents">
          <StatTile
            icon={HandHeart}
            label="Found reports"
            value={reports.filter((r) => r.reportType === REPORT_TYPES.FOUND).length}
          />
        </li>
        <li className="contents">
          <StatTile
            icon={CircleCheck}
            label="Back home"
            value={reports.filter((r) => r.status === 'returned').length}
          />
        </li>
      </ul>

      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_10rem_11rem_10rem]">
          <label className="relative">
            <span className="sr-only">Search records</span>
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => narrow(setSearch)(event.target.value)}
              placeholder="Pet name, breed, city or reporter"
              className="h-10 w-full rounded-control border border-border-strong bg-panel pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted"
            />
          </label>
          <Select
            label="Status"
            hideLabel
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: '', label: 'Any status' },
              ...orderedOptionsFromLabels(REPORT_STATUS_LABELS, REPORT_STATUS_ORDER),
            ]}
          />
          <Select
            label="Type"
            hideLabel
            value={type}
            onChange={(event) => narrow(setType)(event.target.value)}
            options={[
              { value: '', label: 'Lost & found' },
              { value: REPORT_TYPES.LOST, label: 'Lost only' },
              { value: REPORT_TYPES.FOUND, label: 'Found only' },
            ]}
          />
          <Select
            label="Species"
            hideLabel
            value={species}
            onChange={(event) => narrow(setSpecies)(event.target.value)}
            options={[{ value: '', label: 'Any species' }, ...speciesOptions]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm text-fg-muted" aria-live="polite">
            {isFiltering
              ? `${visible.length} of ${reports.length} records`
              : `${reports.length} ${reports.length === 1 ? 'record' : 'records'}`}
          </p>
          {isFiltering && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <label className="ml-auto flex items-center gap-2 text-sm text-fg-muted">
            Sort by
            <select
              value={sort}
              onChange={(event) => narrow(setSort)(event.target.value)}
              className="h-9 rounded-control border border-border-strong bg-panel px-2 text-sm text-fg"
            >
              {Object.entries(SORTS).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No records match"
          description="Try a broader search, a different status, or clear the filters."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Phones and tablets: one compact management card per record. */}
          <ul className="flex flex-col gap-3 rounded-card bg-sunken/60 p-3 lg:hidden">
            {shown.map((report) => (
              <RecordCard
                key={report.id}
                report={report}
                reporter={data.usersById[report.reporterId]}
              />
            ))}
          </ul>

          <div className="hidden rounded-card bg-sunken/60 p-3 lg:block">
            <div className="rounded-card border border-border bg-panel">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-[4.5rem] z-10 border-b border-border bg-surface-muted text-fg shadow-[0_1px_0_var(--color-border)] [&>tr>th:first-child]:rounded-tl-card [&>tr>th:last-child]:rounded-tr-card">
                <tr>
                  <th scope="col" className="w-14 py-2.5 pl-4">
                    <span className="sr-only">Photo</span>
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    Report
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    Location
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    Incident
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    Reporter
                  </th>
                  <th scope="col" className="py-2.5 pr-4 pl-2 font-medium">
                    Updated
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border [&>tr:last-child>td:first-child]:rounded-bl-card [&>tr:last-child>td:last-child]:rounded-br-card">
                {shown.map((report) => {
                  const reporter = usersById[report.reporterId]

                  return (
                    <tr
                      key={report.id}
                      onClick={(event) => {
                        // A click on the name is a link and does its own thing:
                        // it opens the full public report. The row opens the
                        // panel beside the table instead.
                        if (event.target.closest('a')) return
                        setSelected(report)
                      }}
                      className="cursor-pointer align-middle transition-colors hover:bg-surface has-[a:focus-visible]:bg-surface"
                    >
                      <td className="py-3 pl-4">
                        <Thumb report={report} className="size-10" />
                      </td>

                      <td className="px-2 py-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <ReportTypeBadge reportType={report.reportType} size="sm" />
                            <Link
                              to={`/pet/${report.id}`}
                              className="font-medium text-fg hover:underline"
                            >
                              {reportName(report)}
                            </Link>
                          </div>
                          <span className="text-fg-muted">
                            {[speciesLabel(report.species), report.breed].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      </td>

                      <td className="px-2 py-3 text-fg-muted">{report.location.city}</td>

                      <td className="px-2 py-3 whitespace-nowrap text-fg-muted">
                        {formatShortDate(report.incidentDate)}
                      </td>

                      <td className="px-2 py-3">
                        <StatusBadge status={report.status} variant="pill" />
                      </td>

                      <td className="px-2 py-3">
                        <Reporter reporter={reporter} />
                      </td>

                      <td className="py-3 pr-4 pl-2 whitespace-nowrap text-fg-muted">
                        {formatCardDate(report.updatedAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-2">
              <Pagination page={current} totalPages={totalPages} onChange={setPage} />
              <p className="text-sm text-fg-muted" aria-live="polite">
                Showing {(current - 1) * PER_PAGE + 1}–{(current - 1) * PER_PAGE + shown.length} of{' '}
                {visible.length}
              </p>
            </div>
          )}
        </>
      )}

      {/* Beside the table, not over it: the list stays lit and stays
          clickable, so working through several records is one click each
          rather than open-read-close-find-your-place. */}
      <SidePanel
        isOpen={Boolean(selected)}
        eyebrow="Record"
        title={selected ? reportName(selected) : ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <RecordPanel report={selected} reporter={usersById[selected.reporterId]} />
        )}
      </SidePanel>
    </div>
  )
}

/**
 * One record, read in full without leaving the list.
 *
 * Everything here comes off the report the table already loaded, so opening
 * the panel costs no request. Contact details are shown because this page is
 * administrators only and the API has already decided they may see them —
 * the panel does not go looking for anything the row was not given.
 */
function RecordPanel({ report, reporter }) {
  const colours = [report.primaryColor, report.secondaryColor].filter(Boolean).join(' and ')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-3">
        <Thumb report={report} className="size-20 shrink-0" />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ReportTypeBadge reportType={report.reportType} size="sm" />
            <StatusBadge status={report.status} variant="pill" />
          </div>
          <p className="text-sm text-fg-muted">
            {[speciesLabel(report.species), report.breed].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <PanelRow term="Colour" value={colours} />
        <PanelRow term="Size" value={report.size ? PET_SIZE_LABELS[report.size] : null} />
        <PanelRow term="Sex" value={report.sex ? PET_SEX_LABELS[report.sex] : null} />
        <PanelRow
          term="Distinctive features"
          value={report.distinctiveMarkings}
        />
        <PanelRow
          term="Area"
          value={`${report.location.city}, ${report.location.province}`}
        />
        <PanelRow term="Incident date" value={formatShortDate(report.incidentDate)} />
        <PanelRow term="Last updated" value={formatCardDate(report.updatedAt)} />
        <PanelRow term="Filed by" value={reporter?.fullName} />
        <PanelRow term="Contact" value={reporter?.email} />
      </dl>

      {report.description && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium text-fg">What happened</h3>
          <p className="text-sm leading-relaxed text-fg-muted">{report.description}</p>
        </div>
      )}

      <Button as={Link} to={`/pet/${report.id}`} variant="secondary" fullWidth>
        Open the full report
      </Button>
    </div>
  )
}

/** One term and its value. Anything the reporter left blank says so. */
function PanelRow({ term, value }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3">
      <dt className="text-fg-muted">{term}</dt>
      <dd className={value ? 'text-fg' : 'text-fg-subtle'}>{value || 'Not given'}</dd>
    </div>
  )
}

/** One record as a card, for narrower screens. */
function RecordCard({ report, reporter }) {
  return (
    <li className="relative flex gap-3 rounded-card border border-border bg-panel p-3 shadow-card has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand">
      <Thumb report={report} className="size-16 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <ReportTypeBadge reportType={report.reportType} size="sm" />
          <StatusBadge status={report.status} variant="pill" />
        </div>

        <Link
          to={`/pet/${report.id}`}
          className="font-semibold text-fg after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
        >
          {reportName(report)}
        </Link>

        <p className="text-sm text-fg-muted">
          {report.location.city} · {formatShortDate(report.incidentDate)}
        </p>

        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
          <Reporter reporter={reporter} />
          <span className="text-fg-muted">Updated {formatCardDate(report.updatedAt)}</span>
        </div>
      </div>
    </li>
  )
}

/** Who filed it — and, quietly, whether their account still works. */
function Reporter({ reporter }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-fg">{reporter?.fullName ?? 'Unknown reporter'}</span>
      {reporter?.accountStatus === 'suspended' && (
        <span className="text-xs font-medium text-danger">Account suspended</span>
      )}
    </span>
  )
}

function Thumb({ report, className }) {
  const photo = report.photos.find((item) => item.isPrimary) ?? report.photos[0]

  return (
    <img
      src={photo?.url ?? photoPlaceholder}
      alt=""
      loading="lazy"
      className={`rounded-control bg-surface-muted object-cover ${className}`}
    />
  )
}

function reportName(report) {
  return report.petName ?? `${speciesLabel(report.species)} (name unknown)`
}
