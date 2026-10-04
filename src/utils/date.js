/**
 * Dates are stored as ISO strings and formatted at render time, so the stored
 * value stays locale-independent.
 *
 * Formatted in the language showing (Correction 7): en-PH or fil-PH, so a
 * date reads "October 4, 2026" or "Oktubre 4, 2026". Only the words change —
 * never the stored value, and never the time: both locales show a 12-hour
 * clock with AM and PM.
 */
import { languageInfo, t } from '@/i18n'

const locale = () => languageInfo().locale

const SERVER_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Turn whatever the API or a form hands over into a Date, by what it means.
 *
 *   "2026-09-29 12:38:00"  a moment the server recorded (created_at and the
 *                          like). The API sends these in UTC without saying
 *                          so; read as local time they were eight hours out
 *                          in the Philippines ("8 hours ago" for something
 *                          five minutes old).
 *   "2026-09-24"           a calendar day (an incident date): that day at
 *                          local midnight, so it never shifts to another day.
 *   anything else          as the browser reads it (ISO strings with Z, Dates).
 *
 * @param {string|Date|null|undefined} value
 * @returns {Date}  Invalid Date when the value cannot be read.
 */
export function parseDateTime(value) {
  if (value instanceof Date) return value
  if (typeof value === 'string' && SERVER_TIMESTAMP.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`)
  }
  if (typeof value === 'string' && CALENDAR_DATE.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(value)
}

/**
 * @param {string|Date|null|undefined} value
 * @returns {string} e.g. "August 12, 2026", or "" when there is no value.
 */
export function formatDate(value) {
  if (!value) return ''
  const date = parseDateTime(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * @param {string|Date|null|undefined} value
 * @returns {string} e.g. "August 12, 2026 at 5:30 PM".
 */
export function formatDateTime(value) {
  if (!value) return ''
  const date = parseDateTime(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(locale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Short relative label for notification lists — "3 hours ago". Falls back to a
 * full date once something is more than a month old, because "47 days ago" is
 * harder to place than the date itself.
 *
 * @param {string|Date} value
 * @param {Date} [now]  Injectable, so the output is predictable in a test.
 */
export function formatRelativeTime(value, now = new Date()) {
  const date = parseDateTime(value)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return t('dates.justNow')

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return t('dates.minutesAgo', { count: minutes })

  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('dates.hoursAgo', { count: hours })

  const days = Math.round(hours / 24)
  if (days < 30) return t('dates.daysAgo', { count: days })

  return formatDate(date)
}

/**
 * A compact date — "Jul 11" this year, "Jul 11, 2025" otherwise. For places
 * where the year is almost always obvious and space is short: card badges and
 * the dashboard's activity timeline.
 *
 * @param {string|Date|null|undefined} value
 * @param {Date} [now]
 */
export function formatShortDate(value, now = new Date()) {
  if (!value) return ''
  const date = parseDateTime(value)
  if (Number.isNaN(date.getTime())) return ''
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString(locale(), {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/**
 * The date badge on a report card: "19 days ago" while a case is recent, then
 * "Jul 11". One rule for every card, so recent and older cards read as the
 * same system — before, older cards switched to a long "July 11, 2026" beside
 * short relative labels, which looked accidental.
 *
 * @param {string|Date} value
 * @param {Date} [now]
 */
export function formatCardDate(value, now = new Date()) {
  const date = parseDateTime(value)
  if (Number.isNaN(date.getTime())) return ''
  const days = (now.getTime() - date.getTime()) / 86400000
  return days < 30 ? formatRelativeTime(date, now) : formatShortDate(date, now)
}

/**
 * A month from the API ("2026-10") as its short name — "Oct" or "Okt".
 *
 * @param {string} value  "YYYY-MM".
 */
export function formatMonthShort(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  if (!match) return ''
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString(locale(), { month: 'short' })
}

/**
 * Today as "YYYY-MM-DD", for the `max` attribute on date inputs — an incident
 * cannot have happened in the future.
 *
 * @returns {string}
 */
export function todayAsInputValue() {
  const now = new Date()
  const offsetMinutes = now.getTimezoneOffset()
  // Shift to local time before slicing, or users east of UTC get yesterday.
  return new Date(now.getTime() - offsetMinutes * 60000).toISOString().slice(0, 10)
}

/**
 * The 12-hour clock the report form shows, and the 24-hour TIME the API and
 * MySQL store (Correction 3: an approximate time is shown with AM or PM).
 *
 *   12:00 AM -> "00:00"   12:00 PM -> "12:00"   1:05 PM -> "13:05"
 *   11:59 PM -> "23:59"   anything incomplete -> "" (no time given)
 *
 * @param {{ hour: string, minute: string, period: 'AM'|'PM'|'' }} parts
 *   hour "1"–"12", minute "00"–"59".
 * @returns {string} "HH:MM", or "" when the parts do not make a time.
 */
export function timeFrom12Hour({ hour, minute, period }) {
  const h = Number(hour)
  const m = Number(minute)
  if (!hour || minute === '' || minute == null || !['AM', 'PM'].includes(period)) return ''
  if (!Number.isInteger(h) || h < 1 || h > 12 || !Number.isInteger(m) || m < 0 || m > 59) return ''
  const hours24 = (h % 12) + (period === 'PM' ? 12 : 0)
  return `${String(hours24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * The inverse: "13:05" or "13:05:00" -> { hour: "1", minute: "05", period: "PM" }.
 * An empty or unreadable value gives empty parts.
 *
 * @param {string} value
 */
export function timeTo12Hour(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '')
  if (!match) return { hour: '', minute: '', period: '' }
  const hours24 = Number(match[1])
  if (hours24 > 23 || Number(match[2]) > 59) return { hour: '', minute: '', period: '' }
  return {
    hour: String(hours24 % 12 === 0 ? 12 : hours24 % 12),
    minute: match[2],
    period: hours24 < 12 ? 'AM' : 'PM',
  }
}

/**
 * "13:05" -> "1:05 PM", for showing a stored time. "" when there is none.
 *
 * @param {string} value
 */
export function formatTime12Hour(value) {
  const { hour, minute, period } = timeTo12Hour(value)
  return hour ? `${hour}:${minute} ${period}` : ''
}
