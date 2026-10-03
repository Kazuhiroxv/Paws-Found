/**
 * Post-defense Correction 4, in a real browser: drafts, review before
 * publication, and removal.
 *
 *   PAWS_BASE=http://localhost:5173 PAWS_PW=<seeded password> npm run test:workflow-ui
 *
 *   DRAFT-UI   a report saved half-done, closed, and continued from My
 *              reports in a second browser (another device, same account);
 *              private to its author; nowhere public; never matched
 *   REVIEW-UI  Submit for review -> not public -> a Pet Coordinator approves
 *              from the review queue -> public, matched, reporter notified;
 *              then a rejection with a reason, an edit, and a resubmission
 *   SUBMIT-UI  "Submitted for review" is on screen and focused after Submit,
 *              at 820 px and on a phone
 *   RM-UI      an administrator removes a published report: gone from the
 *              public, under Removed (not Closed) for its reporter
 *
 * Changes data. Reseed afterwards.
 */
// The functions passed to page.evaluate run in the browser, not in Node.
/* global document, window, HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement */
import { execFileSync } from 'node:child_process'
import puppeteer, { KnownDevices } from 'puppeteer-core'

const BASE = process.env.PAWS_BASE ?? 'http://localhost:5173'
const API = BASE + '/api'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MYSQL = process.env.PAWS_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'
const PASSWORD = process.env.PAWS_PW
if (!PASSWORD) {
  console.error('Set PAWS_PW to the password of the seeded accounts (see README, "Signing in").')
  process.exit(2)
}

