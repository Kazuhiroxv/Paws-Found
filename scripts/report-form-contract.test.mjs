/**
 * The boundary the API suite does not cross.
 *
 *   npm run test:contract
 *
 * `scripts/audit_cases.py` posts JSON straight at the API, so it proves the
 * backend contract and nothing about how the browser arrives at it. That is
 * exactly where the collar defect lived: the API was right the whole time, and
 * the form model turned 'yes' into `true` on the way out.
 *
 * So these tests import the REAL form model and assert what it hands to the
 * service — the step nothing else looked at.
 *
 * What this does NOT prove: that the API accepts it or that MySQL stores it.
 * `npm run audit` covers that side, and the two together cover the chain.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createEmptyValues,
  toReportInput,
  valuesFromReport,
} from '@/components/report-form/reportFormModel'

/** The only three values the column, the API and the select all agree on. */
const COLLAR = ['yes', 'no', 'unknown']

/** A found report, filled in the way the wizard fills it. */
function foundValues(overrides = {}) {
  return {
    ...createEmptyValues('found'),
    species: 'dog',
    breed: 'Aspin (Philippine Native Dog)',
    sex: 'male',
    size: 'medium',
    primaryColor: 'Brown',
    distinctiveMarkings: 'A notched left ear',
    description: 'Found near the covered court.',
    incidentDate: '2026-09-20',
    incidentTime: '14:30',
    locationLabel: 'Near the covered court',
    city: 'Pasay City',
    province: 'Metro Manila',
    condition: 'Healthy',
    ...overrides,
  }
}

/** A report as `petService.fromApi()` shapes it, for the edit form. */
function reportFromApi(hasCollar) {
  return {
    reportType: 'found',
    petName: null,
    species: 'dog',
    breed: 'Aspin (Philippine Native Dog)',
    sex: 'male',
    size: 'medium',
    primaryColor: 'Brown',
    secondaryColor: '',
    distinctiveMarkings: 'A notched left ear',
    description: 'Found near the covered court.',
    incidentDate: '2026-09-20',
    incidentTime: '14:30',
    condition: 'Healthy',
    hasCollar,
    location: { label: 'Near the covered court', city: 'Pasay City', province: 'Metro Manila', lat: null, lng: null },
    photos: [],
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: false },
  }
}

/**
 * A raw API row, as `report_detail` sends it to somebody who may edit.
 *
 * Deliberately built at the API's shape, not the model's, so the test runs
 * through fromApi() — which is where both defects so far have lived.
 */
function apiRow({ showPhone, phoneOnAccount }) {
  return {
    report_id: 1,
    report_type: 'found',
    status: 'active',
    species: 'dog',
    breed: 'Aspin (Philippine Native Dog)',
    sex: 'male',
    size: 'medium',
    primary_color: 'Brown',
    has_collar: 'yes',
    incident_date: '2026-09-20',
    incident_time: '14:30:00',
    location: { label: 'Near the covered court', city: 'Pasay City', province: 'Metro Manila' },
    reporter: {
      user_id: 1,
      full_name: 'Maria Santos',
      accepts_messages: true,
      // The API masks the value with the preference. An account with no number
      // has nothing to return EVEN WHEN the preference is on — which is the
      // whole defect.
      phone: showPhone && phoneOnAccount ? '+63 917 000 0000' : null,
      email: null,
    },
    contact_preferences: {
      allow_platform_contact: true,
      show_phone: showPhone,
      show_email: false,
    },
  }
}

/**
 * What petService.fromApi() does with the preferences, restated.
 *
 * petService itself cannot be imported here: it pulls in `import.meta.glob`,
 * which is Vite syntax that plain Node cannot parse, and bending production
 * code so a test runner can load it is the wrong way round.
 *
 * So this mirrors the rule rather than importing it, and the rule is checked
 * against the real thing in two other places: FN-41/FN-42 in `npm run audit`
 * prove the API sends the preference, and the browser proof in
 * `scripts/.local/` opens a real edit form and reads the real toggle. If this
 * mirror ever drifts from petService, those two catch it.
 */
