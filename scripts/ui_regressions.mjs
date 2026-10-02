// Two interface regressions found in final manual testing, in a real Chrome.
//
//   PAWS_BASE=http://localhost:5173 PAWS_PW=<seeded password> npm run test:ui
//
// MOD-LINK: on Administrator > Moderation, "Open the full report" looked like
// a link and did nothing; it sat above the title's stretched overlay as a
// plain span. REG: registration said nothing about an obviously bad email
// until Create account was pressed. MOD-FLAG / MOD-DECIDE: "Report this
// listing" and the administrator's decisions sent a plain object where JSON was
// declared, so the API refused both as invalid JSON; these go through the real
// dialogs and buttons.
//
// NAV-MOBILE: on a phone, the workspace menu (Administration, Pet Coordinator)
// opened at the top of the page even when its sticky button was tapped far
// down a long list, so it could not be seen without scrolling back up.
//
// WITHDRAWN: a pairing withdrawn because a report was finished used to read
// "Ruled out · by the reporter" and "Dismissed by User". TABLE-HEAD: the
// sticky header of the admin and staff tables stuck 72px down on desktop,
// where no bar is above it, and rows showed through the gap.
//
// EDIT-MATCH-2: a report with an open possible match offers no Edit, because
// the API refuses to change a report underneath its pairing.
//
// REPORT-ACTIONS: a returned report's only remaining action, Close, sat alone
// in a More menu whose panel hung over the next card on a phone.
//
// The MOD-FLAG checks raise one flag and dismiss it, so they run only against
// localhost and are skipped anywhere else. Nothing else changes data: the one
// registration request is refused by the API on purpose.
//
// The page.evaluate() callbacks run inside the page, where these exist.
/* global document, window, HTMLInputElement, HTMLTextAreaElement, ClipboardEvent, DataTransfer, FocusEvent, innerWidth */
import puppeteer from 'puppeteer-core'

const BASE = process.env.PAWS_BASE ?? 'http://localhost/pawsandfound'
const API = BASE + '/api'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PASSWORD = process.env.PAWS_PW
if (!PASSWORD) {
  console.error('Set PAWS_PW to the password of the seeded accounts (see README, "Signing in").')
  process.exit(2)
}

const results = []
const check = (id, description, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(11)} ${description}${detail ? `  (${detail})` : ''}`)
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const path = (page) => new URL(page.url()).pathname

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1280, height: 900 } })

// ---- MOD-LINK: the flagged report preview on the moderation queue
{
  const page = await browser.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await page.evaluate(async (api, pw) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    await fetch(api + '/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ email: 'grace.bautista@example.com', password: pw }),
    })
  }, API, PASSWORD)

  const openQueue = async () => {
    await page.goto(BASE + '/admin/moderation', { waitUntil: 'networkidle2' })
    await pause(1200)
  }

  await openQueue()
  const cta = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find((a) => a.textContent.trim().startsWith('Open the full report'))
    return link ? link.getAttribute('href') : null
  })
  check('MOD-LINK-1', '"Open the full report" is a link to the report', /^\/pet\/\d+$/.test(cta ?? ''), cta ?? 'not a link')

  // Keyboard: Tab until the link has focus, then Enter.
  let reached = false
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await page.evaluate(() => document.activeElement?.textContent.trim().startsWith('Open the full report'))
  }
  if (reached) {
    await page.keyboard.press('Enter')
    await pause(1500)
  }
  check('MOD-LINK-2', 'Tab reaches it and Enter opens the report', reached && path(page) === cta,
    reached ? path(page) : 'never focused')

  await openQueue()
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find((a) => a.textContent.trim().startsWith('Open the full report'))
    link.click()
  })
  await pause(1200)
  const byClick = path(page)

  await openQueue()
  const title = await page.evaluate(() => {
    const cta = [...document.querySelectorAll('a')].find((a) => a.textContent.trim().startsWith('Open the full report'))
    const titleLink = cta?.parentElement?.querySelector('a:not(:last-of-type)') ?? null
    titleLink?.click()
    return titleLink?.getAttribute('href') ?? null
  })
  await pause(1200)
  check('MOD-LINK-3', 'A mouse click on it, and on the title, open the same report',
    byClick === cta && path(page) === cta && title === cta, `link ${byClick}, title ${path(page)}`)

  // The decision controls sit outside the preview: using them must not navigate.
  await openQueue()
  await page.evaluate(() => {
    const note = [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith('Decision note'))
    const field = note && document.getElementById(note.htmlFor)
    field?.click()
    field?.focus()
    ;[...document.querySelectorAll('[role=tab]')].find((t) => /Awaiting/.test(t.textContent))?.click()
  })
  await pause(800)
  check('MOD-LINK-4', 'Clicking the decision note and the tabs stays on the queue',
    path(page) === '/admin/moderation', path(page))
  await page.close()
}

// ---- REG: registration feedback after a field is left, not before
{
  const page = await (await browser.createBrowserContext()).newPage()
  await page.goto(BASE + '/register', { waitUntil: 'networkidle2' })
  await pause(800)

  const fieldId = (label) => page.evaluate((l) =>
    [...document.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(l))?.htmlFor, label)
  const state = (id) => page.evaluate((i) => {
    const input = document.getElementById(i)
    const error = document.getElementById(`${i}-error`)
    return { invalid: input.getAttribute('aria-invalid') === 'true', error: error?.textContent.trim() ?? '',
      describedBy: (input.getAttribute('aria-describedby') ?? '').includes(`${i}-error`) }
  }, id)

  const name = await fieldId('Full name')
  const email = await fieldId('Email address')
  const phone = await fieldId('Phone number')

  const anyInvalid = await page.evaluate(() => document.querySelectorAll('[aria-invalid=true]').length)
  check('REG-1', 'A fresh form marks nothing as wrong', anyInvalid === 0, `${anyInvalid} invalid`)

  await page.click(`#${email}`)
  await page.type(`#${email}`, 'yuuriko1506')
  const typing = await state(email)
  check('REG-2', 'No error while the email is still being typed', !typing.invalid && typing.error === '')

  await page.keyboard.press('Tab')
  await pause(200)
  const left = await state(email)
  check('REG-3', 'Leaving it shows the email error, bound to the field',
    left.invalid && left.describedBy && left.error === 'Enter a valid email address, such as name@example.com.', left.error)

  await page.click(`#${email}`)
  await page.type(`#${email}`, '@gmail.com')
  const fixed = await state(email)
  check('REG-4', 'Correcting it clears the error at once, without submitting', !fixed.invalid && fixed.error === '')

  await page.click(`#${name}`)
  await page.keyboard.press('Tab')
  await pause(200)
  const blankName = await state(name)
  check('REG-5', 'Leaving the name blank says so', blankName.invalid && blankName.error === 'Enter your name.', blankName.error)

  await page.click(`#${phone}`)
  await page.keyboard.press('Tab')
  await pause(200)
  const blankPhone = await state(phone)
  check('REG-6', 'A blank phone number is fine (it is optional)', !blankPhone.invalid && blankPhone.error === '')

  // Everything else valid except the email, so only the email blocks it.
  await page.type(`#${name}`, 'Registration Check')
  await page.click(`#${email}`, { clickCount: 3 })
  await page.type(`#${email}`, 'not-an-email')
  const passwords = await page.$$('input[type=password]')
  await passwords[0].type('correct horse battery')
  await passwords[1].type('correct horse batterY')
  const mismatch = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type=submit]')][0]
    return { disabled: button.disabled, text: document.body.innerText.includes('Both entries match') }
  })
  await page.evaluate(() => document.querySelector('input[type=checkbox]').click())
  const stillBlocked = await page.evaluate(() => document.querySelector('button[type=submit]').disabled)
  check('REG-7', 'Mismatched passwords: the checklist shows it and Create account stays disabled',
    mismatch.text && stillBlocked, `disabled=${stillBlocked}`)

  const passwordsNow = await page.$$('input[type=password]')
  await passwordsNow[1].click({ clickCount: 3 })
  await passwordsNow[1].type('correct horse battery')
  const sent = []
  page.on('request', (request) => { if (request.url().includes('/auth/register')) sent.push(request.url()) })
  await page.evaluate(() => document.querySelector('button[type=submit]').click())
  await pause(1000)
  const afterSubmit = await state(email)
  check('REG-8', 'Submitting with a bad email is blocked in the browser and says why',
    sent.length === 0 && afterSubmit.invalid, `${sent.length} request(s) sent`)

  const code = await page.evaluate(async (api) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    const response = await fetch(api + '/auth/register', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ full_name: 'Hand Built', email: 'yuuriko1506', password: 'correct horse battery', privacy_consent: true }),
    })
    return response.status
  }, API)
  check('REG-9', 'The API still refuses the same bad email sent by hand', code === 422, `HTTP ${code}`)

  await page.setViewport({ width: 390, height: 844, isMobile: true })
  await pause(500)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('REG-10', 'At 390 px, with errors showing, nothing overflows', overflow === 0, `${overflow}px`)
}

