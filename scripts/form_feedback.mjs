/**
 * Post-defense Correction 2, in a real browser.
 *
 *   PAWS_BASE=http://localhost:5173 PAWS_PW=<seeded password> npm run test:feedback
 *
 * Three things seen at the defense, each driven through the interface itself:
 *
 *   CF  the Confirm password box appears only once the password meets every
 *       requirement, refuses a paste or a drop with a reason, and is emptied
 *       and hidden again if the password stops being acceptable
 *   SB  a result is brought into view: a form submitted from the bottom of the
 *       page ends with its confirmation on screen and focused, not above the
 *       window where nobody looks (team observation T1, and "no feedback after
 *       Submit" in the recording); a refused one goes to the field that refused
 *   RW  the responsive widths a touch laptop at 125-175% scaling lands on
 *       (820-1279 CSS px): the date filter can be found, filters open and
 *       clear, navigation has a way through, and the controls are big enough
 *       to press
 *
 * Changes data: files one found report and tries one registration with a
 * taken address. Reseed afterwards (README, "Signing in").
 */
// The functions passed to page.evaluate run in the browser, not in Node.
/* global document, window, HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement, ClipboardEvent, DragEvent, DataTransfer */
import puppeteer from 'puppeteer-core'

const BASE = process.env.PAWS_BASE ?? 'http://localhost:5173'
const API = BASE + '/api'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PASSWORD = process.env.PAWS_PW
if (!PASSWORD) {
  console.error('Set PAWS_PW to the password of the seeded accounts (see README, "Signing in").')
  process.exit(2)
}