function modelShape(row) {
  return {
    ...reportFromApi(row.has_collar),
    contactPreferences: {
      allowPlatformContact:
        row.contact_preferences?.allow_platform_contact ?? row.reporter?.accepts_messages ?? true,
      showPhone: row.contact_preferences?.show_phone ?? Boolean(row.reporter?.phone),
      showEmail: row.contact_preferences?.show_email ?? Boolean(row.reporter?.email),
    },
  }
}

// ============================================================ create
test('the collar answer reaches the service exactly as the select holds it', () => {
  for (const answer of COLLAR) {
    const input = toReportInput(foundValues({ hasCollar: answer }), '1')
    assert.equal(
      input.hasCollar,
      answer,
      `selecting "${answer}" must send "${answer}", not ${JSON.stringify(input.hasCollar)}`,
    )
  }
})

test('the collar answer is never a boolean or null', () => {
  // The whole defect in one assertion. `true` was refused with a 422; `false`
  // became null in PHP and was stored as 'unknown' with no error at all, which
  // is the worse of the two because nobody sees it.
  for (const answer of COLLAR) {
    const { hasCollar } = toReportInput(foundValues({ hasCollar: answer }), '1')
    assert.equal(typeof hasCollar, 'string', `sent ${JSON.stringify(hasCollar)} for "${answer}"`)
    assert.ok(COLLAR.includes(hasCollar), `sent "${hasCollar}", which the column would refuse`)
  }
})

test('a lost report sends the column default rather than null', () => {
  // The question is only asked on a found report. Sending null relied on PHP
  // defaulting it; sending 'unknown' keeps the payload inside the enum.
  const input = toReportInput({ ...createEmptyValues('lost'), petName: 'Milo' }, '1')
  assert.equal(input.hasCollar, 'unknown')
})

// ============================================================ edit round trip
test('opening a report for editing shows the answer that was saved', () => {
  for (const answer of COLLAR) {
    const values = valuesFromReport(reportFromApi(answer))
    assert.equal(
      values.hasCollar,
      answer,
      `a report stored as "${answer}" opened as "${values.hasCollar}"`,
    )
  }
})

test('saving an untouched edit preserves the answer', () => {
  // The round trip that was silently losing data: the API returns the string,
  // the edit form used to read it as a boolean, got 'unknown', and saved that
  // over the real answer without anybody touching the field.
  for (const answer of COLLAR) {
    const reopened = valuesFromReport(reportFromApi(answer))
    const resaved = toReportInput(reopened, '1')
    assert.equal(resaved.hasCollar, answer, `"${answer}" became "${resaved.hasCollar}" after a no-op edit`)
  }
})

test('changing the answer during an edit persists the new one', () => {
  for (const before of COLLAR) {
    for (const after of COLLAR) {
      const reopened = valuesFromReport(reportFromApi(before))
      const resaved = toReportInput({ ...reopened, hasCollar: after }, '1')
      assert.equal(resaved.hasCollar, after, `"${before}" changed to "${after}" sent "${resaved.hasCollar}"`)
    }
  }
})

// ==================================== the other enum fields, same boundary
test('every other enum field is passed through untouched', () => {
  // The collar was the only field with a translation layer left over from the
  // mock data. This is what proves that statement rather than asserting it:
  // each of these must arrive at the service as the exact string the database
  // column allows.
  const cases = [
    ['species', ['dog', 'cat', 'bird', 'rabbit', 'other']],
    ['sex', ['male', 'female', 'unknown']],
    ['size', ['small', 'medium', 'large']],
  ]

  for (const [field, allowed] of cases) {
    for (const value of allowed) {
      const input = toReportInput(foundValues({ [field]: value }), '1')
      assert.equal(input[field], value, `${field} "${value}" was sent as ${JSON.stringify(input[field])}`)
    }
  }
})