// ---- PWD: the password requirements and the strength label (guidance only)
{
  const page = await (await browser.createBrowserContext()).newPage()
  await page.setViewport({ width: 1280, height: 1000 })
  await page.goto(BASE + '/register', { waitUntil: 'networkidle2' })
  const ids = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('label')]
    .map((l) => [l.textContent.replace(/\*|\(required\)/g, '').trim(), l.htmlFor]).filter(([, id]) => id)))
  const setValue = (id, value) => page.evaluate((id, value) => {
    const el = document.getElementById(id)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, id, value)
  const read = () => page.evaluate(() => {
    const text = document.body.innerText
    const strength = text.match(/Strength: (Weak|Fair|Strong)/)?.[1] ?? null
    const meter = [...document.querySelectorAll('p')].find((p) => p.textContent.startsWith('Strength:'))
    return { strength, disabled: document.querySelector('button[type=submit]').disabled,
      meterIsError: Boolean(meter && (meter.closest('[role=alert]') || /text-danger/.test(meter.className))) }
  })
  await setValue(ids['Full name'], 'Registration Check')
  await setValue(ids['Email address'], 'registration.check@example.com')
  await page.evaluate(() => document.querySelector('input[type=checkbox]').click())
  const both = async (password) => {
    await setValue(ids['Password'], password)
    await setValue(ids['Type it again'], password)
    await pause(150)
    return read()
  }
  const weak = await both('short')
  check('PWD-1', 'Weak while a requirement is not met, and Create account stays disabled',
    weak.strength === 'Weak' && weak.disabled, JSON.stringify(weak))
  const fair = await both('river bend walks')
  check('PWD-2', 'Fair once every requirement is met: shown as fine, and it may be submitted',
    fair.strength === 'Fair' && !fair.disabled && !fair.meterIsError, JSON.stringify(fair))
  const strong = await both('correct horse battery staple')
  check('PWD-3', 'Strong for a long passphrase, also allowed', strong.strength === 'Strong' && !strong.disabled, JSON.stringify(strong))
  const common = await both('passwordpassword')
  const commonText = await page.evaluate(() => document.body.innerText)
  check('PWD-4', 'A long but common password is Weak, and the checklist says why',
    common.strength === 'Weak' && common.disabled && /Not a commonly used password\s*— not yet met/.test(commonText))
  const own = await both('registration.check@example.com')
  check('PWD-5', 'The email address itself is refused as a password', own.disabled && own.strength === 'Weak')
  const pasted = await page.evaluate((id) => {
    const el = document.getElementById(id)
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() })
    el.dispatchEvent(event)
    return !event.defaultPrevented
  }, ids['Type it again'])
  check('PWD-6', 'Pasting into "Type it again" is allowed (password managers)', pasted)
  const autocomplete = await page.evaluate(() =>
    [...document.querySelectorAll('input[type=password]')].map((i) => i.getAttribute('autocomplete')).join(','))
  check('PWD-7', 'Both password boxes offer autocomplete="new-password"', autocomplete === 'new-password,new-password', autocomplete)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Show password')).click())
  await pause(200)
  const revealed = await page.evaluate(() => document.querySelectorAll('input[type=text][autocomplete=new-password]').length)
  check('PWD-8', 'Show password still reveals the box', revealed === 1)
  await setValue(ids['Full name'], 'A')
  await page.evaluate((id) => document.getElementById(id).dispatchEvent(new FocusEvent('focusout', { bubbles: true })), ids['Full name'])
  await page.evaluate((id) => { document.getElementById(id).focus(); document.getElementById(id).blur() }, ids['Full name'])
  await pause(200)
  const name = await page.evaluate((id) => {
    const el = document.getElementById(id)
    return { invalid: el.getAttribute('aria-invalid') === 'true', text: document.body.innerText.includes('Enter a real name with at least 2 letters.'),
      disabled: document.querySelector('button[type=submit]').disabled }
  }, ids['Full name'])
  check('PWD-9', 'A one-letter name is marked on the field and blocks Create account', name.invalid && name.text && name.disabled, JSON.stringify(name))
  await page.setViewport({ width: 390, height: 844, isMobile: true })
  await pause(400)
  check('PWD-10', 'At 390 px the requirements and strength fit', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))

  // The reset page: the same requirements and label, no name/email item (the link does not say whose account).
  await page.setViewport({ width: 1280, height: 1000 })
  await page.goto(BASE + '/reset-password?token=' + 'b'.repeat(64), { waitUntil: 'networkidle2' })
  const resetIds = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('label')]
    .map((l) => [l.textContent.replace(/\*|\(required\)/g, '').trim(), l.htmlFor]).filter(([, id]) => id)))
  await page.evaluate((a, b) => {
    for (const id of [a, b]) {
      const el = document.getElementById(id)
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'river bend walks')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, resetIds['New password'], resetIds['Type it again'])
  await pause(150)
  const reset = await page.evaluate(() => ({
    strength: document.body.innerText.match(/Strength: (Weak|Fair|Strong)/)?.[1],
    identityItem: document.body.innerText.includes('Not your name or email address'),
    disabled: document.querySelector('button[type=submit]').disabled,
  }))
  check('PWD-11', 'Reset: the same label and requirements, and a Fair password may be saved',
    reset.strength === 'Fair' && !reset.identityItem && !reset.disabled, JSON.stringify(reset))

  // The profile: the same name rule, before anything is sent.
  const profile = await (await browser.createBrowserContext()).newPage()
  await profile.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await profile.evaluate(async (api, pw) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    await fetch(api + '/auth/login', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ email: 'maria.santos@example.com', password: pw }) })
  }, API, PASSWORD)
  await profile.goto(BASE + '/dashboard/profile', { waitUntil: 'networkidle2' })
  await pause(800)
  const patches = []
  profile.on('request', (request) => { if (request.method() === 'PATCH' && request.url().includes('/users/me')) patches.push(1) })
  await profile.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit profile').click())
  await profile.evaluate(() => {
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith('Full name'))
    const el = document.getElementById(label.htmlFor)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'A')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await profile.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save changes').click())
  await pause(800)
  const profileName = await profile.evaluate(() => document.body.innerText.includes('Enter a real name with at least 2 letters.'))
  check('PWD-12', 'Profile: a one-letter name is refused on the field and nothing is sent', profileName && patches.length === 0,
    `${patches.length} request(s)`)
}

