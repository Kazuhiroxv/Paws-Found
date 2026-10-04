/**
 * The Disclaimer says what it must, in both languages, and nothing it must
 * not (Correction 7).
 *
 *   npm run test:disclaimer
 *
 *   DISC-01  /disclaimer is a public route (no sign-in guard, not bounced for
 *            an administrator) and the footer links to it
 *   DISC-02  it says the project is academic and non-commercial
 *   DISC-03  it says no payments or financial transactions are processed
 *   DISC-04  it disclaims affiliation with any agency, organisation, clinic
 *            or pet business — and claims none
 *   DISC-05  it says user-submitted information may be inaccurate
 *   DISC-06  it says recovery (and identity, ownership…) cannot be guaranteed
 *   DISC-07  it gives safety and independent-verification guidance
 *   DISC-08  no blanket "you cannot sue us" language: no waiver, immunity or
 *            hold-harmless wording, in either language
 *   DISC-09  English and Filipino carry the same sections, the same number of
 *            paragraphs and safety points, and every required point in both
 *
 * Content is checked in the dictionaries the page renders from; the browser
 * suite (test:i18n-ui) opens the page itself, signed out, in both languages.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.join(import.meta.dirname, '..')
const results = []
const check = (id, description, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(8)} ${description}${detail ? `  (${detail})` : ''}`)
}

const { DICTIONARIES } = await import(pathToFileURL(path.join(ROOT, 'src/i18n/index.js')).href)

/** Every word of the disclaimer page in one language, plus its short forms. */
function textOf(dict) {
  const d = dict.disclaimer
  const parts = [d.title, d.description, d.intro]
  for (const section of Object.values(d.sections)) {
    parts.push(section.title, ...(section.body ?? []), ...(section.list ?? []), ...(section.after ?? []))
  }
  return parts.join('\n')
}
const en = textOf(DICTIONARIES.en)
const fil = textOf(DICTIONARIES.fil)
const has = (text, ...patterns) => patterns.every((pattern) => pattern.test(text))

// ---------------------------------------------------------------- DISC-01
const app = readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8')
const route = app.indexOf('path="/disclaimer"')
const adminGuard = app.indexOf('<Route element={<AdminStaysInWorkspace')
const before = app.slice(Math.max(0, route - 400), route)
check('DISC-01', '/disclaimer is a route, with no sign-in guard around it', route > 0 && !before.includes('<RequireAccess'))
check('DISC-01', 'it is outside the administrator bounce, so every account can read it', route > 0 && route < adminGuard)
const footer = readFileSync(path.join(ROOT, 'src/components/Footer.jsx'), 'utf8')
check('DISC-01', 'the footer links to it', footer.includes("to: '/disclaimer'") && footer.includes('to="/disclaimer"'))

// ---------------------------------------------------------------- DISC-02…07
const POINTS = [
  ['DISC-02', 'academic and non-commercial', [/academic/i, /non-commercial/i], [/akademiko/i, /hindi pangkomersyal/i]],
  ['DISC-03', 'no payments or financial transactions', [/does not process payments or financial transactions/i], [/hindi nagpoproseso .*bayad o transaksyong pinansyal/i]],
  ['DISC-04', 'not affiliated with an agency, organisation, clinic or pet business',
    [/not affiliated with/i, /government agency/i, /animal welfare/i, /veterinary clinic/i],
    [/hindi kaanib/i, /ahensya ng gobyerno/i, /kapakanan o pagsagip ng hayop/i, /beterinaryong klinika/i]],
  ['DISC-05', 'user-submitted information may be incomplete, inaccurate or outdated',
    [/written by the people who file them/i, /incomplete, inaccurate or out of date/i],
    [/isinulat ng mga taong nag-file/i, /kulang, mali o luma/i]],
  ['DISC-06', 'no guarantee of identity, ownership, location, condition, authenticity or recovery',
    [/cannot guarantee/i, /identity/i, /owns a pet/i, /where a pet is/i, /condition/i, /genuine/i, /recovered/i],
    [/hindi nito magagarantiya/i, /pagkakakilanlan/i, /may-ari ng alaga/i, /kung nasaan ang alaga/i, /kalagayan/i, /totoo/i, /mababawi/i]],
  ['DISC-07', 'verify independently, and stay safe at a handover',
    [/verify information independently/i, /public, well-lit place/i, /never pay/i],
    [/patunayan nang mag-isa/i, /pampubliko at maliwanag na lugar/i, /huwag kailanman magbayad/i]],
]
for (const [id, label, enPatterns, filPatterns] of POINTS) {
  check(id, `English says it: ${label}`, has(en, ...enPatterns))
  check(id, `Filipino says it: ${label}`, has(fil, ...filPatterns))
}

// ---------------------------------------------------------------- DISC-08
const FORBIDDEN = [
  /cannot sue/i, /may not sue/i, /waive/i, /hold harmless/i, /indemnif/i, /immun/i,
  /not liable for any/i, /no liability/i, /release[sd]? .* from (all|any) claims/i, /at your own risk/i,
  /hindi (mo|ka) (maaaring|puwedeng) magdemanda/i, /isinusuko mo/i,
]
const enForbidden = FORBIDDEN.filter((pattern) => pattern.test(en)).map(String)
const filForbidden = FORBIDDEN.filter((pattern) => pattern.test(fil)).map(String)
check('DISC-08', 'no waiver, immunity or "you cannot sue us" wording in English', enForbidden.length === 0, enForbidden.join(' '))
check('DISC-08', 'no such wording in Filipino either', filForbidden.length === 0, filForbidden.join(' '))
check('DISC-08', 'it says it is not a contract and takes no rights away', /not a legal contract/i.test(en) && /does not take away any rights/i.test(en)
  && /hindi ito legal na kontrata/i.test(fil) && /hindi nito inaalis ang anumang karapatan/i.test(fil))

// ---------------------------------------------------------------- DISC-09
const enSections = DICTIONARIES.en.disclaimer.sections
const filSections = DICTIONARIES.fil.disclaimer.sections
const shape = (sections) => Object.entries(sections).map(([id, s]) => `${id}:${s.body?.length ?? 0}/${s.list?.length ?? 0}/${s.after?.length ?? 0}`).join(' ')
check('DISC-09', 'the same sections, paragraphs and safety points in both languages', shape(enSections) === shape(filSections), shape(enSections))
check('DISC-09', 'every required point is in both languages (DISC-02…07 above)', results.every(Boolean))
const short = (dict) => Object.keys(dict.disclaimer.short).join(',')
check('DISC-09', 'the short forms (submit, handover, print) exist in both', short(DICTIONARIES.en) === short(DICTIONARIES.fil) && short(DICTIONARIES.en) === 'submit,handover,print')

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
