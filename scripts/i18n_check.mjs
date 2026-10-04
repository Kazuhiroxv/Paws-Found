/**
 * English and Filipino, checked without a browser (Correction 7).
 *
 *   npm run test:i18n          (after `npm run build`, for the bundle check)
 *
 * Runs with scripts/alias-hook.mjs, so the source's own `@/…` imports load.
 *
 *   I18N-18  every key path in English exists in Filipino and the other way
 *            round — compared as normalised paths, so a nested object that
 *            differs is caught, not only a different number of keys
 *   I18N-P   no empty value; the same {placeholders}, the same <tags> and
 *            the same plural forms (one/other) in both languages
 *   I18N-K   every key the source asks for exists (t('…'), tList('…'),
 *            <Rich k="…">), and every family of keys built at run time
 *   I18N-H   no hard-coded interface text left in the components
 *            (scripts/i18n-scan.mjs)
 *   I18N-16  the stored values — report types, statuses, publication states,
 *            species, sizes, roles, levels — are exactly the database's, and
 *            switching language changes their words, never the values
 *   I18N-T   one Filipino word per status, the same on every page
 *   I18N-B   the production bundle carries both languages
 *   I18N-D   no duplicate keys (ESLint no-dupe-keys over src/i18n)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.join(import.meta.dirname, '..')
const results = []
const check = (id, description, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(9)} ${description}${detail ? `  (${detail})` : ''}`)
}

const i18n = await import(pathToFileURL(path.join(ROOT, 'src/i18n/index.js')).href)
const { DICTIONARIES } = i18n
const en = DICTIONARIES.en
const fil = DICTIONARIES.fil

/** Every leaf as "a.b.c" → value. Arrays count by index. */
function leaves(node, prefix = '', out = new Map()) {
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) leaves(value, prefix ? `${prefix}.${key}` : key, out)
  } else {
    out.set(prefix, node)
  }
  return out
}
const enLeaves = leaves(en)
const filLeaves = leaves(fil)

// ------------------------------------------------------------- I18N-18
const missingInFil = [...enLeaves.keys()].filter((key) => !filLeaves.has(key))
const missingInEn = [...filLeaves.keys()].filter((key) => !enLeaves.has(key))
check('I18N-18a', `every English key exists in Filipino (${enLeaves.size} keys)`, missingInFil.length === 0, missingInFil.slice(0, 5).join(', '))
check('I18N-18b', 'every Filipino key exists in English', missingInEn.length === 0, missingInEn.slice(0, 5).join(', '))

// ------------------------------------------------------------- I18N-P
const empty = [...enLeaves, ...filLeaves].filter(([, value]) => typeof value !== 'string' || value.trim() === '')
check('I18N-P1', 'no empty or non-text values', empty.length === 0, empty.slice(0, 5).map(([k]) => k).join(', '))

const sorted = (list) => [...list].sort().join(',')
const placeholders = (text) => sorted([...new Set(String(text).match(/\{\w+\}/g) ?? [])])
const tags = (text) => sorted(String(text).match(/<\/?\w+>/g) ?? [])
const placeholderDiff = []
const tagDiff = []
for (const [key, value] of enLeaves) {
  if (!filLeaves.has(key)) continue
  if (placeholders(value) !== placeholders(filLeaves.get(key))) placeholderDiff.push(key)
  if (tags(value) !== tags(filLeaves.get(key))) tagDiff.push(key)
}
check('I18N-P2', 'the same {placeholders} in both languages', placeholderDiff.length === 0, placeholderDiff.slice(0, 5).join(', '))
check('I18N-P3', 'the same <link>/<b>/<i> markup in both languages', tagDiff.length === 0, tagDiff.slice(0, 5).join(', '))

/** A count is an object whose only keys are one and other. */
function pluralKeys(node, prefix = '', out = []) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return out
  const keys = Object.keys(node)
  if (keys.includes('one') || (keys.includes('other') && keys.every((k) => k === 'one' || k === 'other'))) {
    out.push(prefix)
    return out
  }
  for (const [key, value] of Object.entries(node)) pluralKeys(value, prefix ? `${prefix}.${key}` : key, out)
  return out
}
const pluralBroken = [...new Set([...pluralKeys(en), ...pluralKeys(fil)])].filter(
  (base) => !(enLeaves.has(`${base}.one`) && enLeaves.has(`${base}.other`) && filLeaves.has(`${base}.one`) && filLeaves.has(`${base}.other`)),
)
check('I18N-P4', 'every count has both forms (one, other) in both languages', pluralBroken.length === 0, pluralBroken.join(', '))

// ------------------------------------------------------------- I18N-K
const sourceFiles = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (!['i18n', 'mock'].includes(name)) walk(full)
    } else if (/\.(jsx?|mjs)$/.test(name)) sourceFiles.push(full)
  }
})(path.join(ROOT, 'src'))