// ---- MOD-FLAG / MOD-DECIDE: raising a flag and deciding it, through the interface
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(BASE).hostname)) {
  console.log('SKIP  MOD-FLAG    raises and dismisses a flag, so it runs against localhost only')
} else {
  const signedIn = async (email) => {
    const page = await (await browser.createBrowserContext()).newPage()
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    await page.evaluate(async (api, e, pw) => {
      const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
      await fetch(api + '/auth/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
        body: JSON.stringify({ email: e, password: pw }),
      })
    }, API, email, PASSWORD)
    return page
  }
  const api = (page, path) => page.evaluate(async (a, p) =>
    (await (await fetch(a + p, { credentials: 'include' })).json()), API, path)
  const DETAILS = `Same dog as another listing (ui-regression ${Date.now()})`

  // A member flags somebody else's report (Milo, Maria's).
  const member = await signedIn('noel.aguilar@example.com')
  const memberId = (await api(member, '/auth/me')).user?.user_id
  const statusBefore = (await api(member, '/reports/1')).data?.status
  await member.goto(BASE + '/pet/1', { waitUntil: 'networkidle2' })
  await pause(1000)
  await member.evaluate(() => [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === 'Report this listing')?.click())
  await pause(600)
  const reasonId = await member.evaluate(() => [...document.querySelectorAll('label')]
    .find((l) => l.textContent.trim().startsWith('What is the problem?'))?.htmlFor)
  const detailsId = await member.evaluate(() => [...document.querySelectorAll('label')]
    .find((l) => l.textContent.trim().startsWith('Anything else we should know?'))?.htmlFor)
  await member.select(`#${reasonId}`, 'duplicate')
  await member.type(`#${detailsId}`, DETAILS)
  const sent = member.waitForResponse((r) => r.url().endsWith('/api/moderation') && r.request().method() === 'POST')
  await member.evaluate(() => [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === 'Send report')?.click())
  const response = await sent
  await pause(800)
  const thanked = await member.evaluate(() => document.body.innerText.includes('Thank you'))

  const admin = await signedIn('grace.bautista@example.com')
  const cases = (await api(admin, '/moderation?status=open')).data ?? []
  const raised = cases.find((c) => c.details === DETAILS)
  check('MOD-FLAG-1', 'A member flags a report from its page: 201, thanked, recorded as theirs',
    response.status() === 201 && thanked && raised?.report_id === 1 && raised?.reason === 'duplicate'
      && raised?.flagged_by?.user_id === memberId,
    `HTTP ${response.status()}, case ${raised?.case_id ?? 'not found'}`)

  await admin.goto(BASE + '/admin/moderation', { waitUntil: 'networkidle2' })
  await pause(1200)
  const queued = await admin.evaluate((d) => document.body.innerText.includes(d), DETAILS)
  check('MOD-FLAG-2', 'It appears in the administrator\'s queue', queued)
  const labels = await admin.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()))
  check('MOD-WORDING', 'The warning is labelled for the report author, not "the reporter"',
    labels.includes('Warn report author') && !labels.includes('Warn the reporter'))

  const statusAfter = (await api(member, '/reports/1')).data?.status
  check('MOD-FLAG-3', 'Flagging changes nothing about the report itself', statusAfter === statusBefore,
    `${statusBefore} -> ${statusAfter}`)

  const owner = await signedIn('maria.santos@example.com')
  await owner.goto(BASE + '/pet/1', { waitUntil: 'networkidle2' })
  await pause(1000)
  const ownerSees = await owner.evaluate((d) => ({ name: document.body.innerText.includes('Noel Aguilar'),
    details: document.body.innerText.includes(d) }), DETAILS)
  const ownerApi = JSON.stringify(await api(owner, '/reports/1'))
  check('MOD-FLAG-4', 'The report\'s owner is not shown who flagged it, or what they wrote',
    !ownerSees.name && !ownerSees.details && !ownerApi.includes(DETAILS) && !ownerApi.includes('flagged_by'))

  // The administrator decides it from the queue, with a note.
  const noteCount = async (page) => ((await api(page, '/notifications')).data ?? [])
    .filter((n) => (n.body ?? '').includes('Checked: not a duplicate.')).length
  const authorBefore = await noteCount(owner)
  const flaggerBefore = await noteCount(member)
  const decided = admin.waitForResponse((r) => /\/api\/moderation\/\d+$/.test(r.url()) && r.request().method() === 'PATCH')
  await admin.evaluate((d) => {
    const card = [...document.querySelectorAll('article, li, section')].reverse()
      .find((el) => el.innerText.includes(d) && el.querySelector('textarea'))
    const note = card.querySelector('textarea')
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(note, 'Checked: not a duplicate.')
    note.dispatchEvent(new Event('input', { bubbles: true }))
    ;[...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Dismiss flag').click()
  }, DETAILS)
  const decision = await decided
  await pause(800)
  const after = ((await api(admin, '/moderation')).data ?? []).find((c) => c.case_id === raised?.case_id)
  check('MOD-DECIDE-1', 'The administrator dismisses it from the queue: 200 and recorded',
    decision.status() === 200 && after?.case_status === 'dismissed', `HTTP ${decision.status()}, ${after?.case_status}`)

  // The decision goes to the person who filed the pet report; the person who
  // flagged it is not told. Unchanged behaviour, now said on the page.
  const toAuthor = (await noteCount(owner)) - authorBefore
  const toFlagger = (await noteCount(member)) - flaggerBefore
  check('MOD-DECIDE-2', 'The decision reaches the report author and not the person who flagged it',
    toAuthor === 1 && toFlagger === 0, `author ${toAuthor}, flagger ${toFlagger}`)

  const refused = await member.evaluate(async (a) => {
    const me = await (await fetch(a + '/auth/me', { credentials: 'include' })).json()
    const r = await fetch(a + '/moderation', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: '[object Object]',
    })
    return { status: r.status, error: (await r.json()).error }
  }, API)
  check('MOD-JSON', 'A body that is not JSON is still refused by the API',
    refused.status === 400 && /not valid JSON/i.test(refused.error ?? ''), `HTTP ${refused.status}`)
}