const results = []
const check = (id, description, ok, detail = '') => {
  results.push({ id, description, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(13)} ${description}${detail ? `  (${detail})` : ''}`)
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sql = (query) =>
  execFileSync(MYSQL, ['-uroot', '-h127.0.0.1', '-P3307', '--default-character-set=utf8mb4', '-N', '-B', 'pawsandfound', '-e', query])
    .toString().trim()

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })

// ------------------------------------------------------------------ helpers
async function fieldByLabel(page, label) {
  return page.evaluateHandle((text) => {
    const found = [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(text))
    return found ? (found.control ?? document.getElementById(found.htmlFor)) : null
  }, label)
}
async function setField(page, label, value) {
  const handle = await fieldByLabel(page, label)
  const ok = await page.evaluate((el, v) => {
    if (!el) return false
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    return true
  }, handle, value)
  if (!ok) throw new Error(`No field labelled "${label}"`)
}
const valueOf = async (page, label) => page.evaluate((el) => el?.value ?? null, await fieldByLabel(page, label))
const clickButton = (page, text) => page.evaluate((t) => {
  const button = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim() === t && b.getClientRects().length)
  button?.click()
  return Boolean(button)
}, text)
const text = (page) => page.evaluate(() => document.body.innerText)

async function signedInPage(email, { device } = {}) {
  // A context of its own: its own cookies, as a separate browser or device.
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  if (device) await page.emulate(device)
  else await page.setViewport({ width: 820, height: 1000 })
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
  return { page, context }
}
async function guestPage() {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  return { page, context }
}

/** Step one of the wizard, filled with a recognisable lost Shih Tzu. */
async function fillPet(page, name) {
  await setField(page, 'Pet name', name)
  await setField(page, 'Species', 'dog')
  await pause(800)
  await setField(page, 'Breed', 'Shih Tzu')
  await setField(page, 'Size', 'small')
  await setField(page, 'Sex', 'male')
  await setField(page, 'Main colour', 'Brown')
  await setField(page, 'Other colour', 'White')
}
/** Steps two to four, then Submit for review. */
async function finishAndSubmit(page) {
  await clickButton(page, 'Continue')
  await pause(900)
  await setField(page, 'Date last seen', '2026-09-29')
  await setField(page, 'Province or Metro Manila', '1300000000')
  await pause(900)
  await setField(page, 'City or municipality', '1380300000')
  await setField(page, 'Where your pet', 'Near the Poblacion market')
  await setField(page, 'Description', 'Small brown Shih Tzu with a white chest, shy with strangers but comes to his name.')
  await clickButton(page, 'Continue')
  await pause(900)
  await clickButton(page, 'Continue')
  await pause(600)
  await clickButton(page, 'Skip for now')
  await pause(700)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await clickButton(page, 'Submit for review')
  await pause(3000)
}
/** Whether the confirmation heading is on screen and holds focus. */
const confirmationShown = (page) => page.evaluate(() => {
  const heading = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === 'Submitted for review')
  if (!heading) return { found: false }
  const box = heading.getBoundingClientRect()
  return {
    found: true,
    onScreen: box.bottom > 0 && box.top < window.innerHeight,
    focused: Boolean(heading.closest('[tabindex="-1"]')?.contains(document.activeElement)),
    says: document.body.innerText.includes('A Pet Coordinator must approve it before it appears publicly.'),
    notLive: !/now public|now live/i.test(document.body.innerText),
  }
})
const createdId = () => Number(sql("SELECT MAX(report_id) FROM pet_reports;"))
/** Whether Explore shows a result card for this name — not merely the search term echoed back. */
const exploreLists = (page, name) => page.evaluate((n) =>
  [...document.querySelectorAll('a[href^="/pet/"]')].some((a) => a.textContent.includes(n)), name)

// ===================================================== DRAFT-UI
const NAME = 'Draftmilo'
let draftId
{
  const { page, context } = await signedInPage('maria.santos@example.com')
  await page.goto(BASE + '/report/lost', { waitUntil: 'networkidle2' })
  check('DRAFT-UI-1', 'A report is started', Boolean(await fieldByLabel(page, 'Pet name')))
  await fillPet(page, NAME)
  check('DRAFT-UI-2', 'It is partly filled in — step one only, nothing about where or when', (await valueOf(page, 'Pet name')) === NAME)
  await clickButton(page, 'Save draft')
  await pause(1500)
  const status = await page.evaluate(() => document.querySelector('[data-draft-status]')?.textContent ?? '')
  draftId = Number(new URL(page.url()).searchParams.get('draft'))
  check('DRAFT-UI-3', 'Save draft: "Draft saved." is said, and the draft is in MySQL', status.startsWith('Draft saved.') &&
    sql(`SELECT pet_name FROM report_drafts WHERE draft_id = ${draftId || 0};`) === NAME, `${status} #${draftId}`)
  await context.close()
}
{
  // Another browser — another device, as far as the server can tell.
  const { page, context } = await signedInPage('maria.santos@example.com', { device: KnownDevices['iPhone 13'] })
  check('DRAFT-UI-4', 'A new browser, signed in again (nothing carried over but the account)', true)
  await page.goto(BASE + '/dashboard/reports', { waitUntil: 'networkidle2' })
  await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.startsWith('Drafts'))?.click())
  await pause(400)
  const listed = (await text(page)).includes(NAME)
  check('DRAFT-UI-5', 'My reports lists the draft under Drafts', listed)
  await clickButton(page, 'Continue editing')
  await pause(2500)
  check('DRAFT-UI-6', 'Continue editing opens it in the report form', page.url().includes(`/report/lost?draft=${draftId}`), page.url())
  const restored = {
    name: await valueOf(page, 'Pet name'), species: await valueOf(page, 'Species'),
    breed: await valueOf(page, 'Breed'), colour: await valueOf(page, 'Main colour'), size: await valueOf(page, 'Size'),
  }
  check('DRAFT-UI-7', 'Everything saved is back: name, species, breed, colour, size',
    JSON.stringify(restored) === JSON.stringify({ name: NAME, species: 'dog', breed: 'Shih Tzu', colour: 'Brown', size: 'small' }),
    JSON.stringify(restored))
  await context.close()
}
{
  const { page, context } = await signedInPage('noel.aguilar@example.com')
  await page.goto(`${BASE}/report/lost?draft=${draftId}`, { waitUntil: 'networkidle2' })
  await pause(800)
  const refused = (await text(page)).includes('That draft could not be opened')
  check('DRAFT-UI-8', 'Another account cannot open it, even with its link', refused && !(await text(page)).includes(NAME))
  await context.close()
}
{
  const { page, context } = await guestPage()
  await page.goto(`${BASE}/explore?q=${NAME}`, { waitUntil: 'networkidle2' })
  await pause(1200)
  check('DRAFT-UI-9', 'The draft is nowhere in Explore', !(await exploreLists(page, NAME)))
  await context.close()
}
check('DRAFT-UI-10', 'A draft is never compared: it is not a report, and no pairing names it',
  sql(`SELECT COUNT(*) FROM pet_reports WHERE pet_name = '${NAME}';`) === '0')