test('the report type decides the pet name, and says so consistently', () => {
  const found = toReportInput(foundValues({ petName: 'Typed by mistake' }), '1')
  assert.equal(found.petName, null, 'a found report must not carry a pet name')

  const lost = toReportInput({ ...createEmptyValues('lost'), petName: '  Milo  ' }, '1')
  assert.equal(lost.petName, 'Milo', 'a lost report keeps its name, trimmed')
})


// ============================ the contact preference, which is not the value
test('the phone preference survives an edit when the account has no number', () => {
  // The defect this replaces: showPhone used to be inferred from whether a
  // phone came back. The number is optional, so an account without one made a
  // stored 1 look like false, and an untouched edit saved it that way.
  for (const showPhone of [true, false]) {
    for (const phoneOnAccount of [true, false]) {
      const reopened = valuesFromReport(modelShape(apiRow({ showPhone, phoneOnAccount })))
      assert.equal(
        reopened.showPhone,
        showPhone,
        `stored ${showPhone} with ${phoneOnAccount ? 'a' : 'no'} number opened as ${reopened.showPhone}`,
      )

      const resaved = toReportInput(reopened, '1')
      assert.equal(
        resaved.contactPreferences.showPhone,
        showPhone,
        `an untouched edit changed it to ${resaved.contactPreferences.showPhone}`,
      )
    }
  }
})

test('the email preference is read the same way, not inferred either', () => {
  for (const showEmail of [true, false]) {
    const row = apiRow({ showPhone: false, phoneOnAccount: false })
    row.contact_preferences.show_email = showEmail
    const reopened = valuesFromReport(modelShape(row))
    assert.equal(reopened.showEmail, showEmail)
    assert.equal(toReportInput(reopened, '1').contactPreferences.showEmail, showEmail)
  }
})

// ============================================ the password rule, at its edges
test('the checklist states the rule the server actually enforces', async () => {
  const { passwordChecks, PASSWORD_RULES } = await import('@/utils/passwordRules')

  assert.equal(PASSWORD_RULES.min, 15, 'api/helpers.php refuses under 15 characters')
  assert.equal(PASSWORD_RULES.maxBytes, 72, "72 bytes is bcrypt's limit, not a preference")

  const met = (password, id) =>
    passwordChecks(password, password).find((check) => check.id === id).met

  // The boundaries, from both sides.
  assert.equal(met('river bend walk', 'min'), true, '15 characters must pass')
  assert.equal(met('river bend wal', 'min'), false, '14 characters must not pass')
  // Bytes, not characters: 65 characters can be 72 bytes, and one more accented letter is too many.
  const accented = 'añoranza señorío mañana piñata ñandú'
  const seventyTwo = accented + 'x'.repeat(70 - new TextEncoder().encode(accented).length) + 'yz'
  assert.equal(new TextEncoder().encode(seventyTwo).length, 72)
  assert.equal(met(seventyTwo, 'max'), true, '72 bytes must pass')
  assert.equal(met(seventyTwo + 'é', 'max'), false, '74 bytes must not pass, though it is only 66 characters')

  // An empty box is not "within the maximum" — it is nothing typed yet.
  assert.equal(met('', 'max'), false)
})

