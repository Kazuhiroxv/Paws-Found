/**
 * Post-defense Correction 3, in a real browser.
 *
 *   PAWS_BASE=http://localhost:5173 PAWS_PW=<seeded password> npm run test:report-ui
 *
 * The report form and Explore as somebody uses them, at 820 px (the touch
 * laptop Ma'am used) and 390 px (a phone, with touch):
 *
 *   MAP     the map is the Philippines, refuses a point outside it, and a
 *           tap or click never changes the province or city
 *   PHOTO   the photo rules are stated, counted ("2 of 5") and enforced, and
 *           the main photo is marked in words
 *   PH      the city list follows the province and empties when it changes
 *   RN/RD/RT  the name refusal, the description counter, AM/PM
 *   CONTACT no phone option on the form, no phone number on any report page
 *   EX      Explore offers XL, the colour list, and the place lists
 *
 * Changes data: files one lost report with two photographs. Reseed afterwards.
 */
// The functions passed to page.evaluate run in the browser, not in Node.
/* global document, window, HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer, { KnownDevices } from 'puppeteer-core'

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
  results.push({ id, description, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(10)} ${description}${detail ? `  (${detail})` : ''}`)
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Two small, real PNGs (1x1), written once, for the photo step.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)
const folder = mkdtempSync(join(tmpdir(), 'paws-photos-'))
const photo = (n) => {
  const path = join(folder, `pet-${n}.png`)
  writeFileSync(path, PNG)
  return path
}

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
const fieldInfo = async (page, label) => page.evaluate((el) => el && ({
  value: el.value, disabled: el.disabled, options: el.options ? [...el.options].map((o) => o.textContent.trim()) : null,
}), await fieldByLabel(page, label))
const clickButton = (page, text) => page.evaluate((t) => {
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t && b.getClientRects().length)
  button?.click()
  return Boolean(button)
}, text)
const text = (page) => page.evaluate(() => document.body.innerText)

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

/** The map's box on the page, scrolled into view. */
async function mapBox(page) {
  await page.evaluate(() => document.querySelector('[data-location-picker] .leaflet-container')
    ?.scrollIntoView({ block: 'center' }))
  await pause(400)
  return page.evaluate(() => {
    const box = document.querySelector('[data-location-picker] .leaflet-container').getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  })
}
/** Click (or tap) at a fraction of the map's box; returns the pin readout, or null. */
async function pinAt(page, fx, fy, touch) {
  const box = await mapBox(page)
  const x = box.x + box.width * fx
  const y = box.y + box.height * fy
  if (touch) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
  await pause(500)
  return page.evaluate(() => {
    const picker = document.querySelector('[data-location-picker]')
    if (!picker) return { gone: `${window.location.pathname}: ${document.querySelector('h1, h2')?.textContent}` }
    const match = /Pinned at about (-?[\d.]+), (-?[\d.]+)/.exec(picker.innerText)
    return match ? [Number(match[1]), Number(match[2])] : null
  })
}
const outsideShown = (page) => page.evaluate(() =>
  document.querySelector('[data-location-picker]').innerText.includes('outside the Philippines'))

