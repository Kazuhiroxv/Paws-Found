/**
 * Correction 6, in a real browser: what each administrator level sees and
 * can do.
 *
 *   PAWS_BASE=http://localhost:5173 PAWS_PW=<seeded password> npm run test:admin-levels-ui
 *
 *   MOD   a Moderator: Overview, Reports, Moderation — and nothing else, not
 *         even by typing the address; moderation works; no suspend
 *   MAN   a Manager: Users and Pet Categories as well, no Logs; suspends
 *         (with a reason) and reinstates a customer; administrators' rows are
 *         not theirs to touch; no role controls anywhere
 *   SUP   a Super Administrator: Logs; promotes a customer to Administrator
 *         only once a level is chosen; changes a level; the person on the
 *         other end is told why their session ended
 *
 * The seed has one administrator (a Super Administrator); the Moderator and
 * the Manager are made by SQL for this run. Reseeds at the start and the end.
 */
// The functions passed to page.evaluate run in the browser, not in Node.
/* global document, window, HTMLTextAreaElement */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
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

const SUPER = 'grace.bautista@example.com'
const MODERATOR = 'rafael.mendoza@example.com'
const MANAGER = 'kenneth.villanueva@example.com'
const CUSTOMER = 'liza.ocampo@example.com'
const PROMOTED = 'aileen.reyes@example.com'
const DENIED = "You don't have permission to access this page."

