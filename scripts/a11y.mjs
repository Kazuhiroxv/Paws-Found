// Accessibility audit — runs axe-core over every page, in each role.
//
//   node scripts/a11y.mjs
//
// Needs the built site deployed and Chrome installed. Set PAWS_BASE to point
// somewhere other than the local XAMPP deployment, and CHROME if Chrome is not
// in the usual place.
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

for (const [who, route, label] of PAGES) {
  if (who !== 'guest') await signIn(who)
  await page.goto(BASE + route, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1400))

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
