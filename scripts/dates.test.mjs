/**
 * How the interface reads and shows dates.
 *
 *   npm run test:contract
 *
 * The API sends a recorded moment (created_at and the like) as
 * "2026-09-29 12:38:00" in UTC, with no zone on it. Read as local time it was
 * eight hours out in the Philippines: a notification five minutes old said
 * "8 hours ago", and a reply at 8:38 PM said 12:38 PM. A calendar day, such as
 * an incident date, is a different kind of value and must stay on its day.
 *
 * The zone is pinned so the results are the same on any machine.
 */
process.env.TZ = 'Asia/Manila'

const { default: test, mock } = await import('node:test')
const { default: assert } = await import('node:assert/strict')
const { formatDate, formatDateTime, formatRelativeTime, formatShortDate, parseDateTime } =
  await import('../src/utils/date.js')
const { createEmptyValues, validateStep } = await import('../src/components/report-form/reportFormModel.js')

// 8:43 PM in Manila, five minutes after the reply below.
const NOW = new Date('2026-09-29T20:43:00+08:00')

test('a server timestamp is read as UTC and shown in local time', () => {
  assert.equal(parseDateTime('2026-09-29 12:38:00').toISOString(), '2026-09-29T12:38:00.000Z')
  assert.match(formatDateTime('2026-09-29 12:38:00'), /^September 29, 2026 at 8:38\s?PM$/i)
})

test('a staff reply or notification from five minutes ago says so, not eight hours', () => {
  assert.equal(formatRelativeTime('2026-09-29 12:38:00', NOW), '5 minutes ago')
  assert.equal(formatRelativeTime('2026-09-29 12:42:40', NOW), 'just now')
  assert.equal(formatRelativeTime('2026-09-29 09:43:00', NOW), '3 hours ago')
  assert.equal(formatRelativeTime('2026-09-27 12:43:00', NOW), '2 days ago')
})

test('an ISO timestamp that carries its zone is read as it says', () => {
  assert.equal(parseDateTime('2026-09-29T12:38:00Z').toISOString(), '2026-09-29T12:38:00.000Z')
  assert.equal(parseDateTime('2026-09-29T20:38:00+08:00').toISOString(), '2026-09-29T12:38:00.000Z')
  const date = new Date('2026-09-29T12:38:00Z')
  assert.equal(parseDateTime(date), date)
})

test('an incident date stays on its calendar day, here and in a zone behind UTC', () => {
  assert.equal(formatDate('2026-09-24'), 'September 24, 2026')
  assert.equal(formatShortDate('2026-09-24', NOW), 'Sep 24')

  process.env.TZ = 'America/Los_Angeles'
  try {
    assert.equal(formatDate('2026-09-24'), 'September 24, 2026')
  } finally {
    process.env.TZ = 'Asia/Manila'
  }
})

test('nothing, or nonsense, formats as nothing', () => {
  assert.equal(formatDate(null), '')
  assert.equal(formatDateTime('not a date'), '')
  assert.equal(formatRelativeTime('not a date'), '')
})

test('a report dated today is accepted before 8 AM in Manila, and tomorrow is not', () => {
  // 22:00 UTC on the 29th is 06:00 on the 30th in Manila.
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-29T22:00:00Z') })
  try {
    const on = (date) => validateStep('incident', { ...createEmptyValues('found'), incidentDate: date }).incidentDate
    assert.equal(on('2026-09-30'), undefined)
    assert.equal(on('2026-09-29'), undefined)
    assert.equal(on('2026-10-01'), 'The date cannot be in the future.')
  } finally {
    mock.timers.reset()
  }
})