// ---- NAV-MOBILE: the workspace menu opens where its button is, at any depth
{
  const signedInAt = async (email, viewport) => {
    const page = await (await browser.createBrowserContext()).newPage()
    await page.setViewport(viewport)
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    await page.evaluate(async (api, e, pw) => {
      const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
      await fetch(api + '/auth/login', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
        body: JSON.stringify({ email: e, password: pw }) })
    }, API, email, PASSWORD)
    return page
  }
  const phone = { width: 390, height: 844, isMobile: true, hasTouch: true }
  const toggle = '[aria-controls][aria-expanded]'

  /** Scroll deep, open the menu, and say where it landed in the viewport. */
  const openDeep = async (page, route) => {
    await page.goto(BASE + route, { waitUntil: 'networkidle2' })
    await pause(1200)
    const scrolled = await page.evaluate(() => {
      window.scrollTo(0, Math.max(0, document.documentElement.scrollHeight - window.innerHeight * 1.5))
      return window.scrollY
    })
    await pause(800)
    const before = await page.evaluate(() => window.scrollY)
    await page.click(toggle)
    await pause(500)
    return page.evaluate((scrolledTo, beforeTap) => {
      const button = document.querySelector('[aria-controls][aria-expanded]')
      const menu = document.getElementById(button.getAttribute('aria-controls'))
      const box = menu?.getBoundingClientRect()
      return { scrolledTo, expanded: button.getAttribute('aria-expanded'), top: Math.round(box?.top ?? -1),
        visible: Boolean(box) && box.top >= 0 && box.top < 150 && box.bottom <= window.innerHeight + 1,
        beforeTap, scrollY: window.scrollY, links: menu ? [...menu.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [] }
    }, scrolled, before)
  }

  const admin = await signedInAt('grace.bautista@example.com', phone)
  const a = await openDeep(admin, '/admin/users')
  check('NAV-MOBILE-1', 'Admin at 390px, scrolled down Users: the menu opens in view under its button',
    a.scrolledTo > 200 && a.expanded === 'true' && a.visible && a.scrollY === a.beforeTap,
    `scrolled to ${a.beforeTap}px, menu top ${a.top}px, page still at ${a.scrollY}px after the tap`)

  const target = a.links.find((href) => href !== '/admin/users' && href?.startsWith('/admin/'))
  await admin.evaluate((href) => [...document.querySelectorAll(`a[href="${href}"]`)].find((l) => l.offsetParent)?.click(), target)
  await pause(1200)
  const after = await admin.evaluate(() => ({ path: window.location.pathname,
    expanded: document.querySelector('[aria-controls][aria-expanded]')?.getAttribute('aria-expanded') }))
  check('NAV-MOBILE-2', 'Choosing another section goes there and closes the menu',
    after.path === target && after.expanded === 'false', `${after.path}, expanded=${after.expanded}`)

  const again = await openDeep(admin, '/admin/users')
  await admin.click(toggle)
  await pause(300)
  await admin.click(toggle)
  await pause(400)
  const reopened = await admin.evaluate(() => {
    const button = document.querySelector('[aria-controls][aria-expanded]')
    const box = document.getElementById(button.getAttribute('aria-controls'))?.getBoundingClientRect()
    return { top: Math.round(box?.top ?? -1), visible: Boolean(box) && box.top >= 0 && box.top < 150 }
  })
  check('NAV-MOBILE-4', 'Closed and reopened while still scrolled: still in view', again.visible && reopened.visible,
    `menu top ${reopened.top}px`)

  // Keyboard: the button takes Enter, and the first link in the menu is reachable with Tab.
  await admin.click(toggle)
  await pause(300)
  await admin.focus(toggle)
  await admin.keyboard.press('Enter')
  await pause(300)
  await admin.keyboard.press('Tab')
  const focusInMenu = await admin.evaluate(() => {
    const button = document.querySelector('[aria-controls][aria-expanded]')
    return button.getAttribute('aria-expanded') === 'true'
      && Boolean(document.getElementById(button.getAttribute('aria-controls'))?.contains(document.activeElement))
  })
  check('NAV-MOBILE-K', 'Keyboard: Enter opens it and Tab moves into the menu', focusInMenu)

  const staff = await signedInAt('patricia.lim@example.com', phone)
  const st = await openDeep(staff, '/staff/reports')
  check('NAV-MOBILE-3', 'Staff at 390px, scrolled down the report queue: the menu opens in view',
    st.scrolledTo > 200 && st.visible, `scrolled ${st.scrolledTo}px, menu top ${st.top}px`)

  const tablet = await signedInAt('grace.bautista@example.com', { width: 768, height: 1024 })
  const tb = await openDeep(tablet, '/admin/users')
  check('NAV-MOBILE-T', 'Admin at 768px: the same', tb.visible, `menu top ${tb.top}px`)

  const desktop = await signedInAt('grace.bautista@example.com', { width: 1366, height: 900 })
  await desktop.goto(BASE + '/admin/users', { waitUntil: 'networkidle2' })
  await pause(1000)
  const rail = await desktop.evaluate(() => {
    const button = document.querySelector('[aria-controls][aria-expanded]')
    const sidebar = [...document.querySelectorAll('nav')].find((n) => n.offsetParent && n.querySelector('a[href="/admin/users"]'))
    return { buttonShown: Boolean(button?.offsetParent), sidebar: Boolean(sidebar) }
  })
  check('NAV-MOBILE-5', 'Desktop: no menu button, the sidebar is there as before', !rail.buttonShown && rail.sidebar,
    `button shown=${rail.buttonShown}, sidebar=${rail.sidebar}`)
}

