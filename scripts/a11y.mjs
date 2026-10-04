// Accessibility audit — runs axe-core over every page, in each role.
//
//   node scripts/a11y.mjs
//
// Needs the built site deployed and Chrome installed. Set PAWS_BASE to point
// somewhere other than the local XAMPP deployment, and CHROME if Chrome is not
// in the usual place.
// The page.evaluate() callbacks below run inside the page, where this exists.
/* global document */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.PAWS_BASE ?? 'http://localhost/pawsandfound'
const API = BASE + '/api'
const CHROME = process.env.CHROME
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
const MYSQL = process.env.PAWS_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'
const sql = (query) =>
  execFileSync(MYSQL, ['-uroot', '-h127.0.0.1', '-P3307', '--default-character-set=utf8mb4', '-N', '-B', 'pawsandfound', '-e', query])

// Administrator levels (Correction 6). The seed has one administrator, a
// Super Administrator, so a Moderator and a Manager are made for this run
// from two seeded accounts and put back at the end.
const MODERATOR = 'rafael.mendoza@example.com'
const MANAGER = 'kenneth.villanueva@example.com'
sql(`UPDATE users SET role = 'admin', admin_level = 'moderator' WHERE email = '${MODERATOR}';
     UPDATE users SET role = 'admin', admin_level = 'manager' WHERE email = '${MANAGER}'`)

/** Open the role dialog for the Manager and choose Administrator, so the level choice is on screen. */
async function openRoleDialog(page) {
  await page.evaluate((who) => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(who))
    ;[...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.includes('Change role'))?.click()
  }, 'Kenneth')
  await new Promise((r) => setTimeout(r, 500))
  await page.evaluate(() => {
    ;[...document.querySelectorAll('input[type=radio]')].find((r) => r.value === 'admin')?.click()
  })
  await new Promise((r) => setTimeout(r, 400))
}

const PAGES = [
  ['guest', '/', 'Homepage'],
  ['guest', '/explore', 'Explore — list'],
  ['guest', '/explore?species=dog&type=lost', 'Explore — filtered + paged'],
  ['guest', '/pet/1', 'Report detail — guest gate'],
  ['guest', '/about', 'About'],
  ['guest', '/help', 'Help'],
  ['guest', '/privacy', 'Privacy Notice'],
  ['guest', '/login', 'Sign in'],
  ['guest', '/register', 'Register'],
  // The account-lifecycle pages. Reached from an email rather than the
  // navigation, which is exactly why they are easy to forget to check.
  ['guest', '/forgot-password', 'Forgot password'],
  ['guest', '/reset-password?token=' + 'a'.repeat(64), 'Reset password'],
  ['guest', '/verify-email', 'Verify email — no token'],
  ['guest', '/no-such-page', 'Not found'],
  ['maria.santos@example.com', '/report/lost', 'Report a lost pet'],
  ['maria.santos@example.com', '/report/found', 'Report a found pet'],
  ['maria.santos@example.com', '/dashboard', 'Customer dashboard'],
  ['maria.santos@example.com', '/dashboard/reports', 'My reports'],
  ['maria.santos@example.com', '/dashboard/matches', 'My possible matches'],
  ['maria.santos@example.com', '/dashboard/notifications', 'Notifications'],
  ['maria.santos@example.com', '/dashboard/profile', 'Profile'],
  ['maria.santos@example.com', '/pet/1', 'Report detail — owner'],
  ['noel.aguilar@example.com', '/pet/1', 'Report detail — another member'],
  ['patricia.lim@example.com', '/staff', 'Staff overview'],
  ['patricia.lim@example.com', '/staff/review', 'Report review'],
  ['patricia.lim@example.com', '/pet/9', 'Report detail — removed, as a coordinator'],
  ['grace.bautista@example.com', '/pet/9', 'Report detail — removed, as an administrator'],
  ['patricia.lim@example.com', '/staff/reports', 'Report queue'],
  ['patricia.lim@example.com', '/staff/matches', 'Match queue'],
  ['patricia.lim@example.com', '/staff/verification', 'Verification'],
  ['grace.bautista@example.com', '/admin', 'Admin overview'],
  ['grace.bautista@example.com', '/admin/users', 'Accounts'],
  ['grace.bautista@example.com', '/admin/reports', 'Records'],
  ['grace.bautista@example.com', '/admin/categories', 'Pet categories'],
  ['grace.bautista@example.com', '/admin/moderation', 'Moderation'],
  ['grace.bautista@example.com', '/admin/logs', 'Logs'],
  ['grace.bautista@example.com', '/admin/logs?tab=sessions', 'Logs: sessions'],
  // Correction 6: what each administrator level sees.
  [MODERATOR, '/admin', 'Admin overview — Moderator'],
  [MODERATOR, '/admin/logs', 'No access — Moderator on Logs'],
  [MANAGER, '/admin/users', 'Accounts — Manager'],
  ['grace.bautista@example.com', '/admin/users', 'Accounts — role and level dialog', openRoleDialog],
  // Correction 7: the Disclaimer, and Filipino versions of representative
  // pages — public, customer (with the Privacy Notice update message and the
  // report wizard), coordinator and administrator, with the language control
  // showing "Filipino" in each. The fifth column is the language.
  ['guest', '/disclaimer', 'Disclaimer'],
  ['guest', '/disclaimer', 'Disclaimer — Filipino', null, 'fil'],
  ['guest', '/', 'Homepage — Filipino', null, 'fil'],
  ['guest', '/explore?type=lost', 'Explore — Filipino, print control', null, 'fil'],
  ['maria.santos@example.com', '/dashboard', 'Customer dashboard — Filipino, privacy update', null, 'fil'],
  ['maria.santos@example.com', '/report/lost', 'Report a lost pet — Filipino', null, 'fil'],
  ['patricia.lim@example.com', '/staff/review', 'Report review — Filipino', null, 'fil'],
  ['grace.bautista@example.com', '/admin/users', 'Accounts — Filipino', null, 'fil'],
  ['grace.bautista@example.com', '/admin/logs', 'Logs — Filipino', null, 'fil'],
  [MODERATOR, '/admin/logs', 'No access — Filipino', null, 'fil'],
]

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 1440, height: 950 },
})
const page = await browser.newPage()
let signedInAs = null