// ===================================================== REVIEW-UI + SUBMIT-UI (820)
let approvedId
{
  const { page, context } = await signedInPage('maria.santos@example.com')
  await page.goto(`${BASE}/report/lost?draft=${draftId}`, { waitUntil: 'networkidle2' })
  await pause(1500)
  await finishAndSubmit(page)
  const shown = await confirmationShown(page)
  check('SUBMIT-UI-820', '820px: "Submitted for review" is on screen and focused, and says a coordinator must approve it',
    shown.found && shown.onScreen && shown.focused && shown.says && shown.notLive, JSON.stringify(shown))
  approvedId = createdId()
  check('REVIEW-UI-1', 'The draft became a report waiting for review, and the draft is gone',
    sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${approvedId};`) === 'pending_review' &&
    sql(`SELECT COUNT(*) FROM report_drafts WHERE draft_id = ${draftId};`) === '0')
  await context.close()
}
{
  const { page, context } = await guestPage()
  await page.goto(`${BASE}/pet/${approvedId}`, { waitUntil: 'networkidle2' })
  await pause(1000)
  const missing = (await text(page)).includes('This report does not exist')
  await page.goto(`${BASE}/explore?q=${NAME}`, { waitUntil: 'networkidle2' })
  await pause(1200)
  check('REVIEW-UI-2', 'Waiting for review: its URL says it does not exist, and Explore does not list it',
    missing && !(await exploreLists(page, NAME)))
  check('REVIEW-UI-3', '...and it is not matched', sql(`SELECT COUNT(*) FROM match_claims WHERE lost_report_id = ${approvedId};`) === '0')
  await context.close()
}
{
  const { page, context } = await signedInPage('patricia.lim@example.com')
  await page.goto(BASE + '/staff/review', { waitUntil: 'networkidle2' })
  await pause(800)
  const queued = (await text(page)).includes(NAME)
  const badge = await page.evaluate(() => [...document.querySelectorAll('nav a')].find((a) => a.textContent.includes('Report Review'))?.textContent ?? '')
  check('REVIEW-UI-4', 'The coordinator\'s Report review queue holds it, and the sidebar counts it', queued && /Waiting\s*\d/.test(badge), badge.trim())
  await page.evaluate((name) => [...document.querySelectorAll('article')].find((a) => a.textContent.includes(name))
    ?.querySelector('a')?.click(), NAME)
  await pause(2000)
  const inspect = await text(page)
  check('REVIEW-UI-5', 'Review opens the whole report: description, place, reporter, and the decision buttons',
    inspect.includes('shy with strangers') && inspect.includes('City of Makati') && inspect.includes('Maria') &&
    inspect.includes('Approve and publish') && inspect.includes('Not approved…'))
  await clickButton(page, 'Approve and publish')
  await pause(2500)
  const notice = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role=status]')].find((s) => s.textContent.startsWith('Approved.'))
    if (!el) return null
    const box = el.getBoundingClientRect()
    return { onScreen: box.bottom > 0 && box.top < window.innerHeight }
  })
  check('REVIEW-UI-6', 'Approved: the coordinator is told so, on screen', Boolean(notice?.onScreen), JSON.stringify(notice))
  check('REVIEW-UI-7', 'It is published, and the review is recorded with the coordinator\'s name',
    sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${approvedId};`) === 'published' &&
    sql(`SELECT u.email FROM publication_logs p JOIN users u ON u.user_id = p.actor_user_id WHERE p.report_id = ${approvedId} AND p.new_state = 'published';`) === 'patricia.lim@example.com')
  check('REVIEW-UI-8', 'Matching ran on approval: it pairs with the seeded found Shih Tzu in Makati',
    Number(sql(`SELECT COUNT(*) FROM match_claims WHERE lost_report_id = ${approvedId};`)) > 0)
  await context.close()
}
{
  const { page, context } = await guestPage()
  await page.goto(`${BASE}/explore?q=${NAME}`, { waitUntil: 'networkidle2' })
  await pause(1500)
  check('REVIEW-UI-9', 'Now it is public: Explore lists it', await exploreLists(page, NAME))
  await context.close()
}
{
  const { page, context } = await signedInPage('maria.santos@example.com')
  await page.goto(BASE + '/dashboard/notifications', { waitUntil: 'networkidle2' })
  await pause(800)
  check('REVIEW-UI-10', 'The reporter was notified: "Your report is published"', (await text(page)).includes('Your report is published'))
  await context.close()
}