const has = (key) => enLeaves.has(key) || [...enLeaves.keys()].some((leaf) => leaf.startsWith(`${key}.`))
const asked = new Map()
const families = new Set()
for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/(?:\bt|tList|hasKey)\(\s*'([a-zA-Z][\w.]*)'/g)) asked.set(m[1], file)
  for (const m of text.matchAll(/\bk="([a-zA-Z][\w.]*)"/g)) asked.set(m[1], file)
  for (const m of text.matchAll(/\?\s*'([a-z][\w]*\.[\w.]+)'\s*:\s*'([a-z][\w]*\.[\w.]+)'/g)) {
    if (has(m[1]) || has(m[2])) { asked.set(m[1], file); asked.set(m[2], file) }
  }
  // Keys built at run time: t(`labels.species.${value}`) — the family must exist.
  for (const m of text.matchAll(/(?:\bt|tList|hasKey)\(\s*`([a-zA-Z][\w.]*)\.\$\{/g)) families.add(m[1])
}
const unknown = [...asked.keys()].filter((key) => !has(key))
check('I18N-K1', `every key the source asks for exists (${asked.size} keys)`, unknown.length === 0,
  unknown.slice(0, 5).map((k) => `${k} in ${path.relative(ROOT, asked.get(k))}`).join('; '))
const missingFamilies = [...families].filter((family) => !has(family))
check('I18N-K2', `every family of run-time keys exists (${families.size})`, missingFamilies.length === 0, missingFamilies.join(', '))

// ------------------------------------------------------------- I18N-H
let scan = ''
let scanOk = true
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/i18n-scan.mjs')], { encoding: 'utf8' })
} catch (error) {
  scanOk = false
  scan = error.stdout ?? ''
}
check('I18N-H', 'no hard-coded interface text in the components', scanOk, scanOk ? '' : scan.trim().split('\n').slice(0, 3).join(' | '))

// ------------------------------------------------------------- I18N-16
const schema = readFileSync(path.join(ROOT, 'database/schema.sql'), 'utf8')
const enumOf = (column) => {
  const m = new RegExp(`\\b${column}\\s+ENUM\\(([^)]*)\\)`).exec(schema)
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null
}
const constants = await import(pathToFileURL(path.join(ROOT, 'src/constants/index.js')).href)
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
const stored = [
  ['report_type', Object.values(constants.REPORT_TYPES)],
  ['publication_status', Object.values(constants.PUBLICATION_STATUSES)],
  ['pet_size', Object.values(constants.PET_SIZES)],
  ['pet_sex', Object.values(constants.PET_SEXES)],
  ['role', Object.values(constants.ROLES)],
  ['admin_level', Object.values(constants.ADMIN_LEVELS)],
]
for (const [column, values] of stored) {
  const fromSchema = enumOf(column)
  check('I18N-16', `${column}: the interface's values are the database's own`, Boolean(fromSchema) && same(fromSchema, values),
    `${values.join('/')} vs ${fromSchema?.join('/')}`)
}
const statusEnum = /\bstatus\s+ENUM\('active'[^)]*\)/.exec(schema)?.[0]
check('I18N-16', 'report status: the interface\'s values are the database\'s own',
  Boolean(statusEnum) && same([...statusEnum.matchAll(/'([^']+)'/g)].map((x) => x[1]), Object.values(constants.REPORT_STATUSES)))

const snapshot = () => ({
  values: JSON.stringify([constants.REPORT_TYPES, constants.REPORT_STATUSES, constants.PUBLICATION_STATUSES, constants.SPECIES]),
  words: [constants.PUBLICATION_STATUS_LABELS.pending_review, constants.REPORT_STATUS_LABELS.active, constants.REPORT_TYPE_LABELS.lost, constants.speciesLabel('dog')],
})
i18n.setLanguage('en')
const inEnglish = snapshot()
i18n.setLanguage('fil')
const inFilipino = snapshot()
i18n.setLanguage('en')
check('I18N-16', 'switching to Filipino changes the words, not the stored values',
  inEnglish.values === inFilipino.values && inEnglish.words.every((word, index) => word !== inFilipino.words[index]),
  `${inEnglish.words.join('/')} → ${inFilipino.words.join('/')}`)
check('I18N-16', 'pending_review reads "Hinihintay ang pagsusuri" in Filipino', inFilipino.words[0] === 'Hinihintay ang pagsusuri', inFilipino.words[0])

// ------------------------------------------------------------- I18N-T
// One Filipino word per status: wherever the dictionaries name a status in a
// heading-sized phrase, it is the word labels.* defines, never a variant.
const VARIANTS = {
  Nakalathala: ['Nailathala na', 'Na-publish'],
  'Hinihintay ang pagsusuri': ['Naghihintay ng pagsusuri', 'Pending review'],
  'Hindi inaprubahan': ['Tinanggihan ang report', 'Hindi naaprubahan'],
  'Naibalik na': ['Naisauli'],
  'Posibleng Tugma': ['Posibleng Katugma', 'Possible Match'],
}
const filText = [...filLeaves.values()].join('\n')
const variantsFound = Object.values(VARIANTS).flat().filter((variant) => filText.includes(variant))
check('I18N-T1', 'no second Filipino word for a status anywhere in the dictionaries', variantsFound.length === 0, variantsFound.join(', '))
const statusWords = ['caseStatus', 'publication', 'reportType'].flatMap((group) => Object.values(fil.labels[group]))
check('I18N-T2', 'each status, type and publication state has one distinct Filipino word',
  new Set(statusWords).size === statusWords.length,
  statusWords.join(' / '))

// ------------------------------------------------------------- I18N-B
const assets = path.join(ROOT, 'dist', 'assets')
if (!existsSync(assets)) {
  check('I18N-B', 'the production bundle carries both languages', false, 'no dist/ — run npm run build first')
} else {
  const bundle = readdirSync(assets).filter((name) => name.endsWith('.js')).map((name) => readFileSync(path.join(assets, name), 'utf8')).join('\n')
  check('I18N-B', 'the production bundle carries both languages',
    bundle.includes(en.disclaimer.sections.payments.title) && bundle.includes(fil.disclaimer.sections.payments.title),
    `"${en.disclaimer.sections.payments.title}" and "${fil.disclaimer.sections.payments.title}"`)
}

// ------------------------------------------------------------- I18N-D
let lintOk = true
try {
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules/eslint/bin/eslint.js'), '--rule', '{"no-dupe-keys":"error"}', 'src/i18n'], { cwd: ROOT, encoding: 'utf8' })
} catch {
  lintOk = false
}
check('I18N-D', 'no duplicate keys in the dictionaries', lintOk)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