const results = []
const check = (id, description, ok, detail = '') => {
  results.push({ id, description, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(9)} ${description}${detail ? `  (${detail})` : ''}`)
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const mysql = (args, input) =>
  execFileSync(MYSQL, ['-uroot', '-h127.0.0.1', '-P3307', '--default-character-set=utf8mb4', ...args], input ? { input } : {})
const sql = (query) => mysql(['-N', '-B', 'pawsandfound', '-e', query]).toString().trim()
const reseed = () => mysql(['pawsandfound'], fs.readFileSync(path.join(ROOT, 'database', 'seed.sql')))
const roleOf = (email) =>
  sql(`SELECT CONCAT(role, '/', IFNULL(admin_level, '-'), '/', account_status) FROM users WHERE email = '${email}'`)

reseed()
sql(`UPDATE users SET role = 'admin', admin_level = 'moderator' WHERE email = '${MODERATOR}';
     UPDATE users SET role = 'admin', admin_level = 'manager' WHERE email = '${MANAGER}'`)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })

// ------------------------------------------------------------------ helpers
const text = (page) => page.evaluate(() => document.body.innerText)
const navLinks = (page) => page.evaluate(() =>
  [...document.querySelectorAll('nav a')].map((a) => a.textContent.replace(/\d+\s*items?$/, '').trim()))
const clickText = (page, wanted, scope = 'button') => page.evaluate((t, s) => {
  const el = [...document.querySelectorAll(s)].find((b) => b.textContent.trim().startsWith(t) && b.getClientRects().length)
  el?.click()
  return Boolean(el)
}, wanted, scope)
/** The buttons in the table row (desktop) that names this person. */
const rowButtons = (page, who) => page.evaluate((w) => {
  const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(w))
  return row ? [...row.querySelectorAll('button')].map((b) => b.textContent.trim()) : null
}, who)
const clickInRow = (page, who, label) => page.evaluate((w, l) => {
  const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(w))
  const button = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim().startsWith(l))
  button?.click()
  return Boolean(button)
}, who, label)
const dialogButton = (page, label) => page.evaluate((l) => {
  const button = [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.trim().startsWith(l))
  return button ? { found: true, disabled: button.disabled } : { found: false }
}, label)

async function signedIn(email) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1366, height: 900 })
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
  return { context, page }
}
async function open(page, route) {
  await page.goto(BASE + route, { waitUntil: 'networkidle2' })
  await pause(900)
}

try {
  // ============================================================ REV
  // Correction 6A, and the demonstration sequence for the defense: a customer
  // submits; every administrator level opens the pending report and finds no
  // way to publish it; the Pet Coordinator approves it.
  console.log('\nREV. Only the Pet Coordinator publishes (Correction 6A)')
  {
    const customer = await signedIn(CUSTOMER)
    const pending = await customer.page.evaluate(async (api) => {
      const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
      const response = await fetch(api + '/reports', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
        body: JSON.stringify({
          report_type: 'lost', species: 'dog', pet_name: 'Demo Review Dog', breed: 'Aspin (Philippine Native Dog)',
          size: 'medium', sex: 'male', primary_color: 'Brown', distinct_features: 'A white tip on the tail',
          incident_date: '2026-10-01', area_code: '1300000000', city_code: '1381100000',
          allow_platform_contact: true, has_collar: 'unknown', location_label: 'Near the barangay hall',
          description: 'Filed for the defense demonstration of the coordinator review step.',
        }),
      })
      return (await response.json()).data?.report_id
    }, API)
    await customer.context.close()
    const reviewControls = (page) => page.evaluate(() =>
      [...document.querySelectorAll('button')].map((b) => b.textContent.trim())
        .filter((t) => t.startsWith('Approve and publish') || t.startsWith('Not approved')))

    for (const [id, email, label] of [['REV-UI-1', MODERATOR, 'Moderator'], ['REV-UI-2', MANAGER, 'Manager'],
      ['REV-UI-3', SUPER, 'Super Administrator']]) {
      const { context, page } = await signedIn(email)
      await open(page, `/pet/${pending}`)
      const controls = await reviewControls(page)
      const says = (await text(page)).includes('Only a Pet Coordinator can approve it or not')
      check(id, `${label} opens the pending report: no Approve / Not approved, and it says who decides`,
        controls.length === 0 && says, controls.join(', ') || 'no controls')
      await context.close()
    }
    check('REV-UI-4', 'After every administrator has inspected it, it is still pending',
      sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${pending}`) === 'pending_review')

    const coordinator = await signedIn('patricia.lim@example.com')
    await open(coordinator.page, `/pet/${pending}`)
    const controls = await reviewControls(coordinator.page)
    check('REV-UI-5', 'The Pet Coordinator sees Approve and publish, and Not approved…',
      controls.length === 2, controls.join(', '))
    await clickText(coordinator.page, 'Approve and publish')
    await pause(2000)
    check('REV-UI-6', 'The Pet Coordinator approves: published, with the coordinator as reviewer',
      sql(`SELECT CONCAT(r.publication_status, '/', u.role) FROM pet_reports r JOIN publication_logs p
             ON p.report_id = r.report_id AND p.new_state = 'published' JOIN users u ON u.user_id = p.actor_user_id
            WHERE r.report_id = ${pending}`) === 'published/staff')
    await coordinator.context.close()
  }

  // ============================================================ MOD
  console.log('\nMOD. A Moderator')
  {
    const { context, page } = await signedIn(MODERATOR)
    await open(page, '/admin')
    const links = await navLinks(page)
    check('MOD-UI-1', 'Navigation: Overview, Reports, Moderation — nothing else',
      JSON.stringify(links) === JSON.stringify(['Overview', 'Reports', 'Moderation']), links.join(', '))
    const overview = await text(page)
    // The figures' own labels — the page's subtitle also says "Accounts".
    const tiles = await page.evaluate(() =>
      [...document.querySelectorAll('main *')].filter((el) => el.children.length === 0)
        .map((el) => el.textContent.trim()).filter((s) => s === 'Accounts' || s === 'Pet categories'))
    check('MOD-UI-2', 'The Overview has no Accounts or Pet categories figures, no Suspended accounts',
      !overview.includes('Suspended accounts') && tiles.length === 0, tiles.join(', '))
    check('MOD-UI-3', 'The rail says which administrator this is', overview.includes('Administrator — Moderator'))
    for (const [id, route, label] of [['MOD-UI-4', '/admin/users', 'Users'], ['MOD-UI-5', '/admin/logs', 'Logs'],
      ['MOD-UI-6', '/admin/categories', 'Pet Categories']]) {
      await open(page, route)
      const now = await text(page)
      check(id, `Typing ${route}: "${DENIED}", and none of ${label} on the page`,
        now.includes(DENIED) && !now.includes('@example.com') && !now.includes('Sessions'), new URL(page.url()).pathname)
    }
    const links2 = await page.evaluate(() =>
      [...document.querySelectorAll('a[href$="/admin/users"], a[href$="/admin/logs"], a[href$="/admin/categories"]')].length)
    check('MOD-UI-7', 'No link to those pages anywhere, so the keyboard cannot reach one', links2 === 0, `${links2} links`)
    await open(page, '/admin/moderation')
    const queue = await text(page)
    check('MOD-UI-8', 'Moderation: "Remove the report" is offered, "…and suspend account" is not',
      queue.includes('Remove the report') && !queue.includes('Remove report and suspend account'))
    const dismissed = await clickText(page, 'Dismiss flag')
    await pause(1800)
    check('MOD-UI-9', 'A moderation decision works: the flag is dismissed', dismissed
      && (await text(page)).includes('Flag dismissed') && sql("SELECT COUNT(*) FROM moderation_cases WHERE case_status = 'open'") === '0')
    await context.close()
  }

  // ============================================================ MAN
  console.log('\nMAN. A Manager')
  {
    const { context, page } = await signedIn(MANAGER)
    await open(page, '/admin')
    const links = await navLinks(page)
    check('MAN-UI-1', 'Navigation adds Users and Pet Categories; no Logs',
      links.includes('Users') && links.includes('Pet Categories') && !links.includes('Logs'), links.join(', '))
    await open(page, '/admin/logs')
    check('MAN-UI-2', 'Typing /admin/logs: permission denied', (await text(page)).includes(DENIED))
    await open(page, '/admin/users')
    const all = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()))
    check('MAN-UI-3', 'Users: no "Change role" anywhere', !all.some((t) => t.startsWith('Change role')))
    const graceRow = await rowButtons(page, 'Grace')
    const rafaelRow = await page.evaluate(() =>
      [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Rafael'))?.textContent ?? '')
    check('MAN-UI-4', "Administrators' rows: no buttons, \"Managed by a Super Administrator\"",
      graceRow?.length === 0 && rafaelRow.includes('Managed by a Super Administrator') && rafaelRow.includes('Moderator'))
    await clickInRow(page, 'Liza', 'Suspend')
    await pause(500)
    const before = await dialogButton(page, 'Suspend account')
    await page.evaluate((reason) => {
      const box = document.querySelector('dialog[open] textarea')
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, reason)
      box.dispatchEvent(new Event('input', { bubbles: true }))
    }, 'Repeated fake listings, reported twice.')
    await pause(200)
    const after = await dialogButton(page, 'Suspend account')
    check('MAN-UI-5', 'Suspending asks for a reason: the button waits for one', before.found && before.disabled && !after.disabled)
    await page.evaluate(() =>
      [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.trim().startsWith('Suspend account'))?.click())
    await pause(1800)
    check('MAN-UI-6', 'The customer is suspended, with the reason in the audit log',
      roleOf(CUSTOMER) === 'user/-/suspended'
        && sql("SELECT detail FROM audit_logs WHERE action = 'account_suspended' ORDER BY audit_id DESC LIMIT 1").includes('fake listings'))
    await clickInRow(page, 'Liza', 'Reinstate')
    await pause(500)
    await page.evaluate(() =>
      [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.trim().startsWith('Reinstate account'))?.click())
    await pause(1800)
    check('MAN-UI-7', 'And reinstated', roleOf(CUSTOMER) === 'user/-/active', roleOf(CUSTOMER))
    await open(page, '/admin/categories')
    check('MAN-UI-8', 'Pet Categories opens for a Manager', !(await text(page)).includes(DENIED))
    await context.close()
  }

  // ============================================================ SUP
  console.log('\nSUP. A Super Administrator')
  {
    const target = await signedIn(PROMOTED)
    await open(target.page, '/dashboard')

    const { context, page } = await signedIn(SUPER)
    await open(page, '/admin')
    const links = await navLinks(page)
    check('SUP-UI-1', 'Navigation has every section, Logs included',
      ['Users', 'Reports', 'Pet Categories', 'Moderation', 'Logs'].every((l) => links.includes(l)), links.join(', '))
    check('SUP-UI-2', 'The rail says "Super Administrator"', (await text(page)).includes('Super Administrator'))
    await open(page, '/admin/logs')
    check('SUP-UI-3', 'Logs open and list activity', !(await text(page)).includes(DENIED)
      && (await page.evaluate(() => document.querySelectorAll('tbody tr').length)) > 0)

    await open(page, '/admin/users')
    check('SUP-UI-4', 'Their own row offers nothing ("This is your account")',
      (await rowButtons(page, 'Grace'))?.length === 0)
    await clickInRow(page, 'Aileen', 'Change role')
    await pause(500)
    await page.evaluate(() => [...document.querySelectorAll('dialog[open] input[type=radio]')].find((r) => r.value === 'admin')?.click())
    await pause(300)
    const noLevel = await page.evaluate(() => {
      const confirm = [...document.querySelectorAll('dialog[open] button')].find((b) => /^(Make|Change role)/.test(b.textContent.trim()))
      return { disabled: confirm?.disabled, levels: document.querySelectorAll('dialog[open] input[name^=level]').length }
    })
    check('SUP-UI-5', 'Choosing Administrator shows three levels and waits for one to be chosen',
      noLevel.levels === 3 && noLevel.disabled === true, JSON.stringify(noLevel))
    await page.evaluate(() => [...document.querySelectorAll('dialog[open] input[type=radio]')].find((r) => r.value === 'moderator')?.click())
    await pause(300)
    const ready = await dialogButton(page, 'Make Administrator — Moderator')
    check('SUP-UI-6', 'With Moderator chosen: "Make Administrator — Moderator", enabled', ready.found && !ready.disabled)
    await clickText(page, 'Make Administrator — Moderator', 'dialog[open] button')
    await pause(1800)
    check('SUP-UI-7', 'Aileen is an Administrator — Moderator', roleOf(PROMOTED) === 'admin/moderator/active', roleOf(PROMOTED))
    await target.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await pause(2000)
    const told = await target.page.evaluate(() => document.querySelector('[role=alert]')?.innerText ?? '')
    check('SUP-UI-8', 'Her open customer session ended, and it says why',
      told.includes('access level changed'), told.split('\n')[0])
    await target.context.close()

    const again = await signedIn(PROMOTED)
    await open(again.page, '/admin')
    await clickInRow(page, 'Aileen', 'Change role')
    await pause(500)
    await page.evaluate(() => [...document.querySelectorAll('dialog[open] input[type=radio]')].find((r) => r.value === 'manager')?.click())
    await pause(300)
    await clickText(page, 'Make Administrator — Manager', 'dialog[open] button')
    await pause(1800)
    check('SUP-UI-9', 'Changing her level to Manager', roleOf(PROMOTED) === 'admin/manager/active', roleOf(PROMOTED))
    await again.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await pause(2000)
    const told2 = await again.page.evaluate(() => document.querySelector('[role=alert]')?.innerText ?? '')
    check('SUP-UI-10', 'Her administrator session ended: "…administrator privileges changed"',
      told2.includes('administrator privileges changed'), told2.split('\n')[0])
    await again.context.close()
    await context.close()
  }
} finally {
  await browser.close().catch(() => {})
  reseed()
}

const failed = results.filter((result) => !result.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
