/**
 * The browser's copy of the report-form rules, held to the server's.
 *
 *   npm run test:contract
 *
 * Post-defense Correction 3. The cases live in scripts/report-rules-cases.json,
 * which scripts/report_rules.php runs against the PHP rules — so every case
 * here is checked on both sides, and the two copies cannot quietly disagree.
 *
 *   RN  a lost pet's name: two letters or digits; letters, digits, spaces, ' . -
 *   RD  the description: thirty characters, spaces in a row counted once
 *   RT  the time: 12-hour with AM/PM on screen, 24-hour HH:MM to the API
 */
const { default: test } = await import('node:test')
const { default: assert } = await import('node:assert/strict')
const { readFileSync } = await import('node:fs')
const { descriptionLength, descriptionProblem, meaningfulText, petNameProblem, DESCRIPTION_MIN } =
  await import('@/components/report-form/reportFormModel')
const { formatTime12Hour, timeFrom12Hour, timeTo12Hour } = await import('@/utils/date')

const cases = JSON.parse(readFileSync(new URL('./report-rules-cases.json', import.meta.url), 'utf8'))

test('RN: every pet name the server accepts, the form accepts', () => {
  for (const name of cases.pet_names_accepted) {
    assert.equal(petNameProblem(name, true), null, `"${name}"`)
  }
})

test('RN: every pet name the server refuses, the form refuses', () => {
  for (const name of cases.pet_names_refused) {
    assert.notEqual(petNameProblem(name, true), null, `"${name}"`)
  }
})

test('RN: a found report needs no name; a sent one is tidied', () => {
  assert.equal(petNameProblem('', false), null)
  assert.equal(meaningfulText('  Mr.   Bean '), 'Mr. Bean')
})

test('RD: descriptions are judged exactly as the server judges them', () => {
  for (const text of cases.descriptions_accepted) assert.equal(descriptionProblem(text), null, JSON.stringify(text))
  for (const text of cases.descriptions_refused) assert.notEqual(descriptionProblem(text), null, JSON.stringify(text))
})

test('RD: the counter counts what the minimum counts', () => {
  assert.equal(DESCRIPTION_MIN, 30)
  assert.equal(descriptionLength('                              '), 0, 'thirty spaces are nothing')
  assert.equal(descriptionLength('  Brown   dog.  '), 10)
  assert.match(descriptionProblem('Brown dog.'), /you have 10/)
})

test('RT: 12-hour with AM/PM converts to the 24-hour time the API stores', () => {
  for (const [parts, time] of cases.times_12_to_24) {
    assert.equal(timeFrom12Hour(parts), time, JSON.stringify(parts))
  }
})

test('RT: a stored time opens as the same 12-hour time, and displays with AM/PM', () => {
  for (const [parts, time] of cases.times_12_to_24) {
    if (!time) continue
    assert.deepEqual(timeTo12Hour(time), { hour: String(Number(parts.hour)), minute: parts.minute, period: parts.period })
  }
  assert.deepEqual(timeTo12Hour('13:05:00'), { hour: '1', minute: '05', period: 'PM' }, 'MySQL TIME has seconds')
  assert.equal(formatTime12Hour('00:00'), '12:00 AM')
  assert.equal(formatTime12Hour('12:00:00'), '12:00 PM')
  assert.equal(formatTime12Hour('23:59'), '11:59 PM')
  assert.equal(formatTime12Hour(''), '', 'no time stays no time')
  assert.equal(formatTime12Hour(null), '')
})