async function signIn(email) {
  if (signedInAs === email) return
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  // The API refuses any POST without the session's CSRF token, which /auth/me
  // hands out. Without it this sign-in answered 403, every signed-in page
  // redirected to /login, and the suite audited the sign-in form sixteen times
  // while reporting sixteen workspaces clean.
  const status = await page.evaluate(async (api, e) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    const response = await fetch(api + '/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
      body: JSON.stringify({ email: e, password: 'demo1234' }),
    })
    return response.status
  }, API, email)
  if (status !== 200) throw new Error(`Could not sign in as ${email}: HTTP ${status}`)
  signedInAs = email
}

const all = new Map()   // rule id -> { impact, help, count, pages:Set, sample }

console.log('page'.padEnd(34) + 'critical  serious  moderate    minor')
console.log('-'.repeat(74))

async function signOut() {
  if (signedInAs === null) return
  await page.evaluate(async (api) => {
    const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
    await fetch(api + '/auth/logout', { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': me.csrf_token ?? '' } })
  }, API)
  signedInAs = null
}

for (const [who, route, label, prepare, language = 'en'] of PAGES) {
  if (who !== 'guest') await signIn(who)
  else await signOut()
  await page.goto(BASE + route, { waitUntil: 'networkidle2' })
  // The language is this browser's own setting (Correction 7): set it, and
  // load the page again in it when it was showing the other one.
  const showing = await page.evaluate((l) => {
    const before = document.documentElement.lang
    localStorage.setItem('paws:language', l)
    return before
  }, language)
  if (showing !== language) await page.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1400))
  if (prepare) await prepare(page)

  // A signed-in page that bounced to /login is not the page this row names.
  if (who !== 'guest' && new URL(page.url()).pathname.endsWith('/login')) {
    throw new Error(`${label}: redirected to sign-in, so it was not audited`)
  }

  await page.evaluate(AXE)
  // This callback runs inside the page, where window and document exist.
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await window.axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    })
    return r.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.html?.slice(0, 110) ?? '',
      target: v.nodes[0]?.target?.[0] ?? '',
    }))
  })

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  for (const v of result) {
    counts[v.impact] = (counts[v.impact] ?? 0) + v.nodes
    const entry = all.get(v.id) ?? { impact: v.impact, help: v.help, count: 0, pages: new Set(), sample: v.sample, target: v.target }
    entry.count += v.nodes
    entry.pages.add(label)
    all.set(v.id, entry)
  }

  const flag = Object.values(counts).some(Boolean) ? '' : '  clean'
  console.log(
    label.padEnd(34) +
    String(counts.critical).padStart(8) + String(counts.serious).padStart(9) +
    String(counts.moderate).padStart(10) + String(counts.minor).padStart(9) + flag
  )
}

await browser.close()
sql(`UPDATE users SET role = 'staff', admin_level = NULL WHERE email = '${MODERATOR}';
     UPDATE users SET role = 'user', admin_level = NULL WHERE email = '${MANAGER}'`)

console.log('')
console.log('='.repeat(74))
if (all.size === 0) {
  console.log('No violations found by axe-core across any page.')
} else {
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 }
  const sorted = [...all.entries()].sort((a, b) => order[a[1].impact] - order[b[1].impact])
  console.log(`${all.size} distinct rule(s) violated:`)
  console.log('')
  for (const [id, v] of sorted) {
    console.log(`  [${v.impact.toUpperCase()}] ${id} — ${v.help}`)
    console.log(`     ${v.count} element(s) across ${v.pages.size} page(s): ${[...v.pages].slice(0, 5).join(', ')}`)
    console.log(`     first: ${v.target}`)
    console.log(`            ${v.sample}`)
    console.log('')
  }
}