// ---- REPORT-ACTIONS: My Reports card actions by state (local only: closes a report)
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(BASE).hostname)) {
  console.log('SKIP  REPORT-ACTIONS closes a report, so it runs against localhost only')
} else {
  const page = await (await browser.createBrowserContext()).newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await page.evaluate(async (api, pw) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    await fetch(api + '/auth/login', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ email: 'maria.santos@example.com', password: pw }) })
  }, API, PASSWORD)

  const openTab = async (label) => {
    await page.goto(BASE + '/dashboard/reports', { waitUntil: 'networkidle2' })
    await pause(900)
    await page.evaluate((l) => [...document.querySelectorAll('[role=tab]')]
      .find((t) => t.textContent.trim().startsWith(l))?.click(), label)
    await pause(500)
  }
  /** Each card in the open panel: its buttons, whether it has a More menu, and whether Close stays inside it. */
  const cards = () => page.evaluate(() => [...document.querySelectorAll('#reports-panel article')].map((card) => {
    const box = card.getBoundingClientRect()
    const buttons = [...card.querySelectorAll('a, button')].filter((b) => b.offsetParent).map((b) => b.textContent.trim())
    const close = [...card.querySelectorAll('button')].find((b) => b.offsetParent && b.textContent.trim() === 'Close report')
    const cb = close?.getBoundingClientRect()
    return { buttons, more: Boolean([...card.querySelectorAll('[aria-haspopup]')].find((m) => m.offsetParent)),
      closeInside: Boolean(cb) && cb.top >= box.top && cb.bottom <= box.bottom && cb.left >= box.left && cb.right <= box.right,
      overflow: document.documentElement.scrollWidth - window.innerWidth }
  }))

  // 1 and 5: a returned report shows Close as a button inside its own card, at every width.
  const widths = []
  for (const viewport of [{ width: 360, height: 740, isMobile: true, hasTouch: true },
    { width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 768, height: 1024 }, { width: 1366, height: 900 }]) {
    await page.setViewport(viewport)
    await openTab('Returned')
    const returned = await cards()
    const ok = returned.length > 0 && returned.every((c) => c.buttons.some((b) => b.startsWith('View report'))
      && c.buttons.includes('Close report') && !c.more && c.closeInside && c.overflow === 0)
    widths.push(`${viewport.width}:${ok ? 'ok' : JSON.stringify(returned)}`)
  }
  const w390 = widths[1]
  check('REPORT-ACTIONS-1', 'Returned at 390px: View report and a direct Close report, no single-item More menu',
    w390.endsWith(':ok'), w390)
  check('REPORT-ACTIONS-5', 'Returned at 360, 390, 768 and 1366px: Close stays inside its own card, nothing overflows',
    widths.every((w) => w.endsWith(':ok')), widths.join(' '))

  // 2: an Active report keeps its More menu, with Edit and Close, on a phone.
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await openTab('Open')
  const menuItems = await page.evaluate(async () => {
    const card = [...document.querySelectorAll('#reports-panel article')].find((c) => c.innerText.includes('Tuna'))
    const trigger = card?.querySelector('[aria-haspopup]')
    trigger?.click()
    await new Promise((r) => setTimeout(r, 400))
    const items = [...trigger.closest('article').querySelectorAll('a, button')]
      .filter((b) => b.offsetParent).map((b) => b.textContent.trim())
    trigger?.click()
    return items
  })
  check('REPORT-ACTIONS-2', 'An Active report at 390px: the More menu still holds Edit report and Close report',
    menuItems.includes('Edit report') && menuItems.includes('Close report'), menuItems.join(', '))

  // EDIT-MATCH-2: a report with an open possible match is frozen. Milo is one
  // in the seed: no Edit anywhere on its card, and its edit address explains.
  const milo = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#reports-panel article')].find((c) => c.innerText.includes('Milo'))
    const actions = card ? [...card.querySelectorAll('a, button')].filter((b) => b.offsetParent).map((b) => b.textContent.trim()) : []
    return { actions, editLink: Boolean(card?.querySelector('a[href$="/edit"]')), menu: Boolean([...(card?.querySelectorAll('[aria-haspopup]') ?? [])].find((m) => m.offsetParent)) }
  })
  await page.goto(BASE + '/dashboard/reports/1/edit', { waitUntil: 'networkidle2' })
  await pause(1000)
  const paused = await page.evaluate(() => ({ title: document.querySelector('main h1')?.textContent.trim(),
    form: Boolean(document.querySelector('main form, main [role=tablist] ~ * input')) }))
  check('EDIT-MATCH-2', 'Possible Match (Milo): no Edit on its card; its edit address says editing is paused',
    !milo.editLink && !milo.menu && !milo.actions.some((a) => /^Edit/.test(a)) && milo.actions.includes('Close report')
      && paused.title === 'Editing is paused',
    `card: ${milo.actions.join(', ')}; edit page: ${paused.title}`)

  // 4: closing through the new button still asks first, and Keep it open keeps it.
  await openTab('Returned')
  const returnedName = await page.evaluate(() => document.querySelector('#reports-panel article h3, #reports-panel article h2')?.textContent.trim())
  const clickClose = () => page.evaluate(() => [...document.querySelectorAll('#reports-panel article button')]
    .find((b) => b.offsetParent && b.textContent.trim() === 'Close report')?.click())
  await clickClose()
  await pause(500)
  const asked = await page.evaluate(() => Boolean(document.querySelector('dialog[open]')))
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.trim() === 'Keep it open')?.click())
  await pause(500)
  const kept = await page.evaluate(() => !document.querySelector('dialog[open]')
    && [...document.querySelectorAll('#reports-panel article button')].some((b) => b.textContent.trim() === 'Close report'))
  await clickClose()
  await pause(500)
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.trim() === 'Close report')?.click())
  await pause(1500)
  await openTab('Closed')
  const closedCards = await cards()
  const inClosed = await page.evaluate((n) => [...document.querySelectorAll('#reports-panel article')].some((c) => c.innerText.includes(n)), returnedName)
  check('REPORT-ACTIONS-4', 'Close report asks first; Keep it open keeps it; confirming moves it to Closed',
    asked && kept && inClosed, `asked=${asked} kept=${kept} in Closed=${inClosed} (${returnedName})`)

  // 3: a closed report offers neither Edit nor Close, and no menu.
  check('REPORT-ACTIONS-3', 'Closed at 390px: no Edit, no Close, no More menu',
    closedCards.length > 0 && closedCards.every((c) => !c.more && !c.buttons.includes('Close report') && !c.buttons.some((b) => b.startsWith('Edit'))),
    JSON.stringify(closedCards.map((c) => c.buttons)))
}

