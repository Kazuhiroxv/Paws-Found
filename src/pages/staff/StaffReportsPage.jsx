import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronDown, ChevronUp, FileText, Heart, MapPin, PawPrint, Search } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, EmptyState, LoadingSkeleton, Select } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { StatusBadge } from '@/components/StatusBadge'
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_ORDER,
  REPORT_TYPES,
  speciesLabel,
} from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { matchService, petService } from '@/services'
import { formatDate, formatRelativeTime } from '@/utils/date'
import { cn } from '@/utils/cn'

/**
 * Queue tabs.
 *
 * These are the four real report statuses, not the roadmap's "New / Pending
 * Review" — those describe a staff review state the data model does not have,
 * and inventing one to fill a tab would be the wrong way round. If the team
 * wants an explicit review state, it should be added deliberately.
 */
const TABS = [
  { id: 'all', label: 'All' },
  ...REPORT_STATUS_ORDER.map((status) => ({ id: status, label: REPORT_STATUS_LABELS[status] })),
]

async function loadQueue() {
  const [reports, matches] = await Promise.all([petService.getReports(), matchService.getMatches()])
  return { reports, matches }
}

export function StaffReportsPage() {
  const [tab, setTab] = useState(REPORT_STATUSES.ACTIVE)
  // Most recently touched first — where a coordinator picks up from.
  const [sort, setSort] = useState({ key: 'updated', direction: 'desc' })
  const { data, error, isLoading } = useAsync(loadQueue)
  // Narrowing within the loaded queue. The report list already came back in
  // full (up to the API's 50-per-request cap), so this filters in the browser
  // rather than asking the server again.
  const [filters, setFilters] = useState({ text: '', type: '', species: '' })
  const navigate = useNavigate()

  // Clicking the active column flips it; clicking a new one starts ascending.
  const toggleSort = (key) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )

  const header = (
    <PageHeader
      icon={FileText}
      eyebrow="Pet Coordinator"
      title="Report queue"
      description="Every lost and found report in the system, grouped by where it stands."
      breadcrumb={[{ label: 'Staff workspace', to: '/staff' }, { label: 'Report queue' }]}
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
          The queue could not be loaded: {error.message}
        </p>
      </div>
    )
  }

  const { reports, matches } = data
  const needle = filters.text.trim().toLowerCase()
  const matchesFilters = (report) =>
    (!filters.type || report.reportType === filters.type) &&
    (!filters.species || report.species === filters.species) &&
    (!needle ||
      [report.petName, report.breed, speciesLabel(report.species), report.primaryColor, report.secondaryColor, report.location.city, report.location.label]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle)))
  const filtered = reports.filter(matchesFilters)
  const isFiltering = Boolean(needle || filters.type || filters.species)
  const speciesOptions = [...new Set(reports.map((report) => report.species))].map((value) => ({
    value,
    label: speciesLabel(value),
  }))

  // Counts follow the filters, so a tab never promises rows it will not show.
  const countFor = (id) =>
    id === 'all' ? filtered.length : filtered.filter((report) => report.status === id).length

  const visible = tab === 'all' ? filtered : filtered.filter((report) => report.status === tab)

  const matchCountFor = (reportId) =>
    matches.filter((match) => match.lostReportId === reportId || match.foundReportId === reportId)
      .length

  // What each sortable column compares on. Dates are ISO strings, so they sort
  // correctly as text; status sorts by workflow order rather than alphabetically.
  const sortValues = {
    report: (report) => (report.petName ?? speciesLabel(report.species)).toLowerCase(),
    location: (report) => report.location.city.toLowerCase(),
    date: (report) => report.incidentDate,
    status: (report) => REPORT_STATUS_ORDER.indexOf(report.status),
    match: (report) => matchCountFor(report.id),
    updated: (report) => report.updatedAt,
  }

  const readValue = sortValues[sort.key]
  const sorted = [...visible].sort((a, b) => {
    const left = readValue(a)
    const right = readValue(b)
    if (left === right) return 0
    return (left < right ? -1 : 1) * (sort.direction === 'asc' ? 1 : -1)
  })

  const headerProps = { sort, onSort: toggleSort }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {/* The queue summary and the queue filter are the same control.
          
          These were a strip of small text tabs with the count tucked beside
          the word — legible, but they read as navigation rather than as the
          state of the queue. The reference design puts a row of counts at the
          top of a workspace, so the counts became the tabs: the number leads,
          the word explains it, and choosing one still filters the table.
          
          Splitting them into a display row plus a separate tab strip would
          have printed every number on the page twice. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="tablist">
        {TABS.map((item) => {
          const isCurrent = tab === item.id

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => setTab(item.id)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-card border px-4 py-3 text-left transition-colors',
                isCurrent
                  ? 'border-brand/40 bg-brand-soft'
                  : 'border-border bg-panel hover:border-border-strong',
              )}
            >
              <span
                className={cn(
                  'text-2xl leading-none font-semibold tabular-nums',
                  isCurrent ? 'text-brand-hover' : 'text-fg',
                )}
              >
                {countFor(item.id)}
              </span>
              <span
                className={cn(
                  'text-sm',
                  isCurrent ? 'font-medium text-brand-hover' : 'text-fg-muted',
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Utility row: search and two filters over the loaded queue. */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <label className="relative">
          <span className="sr-only">Search reports</span>
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.text}
            onChange={(event) => setFilters((f) => ({ ...f, text: event.target.value }))}
            placeholder="Name, breed, colour or city"
            className="h-10 w-full rounded-control border border-border-strong bg-panel pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted"
          />
        </label>
        <Select
          label="Type"
          hideLabel
          value={filters.type}
          onChange={(event) => setFilters((f) => ({ ...f, type: event.target.value }))}
          options={[
            { value: '', label: 'Lost & found' },
            { value: REPORT_TYPES.LOST, label: 'Lost only' },
            { value: REPORT_TYPES.FOUND, label: 'Found only' },
          ]}
        />
        <Select
          label="Species"
          hideLabel
          value={filters.species}
          onChange={(event) => setFilters((f) => ({ ...f, species: event.target.value }))}
          options={[{ value: '', label: 'Any species' }, ...speciesOptions]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title={isFiltering ? 'No reports match these filters' : 'Nothing in this queue'}
          description={
            isFiltering
              ? 'Try another word, or clear the filters.'
              : 'Reports will appear here as they reach this status.'
          }
          action={
            isFiltering && (
              <Button variant="secondary" onClick={() => setFilters({ text: '', type: '', species: '' })}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Phones and tablets: one case card per report, most important
              fields first. No squeezed table and no sideways scrolling. The
              well behind them groups the queue without another border. */}
          <ul className="flex flex-col gap-3 rounded-card bg-sunken/60 p-3 lg:hidden">
            {sorted.map((report) => (
              <QueueCard key={report.id} report={report} matchCount={matchCountFor(report.id)} />
            ))}
          </ul>

          {/* Laptops and wider: a management table a coordinator can scan and
              sort. The row opens the report; the name is its keyboard link. */}
          <div className="hidden rounded-card bg-sunken/60 p-3 lg:block">
            <div className="rounded-card border border-border bg-panel">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-[4.5rem] z-10 border-b border-border bg-surface-muted text-fg shadow-[0_1px_0_var(--color-border)] [&>tr>th:first-child]:rounded-tl-card [&>tr>th:last-child]:rounded-tr-card">
                <tr>
                  <th scope="col" className="w-16 py-2.5 pl-4">
                    <span className="sr-only">Photo</span>
                  </th>
                  <SortableHeader label="Report" sortKey="report" {...headerProps} />
                  <SortableHeader label="Location" sortKey="location" {...headerProps} />
                  <SortableHeader label="Incident" sortKey="date" {...headerProps} />
                  <SortableHeader label="Status" sortKey="status" {...headerProps} />
                  <SortableHeader label="Matches" sortKey="match" {...headerProps} />
                  <SortableHeader label="Updated" sortKey="updated" className="pr-4" {...headerProps} />
                </tr>
              </thead>

              <tbody className="divide-y divide-border [&>tr:last-child>td:first-child]:rounded-bl-card [&>tr:last-child>td:last-child]:rounded-br-card">
                {sorted.map((report) => {
                  const matchCount = matchCountFor(report.id)

                  return (
                    <tr
                      key={report.id}
                      onClick={(event) => {
                        // A click on the name or the match link does its own thing.
                        if (event.target.closest('a')) return
                        navigate(`/pet/${report.id}`)
                      }}
                      className="cursor-pointer align-middle transition-colors hover:bg-surface has-[a:focus-visible]:bg-surface"
                    >
                      <td className="py-3 pl-4">
                        <Thumb report={report} className="size-11" />
                      </td>

                      <td className="px-2 py-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <ReportTypeBadge reportType={report.reportType} size="sm" />
                            <Link to={`/pet/${report.id}`} className="font-semibold text-fg hover:underline">
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
                        {formatDate(report.incidentDate)}
                      </td>

                      <td className="px-2 py-3">
                        <StatusBadge status={report.status} variant="pill" />
                      </td>

                      <td className="px-2 py-3">
                        <MatchLink count={matchCount} />
                      </td>

                      <td className="py-3 pr-4 pl-2 whitespace-nowrap text-fg-muted">
                        {formatRelativeTime(report.updatedAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** A report as a compact case card, for narrower screens. */
function QueueCard({ report, matchCount }) {
  return (
    <li className="relative flex gap-3 rounded-card border border-border bg-panel p-3 shadow-card has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand">
      <Thumb report={report} className="size-18 shrink-0" />
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
          {[speciesLabel(report.species), report.breed].filter(Boolean).join(' · ')}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} className="shrink-0 text-fg-subtle" aria-hidden="true" />
            {report.location.city}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={13} className="shrink-0 text-fg-subtle" aria-hidden="true" />
            {formatDate(report.incidentDate)}
          </span>
        </p>
        <div className="relative mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-fg-muted">
          <MatchLink count={matchCount} />
          <span>Updated {formatRelativeTime(report.updatedAt)}</span>
        </div>
      </div>
    </li>
  )
}

function MatchLink({ count }) {
  if (count === 0) {
    return (
      <span className="text-fg-muted">
        —<span className="sr-only">No matches</span>
      </span>
    )
  }

  return (
    <Link
      to="/staff/matches"
      className="relative inline-flex items-center gap-1 font-medium whitespace-nowrap text-lost hover:underline"
    >
      <Heart size={14} aria-hidden="true" />
      {count} {count === 1 ? 'match' : 'matches'}
    </Link>
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

/**
 * One sortable column header.
 *
 * `aria-sort` is what tells a screen reader which column the table is ordered
 * by and in which direction — without it the arrow is meaningless to anyone
 * not looking at it.
 */
function SortableHeader({ label, sortKey, sort, onSort, className }) {
  const isActive = sort.key === sortKey
  const Arrow = sort.direction === 'asc' ? ChevronUp : ChevronDown

  return (
    <th
      scope="col"
      aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-2 py-2.5 font-medium', className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 hover:underline',
          isActive && 'font-semibold',
        )}
      >
        {label}
        {isActive && <Arrow size={14} aria-hidden="true" />}
      </button>
    </th>
  )
}