// ============================================================ the form, twice
for (const { tag, width, device } of [
  { tag: '820', width: 820 },
  { tag: '390', width: 390, device: KnownDevices['iPhone 13'] },
]) {
  const page = await browser.newPage()
  if (device) await page.emulate(device)
  else await page.setViewport({ width, height: 900 })
  const touch = Boolean(device)
  await signIn(page, 'maria.santos@example.com')
  await page.goto(BASE + '/report/lost', { waitUntil: 'networkidle2' })

  // ---- step 1
  await setField(page, 'Pet name', 'A')
  await clickButton(page, 'Continue')
  await pause(400)
  check(`RN-UI-${tag}`, `${tag}px: a one-letter name is refused on the field, in words`,
    (await text(page)).includes('Enter a name with at least 2 letters or numbers.'))
  const breedBefore = await fieldInfo(page, 'Breed')
  await setField(page, 'Pet name', 'Bo')
  await setField(page, 'Species', 'dog')
  await pause(800)
  const breedAfter = await fieldInfo(page, 'Breed')
  check(`BR-UI-${tag}`, `${tag}px: breed waits for the species, then lists that species' breeds`,
    breedBefore.disabled && !breedAfter.disabled && breedAfter.options.includes('Aspin (Philippine Native Dog)')
      && breedAfter.options.at(-2) === 'Mixed breed',
    `${breedAfter.options.length} options`)
  const size = await fieldInfo(page, 'Size')
  check(`RS-UI-${tag}`, `${tag}px: Extra Large (XL) is a size`, size.options.includes('Extra Large (XL)'))
  await setField(page, 'Breed', 'Beagle')
  await setField(page, 'Size', 'xl')
  await setField(page, 'Sex', 'male')
  const colour = await fieldInfo(page, 'Main colour')
  check(`CO-UI-${tag}`, `${tag}px: the main colour is a list from the database`,
    colour.options.length === 18 && colour.options.includes('Tricolour'), `${colour.options.length} options`)
  await setField(page, 'Main colour', 'Tricolour')
  await clickButton(page, 'Continue')
  await pause(900)

  // ---- step 2: place
  const cityLocked = await fieldInfo(page, 'City or municipality')
  await setField(page, 'Province', '1300000000')
  await pause(900)
  const metro = await fieldInfo(page, 'City or municipality')
  await setField(page, 'City or municipality', '1380300000')
  await setField(page, 'Province', '0702200000')
  await pause(900)
  const cebu = await fieldInfo(page, 'City or municipality')
  check(`PH-UI-${tag}`, `${tag}px: city waits for the province, follows it, and empties when it changes`,
    cityLocked.disabled && metro.options.includes('City of Makati') && cebu.value === ''
      && cebu.options.includes('City of Cebu') && !cebu.options.includes('City of Makati'))
  await setField(page, 'Province', '1300000000')
  await pause(900)
  await setField(page, 'City or municipality', '1380300000')

  // ---- the map
  // Not lower than 85%: on a touch screen Chrome snaps a tap near the bottom
  // edge onto the map's "© OpenStreetMap" link, which leaves the page.
  // From the top down, the first point that takes a pin: on a phone the
  // whole country fits with room to spare, and the top rows are north of
  // Batanes (outside the Philippines, so refused, as they should be).
  let north = null
  for (const fy of [0.1, 0.15, 0.2, 0.25, 0.3]) {
    north = await pinAt(page, 0.5, fy, touch)
    if (Array.isArray(north)) break
  }
  const south = await pinAt(page, 0.5, 0.85, touch)
  check(`MAP-1-${tag}`, `${tag}px: the map opens on the whole country, Batanes to Tawi-Tawi`,
    north && south && north[0] >= 18.5 && south[0] <= 7.5, `north ${north}, south ${south}`)
  await clickButton(page, 'Remove pin')
  await pause(300)
  const before = [(await fieldInfo(page, 'Province')).value, (await fieldInfo(page, 'City or municipality')).value]
  const centre = await pinAt(page, 0.5, 0.5, touch)
  check(`MAP-2-${tag}`, `${tag}px: a ${touch ? 'tap' : 'click'} in the Philippines places a pin`, Boolean(centre), String(centre))
  const after = [(await fieldInfo(page, 'Province')).value, (await fieldInfo(page, 'City or municipality')).value]
  check(`MAP-3-${tag}`, `${tag}px: placing the pin changes neither the province nor the city`,
    JSON.stringify(before) === JSON.stringify(after), `${before} -> ${after}`)
  const far = await pinAt(page, 0.02, 0.5, touch)
  check(`MAP-4-${tag}`, `${tag}px: a point outside the Philippines places nothing and says why`,
    (far === null || (far[0] === centre?.[0] && far[1] === centre?.[1])) && (await outsideShown(page)))
  const words = await page.evaluate(() => document.querySelector('[data-location-picker]').innerText)
  check(`MAP-5-${tag}`, `${tag}px: the map says the pin does not change the place, and is optional`,
    words.includes('does not change the') && words.includes('Optional'))
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  check(`MAP-6-${tag}`, `${tag}px: the step fits the width (no sideways scrolling)`, pageWidth)

  // ---- time and description
  await setField(page, 'Date last seen', '2026-09-30')
  await setField(page, 'Hour', '1')
  await setField(page, 'Where your pet', 'Near the Poblacion market')
  await setField(page, 'Description', '   Brown   dog   ')
  await pause(200)
  const counter = await page.evaluate(() => document.querySelector('[data-description-count]')?.textContent)
  check(`RD-UI-${tag}`, `${tag}px: the description counts towards 30, spaces in a row once`,
    counter === '9 / 30 minimum', counter)
  await clickButton(page, 'Continue')
  await pause(500)
  const refused = await text(page)
  check(`RT-UI-${tag}`, `${tag}px: an hour without AM or PM is refused, not guessed`,
    refused.includes('Choose the hour, the minutes and AM or PM'))
  await setField(page, 'Minutes', '05')
  await setField(page, 'AM or PM', 'PM')
  await setField(page, 'Description', 'Beagle, very large for the breed, friendly but scared of motorbikes.')

  // ---- contact
  const contact = await page.evaluate(() => [...document.querySelectorAll('label')].map((l) => l.textContent))
  check(`CONTACT-UI-${tag}`, `${tag}px: the form has no "show my phone number" option`,
    !contact.some((l) => /phone/i.test(l)) && (await text(page)).includes('phone number is never shown'))
  await clickButton(page, 'Continue')
  await pause(900)

  // ---- photos
  const rules = await text(page)
  check(`PHOTO-1-${tag}`, `${tag}px: the rules are stated before choosing: optional, 5, types, 5 MB, main photo`,
    rules.includes('Optional') && rules.includes('Up to 5 photos') && rules.includes('JPEG, PNG or WebP')
      && rules.includes('5 MB') && rules.includes('main photo') && rules.includes('0 of 5 photos added'))
  const input = await page.$('#report-photos')
  await input.uploadFile(photo(1), photo(2))
  await pause(600)
  const two = await page.evaluate(() => ({
    count: document.querySelector('[data-photo-count]')?.textContent.trim(),
    badges: [...document.querySelectorAll('li span')].filter((s) => s.textContent.trim() === 'Main photo').length,
  }))
  check(`PHOTO-2-${tag}`, `${tag}px: "2 of 5 photos added", and one is marked "Main photo" in words`,
    two.count === '2 of 5 photos added.' && two.badges === 1, JSON.stringify(two))
  await clickButton(page, 'Make main photo')
  await pause(300)
  const moved = await page.evaluate(() => {
    const items = [...document.querySelectorAll('li')].filter((li) => li.querySelector('img'))
    return items.map((li) => li.innerText.includes('Main photo'))
  })
  check(`PHOTO-3-${tag}`, `${tag}px: "Make main photo" moves the mark`, JSON.stringify(moved) === '[false,true]',
    JSON.stringify(moved))
  await (await page.$('#report-photos')).uploadFile(photo(3), photo(4), photo(5), photo(6))
  await pause(600)
  const full = await page.evaluate(() => ({
    count: document.querySelector('[data-photo-count]')?.textContent.trim(),
    error: document.body.innerText.includes('You can add up to 5 photos.'),
  }))
  check(`PHOTO-4-${tag}`, `${tag}px: a sixth photo is refused, and the count says it is the most`,
    full.count.startsWith('5 of 5') && full.error, JSON.stringify(full))
  const bad = join(folder, 'notes.txt')
  writeFileSync(bad, 'not an image')
  // Its text is "Remove photo 1" to a screen reader; the visible word is "Remove".
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Remove\s*photo/.test(b.textContent.trim()))?.click())
  await pause(200)
  await (await page.$('#report-photos')).uploadFile(bad)
  await pause(400)
  check(`PHOTO-5-${tag}`, `${tag}px: a file that is not an image is refused by name`,
    (await text(page)).includes('notes.txt is not a JPEG, PNG or WebP image.'))

  await clickButton(page, 'Continue')
  await pause(900)
  const review = await text(page)
  check(`RT-REVIEW-${tag}`, `${tag}px: the review shows the time with PM, and the chosen place`,
    review.includes('1:05 PM') && review.includes('City of Makati') && review.includes('Extra Large (XL)'))

  // File it once, at the first width, with its photographs.
  if (tag === '820') {
    await clickButton(page, 'Submit report')
    await pause(4000)
    const done = await text(page)
    check('PHOTO-6', 'The report and its photographs are filed', done.includes('Report submitted') && !done.includes('could not'))
  }
  await page.close()
}