test('the JavaScript and PHP copies of the password rule agree', async () => {
  const { readFileSync } = await import('node:fs')
  const { PASSWORD_RULES, COMMON_PASSWORD_WORDS } = await import('@/utils/passwordRules')
  const php = readFileSync(new URL('../api/helpers.php', import.meta.url), 'utf8')

  assert.equal(Number(php.match(/const PASSWORD_MIN_CHARS = (\d+);/)[1]), PASSWORD_RULES.min)
  assert.equal(Number(php.match(/const PASSWORD_MAX_BYTES = (\d+);/)[1]), PASSWORD_RULES.maxBytes)
  const phpWords = [...php.match(/const COMMON_PASSWORD_WORDS = \[(.*?)\];/s)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(phpWords, COMMON_PASSWORD_WORDS, 'the common-word lists must be the same list')
})

test('obvious long passwords are refused, real passphrases are not', async () => {
  const { isCommonPassword } = await import('@/utils/passwordRules')

  for (const weak of ['passwordpassword', 'password1234567', 'qwertyqwertyqwerty', '123456789012345',
    '111111111111111', 'aaaaaaaaaaaaaaa', 'iloveyouiloveyou', 'letmeinletmeinletmein', 'adminadminadmin',
    'welcome123456789', 'P@ssw0rd123456789', 'abcdefghijklmnop', '987654321098765', '1234567password']) {
    assert.equal(isCommonPassword(weak), true, `${weak} must be refused`)
  }
  for (const fine of ['correct horse battery staple', 'password-after-lock', 'a-brand-new-password',
    'another-password', 'Kape at pandesal tuwing umaga']) {
    assert.equal(isCommonPassword(fine), false, `${fine} must be allowed`)
  }
})

test('a password that is just your own name or address is refused, and only that', async () => {
  const { passwordChecks } = await import('@/utils/passwordRules')
  const identity = { email: 'kyle.austria.2026@example.com', fullName: 'Kyle Michael Austria' }
  const met = (password) => passwordChecks(password, password, { identity }).find((c) => c.id === 'identity').met

  assert.equal(met('kyle.austria.2026@example.com'), false, 'the whole address')
  assert.equal(met('kyle.austria.2026'), false, 'the part before the @')
  assert.equal(met('kylemichaelaustria'), false, 'the name, run together')
  assert.equal(met('Kyle Michael Austria'), false, 'the name as written')
  assert.equal(met('kyle walks the dog at dawn'), true, 'containing a first name is fine')
})

test('strength is guidance: Weak until the rules are met, then Fair or Strong', async () => {
  const { passwordStrength } = await import('@/utils/passwordRules')

  assert.equal(passwordStrength(''), null, 'nothing typed, nothing shown')
  assert.equal(passwordStrength('short'), 'weak')
  assert.equal(passwordStrength('passwordpassword'), 'weak', 'long but common')
  assert.equal(passwordStrength('river bend walks'), 'fair', 'meets every rule: accepted')
  assert.equal(passwordStrength('correct horse battery staple'), 'strong')
  assert.equal(passwordStrength('Tide pool 7 at dusk'), 'strong', '16+ with three kinds of character')
})

test('names: real names of every shape pass, junk does not', async () => {
  const { nameProblem, cleanName } = await import('@/utils/nameRules')

  for (const name of ['Jo Li', 'Maria Santos', 'Ma. Ana Cruz', 'Anne-Marie Cruz', "D'Angelo Reyes", 'O’Connor', 'José Santos', 'Nguyễn Văn An']) {
    assert.equal(nameProblem(name), null, `${name} must be accepted`)
  }
  for (const name of ['A', '1', '12345', '!!!!', '-']) {
    assert.equal(nameProblem(name), 'Enter a real name with at least 2 letters.', `${name} must be refused`)
  }
  assert.equal(nameProblem(''), 'Enter your name.')
  assert.equal(nameProblem('Jo2 Li'), 'Use letters, spaces, apostrophes, hyphens and periods only.')
  assert.equal(cleanName('  Maria   Santos  '), 'Maria Santos')
})

test('the confirmation has to match, and an empty pair does not count as matching', async () => {
  const { passwordChecks } = await import('@/utils/passwordRules')
  const match = (a, b) => passwordChecks(a, b).find((check) => check.id === 'match').met

  assert.equal(match('correct-horse', 'correct-horse'), true)
  assert.equal(match('correct-horse', 'correct-horse '), false, 'a trailing space is a different password')
  assert.equal(match('', ''), false, 'two empty boxes are not a match')
})

test('the confirmation check can be left out where there is only one box', async () => {
  const { passwordChecks } = await import('@/utils/passwordRules')
  const ids = passwordChecks('a'.repeat(10), '', { confirm: false }).map((check) => check.id)
  assert.deepEqual(ids, ['min', 'max', 'common'])
})