// ---- TABLE-HEAD: a sticky table header sits right under whatever is above it
{
  const at = async (viewport, route) => {
    const page = await (await browser.createBrowserContext()).newPage()
    await page.setViewport(viewport)
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    await page.evaluate(async (api, pw) => {
      const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
      await fetch(api + '/auth/login', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
        body: JSON.stringify({ email: 'grace.bautista@example.com', password: pw }) })
    }, API, PASSWORD)
    await page.goto(BASE + route, { waitUntil: 'networkidle2' })
    await pause(1000)
    return page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight)
      await new Promise((r) => setTimeout(r, 500))
      const head = document.querySelector('thead')?.getBoundingClientRect()
      const bar = [...document.querySelectorAll('header')].find((h) => h.offsetParent && h.getBoundingClientRect().top === 0)
      const barBottom = bar ? Math.round(bar.getBoundingClientRect().bottom) : 0
      const through = [...document.querySelectorAll('tbody tr')].filter((tr) => {
        // Visible in the gap between the bar and the header, not merely behind the header.
        const r = tr.getBoundingClientRect()
        return Math.min(r.bottom, head.top) - Math.max(r.top, barBottom) > 1
      }).length
      return { headTop: Math.round(head?.top ?? -1), barBottom, rowsShowingThrough: through }
    })
  }
  const users = await at({ width: 1366, height: 460 }, '/admin/users')
  check('TABLE-HEAD-1', 'Desktop Users, scrolled: the header sticks at the top, no rows above it',
    users.headTop === 0 && users.rowsShowingThrough === 0, JSON.stringify(users))
  const categories = await at({ width: 768, height: 420 }, '/admin/categories')
  check('TABLE-HEAD-2', 'Tablet Categories, scrolled: the header sticks just under the workspace bar',
    Math.abs(categories.headTop - categories.barBottom) <= 1 && categories.rowsShowingThrough === 0, JSON.stringify(categories))
}

