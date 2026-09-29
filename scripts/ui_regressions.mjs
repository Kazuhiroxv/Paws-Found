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
// REPORT-ACTIONS: a returned report's only remaining action, Close, sat alone
// in a More menu whose panel hung over the next card on a phone.
//
// The MOD-FLAG checks raise one flag and dismiss it, so they run only against
// localhost and are skipped anywhere else. Nothing else changes data: the one
// registration request is refused by the API on purpose.
//
// The page.evaluate() callbacks run inside the page, where these exist.
/* global document, window */
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

  // 2: an open report keeps its More menu, with Edit and Close, on a phone.
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await openTab('Open')
  const menuItems = await page.evaluate(async () => {
    const trigger = document.querySelector('#reports-panel article [aria-haspopup]')
    trigger?.click()
    await new Promise((r) => setTimeout(r, 400))
    const items = [...trigger.closest('article').querySelectorAll('a, button')]
      .filter((b) => b.offsetParent).map((b) => b.textContent.trim())
    trigger?.click()
    return items
  })
  check('REPORT-ACTIONS-2', 'Open at 390px: the More menu still holds Edit report and Close report',
    menuItems.includes('Edit report') && menuItems.includes('Close report'), menuItems.join(', '))

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

await browser.close()
const failed = results.filter((ok) => !ok).length
console.log('')
console.log(`${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