// ---- rejection, edit, resubmission
let rejectedId
{
  const { page, context } = await signedInPage('maria.santos@example.com', { device: KnownDevices['iPhone 13'] })
  await page.goto(BASE + '/report/lost', { waitUntil: 'networkidle2' })
  await fillPet(page, 'Rejectbo')
  await finishAndSubmit(page)
  const shown = await confirmationShown(page)
  check('SUBMIT-UI-390', 'On a phone: "Submitted for review" is on screen and focused',
    shown.found && shown.onScreen && shown.focused && shown.says, JSON.stringify(shown))
  rejectedId = createdId()
  await context.close()
}
{
  const { page, context } = await signedInPage('patricia.lim@example.com')
  await page.goto(`${BASE}/pet/${rejectedId}`, { waitUntil: 'networkidle2' })
  await pause(1200)
  await clickButton(page, 'Not approved…')
  await pause(500)
  await clickButton(page, 'Not approved')
  await pause(600)
  const needsReason = (await text(page)).includes('Write why it is not approved')
  check('REVIEW-UI-11', 'Not approving needs a reason: an empty one is refused, in words', needsReason &&
    sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${rejectedId};`) === 'pending_review')
  await setField(page, 'Reason', 'Please describe where exactly he was last seen.')
  await clickButton(page, 'Not approved')
  await pause(2500)
  check('REVIEW-UI-12', 'With a reason it is not approved — not public, not matched',
    sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${rejectedId};`) === 'rejected' &&
    sql(`SELECT COUNT(*) FROM match_claims WHERE lost_report_id = ${rejectedId};`) === '0')
  await context.close()
}
{
  const { page, context } = await signedInPage('maria.santos@example.com')
  await page.goto(`${BASE}/pet/${rejectedId}`, { waitUntil: 'networkidle2' })
  await pause(1500)
  const seen = await text(page)
  check('REVIEW-UI-13', 'The reporter sees "Not approved" and the reason', seen.includes('Not approved') &&
    seen.includes('Please describe where exactly he was last seen.'))
  await page.goto(BASE + '/dashboard/notifications', { waitUntil: 'networkidle2' })
  await pause(800)
  check('REVIEW-UI-14', '...and was notified', (await text(page)).includes('Your report was not approved'))
  await page.goto(`${BASE}/dashboard/reports/${rejectedId}/edit`, { waitUntil: 'networkidle2' })
  await pause(1500)
  await clickButton(page, 'Continue')
  await pause(900)
  await setField(page, 'Where your pet', 'At the corner of Poblacion market and J. P. Rizal Street')
  await clickButton(page, 'Continue')
  await pause(800)
  await clickButton(page, 'Continue')
  await pause(800)
  await clickButton(page, 'Save changes')
  await pause(2500)
  await clickButton(page, 'Submit for review again')
  await pause(500)
  await clickButton(page, 'Submit again')
  await pause(2500)
  const history = sql(`SELECT GROUP_CONCAT(new_state ORDER BY log_id) FROM publication_logs WHERE report_id = ${rejectedId};`)
  check('REVIEW-UI-15', 'Edited and submitted again: waiting for review, the rejection kept in its history',
    history === 'pending_review,rejected,pending_review', history)
  await context.close()
}
{
  const { page, context } = await signedInPage('patricia.lim@example.com')
  await page.goto(`${BASE}/pet/${rejectedId}`, { waitUntil: 'networkidle2' })
  await pause(1200)
  await clickButton(page, 'Approve and publish')
  await pause(2500)
  check('REVIEW-UI-16', 'Resubmitted and approved: published', sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${rejectedId};`) === 'published')
  await context.close()
}

// ===================================================== RM-UI
{
  const { page, context } = await signedInPage('grace.bautista@example.com', {})
  await page.goto(`${BASE}/pet/${rejectedId}`, { waitUntil: 'networkidle2' })
  await pause(1200)
  await clickButton(page, 'Remove from public view…')
  await pause(500)
  await setField(page, 'Reason', 'Duplicate of an earlier report about the same dog.')
  await clickButton(page, 'Remove from public view')
  await pause(2500)
  check('RM-UI-1', 'An administrator removes it, with a reason', sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${rejectedId};`) === 'removed')
  const record = await text(page)
  check('RM-UI-2', '...and can still open the record, marked Removed', record.includes('Removed') && record.includes('Duplicate of an earlier report'))
  await context.close()
}
{
  const { page, context } = await guestPage()
  await page.goto(`${BASE}/pet/${rejectedId}`, { waitUntil: 'networkidle2' })
  await pause(1000)
  check('RM-UI-3', 'The public URL now says it does not exist', (await text(page)).includes('This report does not exist'))
  await context.close()
}
{
  const { page, context } = await signedInPage('maria.santos@example.com')
  await page.goto(BASE + '/dashboard/reports', { waitUntil: 'networkidle2' })
  await pause(800)
  const tab = async (name) => {
    await page.evaluate((n) => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.startsWith(n))?.click(), name)
    await pause(300)
    return text(page)
  }
  const removedTab = await tab('Removed')
  const closedTab = await tab('Closed')
  check('RM-UI-4', 'Its reporter finds it under Removed — not under Closed', removedTab.includes('Rejectbo') && !closedTab.includes('Rejectbo'))
  check('RM-UI-5', 'No Closed event was written for it',
    sql(`SELECT COUNT(*) FROM status_logs WHERE report_id = ${rejectedId} AND new_status = 'closed';`) === '0')
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
for (const r of failed) console.log(`  FAILED  ${r.id}  ${r.description}`)
process.exit(failed.length ? 1 : 0)