// ---- WITHDRAWN: a pairing withdrawn by a finished report says so (local only: finishes a report)
if (/^(localhost|127\.0\.0\.1)$/.test(new URL(BASE).hostname)) {
  const as = async (email) => {
    const page = await (await browser.createBrowserContext()).newPage()
    await page.setViewport({ width: 1366, height: 900 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    await page.evaluate(async (api, e, pw) => {
      const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
      await fetch(api + '/auth/login', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
        body: JSON.stringify({ email: e, password: pw }) })
    }, API, email, PASSWORD)
    return page
  }
  // Milo's pairing is being verified in the seed; his owner marks him returned.
  const owner = await as('maria.santos@example.com')
  const finished = await owner.evaluate(async (api) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    return (await fetch(api + '/reports/1', { method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ status: 'returned', note: 'Came home on his own.' }) })).status
  }, API)
  const staff = await as('patricia.lim@example.com')
  await staff.goto(BASE + '/staff/matches', { waitUntil: 'networkidle2' })
  await pause(1000)
  await staff.evaluate(() => [...document.querySelectorAll('[role=tab], button')].find((t) => t.textContent.trim().startsWith('Ruled out'))?.click())
  await pause(800)
  const queue = await staff.evaluate(() => {
    const card = [...document.querySelectorAll('li')].find((li) => li.innerText.includes('Milo'))
    return card ? card.innerText : ''
  })
  check('WITHDRAWN-1', 'Staff Match Queue: the pairing reads Withdrawn, not ruled out by the reporter',
    finished === 200 && queue.includes('Withdrawn · a report was finished') && queue.includes('Nobody ruled it out')
      && !queue.includes('said this is not their pet'),
    `PATCH ${finished}`)
  const finder = await as('liza.ocampo@example.com')
  await finder.goto(BASE + '/pet/2', { waitUntil: 'networkidle2' })
  await pause(1200)
  const label = await finder.evaluate(() => document.body.innerText.includes('Withdrawn · a report was finished')
    && !document.body.innerText.includes('Dismissed by User'))
  check('WITHDRAWN-2', "The other reporter's report page says Withdrawn, not Dismissed by User", label)

  // ---- HISTORY: a ruled-out pairing's stored reasons are labelled as history.
  // Milo's pairing is now withdrawn and report 2 is Active again, so its finder
  // may edit it. The pairing keeps the reasons it was made with ("dog"), the
  // report card shows today's turtle, and the page has to say which is which.
  // (Editing under an OPEN pairing is refused; that is audit EM-03.)
  const edited = await finder.evaluate(async (api) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    return (await fetch(api + '/reports/2', { method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ species: 'other', breed: 'turtle' }) })).status
  }, API)
  await staff.goto(BASE + '/staff/matches', { waitUntil: 'networkidle2' })
  await pause(1000)
  await staff.evaluate(() => [...document.querySelectorAll('[role=tab], button')].find((t) => t.textContent.trim().startsWith('Ruled out'))?.click())
  await pause(800)
  const ruledOut = await staff.evaluate(() => {
    const card = [...document.querySelectorAll('article')].find((a) => a.innerText.includes('Milo'))
    return card ? card.innerText : ''
  })
  check('HISTORY-1', 'Staff Ruled out: stored "dog" reason beside today\'s turtle, labelled Historical comparison',
    edited === 200 && ruledOut.includes('Historical comparison.') && ruledOut.includes('compatibility when paired')
      && ruledOut.includes('Both reports describe a dog.') && /turtle/i.test(ruledOut),
    `PUT ${edited}`)
  const openCard = await staff.evaluate(async () => {
    ;[...document.querySelectorAll('[role=tab], button')].find((t) => /^(Needs review|Suggested|Open)/.test(t.textContent.trim()))?.click()
    await new Promise((r) => setTimeout(r, 800))
    const card = document.querySelector('article')
    return card ? card.innerText : ''
  })
  check('HISTORY-2', 'An open pairing carries no historical label', openCard !== '' && !openCard.includes('Historical comparison'))
  await owner.goto(BASE + '/pet/1', { waitUntil: 'networkidle2' })
  await pause(1200)
  const ownerPage = await owner.evaluate(() => document.body.innerText)
  check('HISTORY-3', "The lost report's page labels the earlier pairing as history",
    ownerPage.includes('Earlier pairing') && ownerPage.includes('Historical comparison.'))
  await owner.goto(BASE + '/dashboard/matches', { waitUntil: 'networkidle2' })
  await pause(1000)
  check('HISTORY-4', "The customer's Possible Matches still leaves ruled-out pairings out",
    !(await owner.evaluate(() => document.body.innerText.includes('Historical comparison'))))
  const stored = await staff.evaluate(async (api) => (await (await fetch(api + '/matches/1', { credentials: 'include' })).json()).data, API)
  const keys = new Set(stored.signals.map((s) => s.key))
  const summed = stored.signals.reduce((sum, s) => sum + (s.matched ? s.weight : 0), 0)
  check('HISTORY-5', 'Its stored score still equals its seven signals, one of each, untouched',
    stored.signals.length === 7 && keys.size === 7 && summed === stored.score && stored.score === 85,
    `${stored.score} = ${summed}, ${keys.size} keys`)

  // ---- REOPEN: a coordinator undoes a rejection made in error. Pairing 4 is
  // one no earlier check touches (Mochi's, match 3, has a report that
  // REPORT-ACTIONS closes, and the server rightly refuses to reopen it then).
  const matchStatus = (id) => staff.evaluate(async (api, id) =>
    (await (await fetch(`${api}/matches/${id}`, { credentials: 'include' })).json()).data.status, API, id)
  const rejectCode = await staff.evaluate(async (api) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    return (await fetch(api + '/matches/4', { method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ action: 'reject', note: 'Different ear shape.' }) })).status
  }, API)
  await staff.goto(BASE + '/staff/matches', { waitUntil: 'networkidle2' })
  await pause(1000)
  await staff.evaluate(() => [...document.querySelectorAll('[role=tab], button')].find((t) => t.textContent.trim().startsWith('Ruled out'))?.click())
  await pause(700)
  await staff.evaluate(() =>
    [...document.getElementById('match-4').querySelectorAll('button')].find((b) => b.textContent.trim() === 'Reopen for review').click())
  await pause(500)
  const dialog = await staff.evaluate(() => {
    const d = document.querySelector('dialog[open]')
    const go = [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Reopen for review')
    return { title: d.querySelector('h2')?.textContent, blocked: go.disabled }
  })
  check('REOPEN-1', 'Reopen asks first, and cannot be sent without a reason',
    rejectCode === 200 && dialog.title === 'Reopen this pairing for review?' && dialog.blocked, JSON.stringify({ rejectCode, ...dialog }))
  await staff.evaluate(() => {
    const box = document.querySelector('dialog[open] textarea')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, 'Ruled out too quickly; the finder sent a clearer photo.')
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })
  // Wait for the page to enable the button, then for the server's answer.
  await staff.waitForFunction(() => {
    const go = [...document.querySelector('dialog[open]').querySelectorAll('button')].find((b) => b.textContent.trim() === 'Reopen for review')
    return go && !go.disabled
  }, { timeout: 5000 })
  await staff.evaluate(() => [...document.querySelector('dialog[open]').querySelectorAll('button')].find((b) => b.textContent.trim() === 'Reopen for review').click())
  let reopened = ''
  for (let tries = 0; tries < 20 && reopened !== 'under_review'; tries++) {
    await pause(300)
    reopened = await matchStatus(4)
  }
  const dialogError = await staff.evaluate(() => document.querySelector('dialog[open] [role=alert]')?.textContent ?? '')
  check('REOPEN-2', 'Reopened: the pairing is back with a coordinator', reopened === 'under_review', `${reopened} ${dialogError}`)

  // ---- DECIDE-ASK: Confirm and Not the same pet both ask before anything happens
  await staff.goto(BASE + '/staff/verification#match-4', { waitUntil: 'networkidle2' })
  await pause(1200)
  const ask = async (label) => {
    await staff.evaluate((label) => [...document.getElementById('match-4').querySelectorAll('button')].find((b) => b.textContent.trim() === label).click(), label)
    await pause(400)
    const shown = await staff.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      return d ? { title: d.querySelector('h2')?.textContent, focus: document.activeElement?.textContent.trim() } : null
    })
    await staff.evaluate(() => [...document.querySelector('dialog[open]').querySelectorAll('button')].find((b) => b.textContent.trim() === 'Go back').click())
    await pause(400)
    return shown
  }
  const confirmAsk = await ask('Confirm match')
  check('DECIDE-ASK-1', 'Confirm match asks "Confirm this match?" with Go back focused, and Go back decides nothing',
    confirmAsk?.title === 'Confirm this match?' && confirmAsk.focus === 'Go back' && (await matchStatus(4)) === 'under_review',
    JSON.stringify(confirmAsk))
  await staff.evaluate(() => {
    const label = [...document.getElementById('match-4').querySelectorAll('label')].find((l) => l.textContent.trim().startsWith('Case note'))
    const box = document.getElementById(label.htmlFor)
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, 'Different markings on the chest.')
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await pause(200)
  const rejectAsk = await ask('Not the same pet')
  check('DECIDE-ASK-2', 'Not the same pet asks "Rule this pairing out?" with Go back focused, and Go back decides nothing',
    rejectAsk?.title === 'Rule this pairing out?' && rejectAsk.focus === 'Go back' && (await matchStatus(4)) === 'under_review',
    JSON.stringify(rejectAsk))

  // ---- REOPEN-DISMISS: a "Not my pet" can be reopened; a withdrawal cannot.
  // Pairing 4 is under review again; a reporter's "Not my pet" is sent for it
  // (staff may act for a reporter). Milo's pairing, 1, was withdrawn above.
  const dismissCode = await staff.evaluate(async (api) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    return (await fetch(api + '/matches/4', { method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ action: 'dismiss' }) })).status
  }, API)
  await staff.goto(BASE + '/staff/matches', { waitUntil: 'networkidle2' })
  await pause(1000)
  await staff.evaluate(() => [...document.querySelectorAll('[role=tab], button')].find((t) => t.textContent.trim().startsWith('Ruled out'))?.click())
  await pause(800)
  const reopenButtons = await staff.evaluate(() => {
    const has = (id) => [...(document.getElementById(id)?.querySelectorAll('button') ?? [])]
      .some((b) => b.textContent.trim() === 'Reopen for review')
    return { dismissed: has('match-4'), withdrawn: has('match-1'), withdrawnShown: Boolean(document.getElementById('match-1')) }
  })
  check('REOPEN-3', 'A reporter\'s "Not my pet" offers Reopen for review',
    dismissCode === 200 && reopenButtons.dismissed, `PATCH ${dismissCode}, ${JSON.stringify(reopenButtons)}`)
  check('REOPEN-4', 'A withdrawn pairing does not', reopenButtons.withdrawnShown && !reopenButtons.withdrawn,
    JSON.stringify(reopenButtons))
}

