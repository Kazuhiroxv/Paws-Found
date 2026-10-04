import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  PUBLICATION_STATUS_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  colourLabel,
  speciesLabel,
} from '@/constants'
import { t } from '@/i18n'
import { formatDate, formatDateTime } from '@/utils/date'

/**
 * A report list laid out for paper (Correction 7: "Gusto kong iprint sa PDF …
 * list lang siya" — the instructor, filtering Explore during the defense).
 *
 * Browser-native on purpose: this is a plain table drawn outside the app's
 * root, the page's own chrome is hidden by the print stylesheet
 * (`.print-sheet` in index.css), and `window.print()` hands it to the
 * browser — which offers every printer and "Save as PDF". No PDF library, no
 * server-side rendering, and it works offline.
 *
 * It prints exactly the rows it is given, which are the rows the server
 * already returned to this account for the list on screen: it asks for
 * nothing the page could not show, so it can never print more than the
 * account may see. Every value is rendered as React text, never as HTML.
 *
 * Deliberately left out: contact details, reporter accounts, IP addresses,
 * sessions, activity and audit records. A list for finding pets, not a
 * record of the people who filed them.
 *
 * @param {Object} props
 * @param {string} props.title           e.g. "Explore results".
 * @param {string[]} props.filters       What narrowed the list, already said in words.
 * @param {Array} props.reports          The rows to print.
 * @param {boolean} [props.showPublication]  Coordinators and administrators see
 *   pending, not-approved and removed reports; the public only published ones.
 * @param {() => void} props.onDone      Called after the print dialog closes.
 */
export function PrintReportList({ title, filters, reports, showPublication = false, onDone }) {
  // Open the print dialog once the sheet is on the page, and tidy up when it
  // closes. `afterprint` fires whether the person printed, saved or cancelled.
  useEffect(() => {
    document.body.classList.add('printing-report-list')
    const finish = () => onDone()
    window.addEventListener('afterprint', finish)
    const timer = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', finish)
      document.body.classList.remove('printing-report-list')
    }
  }, [onDone])

  const showFiled = reports.some((report) => report.createdAt)

  return createPortal(
    <div className="print-sheet" data-print-sheet="">
      <header className="print-header">
        <p className="print-brand">Paws&amp;Found</p>
        <h1>{title}</h1>
        <p>{t('print.printed', { date: formatDateTime(new Date()) })}</p>
        <p data-print-filters="">
          <strong>{t('print.filters')}</strong>{' '}
          {filters.length > 0 ? filters.join(' · ') : t('print.noFilters')}
        </p>
        <p>{t('print.count', { count: reports.length })}</p>
      </header>

      <table>
        <thead>
          <tr>
            <th scope="col">{t('print.reference')}</th>
            <th scope="col">{t('print.type')}</th>
            <th scope="col">{t('print.pet')}</th>
            <th scope="col">{t('print.species')}</th>
            <th scope="col">{t('print.breed')}</th>
            <th scope="col">{t('print.colour')}</th>
            <th scope="col">{t('labels.area')}</th>
            <th scope="col">{t('labels.city')}</th>
            <th scope="col">{t('print.incident')}</th>
            {showPublication && <th scope="col">{t('print.publication')}</th>}
            <th scope="col">{t('print.status')}</th>
            {showFiled && <th scope="col">{t('print.filed')}</th>}
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id} data-print-row={report.id}>
              <td>#{report.id}</td>
              {/* The word, in capitals — never colour alone. */}
              <td data-print-type={report.reportType}>
                <strong>{(REPORT_TYPE_LABELS[report.reportType] ?? report.reportType).toUpperCase()}</strong>
              </td>
              <td>{report.petName || '—'}</td>
              <td>{speciesLabel(report.species)}</td>
              <td>{report.breed || '—'}</td>
              <td>
                {[report.primaryColor, report.secondaryColor].filter(Boolean).map(colourLabel).join(' / ') || '—'}
              </td>
              <td>{report.location.province || '—'}</td>
              <td>{report.location.city || '—'}</td>
              <td>{formatDate(report.incidentDate)}</td>
              {showPublication && (
                <td>{PUBLICATION_STATUS_LABELS[report.publicationStatus] ?? report.publicationStatus}</td>
              )}
              <td>{REPORT_STATUS_LABELS[report.status] ?? report.status}</td>
              {showFiled && <td>{report.createdAt ? formatDate(report.createdAt) : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="print-footer">{t('disclaimer.short.print')}</footer>
    </div>,
    document.body,
  )
}
