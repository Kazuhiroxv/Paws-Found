/**
 * Correction 7 in a real browser: English and Filipino, the Privacy Notice
 * update, the Disclaimer and the printable report list.
 *
 *   PAWS_BASE=http://localhost:5173 PAWS_PW=<seeded password> npm run test:i18n-ui
 *
 *   I18N   English by default; Filipino chosen from the header, remembered
 *          across pages and reloads; <html lang> follows; switching keeps the
 *          page, the session and a half-filled form — and sends nothing; the
 *          public site, a customer's dashboard and the report wizard, the
 *          coordinator's review queue and Administration all in Filipino;
 *          session-end reasons, statuses and the permission-denied page too;
 *          stored values and what people typed never change
 *   PRIV   the "Privacy Notice updated" message: shown, non-blocking,
 *          Review opens the notice, Acknowledge records it and it goes
 *   DISC   the Disclaimer, public, in both languages; its short forms where
 *          they belong
 *   PRINT  Print / Save as PDF on Explore, the coordinator's queue and
 *          Administration: what is filtered is what prints, only rows the
 *          account may see, no contact or security details, Lost/Found in
 *          words, script-like text printed as text, the app's chrome hidden,
 *          A4, rows kept whole, headings in the language showing — and a PDF
 *          actually produced from it
 *
 * Reseeds at the start and the end. Uses the dev server and the local API.
 */
// The functions passed to page.evaluate run in the browser, not in Node.
/* global document, window, getComputedStyle, CSSPageRule, CSSMediaRule */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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

const { default: en } = await import(pathToFileURL(path.join(ROOT, 'src/i18n/en/index.js')).href)
const { default: fil } = await import(pathToFileURL(path.join(ROOT, 'src/i18n/fil/index.js')).href)

const CUSTOMER = 'maria.santos@example.com'
const CUSTOMER2 = 'liza.ocampo@example.com'
const STAFF = 'patricia.lim@example.com'
const MODERATOR = 'rafael.mendoza@example.com'
const SUPER = 'grace.bautista@example.com'
const XSS = '<img src=x onerror="window.__xss=1">Bantay'

