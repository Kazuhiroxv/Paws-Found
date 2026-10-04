/**
 * Hard-coded English left in the interface (Correction 7).
 *
 * After the move to `src/i18n`, words a person reads come from the
 * dictionaries. This finds the ones that do not: text between JSX tags, and
 * string literals given to the attributes and object fields a person reads
 * (label, title, placeholder, aria-label, alt, hint, description, …).
 *
 * Deliberately forgiving: comments, class names, URLs, codes and the
 * allowlist below are ignored, and punctuation never matters. It looks for
 * runs of letters that read as words, so a changed comma cannot fail it.
 *
 *   node scripts/i18n-scan.mjs            report, exit 1 if anything is found
 *   node scripts/i18n-scan.mjs --list     the same, without failing
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..', 'src')

/** Not translated on purpose. Kept short and explained in docs/localization.md. */
const ALLOW = [
  'Paws&Found', 'Paws&amp;Found', 'OpenStreetMap', 'PSGC', 'GCash', 'AM', 'PM', 'JPEG', 'PNG', 'WebP', 'MB',
  'Metro Manila', 'Mapúa University', 'ITS122P', 'Group 3', 'English', 'Filipino', 'Admin', 'Email', 'Logs',
  'Super Administrator', 'Pet Coordinator', 'Moderator', 'Manager', 'Administrator',
]

/** Files that never reach a person: development scaffolding and the mock dataset. */
const SKIP_FILES = [
  'components/DemoRoleSelector.jsx', // development only; removed from the production bundle
  'i18n/', 'mock/',
]

const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = path.relative(ROOT, full).replaceAll('\\', '/')
    if (SKIP_FILES.some((skip) => rel.startsWith(skip) || rel === skip)) continue
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.jsx$/.test(name)) files.push([full, rel])
  }
})(ROOT)

/** Remove comments, keeping line numbers. */
function stripComments(text) {
  return text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, lead) => lead + ' '.repeat(m.length - lead.length))
}

const WORDS = /[A-Za-z][a-z]+(?:[ ,.'’-]+[A-Za-z][a-z]*){1,}/ // two or more words
const ATTRS = 'label|title|placeholder|aria-label|alt|hint|description|eyebrow|confirmLabel|cancelLabel|message|text|heading|body|countLabel'

/** Tailwind classes and other code that happens to contain words. */
const CODE = /\b(?:bg|text|border|size|max|min|rounded|shadow|hover|ring|px|py|pt|pb|h|w|gap|flex|grid|object|font|opacity)-|=>|\.length\b|\?\?|&&|\|\|/

function allowed(text) {
  // Code, and example addresses (you@example.com) — not sentences.
  if (CODE.test(text) || text.includes('@')) return true
  let rest = text
  for (const word of ALLOW) rest = rest.replaceAll(word, '')
  return !WORDS.test(rest)
}

/**
 * Two deliberate exceptions, marked where they are: a block between
 * `i18n-ignore-start` and `i18n-ignore-end` comments (development-only
 * scaffolding, removed from the production build), and a line carrying
 * `i18n: stored` — words saved into the database, which stay in one language
 * whoever saved them.
 */
function blankIgnored(text) {
  return text
    .replace(/i18n-ignore-start[\s\S]*?i18n-ignore-end/g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (line.includes('i18n: stored') ? '' : line))
    .join('\n')
}

/** Identifiers, member access and import lists: code, not words. */
const CODE_LINE = /^\s*[\w.?]+(?:\s+as\s+\w+)?(?:,\s*[\w.?]+(?:\s+as\s+\w+)?)*,?\s*$/

const findings = []
for (const [full, rel] of files) {
  const lines = stripComments(blankIgnored(readFileSync(full, 'utf8'))).split('\n')
  lines.forEach((line, index) => {
    if (CODE_LINE.test(line)) return
    const report = (text) => {
      if (!allowed(text)) findings.push(`${rel}:${index + 1}: ${text.trim().slice(0, 90)}`)
    }
    // Text between tags on one line: >Some words<
    for (const m of line.matchAll(/>([^<>{}]*[A-Za-z]{2,}[^<>{}]*)</g)) report(m[1])
    // A line that is only JSX text (a wrapped sentence).
    if (/^\s+[A-Za-z][^<>{}=;()'"`]*$/.test(line) && !/^\s*(import|export|return|const|let|if|else|case|default|from|await|async|function|throw)\b/.test(line)
        && !/^\s*[a-zA-Z_.]+\s*$/.test(line) && !/^\s*[\w-]+=/.test(line)
        && !/^\s*[\w.]+\s*:\s/.test(line) && !/^\s*delete\b/.test(line)) report(line)
    // label="Words" and label: 'Words'
    for (const m of line.matchAll(new RegExp(`\\b(?:${ATTRS})(?:=|:\\s*)["'\`]([^"'\`]*[A-Za-z]{2,}[^"'\`]*)["'\`]`, 'g'))) report(m[1])
    // Template strings and quoted strings inside JSX expressions that read as sentences.
    for (const m of line.matchAll(/[?:(]\s*['"`]([A-Z][a-z]+(?: [^'"`]+)+)['"`]/g)) report(m[1])
  })
}

if (findings.length) {
  console.log(findings.join('\n'))
  console.log(`\n${findings.length} possible hard-coded strings`)
  if (!process.argv.includes('--list')) process.exit(1)
} else {
  console.log('No hard-coded interface text found.')
}
