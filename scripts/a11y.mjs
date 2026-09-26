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
  ['guest', '/pet/1', 'Report detail'],
  ['guest', '/about', 'About'],
  ['guest', '/help', 'Help'],
  ['guest', '/privacy', 'Privacy Notice'],
  ['guest', '/login', 'Sign in'],
  ['guest', '/register', 'Register'],
  ['guest', '/no-such-page', 'Not found'],
  ['maria.santos@example.com', '/report/lost', 'Report a lost pet'],
  ['maria.santos@example.com', '/report/found', 'Report a found pet'],
  ['maria.santos@example.com', '/dashboard', 'Customer dashboard'],
  ['maria.santos@example.com', '/dashboard/reports', 'My reports'],
  ['maria.santos@example.com', '/dashboard/matches', 'My possible matches'],
  ['maria.santos@example.com', '/dashboard/notifications', 'Notifications'],
  ['maria.santos@example.com', '/dashboard/profile', 'Profile'],
  ['patricia.lim@example.com', '/staff', 'Staff overview'],
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
  await page.evaluate(async (api, e) => {
    await fetch(api + '/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, password: 'demo1234' }),
    })
  }, API, email)
  signedInAs = email
}

const all = new Map()   // rule id -> { impact, help, count, pages:Set, sample }

console.log('page'.padEnd(34) + 'critical  serious  moderate    minor')
console.log('-'.repeat(74))

for (const [who, route, label] of PAGES) {
  if (who !== 'guest') await signIn(who)
  await page.goto(BASE + route, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1400))

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
