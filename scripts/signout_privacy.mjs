// Browser privacy checks: signing out, switching accounts, and the guest map.
//
//   PAWS_BASE=http://localhost:5173 PAWS_PW=<seeded password> npm run test:signout
//
// The API has always refused a guest the full report (401). What this checks
// is the browser: a report fetched while signed in must not stay on screen,
// in memory, or come back through Back, once the session is gone. A real
// Chrome, the real Sign out button, one report (Milo, /pet/1) seen as its
// owner, another member, a coordinator and an administrator.
//
// Changes no data. Needs Chrome, the dev server (or a build) and the API.
// The seeded accounts' password comes from PAWS_PW (README, "Signing in"),
// so it is neither in this file nor in anything it prints.

// The page.evaluate() callbacks below run inside the page, where these exist.
/* global document, window, MutationObserver, PopStateEvent, HTMLInputElement, HTMLTextAreaElement */
import puppeteer from 'puppeteer-core'

const BASE = process.env.PAWS_BASE ?? 'http://localhost/pawsandfound'
const API = BASE + '/api'
const CHROME = process.env.CHROME
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const REPORT = '/pet/1'
const GATE = 'Sign in to see this report'
const PASSWORD = process.env.PAWS_PW
if (!PASSWORD) {
  console.error('Set PAWS_PW to the password of the seeded accounts (see README, "Signing in").')
  process.exit(2)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 1280, height: 900 },
})

