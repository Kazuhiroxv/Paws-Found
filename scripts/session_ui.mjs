/**
 * Correction 5, in a real browser: sign-out reliability, session-end
 * messages, page views and the Logs page.
 *
 *   PAWS_BASE=http://localhost:5173 PAWS_PW=<seeded password> npm run test:session-ui
 *
 *   RACE   the cross-tab sign-out race, made to happen on purpose: tab A's
 *          session check is held at the network AFTER the server answered
 *          "signed in", tab B signs out, tab A asks again, the stale answer is
 *          released. No CPU load, no luck — the Chrome DevTools Fetch domain
 *          pauses the response.
 *   MSG    what the page says when the server ends a session, for each reason
 *   PV     page views: one per page, none for re-renders, focus, polling,
 *          query strings or guests
 *   LOGUI  the administrator's Logs page
 *
 * Writes api/config.local.php while it runs (session clocks in seconds, email
 * captured) and restores it. Changes data; reseeds at the end.
 */
// The functions passed to page.evaluate run in the browser, not in Node.
/* global document, window, PopStateEvent */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BASE = process.env.PAWS_BASE ?? 'http://localhost:5173'
const API = BASE + '/api'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MYSQL = process.env.PAWS_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'
const PASSWORD = process.env.PAWS_PW
if (!PASSWORD) {
  console.error('Set PAWS_PW to the password of the seeded accounts (see README, "Signing in").')
  process.exit(2)
}

const LOCAL_CONFIG = path.join(ROOT, 'api', 'config.local.php')
const CAPTURE_DIR = path.join(os.tmpdir(), 'pawsandfound-mail-session-ui')
const REPORT = '/pet/1'
const GATE = 'Sign in to see this report'
const NEW_PASSWORD = 'quiet harbour passphrase'