// ============================================================ report pages
{
  const page = await browser.newPage()
  await page.setViewport({ width: 820, height: 900 })
  await signIn(page, 'noel.aguilar@example.com')
  const phones = []
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    await page.goto(`${BASE}/pet/${id}`, { waitUntil: 'networkidle2' })
    phones.push(await page.evaluate(() => document.querySelectorAll('a[href^="tel:"]').length))
  }
  check('CONTACT-UI-pages', 'Ten seeded report pages, some with show_phone = 1 in the seed: no phone link on any',
    phones.every((n) => n === 0), phones.join(','))
  await page.close()
}

// ============================================================ Explore
{
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto(BASE + '/explore', { waitUntil: 'networkidle2' })
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => /Size and colour|Place/.test(b.textContent)).forEach((b) => b.click()))
  await pause(500)
  const size = await fieldInfo(page, 'Size')
  const colour = await fieldInfo(page, 'Colour')
  check('EX-1', 'Explore: XL is a size filter and the colour filter is the colour list',
    size.options.includes('Extra Large (XL)') && colour.options.length === 18)
  const cityBefore = await fieldInfo(page, 'City or municipality')
  await setField(page, 'Province', '1300000000')
  await pause(1200)
  const cityAfter = await fieldInfo(page, 'City or municipality')
  const chip = (await text(page)).includes('Province: Metro Manila')
  check('EX-2', 'Explore: the city filter waits for a province, then lists its cities; the chip names it',
    cityBefore.disabled && !cityAfter.disabled && cityAfter.options.includes('City of Makati') && chip)
  await setField(page, 'City or municipality', '1380300000')
  await pause(1500)
  const names = await page.evaluate(() => document.body.innerText.includes('City: City of Makati'))
  check('EX-3', 'Explore: choosing a city filters by it, and says so in words', names)
  await page.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
for (const r of failed) console.log(`  FAILED  ${r.id}  ${r.description}`)
process.exit(failed.length ? 1 : 0)