// ---- ADMIN-SITE: the administrator stays in Administration; report pages stay open
{
  const page = await (await browser.createBrowserContext()).newPage()
  await page.setViewport({ width: 1366, height: 900 })
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' })
  await page.evaluate(async (api, pw) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    await fetch(api + '/auth/login', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ email: 'grace.bautista@example.com', password: pw }) })
  }, API, PASSWORD)
  const landsOn = async (route) => {
    await page.goto(BASE + route, { waitUntil: 'networkidle2' })
    await pause(700)
    return page.evaluate(() => window.location.pathname)
  }
  const sent = {}
  for (const route of ['/', '/explore', '/report/lost', '/report/found', '/about', '/help', '/privacy']) {
    sent[route] = await landsOn(route)
  }
  check('ADMIN-SITE-1', 'Home, Explore, Report a pet, About, Help and Privacy send the administrator to /admin',
    Object.values(sent).every((path) => path === '/admin'), JSON.stringify(sent))
  const report = await landsOn('/pet/1')
  check('ADMIN-SITE-2', 'A report page still opens for the administrator (Moderation and Records link to it)',
    report === '/pet/1', report)
  await landsOn('/admin/moderation')
  const rail = await page.evaluate(() => ({
    backLink: document.body.innerText.includes('Back to the public site'),
    logo: [...document.querySelectorAll('a')].find((a) => a.querySelector('img[alt="Paws&Found"]') && a.offsetParent)?.getAttribute('href'),
  }))
  check('ADMIN-SITE-3', 'The admin rail has no "Back to the public site", and its logo goes to the Overview',
    !rail.backLink && rail.logo === '/admin', JSON.stringify(rail))

  const staffPage = await (await browser.createBrowserContext()).newPage()
  await staffPage.setViewport({ width: 1366, height: 900 })
  await staffPage.goto(BASE + '/login', { waitUntil: 'networkidle2' })
  await staffPage.evaluate(async (api, pw) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    await fetch(api + '/auth/login', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ email: 'patricia.lim@example.com', password: pw }) })
  }, API, PASSWORD)
  await staffPage.goto(BASE + '/explore', { waitUntil: 'networkidle2' })
  await pause(700)
  const staffExplore = await staffPage.evaluate(() => window.location.pathname)
  await staffPage.goto(BASE + '/staff', { waitUntil: 'networkidle2' })
  await pause(700)
  const staffBack = await staffPage.evaluate(() => document.body.innerText.includes('Back to the public site'))
  check('ADMIN-SITE-4', 'A Pet Coordinator is unaffected: Explore opens, and the rail keeps its way back',
    staffExplore === '/explore' && staffBack, `${staffExplore}, back link ${staffBack}`)
}

await browser.close()
const failed = results.filter((ok) => !ok).length
console.log('')
console.log(`${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