const results = []
const check = (id, description, ok, detail = '') => {
  results.push({ id, ok })
  const note = String(detail).replace(/\s*\n\s*/g, ' / ').slice(0, 140)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(9)} ${description}${detail ? `  (${note})` : ''}`)
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const mysql = (args, input) =>
  execFileSync(MYSQL, ['-uroot', '-h127.0.0.1', '-P3307', '--default-character-set=utf8mb4', ...args], input ? { input } : {})
const sql = (query) => mysql(['-N', '-B', 'pawsandfound', '-e', query]).toString().trim()
const reseed = () => mysql(['pawsandfound'], fs.readFileSync(path.join(ROOT, 'database', 'seed.sql')))

reseed()
sql(`UPDATE users SET role = 'admin', admin_level = 'moderator' WHERE email = '${MODERATOR}'`)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })

// ------------------------------------------------------------------ helpers
async function newPage({ email = null, language = null, width = 1366 } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width, height: 900 })
  // The print dialog cannot open headless; count the calls instead.
  await page.evaluateOnNewDocument(() => {
    window.__printed = 0
    window.print = () => { window.__printed += 1 }
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  if (language) await page.evaluate((l) => localStorage.setItem('paws:language', l), language)
  if (email) {
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
  return { context, page }
}
async function open(page, route) {
  await page.goto(BASE + route, { waitUntil: 'networkidle2' })
  await pause(700)
}
const text = (page) => page.evaluate(() => document.body.innerText)
const htmlLang = (page) => page.evaluate(() => document.documentElement.lang)
const switchTo = async (page, language) => {
  // The visible switcher: the header's at this width, else the workspace rail's.
  await page.evaluate((l) => {
    const select = [...document.querySelectorAll('select[data-language-switcher]')].find((s) => s.getClientRects().length)
    select.value = l
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }, language)
  await pause(400)
}
const clickText = (page, wanted, scope = 'button, a') => page.evaluate((w, s) => {
  const el = [...document.querySelectorAll(s)].find((b) => b.textContent.trim().startsWith(w) && b.getClientRects().length)
  el?.click()
  return Boolean(el)
}, wanted, scope)
const apiAs = (page, method, route, body) => page.evaluate(async (api, m, r, b) => {
  const me = await (await fetch(api + '/auth/me', { credentials: 'include' })).json()
  const response = await fetch(api + r, {
    method: m, credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token ?? '' },
    body: b ? JSON.stringify(b) : undefined,
  })
  return { status: response.status, body: await response.json().catch(() => null) }
}, API, method, route, body)
const sheet = (page) => page.evaluate(() => {
  const s = document.querySelector('[data-print-sheet]')
  if (!s) return null
  return {
    text: s.innerText,
    title: s.querySelector('h1')?.textContent,
    filters: s.querySelector('[data-print-filters]')?.textContent,
    heads: [...s.querySelectorAll('th')].map((th) => th.textContent),
    rows: [...s.querySelectorAll('[data-print-row]')].map((tr) => tr.getAttribute('data-print-row')),
    types: [...s.querySelectorAll('[data-print-type]')].map((td) => [td.getAttribute('data-print-type'), td.textContent]),
    imgs: s.querySelectorAll('img, script').length,
    buttons: s.querySelectorAll('button, a, input, select').length,
  }
})

try {
  // A report waiting for review, filed by a customer: it must never reach a
  // guest's printout, and its publication state is translated.
  const filer = await newPage({ email: CUSTOMER2 })
  const filed = await apiAs(filer.page, 'POST', '/reports', {
    report_type: 'lost', species: 'dog', pet_name: 'Pending Print Dog', breed: 'Aspin (Philippine Native Dog)',
    size: 'medium', sex: 'male', primary_color: 'Brown', distinct_features: 'A white tip on the tail',
    incident_date: '2026-10-01', area_code: '1300000000', city_code: '1381100000',
    allow_platform_contact: true, has_collar: 'unknown', location_label: 'Near the barangay hall',
    description: 'Filed by the Correction 7 browser suite to stay pending review.',
  })
  const pendingId = filed.body?.data?.report_id
  if (filed.status !== 201 && filed.status !== 200) throw new Error(`filing failed: ${filed.status}`)
  await filer.context.close()

  // ================================================================ I18N
  console.log('\nI18N. English and Filipino')
  {
    const { context, page } = await newPage()
    await open(page, '/')
    check('I18N-01', 'English by default: <html lang="en"> and English navigation',
      (await htmlLang(page)) === 'en' && (await text(page)).includes(en.nav.explore), await htmlLang(page))
    const label = await page.evaluate(() => {
      const select = [...document.querySelectorAll('select[data-language-switcher]')].find((s) => s.getClientRects().length)
      return document.querySelector(`label[for="${select.id}"]`)?.textContent
    })
    check('I18N-A', 'the switcher is a labelled control, named in both languages', label === 'Language (Wika)', label)

    await switchTo(page, 'fil')
    const navFil = await page.evaluate(() => [...document.querySelectorAll('header nav a, header nav button')].map((a) => a.textContent.trim()))
    check('I18N-02', 'Filipino can be chosen from the header', (await htmlLang(page)) === 'fil')
    check('I18N-06', '<html lang> changes to "fil"', (await htmlLang(page)) === 'fil')
    check('I18N-07', 'the public navigation is in Filipino',
      [fil.nav.home, fil.nav.explore, fil.nav.about, fil.nav.help].every((w) => navFil.some((n) => n.startsWith(w))), navFil.join(' · '))
    await clickText(page, fil.nav.about, 'header nav a')
    await pause(700)
    check('I18N-03', 'the choice holds across navigation (About, in Filipino)',
      page.url().endsWith('/about') && (await text(page)).includes(fil.about.title) && (await htmlLang(page)) === 'fil')
    await page.reload({ waitUntil: 'networkidle2' })
    await pause(500)
    check('I18N-04', 'and after a reload', (await text(page)).includes(fil.about.title) && (await htmlLang(page)) === 'fil')
    await switchTo(page, 'en')
    check('I18N-06', 'and back to "en" with English words', (await htmlLang(page)) === 'en' && (await text(page)).includes(en.about.title))

    // DISC-01 in the browser, both languages.
    await open(page, '/disclaimer')
    const enDisc = await text(page)
    check('DISC-01', 'the Disclaimer opens signed out, in English',
      enDisc.includes(en.disclaimer.sections.payments.title) && enDisc.includes(en.disclaimer.sections.affiliation.title))
    await switchTo(page, 'fil')
    const filDisc = await text(page)
    check('DISC-01', 'and in Filipino', filDisc.includes(fil.disclaimer.sections.payments.title) && filDisc.includes(fil.disclaimer.sections.guarantee.title))
    check('DISC-F', 'the footer carries the short notice and the link',
      await page.evaluate(() => Boolean(document.querySelector('[data-footer-notice] a[href$="/disclaimer"]'))))
    await context.close()
  }

  // Customer: dashboard, wizard, form contents, statuses.
  {
    const { context, page } = await newPage({ email: CUSTOMER, language: 'fil' })
    await open(page, '/dashboard')
    const dash = await text(page)
    check('I18N-08', 'a customer\'s dashboard is in Filipino',
      dash.includes(fil.dashboard.welcome.replace('{name}', 'Maria')) && dash.includes(fil.nav.myReports), dash.slice(0, 80))
    check('PRIV-01', 'the "Privacy Notice updated" message is shown to an older agreement',
      dash.includes(fil.shell.privacyUpdate.title) && dash.includes(fil.shell.privacyUpdate.acknowledge))
    check('PRIV-06', 'and it blocks nothing: no dialog, and the page under it works',
      (await page.evaluate(() => !document.querySelector('dialog[open]'))) && (await clickText(page, fil.nav.myReports, 'nav a')))
    await pause(800)
    check('PRIV-06', 'My Reports opened with the message still above it', page.url().endsWith('/dashboard/reports')
      && (await text(page)).includes(fil.shell.privacyUpdate.title))
    check('PRIV-05', 'the message offers Review and Acknowledge, never Agree or Decline',
      await page.evaluate(() => {
        const s = document.querySelector('[data-privacy-update]')
        const words = [...s.querySelectorAll('a, button')].map((b) => b.textContent.trim())
        return words.length === 2 && !/agree|decline|sang-ayon|tanggihan/i.test(s.innerText)
      }))

    // I18N-13, I18N-14: statuses in Filipino.
    await clickText(page, fil.myReports.tabs.open, 'button[role="tab"]')
    await pause(300)
    const reportsText = await text(page)
    check('I18N-14', 'case statuses are in Filipino (Aktibo, Posibleng Tugma)',
      reportsText.includes(fil.labels.caseStatus.active) || reportsText.includes(fil.labels.caseStatus.possible_match))

    // PRIV-03 and PRIV-04.
    await open(page, '/dashboard')
    await clickText(page, fil.shell.privacyUpdate.review, '[data-privacy-update] a')
    await pause(800)
    check('PRIV-03', 'Review opens the Privacy Notice, in Filipino',
      page.url().endsWith('/privacy') && (await text(page)).includes(fil.privacy.title))
    await clickText(page, fil.shell.privacyUpdate.acknowledge, '[data-privacy-update] button')
    await pause(1500)
    const userId = sql(`SELECT user_id FROM users WHERE email = '${CUSTOMER}'`)
    const current = fs.readFileSync(path.join(ROOT, 'api', 'config.php'), 'utf8').split("define('PRIVACY_NOTICE_VERSION', '")[1].split("'")[0]
    check('PRIV-04', 'Acknowledge records the current version and the message goes',
      sql(`SELECT COUNT(*) FROM privacy_consents WHERE user_id = ${userId} AND notice_version = '${current}'`) === '1'
        && !(await page.evaluate(() => Boolean(document.querySelector('[data-privacy-update]')))))
    await open(page, '/dashboard')
    check('PRIV-02', 'and it is not shown again', !(await page.evaluate(() => Boolean(document.querySelector('[data-privacy-update]')))))

    // I18N-09, I18N-05: the wizard, a half-filled form, and a switch.
    await switchTo(page, 'en')
    await open(page, '/report/lost')
    check('I18N-09a', 'the report wizard, in English', (await text(page)).includes(en.reportForm.steps.details))
    const sent = []
    const listen = (request) => {
      if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !request.url().includes('page-view')) {
        sent.push(`${request.method()} ${new URL(request.url()).pathname}`)
      }
    }
    page.on('request', listen)
    const draftsBefore = sql(`SELECT COUNT(*) FROM report_drafts`)
    await page.type('input[maxlength="40"]', 'Bantay Switch')
    await page.type('textarea[maxlength="300"]', 'White patch on the chest')
    await clickText(page, en.common.continue, 'button')
    await pause(400)
    const enError = await text(page)
    await switchTo(page, 'fil')
    const after = await page.evaluate(() => ({
      name: document.querySelector('input[maxlength="40"]')?.value,
      features: document.querySelector('textarea[maxlength="300"]')?.value,
      url: window.location.pathname,
    }))
    const filText = await text(page)
    check('I18N-09', 'the report wizard, in Filipino', filText.includes(fil.reportForm.steps.details) && filText.includes(fil.reportForm.details.petName))
    check('I18N-05', 'switching keeps what was typed, and the page',
      after.name === 'Bantay Switch' && after.features === 'White patch on the chest' && after.url === '/report/lost', JSON.stringify(after))
    check('I18N-05', 'the messages beside the fields come back in Filipino',
      enError.includes(en.reportForm.errors.species) && filText.includes(fil.reportForm.errors.species))
    check('I18N-05', 'switching sent nothing: no submission, no draft', sent.length === 0 && sql(`SELECT COUNT(*) FROM report_drafts`) === draftsBefore, sent.join(', '))
    page.off('request', listen)

    // I18N-17 and DISC: a report as typed, the handover notice.
    await open(page, '/pet/1')
    const description = sql('SELECT description FROM pet_reports WHERE report_id = 1')
    const petText = await text(page)
    check('I18N-17', 'what a reporter wrote is shown exactly as written', petText.includes(description), description.slice(0, 40))
    check('DISC-H', 'the handover notice sits with the possible matches, in Filipino',
      await page.evaluate(() => Boolean(document.querySelector('[data-handover-notice]'))) && petText.includes('Bago ang pag-aabot'))
    await context.close()
  }

  // I18N-12: a session ended elsewhere, said in Filipino.
  {
    const a = await newPage({ email: STAFF, language: 'fil' })
    await open(a.page, '/staff/review')
    const reviewText = await text(a.page)
    check('I18N-10', 'the coordinator\'s review queue is in Filipino', reviewText.includes(fil.staff.review.title) && reviewText.includes(fil.nav.reportQueue))
    check('I18N-13', 'a pending report reads "Hinihintay ang pagsusuri" for its coordinator',
      await (async () => { await open(a.page, `/pet/${pendingId}`); return (await text(a.page)).includes(fil.labels.publication.pending_review) })())

    // I18N-16: a decision made in Filipino stores the database's own value.
    await clickText(a.page, fil.publication.approve, 'button')
    await pause(1500)
    check('I18N-16', 'approving in Filipino stores "published", and the log "published"',
      sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${pendingId}`) === 'published'
        && sql(`SELECT new_state FROM publication_logs WHERE report_id = ${pendingId} ORDER BY log_id DESC LIMIT 1`) === 'published')

    const b = await newPage({ email: STAFF })
    await b.context.close()
    await a.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await pause(2500)
    const ended = await text(a.page)
    check('I18N-12', 'a session ended by a sign-in elsewhere says so in Filipino', ended.includes(fil.shell.session.new_privileged_login), ended.slice(0, 120))
    await a.context.close()
  }

  // I18N-11, I18N-15: Administration and the permission-denied page.
  {
    const { context, page } = await newPage({ email: SUPER, language: 'fil' })
    await open(page, '/admin')
    const adminText = await text(page)
    check('I18N-11', 'Administration is in Filipino, the level\'s name kept',
      adminText.includes(fil.shell.workspace.admin) && adminText.includes(fil.nav.categories) && adminText.includes('Super Administrator'))
    await open(page, '/privacy')
    check('PRIV-A', 'an administrator can open the Privacy Notice (Review is not bounced)', page.url().endsWith('/privacy') && (await text(page)).includes(fil.privacy.title))
    await context.close()

    const mod = await newPage({ email: MODERATOR, language: 'fil' })
    await open(mod.page, '/admin/logs')
    check('I18N-15', 'the permission-denied page is in Filipino', (await text(mod.page)).includes(fil.shell.access.denied))
    await mod.context.close()
  }

  // ================================================================ PRINT
  console.log('\nPRINT. Print / Save as PDF')
  sql(`UPDATE pet_reports SET pet_name = '${XSS.replaceAll("'", "''")}' WHERE report_id = 1`)
  {
    // Explore, as a guest, filtered to lost dogs.
    const { context, page } = await newPage()
    await open(page, '/explore?type=lost&species=dog')
    check('PRINT-01', 'Explore offers Print / Save as PDF', await page.evaluate(() => Boolean(document.querySelector('[data-print-trigger]'))))
    await page.click('[data-print-trigger]')
    await page.waitForSelector('[data-print-sheet]', { timeout: 15000 })
    await pause(400)
    const s = await sheet(page)
    check('PRINT-01', 'and opens the browser\'s print dialog', (await page.evaluate(() => window.__printed)) === 1)
    check('PRINT-02', 'the filters on screen are named on the printout', s.filters.includes('Type: Lost') && s.filters.includes('Species: Dog'), s.filters)
    const expected = await page.evaluate(async (api) => (await (await fetch(api + '/reports?type=lost&species=dog&per_page=50')).json()).meta.total, API)
    check('PRINT-02', 'every matching report prints, not only the page on screen', s.rows.length === expected, `${s.rows.length} vs ${expected}`)
    check('PRINT-03', 'only what a guest may see: the report waiting for review is not there', !s.rows.includes(String(pendingId)) || sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${pendingId}`) === 'published')
    check('PRINT-03', 'every printed row is a published report', s.rows.every((id) => sql(`SELECT publication_status FROM pet_reports WHERE report_id = ${id}`) === 'published'))
    check('PRINT-04', 'no session, IP or email on the printout', !/\b\d{1,3}(\.\d{1,3}){3}\b|::1|@|session/i.test(s.text))
    check('PRINT-05', 'no phone number either', !/(\+63|09\d{2})[\s-]?\d{3}/.test(s.text))
    check('PRINT-06', 'Lost and Found are written as words, not only coloured', s.types.length > 0 && s.types.every(([type, word]) => word === (type === 'lost' ? 'LOST' : 'FOUND')))
    check('PRINT-07', 'script-like text prints as text: shown literally, nothing run, no image made',
      s.text.includes(XSS) && s.imgs === 0 && !(await page.evaluate(() => window.__xss)))
    check('PRINT-09', 'English headings when English is showing', s.title === en.print.exploreTitle && s.heads.includes(en.print.type), s.heads.join('|'))

    await page.emulateMediaType('print')
    const printed = await page.evaluate(() => ({
      root: getComputedStyle(document.getElementById('root')).display,
      sheet: getComputedStyle(document.querySelector('[data-print-sheet]')).display,
      rowBreak: getComputedStyle(document.querySelector('[data-print-row]')).breakInside,
      head: getComputedStyle(document.querySelector('[data-print-sheet] thead')).display,
      background: getComputedStyle(document.querySelector('[data-print-sheet] th')).backgroundColor,
    }))
    check('PRINT-08', 'in print, the app — navigation, filters, buttons — is hidden and only the list shows',
      printed.root === 'none' && printed.sheet === 'block' && s.buttons === 0, JSON.stringify(printed))
    check('PRINT-08', 'black on white: no tinted header cells', /rgba\(0, 0, 0, 0\)|transparent/.test(printed.background), printed.background)
    const page4 = await page.evaluate(() => {
      for (const styleSheet of document.styleSheets) {
        let rules
        try { rules = styleSheet.cssRules } catch { continue }
        for (const rule of rules) {
          const inner = rule instanceof CSSMediaRule ? [...rule.cssRules] : [rule]
          for (const r of inner) if (r instanceof CSSPageRule && /size:\s*a4\b/i.test(r.cssText) && !/landscape/i.test(r.cssText)) return 'A4 (portrait)'
        }
      }
      return null
    })
    check('PRINT-11', 'the page is set to A4 portrait', Boolean(page4), page4)
    check('PRINT-12', 'a row is never split across pages, and the heading repeats', printed.rowBreak === 'avoid' && printed.head === 'table-header-group', `${printed.rowBreak} / ${printed.head}`)
    const pdf = path.join(os.tmpdir(), 'paws-print-check.pdf')
    await page.pdf({ path: pdf, preferCSSPageSize: true })
    const bytes = fs.readFileSync(pdf)
    check('PRINT-11', 'Save as PDF produces a PDF from it', bytes.subarray(0, 4).toString() === '%PDF' && bytes.length > 5000, `${bytes.length} bytes`)
    fs.rmSync(pdf, { force: true })
    await page.emulateMediaType(null)
    await context.close()
  }
  {
    // Filipino headings, and Administration's own list.
    const { context, page } = await newPage({ email: SUPER, language: 'fil' })
    await open(page, '/admin/reports')
    // The status filter: the select that offers "closed" (not the language one).
    await page.evaluate(() => {
      const select = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'closed'))
      select.value = 'closed'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await pause(500)
    check('PRINT-01', 'Administration\'s report list offers it too', await page.evaluate(() => Boolean(document.querySelector('[data-print-trigger]'))))
    await page.click('[data-print-trigger]')
    await page.waitForSelector('[data-print-sheet]')
    const s = await sheet(page)
    check('PRINT-10', 'Filipino headings when Filipino is showing', s.title === fil.print.adminTitle && s.heads.includes(fil.print.type) && s.heads.includes(fil.print.publication), s.heads.join('|'))
    check('PRINT-10', 'Lost/Found in Filipino words', s.types.length > 0 && s.types.every(([type, word]) => word === (type === 'lost' ? 'NAWAWALA' : 'NATAGPUAN')))
    check('PRINT-02', 'the status chosen on screen is the status printed', s.filters.includes(fil.labels.caseStatus.closed)
      && s.rows.every((id) => sql(`SELECT status FROM pet_reports WHERE report_id = ${id}`) === 'closed'), s.filters)
    check('PRINT-04', 'no email, phone or IP from the administrator\'s screen reaches the printout', !/@|(\+63|09\d{2})[\s-]?\d{3}|::1/.test(s.text))
    await context.close()

    const staff = await newPage({ email: STAFF })
    await open(staff.page, '/staff/reports')
    check('PRINT-01', 'and the coordinator\'s report queue', await staff.page.evaluate(() => Boolean(document.querySelector('[data-print-trigger]'))))
    await staff.page.click('[data-print-trigger]')
    await staff.page.waitForSelector('[data-print-sheet]')
    const q = await sheet(staff.page)
    check('PRINT-02', 'the queue tab chosen (Active) is the one printed', q.filters.includes('Status: Active')
      && q.rows.every((id) => sql(`SELECT status FROM pet_reports WHERE report_id = ${id}`) === 'active'), q.filters)
    await staff.context.close()
  }
} catch (error) {
  console.error(error)
  results.push({ id: 'CRASH', ok: false })
} finally {
  await browser.close()
  reseed()
}

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