const results = []
const check = (id, description, ok, detail = '') => {
  results.push({ id, description, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(6)} ${description}${detail ? `  (${detail})` : ''}`)
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const text = (page) => page.evaluate(() => document.body.innerText)

/** Sign in through the API, as the a11y suite does, with the session's CSRF token. */
async function signIn(page, email) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  const status = await page.evaluate(async (api, e, pw) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    const response = await fetch(api + '/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ email: e, password: pw }),
    })
    return response.status
  }, API, email, PASSWORD)
  if (status !== 200) throw new Error(`Could not sign in as ${email}: HTTP ${status}`)
}

/** The words only a signed-in viewer is sent: the description and the markings. */
async function privateWords(page) {
  return page.evaluate(async (api) => {
    const body = await (await fetch(api + '/reports/1', { credentials: 'include' })).json()
    const report = body.data ?? body
    return [report.description, report.distinct_features].filter(Boolean)
  }, API)
}

/** Press the real Sign out button, opening the account menu first if it is folded away. */
async function signOutThroughTheUi(page) {
  await page.evaluate(async () => {
    const find = () => [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Sign out')
    if (!find()) {
      [...document.querySelectorAll('header button')]
        .find((button) => button.textContent.includes('account menu'))?.click()
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    find().click()
  })
}

/** Wait until the gate is up or the time runs out; returns the milliseconds taken, or null. */
async function waitForGate(page, limitMs) {
  const started = Date.now()
  while (Date.now() - started < limitMs) {
    if ((await text(page)).includes(GATE)) return Date.now() - started
    await pause(100)
  }
  return null
}

/** Signed-out view: home or the gate, and none of the private words left. */
async function waitForSignedOutView(target, words, limitMs) {
  const started = Date.now()
  while (Date.now() - started < limitMs) {
    const now = await text(target)
    const path = new URL(target.url()).pathname
    if ((path === '/' || now.includes(GATE)) && words.every((word) => !now.includes(word))) {
      return Date.now() - started
    }
    await pause(100)
  }
  return null
}

/** Move inside the app without reloading, so nothing is cleared by a fresh page. */
async function goInApp(target, path) {
  await target.evaluate((to) => {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await pause(1500)
}

/** Reach the sign-in form the way a person would: the page already on it, or the header's Sign in. */
async function openSignIn(target) {
  if (!new URL(target.url()).pathname.endsWith('/login')) {
    const clicked = await target.evaluate(() => {
      const link = [...document.querySelectorAll('header a')]
        .find((a) => a.getAttribute('href')?.endsWith('/login'))
      link?.click()
      return Boolean(link)
    })
    if (!clicked) await goInApp(target, '/login')
    await pause(1000)
  }
}

const page = await browser.newPage()

// A. A guest opening the report gets the gate and nothing private.
{
  await page.goto(BASE + REPORT, { waitUntil: 'networkidle2' })
  await pause(800)
  check('SO-A', 'Guest opening a report sees the sign-in gate', (await text(page)).includes(GATE))
  const status = await page.evaluate(async (api) =>
    (await fetch(api + '/reports/1', { credentials: 'include' })).status, API)
  check('SO-A2', 'Guest asking the API for the report gets 401', status === 401, `HTTP ${status}`)
}

// B-E. Each role: the report is on screen, Sign out, and it is gone.
for (const [id, label, email] of [
  ['SO-B', 'another member', 'noel.aguilar@example.com'],
  ['SO-C', 'the owner', 'maria.santos@example.com'],
  ['SO-D', 'a coordinator', 'patricia.lim@example.com'],
  ['SO-E', 'an administrator', 'grace.bautista@example.com'],
]) {
  await signIn(page, email)
  const words = await privateWords(page)
  await page.goto(BASE + REPORT, { waitUntil: 'networkidle2' })
  await pause(800)
  const before = await text(page)
  const shownBefore = words.length > 0 && words.every((word) => before.includes(word))

  await signOutThroughTheUi(page)
  const tookMs = await waitForSignedOutView(page, words, 3000)
  const after = await text(page)
  const leftOver = words.filter((word) => after.includes(word))
  const where = new URL(page.url()).pathname

  check(id, `Signed in as ${label}, Sign out on the report: private text gone at once`,
    shownBefore && tookMs !== null && leftOver.length === 0,
    !shownBefore ? 'private text was not on screen to begin with'
      : tookMs === null ? `still showing ${leftOver.length} private field(s) after 3 s`
        : `${where === '/' ? 'home' : where} after ${tookMs} ms`)
}

// Back. Sign in, open the report, move on inside the app, sign out, press Back.
{
  await signIn(page, 'maria.santos@example.com')
  const words = await privateWords(page)
  await page.goto(BASE + REPORT, { waitUntil: 'networkidle2' })
  await pause(800)
  await page.evaluate(() => document.querySelector('a[href$="/explore"]')?.click())
  await pause(1200)
  await signOutThroughTheUi(page)
  await pause(1500)
  // Watch every change to the page from here on: "gone by the end" is not
  // enough if the old report flashed up first.
  await page.evaluate((privateWords) => {
    window.__privatePainted = false
    new MutationObserver(() => {
      if (privateWords.some((word) => document.body.innerText.includes(word))) {
        window.__privatePainted = true
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  }, words)
  await page.goBack()
  const tookMs = await waitForGate(page, 3000)
  const painted = await page.evaluate(() => window.__privatePainted)
  check('SO-F', 'Sign out elsewhere, then Back to the report: gate, and the old report never painted',
    tookMs !== null && !painted,
    painted ? 'private text appeared before the gate' : tookMs === null ? 'no gate' : `gate after ${tookMs} ms, nothing private painted`)

  await page.reload({ waitUntil: 'networkidle2' })
  check('SO-G', 'Refresh after signing out: gate', (await waitForGate(page, 3000)) !== null)

  await page.goto(BASE + REPORT, { waitUntil: 'networkidle2' })
  check('SO-H', 'Opening the same address again after signing out: gate', (await waitForGate(page, 3000)) !== null)
}

// Two tabs. The report open in tab A, Sign out in tab B.
for (const [id, how] of [['SO-I', 'focus'], ['SO-J', 'timer']]) {
  await signIn(page, 'maria.santos@example.com')
  await page.goto(BASE + REPORT, { waitUntil: 'networkidle2' })
  await pause(800)
  const words = await privateWords(page)

  const other = await browser.newPage()
  await other.goto(BASE + '/dashboard', { waitUntil: 'networkidle2' })
  await pause(800)
  await other.bringToFront()
  await signOutThroughTheUi(other)
  await pause(800)

  // Tab A has not been told anything. It learns from the focus it gets when
  // somebody returns to it, or from the ten-second re-check. Tab B stays open
  // and in front until then: closing it hands the focus straight back to A,
  // which would make the timer case measure the focus case twice.
  if (how === 'focus') await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  const tookMs = await waitForGate(page, how === 'focus' ? 3000 : 12_000)
  const after = await text(page)
  await other.close()
  check(id, how === 'focus'
    ? 'Signed out in another tab; this tab regains focus: gate'
    : 'Signed out in another tab; this tab left alone: gate by the next re-check',
  tookMs !== null && words.every((word) => !after.includes(word)),
  tookMs === null ? 'old report still on screen' : `gate after ${tookMs} ms`)
}

// Home and Explore stay public, but a signed-in member is sent more of each row
// (description, markings, condition, time, place name). After Sign out the
// rows must be fetched again as a guest, not kept and merely not shown.
const MEMBER_ONLY = ['description', 'distinct_features', 'condition', 'incident_time']
for (const [id, route, label] of [['SO-M', '/', 'Home'], ['SO-N', '/explore', 'Explore']]) {
  await signIn(page, 'maria.santos@example.com')
  const lists = []
  const record = async (response) => {
    const url = new URL(response.url())
    if (!/\/api\/reports$/.test(url.pathname) || response.request().method() !== 'GET') return
    try { lists.push((await response.json()).data ?? []) } catch { /* not JSON */ }
  }
  page.on('response', record)
  await page.goto(BASE + route, { waitUntil: 'networkidle2' })
  await pause(1000)
  const memberRows = lists.flat()
  const memberHadMore = memberRows.some((row) => MEMBER_ONLY.some((key) => key in row))

  lists.length = 0
  await signOutThroughTheUi(page)
  await pause(2500)
  const guestRows = lists.flat()
  const leaked = guestRows.filter((row) =>
    MEMBER_ONLY.some((key) => key in row) || row.location?.label !== undefined)
  page.off('response', record)

  check(id, `${label}: after Sign out the list is fetched again as the guest summary`,
    memberHadMore && guestRows.length > 0 && leaked.length === 0,
    !memberHadMore ? 'member rows had nothing extra to lose'
      : guestRows.length === 0 ? 'the list was not fetched again'
        : `${guestRows.length} guest rows, ${leaked.length} with member-only fields`)
}

// Signing in through the real form still lands in the right place, now that
// every page starts again when the person changes.
async function signInThroughTheForm(target, email) {
  await target.waitForSelector('input[type=email]')
  await target.type('input[type=email]', email)
  await target.type('input[type=password]', PASSWORD)
  await target.keyboard.press('Enter')
  await pause(2000)
  return new URL(target.url()).pathname
}

{
  await page.goto(BASE + '/dashboard/notifications', { waitUntil: 'networkidle2' })
  const landed = await signInThroughTheForm(page, 'maria.santos@example.com')
  check('SO-K', 'Guest sent to sign in from a customer page is returned to it',
    landed === '/dashboard/notifications', landed)

  await signOutThroughTheUi(page)
  await pause(1000)
  await signIn(page, 'patricia.lim@example.com')
  await page.goto(BASE + '/staff/verification', { waitUntil: 'networkidle2' })
  await pause(800)
  await signOutThroughTheUi(page)
  await pause(1200)
  await openSignIn(page)
  const after = await signInThroughTheForm(page, 'maria.santos@example.com')
  check('SO-L', 'Staff signs out in a workspace, a customer signs in: their own dashboard',
    after === '/dashboard', after)

  // The reverse, and one customer after another: a manual Sign out ends the
  // last person's place, so the next account starts at its own home.
  await goInApp(page, '/dashboard/matches')
  await signOutThroughTheUi(page)
  await pause(1200)
  await openSignIn(page)
  const staffLanded = await signInThroughTheForm(page, 'patricia.lim@example.com')
  check('SO-O', 'Customer signs out, staff signs in: the staff workspace', staffLanded === '/staff', staffLanded)

  await signOutThroughTheUi(page)
  await pause(1000)
  await signIn(page, 'noel.aguilar@example.com')
  await page.goto(BASE + '/report/found', { waitUntil: 'networkidle2' })
  await pause(800)
  await signOutThroughTheUi(page)
  await pause(1200)
  await openSignIn(page)
  const nextLanded = await signInThroughTheForm(page, 'maria.santos@example.com')
  check('SO-P', 'One customer signs out on Report Found, another signs in: their own dashboard',
    nextLanded === '/dashboard', nextLanded)
}

// A half-filled report must not be waiting for the next person on this browser.
{
  const MARK = 'Unsaved-by-Noel-7431'
  await signOutThroughTheUi(page)
  await pause(1000)
  await signIn(page, 'noel.aguilar@example.com')
  await page.goto(BASE + '/report/found', { waitUntil: 'networkidle2' })
  await pause(1000)
  const typedInto = await page.evaluate((mark) => {
    const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const setArea = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    let count = 0
    for (const field of document.querySelectorAll('main input[type=text], main input:not([type]), main textarea')) {
      if (field.tagName === 'TEXTAREA') setArea.call(field, mark)
      else setInput.call(field, mark)
      field.dispatchEvent(new Event('input', { bubbles: true }))
      count++
    }
    return count
  }, MARK)
  await signOutThroughTheUi(page)
  await pause(1200)
  await openSignIn(page)
  await signInThroughTheForm(page, 'maria.santos@example.com')
  await goInApp(page, '/report/found')
  const leftBehind = await page.evaluate((mark) =>
    [...document.querySelectorAll('input, textarea')].filter((field) => field.value.includes(mark)).length
    + (document.body.innerText.includes(mark) ? 1 : 0), MARK)
  check('SO-Q', 'Unsaved Report Found values do not survive into the next account',
    typedInto > 0 && leftBehind === 0,
    `${typedInto} field(s) filled by the first account, ${leftBehind} left for the next`)
}

// The map. A guest is sent only snapped pins and cannot zoom past the level a
// report is framed at; a signed-in member's map is as before.
const onGrid = (value) => value == null || Math.abs(Math.round(value / 0.004) * 0.004 - value) < 1e-9

/** Open Explore's map and press zoom-in until Leaflet refuses. */
async function zoomAsFarAsAllowed(target, route) {
  await target.goto(BASE + route, { waitUntil: 'networkidle2' })
  await pause(1500)
  return target.evaluate(async () => {
    [...document.querySelectorAll('button, [role=tab]')].find((b) => b.textContent.trim() === 'Map')?.click()
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const zoom = () => Math.max(0, ...[...document.querySelectorAll('.leaflet-tile')]
      .map((tile) => Number((tile.src.match(/\/(\d+)\/\d+\/\d+\.png/) ?? [0, 0])[1])))
    const start = zoom()
    const button = document.querySelector('.leaflet-control-zoom-in')
    for (let i = 0; i < 12 && button && !button.classList.contains('leaflet-disabled'); i++) {
      button.click()
      await new Promise((resolve) => setTimeout(resolve, 700))
    }
    await new Promise((resolve) => setTimeout(resolve, 1200))
    return { start, end: zoom(), tiles: document.querySelectorAll('.leaflet-tile-loaded').length }
  })
}

{
  await signOutThroughTheUi(page)
  await pause(1000)
  const rows = await page.evaluate(async (api) =>
    (await (await fetch(api + '/reports?per_page=100', { credentials: 'include' })).json()).data ?? [], API)
  const pinned = rows.filter((row) => row.location?.lat != null)
  check('SO-R', 'Guest list: every pin is on the public 0.004 degree grid, never the stored point',
    pinned.length > 0 && pinned.every((row) => onGrid(row.location.lat) && onGrid(row.location.lng)),
    `${pinned.length} pinned rows`)

  const guest = await zoomAsFarAsAllowed(page, '/explore?q=milo')
  check('SO-S', 'Guest Explore map stops at zoom 15', guest.end === 15, `from ${guest.start} to ${guest.end}`)

  await page.setViewport({ width: 390, height: 844, isMobile: true })
  const phone = await zoomAsFarAsAllowed(page, '/explore')
  await page.setViewport({ width: 1280, height: 900 })
  check('SO-T', 'Guest Explore map at 390 px: tiles load, zooms in, stops at 15',
    phone.tiles > 0 && phone.end > phone.start && phone.end === 15,
    `from ${phone.start} to ${phone.end}, ${phone.tiles} tiles`)

  await signIn(page, 'maria.santos@example.com')
  const member = await zoomAsFarAsAllowed(page, '/explore?q=milo')
  check('SO-U', 'Signed-in Explore map is unchanged: zooms past 15', member.end > 15,
    `from ${member.start} to ${member.end}`)

  const detail = await page.evaluate(async (api) =>
    (await (await fetch(api + '/reports/1', { credentials: 'include' })).json()).data ?? {}, API)
  check('SO-V', 'The owner still receives the stored pin, not the public one',
    detail.location?.lat != null && !onGrid(detail.location.lat), `lat ${detail.location?.lat}`)
}

await browser.close()

const failed = results.filter((result) => !result.ok).length
console.log('')
console.log(`${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