const results = []
const check = (id, description, ok, detail = '') => {
  results.push({ id, description, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(8)} ${description}${detail ? `  (${detail})` : ''}`)
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sql = (query) =>
  execFileSync(MYSQL, ['-uroot', '-h127.0.0.1', '-P3307', '--default-character-set=utf8mb4', '-N', '-B', 'pawsandfound', '-e', query])
    .toString().trim()
const uid = (email) => Number(sql(`SELECT user_id FROM users WHERE email = '${email}'`))
const newestSession = (email) =>
  Number(sql(`SELECT MAX(session_record_id) FROM user_sessions WHERE user_id = ${uid(email)}`))
const pageViews = (record, route) =>
  Number(sql(`SELECT COUNT(*) FROM user_activity_logs WHERE session_record_id = ${record} AND action = 'page_view'`
    + (route ? ` AND route = '${route}'` : '')))

function writeConfig(defines = {}) {
  const lines = ['<?php',
    "define('MAIL_TRANSPORT', 'capture');",
    `define('MAIL_CAPTURE_DIR', '${CAPTURE_DIR.replaceAll('\\', '/')}');`,
    "define('TURNSTILE_ENABLED', false);",
    ...Object.entries(defines).map(([name, value]) => `define('${name}', ${value});`)]
  fs.writeFileSync(LOCAL_CONFIG, lines.join('\n') + '\n')
}
const previousConfig = fs.existsSync(LOCAL_CONFIG) ? fs.readFileSync(LOCAL_CONFIG, 'utf8') : null
fs.rmSync(CAPTURE_DIR, { recursive: true, force: true })
writeConfig()
// The reset-link limit (3 an hour per address and per IP) would otherwise run
// out after a few runs, and no email would arrive for MSG-05.
sql('DELETE FROM auth_rate_limits')

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })

// ------------------------------------------------------------------ helpers
const text = (page) => page.evaluate(() => document.body.innerText)
const notice = (page) => page.evaluate(() => {
  const box = document.querySelector('[role=alert][data-session-ended], [role=alert]')
  return box ? { text: box.innerText, reason: box.dataset.sessionEnded ?? null, role: box.getAttribute('role'),
    dismiss: Boolean([...box.querySelectorAll('button')].find((b) => b.textContent.includes('Dismiss this message'))) } : null
})

/**
 * A browser of its own (its own cookies): a separate device.
 *
 * `noPoll` switches off the app's ten-second re-check in that browser, for the
 * race tests: otherwise the poll can happen to land inside the window and
 * rescue a tab that the code under test left wrong, and the test would pass
 * by luck. Without it, only the refresh the test triggers can fix the tab.
 */
async function newDevice({ noPoll = false } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  if (noPoll) {
    await page.evaluateOnNewDocument(() => {
      const real = window.setInterval
      window.setInterval = (fn, ms, ...rest) => (ms === 10_000 ? 0 : real(fn, ms, ...rest))
    })
  }
  return { context, page }
}

/** Whether the header shows somebody signed in (their workspace link). */
const looksSignedIn = async (page) => (await text(page)).includes('My Dashboard')

/** Sign in through the API from inside the page, as the other browser suites do. */
async function signIn(page, email, password = PASSWORD) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  const status = await page.evaluate(async (api, e, pw) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    const response = await fetch(api + '/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ email: e, password: pw }),
    })
    return response.status
  }, API, email, password)
  if (status !== 200) throw new Error(`Could not sign in as ${email}: HTTP ${status}`)
}

/** A write from inside a page, with its CSRF token. */
const apiWrite = (page, method, route, body) => page.evaluate(async (api, m, r, b) => {
  const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
  const response = await fetch(api + r, {
    method: m, credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
    body: JSON.stringify(b),
  })
  return response.status
}, API, method, route, body)

const signOutHere = (page) => apiWrite(page, 'POST', '/auth/logout', {})

/** The words only a signed-in viewer is sent for report 1. */
const privateWords = (page) => page.evaluate(async (api) => {
  const body = await (await fetch(api + '/reports/1', { credentials: 'include' })).json()
  return [body.data?.description, body.data?.distinct_features].filter(Boolean)
}, API)

async function showsReport(page, words) {
  for (let waited = 0; waited < 5000; waited += 200) {
    const now = await text(page)
    if (words.length && words.every((word) => now.includes(word))) return true
    await pause(200)
  }
  return false
}

/** Wait until `test(page)` is true; the milliseconds it took, or null. */
async function within(page, limitMs, test) {
  const started = Date.now()
  while (Date.now() - started < limitMs) {
    if (await test(page)) return Date.now() - started
    await pause(100)
  }
  return null
}

const refocus = (page) => page.evaluate(() => window.dispatchEvent(new Event('focus')))
const goInApp = (page, to) => page.evaluate((target) => {
  window.history.pushState({}, '', target)
  window.dispatchEvent(new PopStateEvent('popstate'))
}, to)

/**
 * Hold this tab's /auth/me answers at the network, after the server has
 * answered. `hold()` arms it for the next one; `release()` lets it through.
 */
async function holdSessionChecks(page) {
  const cdp = await page.createCDPSession()
  let armed = false
  let held = null
  let heldSeen
  const heldPromise = () => new Promise((resolve) => { heldSeen = resolve })
  let waitForHeld = heldPromise()
  let count = 0
  cdp.on('Fetch.requestPaused', async (event) => {
    count++
    if (armed && !held) {
      held = event.requestId
      armed = false
      heldSeen()
      return
    }
    await cdp.send('Fetch.continueRequest', { requestId: event.requestId }).catch(() => {})
  })
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/auth/me*', requestStage: 'Response' }] })
  return {
    hold() { armed = true; held = null; waitForHeld = heldPromise() },
    held: () => waitForHeld,
    async release() {
      if (held) await cdp.send('Fetch.continueRequest', { requestId: held }).catch(() => {})
      held = null
    },
    count: () => count,
    async stop() { await cdp.send('Fetch.disable').catch(() => {}); await cdp.detach().catch(() => {}) },
  }
}

const signedOutView = (words) => async (page) => {
  const now = await text(page)
  return words.every((word) => !now.includes(word)) && (now.includes(GATE) || new URL(page.url()).pathname === '/login')
}

try {
  // ========================================================== RACE
  console.log('\nRACE. The cross-tab sign-out race, reproduced on purpose')
  {
    // RACE-1: focus while a stale check is in flight.
    const { context, page: tabA } = await newDevice({ noPoll: true })
    await signIn(tabA, 'maria.santos@example.com')
    const words = await privateWords(tabA)
    await tabA.goto(BASE + REPORT, { waitUntil: 'networkidle2' })
    const shown = await showsReport(tabA, words)
    const tabB = await context.newPage()
    await tabB.goto(BASE + '/', { waitUntil: 'networkidle2' })

    const net = await holdSessionChecks(tabA)
    await pause(1500)                      // let the page's own first requests finish
    net.hold()
    await refocus(tabA)
    await net.held()                       // the server said "signed in"; held
    await signOutHere(tabB)                // tab B signs out
    await refocus(tabA)                    // tab A asks again, mid-flight
    await net.release()                    // the stale "signed in" arrives
    const took = await within(tabA, 3000, signedOutView(words))
    const said = await notice(tabA)
    check('RACE-1', 'Stale "signed in" + focus during it: tab A signs out at once, private text gone',
      shown && took !== null, took === null ? 'still showing the report after 3 s' : `signed-out view after ${took} ms`)
    check('RACE-1b', '...and says so', said?.text?.includes('You have been signed out.') ?? false, said?.text?.split('\n')[0])
    await net.stop()
    await context.close()
  }
  {
    // RACE-2: a route change while a stale check is in flight.
    const { context, page: tabA } = await newDevice({ noPoll: true })
    await signIn(tabA, 'maria.santos@example.com')
    await tabA.goto(BASE + '/dashboard', { waitUntil: 'networkidle2' })
    const tabB = await context.newPage()
    await tabB.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const net = await holdSessionChecks(tabA)
    await pause(1500)                      // let the page's own first requests finish
    net.hold()
    await refocus(tabA)
    await net.held()
    await signOutHere(tabB)
    await goInApp(tabA, '/explore')        // route-triggered check, mid-flight
    await net.release()
    const took = await within(tabA, 3000, async (page) => (await notice(page))?.text?.includes('You have been signed out.')
      && (await text(page)).includes('Sign in'))
    check('RACE-2', 'Stale "signed in" + a route change during it: signed out at once', took !== null,
      took === null ? 'still signed in after 3 s' : `${took} ms`)
    await net.stop()
    await context.close()
  }
  {
    // RACE-3: this tab signs out while its own stale check is in flight.
    const { context, page } = await newDevice({ noPoll: true })
    await signIn(page, 'maria.santos@example.com')
    const words = await privateWords(page)
    await page.goto(BASE + REPORT, { waitUntil: 'networkidle2' })
    const before = (await showsReport(page, words)) && (await looksSignedIn(page))
    const net = await holdSessionChecks(page)
    await pause(1500)                      // let the page's own first requests finish
    net.hold()
    await refocus(page)
    await net.held()
    await page.evaluate(async () => {
      const find = () => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sign out')
      if (!find()) {
        [...document.querySelectorAll('header button')].find((b) => b.textContent.includes('account menu'))?.click()
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
      find()?.click()
    })
    await pause(1500)
    // From here on, any moment at which the tab looks signed in again counts
    // — even one corrected a tenth of a second later. "Fine by the end" is not
    // enough when the wrong account flashed up on the screen.
    await page.evaluate(() => {
      window.__signedInAgain = false
      new window.MutationObserver(() => {
        if (document.body.innerText.includes('My Dashboard')) window.__signedInAgain = true
      }).observe(document.body, { childList: true, subtree: true, characterData: true })
    })
    await net.release()                    // the stale "signed in" arrives after Sign out
    await pause(1500)
    const now = await text(page)
    const flashed = await page.evaluate(() => window.__signedInAgain)
    const signedInAgain = flashed || (await looksSignedIn(page)) || words.some((word) => now.includes(word))
    check('RACE-3', 'Sign out here while a check is in flight: the stale answer never signs the tab back in, even briefly',
      before && !signedInAgain, !before ? 'was not signed in to begin with' : signedInAgain ? 'the tab showed the account again' : `at ${new URL(page.url()).pathname}, signed out throughout`)
    await net.stop()
    await context.close()
  }
  {
    // RACE-4: a burst of checks collapses to one extra.
    const { context, page } = await newDevice({ noPoll: true })
    await signIn(page, 'maria.santos@example.com')
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle2' })
    const net = await holdSessionChecks(page)
    await pause(500)
    const before = net.count()
    net.hold()
    await refocus(page)
    await net.held()
    for (let i = 0; i < 10; i++) await refocus(page)
    await net.release()
    await pause(1500)
    const made = net.count() - before
    check('RACE-4', 'Ten focus events during one check: one held plus one trailing check, no storm',
      made >= 2 && made <= 3, `${made} checks`)
    check('RACE-4b', '...and the tab is still signed in (nothing changed on the server)',
      await looksSignedIn(page))
    await net.stop()
    await context.close()
  }

  // ========================================================== MSG
  console.log('\nMSG. What the page says when the session ends')
  {
    const { context, page } = await newDevice()
    await signIn(page, 'maria.santos@example.com')
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle2' })
    await page.evaluate(async () => {
      const find = () => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sign out')
      if (!find()) {
        [...document.querySelectorAll('header button')].find((b) => b.textContent.includes('account menu'))?.click()
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
      find()?.click()
    })
    await within(page, 3000, async (p) => Boolean(await notice(p)))
    const said = await notice(page)
    check('MSG-01', 'Manual sign-out: "You have been signed out."', said?.text?.startsWith('You have been signed out.') ?? false,
      said?.text?.split('\n')[0])
    check('MSG-SR', 'Announced (role="alert") with a keyboard-reachable Dismiss button',
      said?.role === 'alert' && said?.dismiss === true)
    await context.close()
  }

  /** Sign in on one device, let `end` happen, refocus, read the notice. */
  async function endedBy(email, end, { password = PASSWORD, route = '/dashboard', afterMs = 0 } = {}) {
    const { context, page } = await newDevice()
    await signIn(page, email, password)
    await page.goto(BASE + route, { waitUntil: 'networkidle2' })
    if (afterMs) await pause(afterMs)
    await end()
    await refocus(page)
    await within(page, 4000, async (p) => Boolean((await notice(p))?.reason))
    const said = await notice(page)
    const where = new URL(page.url()).pathname
    await context.close()
    return { said, where }
  }

  writeConfig({ SESSION_IDLE_TIMEOUT: 2, SESSION_ABSOLUTE_TIMEOUT: 3600 })
  {
    const { said, where } = await endedBy('liza.ocampo@example.com', async () => pause(3500))
    check('MSG-02', 'Idle: "Your session expired due to inactivity. Please sign in again."',
      said?.text?.startsWith('Your session expired due to inactivity. Please sign in again.') ?? false,
      `${said?.reason} at ${where}`)
  }
  writeConfig({ SESSION_IDLE_TIMEOUT: 3600, SESSION_ABSOLUTE_TIMEOUT: 2 })
  {
    const { said, where } = await endedBy('liza.ocampo@example.com', async () => pause(3000))
    check('MSG-03', 'Time limit: "Your session has ended. Please sign in again."',
      said?.text?.startsWith('Your session has ended. Please sign in again.') ?? false, `${said?.reason} at ${where}`)
  }
  writeConfig()
  {
    const { said } = await endedBy('rafael.mendoza@example.com', async () => {
      const other = await newDevice()
      await signIn(other.page, 'rafael.mendoza@example.com')
      await other.context.close()
    }, { route: '/staff' })
    check('MSG-04', 'Coordinator signed in elsewhere: "...signed in on another device."',
      said?.text?.startsWith('Your session ended because this account was signed in on another device.') ?? false,
      said?.reason)
  }
  {
    const { said } = await endedBy('noel.aguilar@example.com', async () => {
      const other = await newDevice()
      await other.page.goto(BASE + '/', { waitUntil: 'networkidle2' })
      const started = Date.now()
      await apiWrite(other.page, 'POST', '/auth/forgot-password', { email: 'noel.aguilar@example.com' })
      const mail = (fs.existsSync(CAPTURE_DIR) ? fs.readdirSync(CAPTURE_DIR) : []).map((f) => path.join(CAPTURE_DIR, f))
        .filter((f) => fs.statSync(f).mtimeMs >= started - 1000).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
      const token = mail ? /token=([0-9a-f]+)/.exec(JSON.parse(fs.readFileSync(mail, 'utf8')).text)?.[1] : null
      await apiWrite(other.page, 'POST', '/auth/reset-password', { token, password: NEW_PASSWORD })
      await other.context.close()
    })
    check('MSG-05', 'Password changed: "...because the account password was changed."',
      said?.text?.startsWith('Your session ended because the account password was changed.') ?? false, said?.reason)
  }

  const admin = await newDevice()
  await signIn(admin.page, 'grace.bautista@example.com')
  {
    const { said } = await endedBy('jomar.delacruz@example.com', async () => {
      await apiWrite(admin.page, 'PATCH', `/users/${uid('jomar.delacruz@example.com')}`,
        { account_status: 'suspended', reason: 'Session UI suite.' })
    })
    check('MSG-06', 'Suspended: "Your account has been suspended." with the contact',
      (said?.text?.startsWith('Your account has been suspended.') && said?.text?.includes('@')) ?? false, said?.reason)
    await apiWrite(admin.page, 'PATCH', `/users/${uid('jomar.delacruz@example.com')}`, { account_status: 'active' })
  }
  {
    const { said } = await endedBy('kenneth.villanueva@example.com', async () => {
      const other = await newDevice()
      await other.page.goto(BASE + '/', { waitUntil: 'networkidle2' })
      for (let i = 0; i < 3; i++) {
        await apiWrite(other.page, 'POST', '/auth/login', { email: 'kenneth.villanueva@example.com', password: 'not the password at all' })
      }
      await other.context.close()
    })
    check('MSG-07', 'Locked: "Your account is locked." with the contact',
      (said?.text?.startsWith('Your account is locked.') && said?.text?.includes('@')) ?? false, said?.reason)
    await apiWrite(admin.page, 'PATCH', `/users/${uid('kenneth.villanueva@example.com')}`, { account_status: 'active' })
  }

  // ========================================================== PV
  console.log('\nPV. Page views')
  {
    const { context, page } = await newDevice()
    const sent = []
    page.on('request', (request) => {
      if (request.url().endsWith('/api/activity/page-view')) sent.push(JSON.parse(request.postData() ?? '{}').path)
    })
    await signIn(page, 'maria.santos@example.com')
    const record = newestSession('maria.santos@example.com')
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle2' })
    await pause(800)
    check('PV-01', 'Opening a page signed in records it once', pageViews(record, '/dashboard') === 1,
      `${pageViews(record, '/dashboard')} row(s)`)
    await page.evaluate(() => document.querySelector('a[href="/dashboard/reports"]')?.click())
    await pause(1200)
    check('PV-02', 'Following a link in the app records the new page', pageViews(record, '/dashboard/reports') === 1)
    const before = pageViews(record)
    for (let i = 0; i < 3; i++) await refocus(page)
    await page.setViewport({ width: 900, height: 900 })
    await page.setViewport({ width: 1280, height: 900 })
    await pause(11_000)                    // past one ten-second re-check, which re-renders with a new user object
    check('PV-03', 'Re-renders, refocusing and the ten-second re-check add no page view', pageViews(record) === before,
      `${pageViews(record) - before} extra`)
    await goInApp(page, '/explore?q=milo#results')
    await pause(1200)
    const stored = sql(`SELECT GROUP_CONCAT(route) FROM user_activity_logs WHERE session_record_id = ${record} AND route LIKE '/explore%'`)
    check('PV-04', 'A query string and #fragment are never sent or stored: "/explore" only',
      stored === '/explore' && sent.every((p) => !/[?#]/.test(p)), stored)
    await goInApp(page, '/reset-password?token=' + 'c'.repeat(64))
    await pause(1200)
    check('PV-05', 'A reset link opened while signed in sends no page view at all',
      !sent.some((p) => p.startsWith('/reset-password')) && sql("SELECT COUNT(*) FROM user_activity_logs WHERE route LIKE '%reset%'") === '0')
    await context.close()

    const guest = await newDevice()
    const guestSent = []
    guest.page.on('request', (request) => {
      if (request.url().includes('/api/activity')) guestSent.push(request.url())
    })
    const total = Number(sql('SELECT COUNT(*) FROM user_activity_logs'))
    for (const route of ['/', '/explore', REPORT, '/about']) {
      await guest.page.goto(BASE + route, { waitUntil: 'networkidle2' })
    }
    check('PV-06', 'A guest browsing four pages sends nothing and nothing is stored',
      guestSent.length === 0 && Number(sql('SELECT COUNT(*) FROM user_activity_logs')) === total, `${guestSent.length} sent`)
    await guest.context.close()
  }

  // ========================================================== LOGUI
  console.log('\nLOGUI. The Logs page')
  {
    const { page } = admin
    await page.goto(BASE + '/admin/logs', { waitUntil: 'networkidle2' })
    await pause(800)
    const activity = await text(page)
    check('LOGUI-1', 'Administration has Logs; the activity tab lists sign-ins with IP and session',
      activity.includes('Signed in') && /::1|127\.0\.0\.1/.test(activity) && /[0-9a-f]{8}…/.test(activity))
    await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.includes('Sessions'))?.click())
    await pause(1200)
    const sessions = await text(page)
    check('LOGUI-2', 'Sessions tab: browser, start, and why each ended',
      sessions.includes('Password changed') && sessions.includes('Account suspended') && sessions.includes('Signed in on another device'))
    await page.goto(BASE + '/admin/logs?tab=security&outcome=failure', { waitUntil: 'networkidle2' })
    await pause(800)
    const events = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].map((r) => r.innerText))
    check('LOGUI-3', 'Security events, failures only: the failed sign-ins, and nothing that succeeded',
      events.length > 0 && events.some((row) => row.includes('Failed sign-in')) && events.every((row) => row.includes('Failed')),
      `${events.length} rows`)
    await page.goto(BASE + '/admin/logs?tab=activity&user=kenneth', { waitUntil: 'networkidle2' })
    await pause(800)
    const people = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].map((r) => r.innerText))
    check('LOGUI-4', 'A filter in the address narrows the table to that person',
      people.length > 0 && people.every((row) => row.includes('Kenneth')), `${people.length} rows`)
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(BASE + '/admin/logs', { waitUntil: 'networkidle2' })
    await pause(800)
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    check('LOGUI-5', 'At 390 px the page itself does not scroll sideways (the table scrolls in its box)', fits)

    const coordinator = await newDevice()
    await signIn(coordinator.page, 'patricia.lim@example.com')
    await coordinator.page.goto(BASE + '/admin/logs', { waitUntil: 'networkidle2' })
    await pause(800)
    check('LOGUI-6', 'A Pet Coordinator opening /admin/logs is turned away',
      new URL(coordinator.page.url()).pathname !== '/admin/logs', new URL(coordinator.page.url()).pathname)
    await coordinator.context.close()
  }
  await admin.context.close()
} finally {
  // The configuration first: whatever else fails on the way out, the server
  // must not be left with the session clocks turned down.
  if (previousConfig === null) fs.rmSync(LOCAL_CONFIG, { force: true })
  else fs.writeFileSync(LOCAL_CONFIG, previousConfig)
  fs.rmSync(CAPTURE_DIR, { recursive: true, force: true })
  await browser.close().catch(() => {})
  execFileSync(MYSQL, ['-uroot', '-h127.0.0.1', '-P3307', '--default-character-set=utf8mb4', 'pawsandfound'],
    { input: fs.readFileSync(path.join(ROOT, 'database', 'seed.sql')) })
}

const failed = results.filter((result) => !result.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