const results = []
const check = (id, description, ok, detail = '') => {
  results.push({ id, description, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(6)} ${description}${detail ? `  (${detail})` : ''}`)
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 1280, height: 900 },
})

// ------------------------------------------------------------------ helpers

/** The input a visible label belongs to, found by the label's opening words. */
async function fieldByLabel(page, label) {
  return page.evaluateHandle((text) => {
    const found = [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(text))
    return found ? (found.control ?? document.getElementById(found.htmlFor)) : null
  }, label)
}

/** Set a field's value the way React notices: through the native setter. */
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

/** Choose a <select> option by its visible text. */
async function chooseOption(page, label, optionText) {
  const handle = await fieldByLabel(page, label)
  const value = await page.evaluate((el, t) => [...(el?.options ?? [])].find((o) => o.textContent.trim() === t)?.value ?? null, handle, optionText)
  if (value === null) throw new Error(`No option "${optionText}" in "${label}"`)
  await setField(page, label, value)
}

const clickButton = (page, text) => page.evaluate((t) => {
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t && b.getClientRects().length)
  button?.click()
  return Boolean(button)
}, text)

const scrollToBottom = (page) => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

/** Is this element's box at least partly inside the window? */
const inViewport = (page, handle) => page.evaluate((el) => {
  if (!el) return false
  const box = el.getBoundingClientRect()
  return box.bottom > 0 && box.top < window.innerHeight
}, handle)

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

const confirmShown = (page) => page.evaluate(() =>
  [...document.querySelectorAll('label')].some((l) => l.textContent.trim().startsWith('Confirm password')))

// ======================================================= CF: confirm password
{
  const page = await browser.newPage()
  await page.goto(BASE + '/register', { waitUntil: 'networkidle2' })
  await setField(page, 'First name', 'Ja')
  await setField(page, 'Last name', 'Lim')
  await setField(page, 'Email address', 'ja.lim.feedback@example.test')

  check('CF-1', 'Confirm password is not shown before a password is typed', !(await confirmShown(page)))

  await setField(page, 'Password', '123jaabcdefghijk')
  await pause(150)
  check('CF-2', 'Still hidden while the password contains the first name ("ja")', !(await confirmShown(page)))

  await setField(page, 'Password', 'good-random-passphrase')
  await pause(150)
  check('CF-3', 'Appears once every requirement is met', await confirmShown(page))

  const confirmInput = await fieldByLabel(page, 'Confirm password')
  const pasted = await page.evaluate((el) => {
    const data = new DataTransfer()
    data.setData('text/plain', 'good-random-passphrase')
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
    el.dispatchEvent(event)
    return event.defaultPrevented
  }, confirmInput)
  await pause(150)
  const explained = await page.evaluate(() => document.body.innerText.includes('Please retype your password instead of pasting it.'))
  check('CF-4', 'A paste is refused, with the reason shown', pasted && explained)

  const dropped = await page.evaluate((el) => {
    const data = new DataTransfer()
    data.setData('text/plain', 'good-random-passphrase')
    const event = new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true })
    el.dispatchEvent(event)
    return event.defaultPrevented
  }, confirmInput)
  check('CF-5', 'A drop is refused too', dropped)

  await confirmInput.focus()
  await page.keyboard.type('good-random-passphrase')
  await pause(150)
  const typed = await page.evaluate((el) => el.value, await fieldByLabel(page, 'Confirm password'))
  check('CF-6', 'Typing it works', typed === 'good-random-passphrase', typed)

  await page.evaluate(() => {
    const box = [...document.querySelectorAll('input[type="checkbox"]')].find((c) => c.closest('label')?.textContent.includes('Privacy Notice'))
    if (box && !box.checked) box.click()
  })
  await setField(page, 'Confirm password', 'good-random-passphrasX')
  await pause(150)
  const disabledOnMismatch = await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Create account')?.disabled)
  check('CF-7', 'A mismatch keeps Create account disabled', disabledOnMismatch === true)

  await setField(page, 'Password', 'short')
  await pause(150)
  const hiddenAgain = !(await confirmShown(page))
  await setField(page, 'Password', 'good-random-passphrase')
  await pause(150)
  const emptied = await page.evaluate((el) => el?.value === '', await fieldByLabel(page, 'Confirm password'))
  check('CF-8', 'An unacceptable password hides it again, and it comes back empty', hiddenAgain && emptied)

  // A server refusal, submitted from the bottom of the page: the address is
  // already taken (or, if this machine has registered too often, a rate
  // limit). Either way the answer must be where the person can see it.
  await setField(page, 'Email address', 'maria.santos@example.com')
  await setField(page, 'Confirm password', '')
  await pause(100)
  const retyped = await fieldByLabel(page, 'Confirm password')
  await retyped.focus()
  await page.keyboard.type('good-random-passphrase')
  await scrollToBottom(page)
  await pause(200)
  await clickButton(page, 'Create account')
  await pause(1800)
  const focused = await page.evaluateHandle(() => document.activeElement)
  const what = await page.evaluate((el) => el?.getAttribute('aria-invalid') === 'true' ? `field ${el.type}`
    : el?.getAttribute('role') === 'alert' ? 'the message' : el?.tagName, focused)
  check('SB-1', 'Registration refused from the bottom: focus goes to what refused it, on screen',
    (what.startsWith('field') || what === 'the message') && (await inViewport(page, focused)), what)
  await page.close()
}

// =========================================== SB: the report wizard, submitted from the bottom
async function fileFoundReport(width) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width, height: 800 })
  await signIn(page, 'maria.santos@example.com')
  await page.goto(BASE + '/report/found', { waitUntil: 'networkidle2' })
  await pause(600)

  // A refused Continue, pressed from the bottom of step one.
  await scrollToBottom(page)
  await pause(200)
  await clickButton(page, 'Continue')
  await pause(700)
  const refused = await page.evaluateHandle(() => document.activeElement)
  const refusedOk = await page.evaluate((el) => el?.getAttribute('aria-invalid') === 'true', refused)
  check(`SB-${width}a`, `Wizard at ${width}px: Continue refused from the bottom focuses the first wrong field, on screen`,
    refusedOk && (await inViewport(page, refused)),
    await page.evaluate((el) => `${el?.tagName} invalid=${el?.getAttribute('aria-invalid')}`, refused))

  // Step one: the pet.
  await chooseOption(page, 'Species', 'Dog')
  await pause(150)
  await setField(page, 'Breed', 'Aspin')
  await chooseOption(page, 'Size', 'Medium')
  await chooseOption(page, 'Sex', 'Unknown')
  await setField(page, 'Main colour', 'Brown')
  await chooseOption(page, 'Was it wearing a collar?', 'Not sure')
  await clickButton(page, 'Continue')
  await pause(600)

  // Step two: where and when.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  await setField(page, 'Date found', yesterday)
  await setField(page, 'Where you found the pet', 'Near the covered court')
  await setField(page, 'City or municipality', 'Makati City')
  await setField(page, 'Province', 'Metro Manila')
  await setField(page, 'Description', 'Friendly brown dog wearing a red collar, waiting by the gate.')
  await clickButton(page, 'Continue')
  await pause(600)

  // Photos: none. Then the review step, submitted from its bottom.
  await clickButton(page, 'Continue')
  await pause(800)
  await scrollToBottom(page)
  await pause(300)
  const submitted = await clickButton(page, 'Submit report')
  await pause(2500)

  const heading = await page.evaluateHandle(() =>
    [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === 'Report submitted') ?? null)
  const seen = await inViewport(page, heading)
  const focusInside = await page.evaluate((h) => Boolean(h && h.closest('[tabindex="-1"]')?.contains(document.activeElement)), heading)
  check(`SB-${width}b`, `Wizard at ${width}px: submitted from the bottom, "Report submitted" is on screen and focused`,
    submitted && seen && focusInside, !submitted ? 'Submit button not reached' : `on screen ${seen}, focused ${focusInside}`)
  await context.close()
}

await fileFoundReport(1280)
await fileFoundReport(820)

// ============================================== RW: touch-laptop widths
for (const width of [390, 768, 820, 912, 1023, 1024, 1280, 1440, 1920]) {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 900 })
  await page.goto(BASE + '/explore', { waitUntil: 'networkidle2' })
  await pause(400)

  const hasSidebar = await page.evaluate(() => {
    const aside = document.querySelector('aside')
    return Boolean(aside && aside.getClientRects().length)
  })
  if (!hasSidebar) {
    await clickButton(page, 'Filters')
    await pause(500)
  }
  const dateVisible = await page.evaluate(() => [...document.querySelectorAll('input[type="date"]')].some((el) => el.getClientRects().length))
  check(`RW-${width}a`, `${width}px: the date filter is visible ${hasSidebar ? 'on arrival' : 'once Filters is opened'}`, dateVisible)

  // Set a filter, then clear it.
  await setField(page, 'From', '2026-01-01')
  await pause(300)
  await clickButton(page, 'Clear all filters')
  await pause(400)
  const cleared = await page.evaluate(() => [...document.querySelectorAll('input[type="date"]')].every((el) => el.value === ''))
  check(`RW-${width}b`, `${width}px: a filter can be set and cleared`, cleared)

  // A way through the site: links, or a menu button that opens to links.
  await page.goto(BASE + '/explore', { waitUntil: 'networkidle2' })
  const navLinks = await page.evaluate(() => [...document.querySelectorAll('header nav a')].filter((a) => a.getClientRects().length).length)
  let reachable = navLinks >= 3
  let menuSize = null
  if (!reachable) {
    menuSize = await page.evaluate(() => {
      const button = [...document.querySelectorAll('header button')].find((b) => /menu/i.test(b.getAttribute('aria-label') ?? b.textContent) && b.getClientRects().length)
      if (!button) return null
      const box = button.getBoundingClientRect()
      button.click()
      return Math.round(Math.min(box.width, box.height))
    })
    await pause(400)
    reachable = await page.evaluate(() => [...document.querySelectorAll('a[href$="/explore"], a[href$="/about"], a[href$="/help"]')].some((a) => a.getClientRects().length))
  }
  check(`RW-${width}c`, `${width}px: navigation has a way through`, reachable,
    navLinks >= 3 ? `${navLinks} links` : `menu button ${menuSize}px`)

  // WCAG 2.5.8 (AA) asks for at least 24 CSS px; touch guidance prefers 44.
  // Links inside a sentence are exempt, and so is the map's attribution line
  // ("Leaflet", "OpenStreetMap"): required third-party credit, set in small
  // inline text by the library. Those were the only things under 24px.
  const smallest = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('header button, main button, main a[href]')]
      .filter((el) => el.getClientRects().length && !el.closest('p') && !el.closest('.leaflet-control-attribution'))
    return Math.round(Math.min(...controls.map((el) => { const b = el.getBoundingClientRect(); return Math.max(b.height, 0) })))
  })
  check(`RW-${width}d`, `${width}px: no header or page control is under 24px tall`, smallest >= 24, `smallest ${smallest}px`)
  await page.close()
}

await browser.close()

const passed = results.filter((r) => r.ok).length
console.log(`\n${passed}/${results.length} passed`)
for (const r of results.filter((x) => !x.ok)) console.log(`  FAILED  ${r.id}  ${r.description}${r.detail ? ` (${r.detail})` : ''}`)
process.exit(passed === results.length ? 0 : 1)
