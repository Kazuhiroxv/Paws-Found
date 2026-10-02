/**
 * Proves the production bundle carries none of the mock dataset.
 *
 *   npm run build
 *   npm run check:bundle
 *
 * The source-level rule in no-mock-in-production.test.mjs stops the import
 * that used to drag `src/mock/` into the bundle. This checks the result
 * instead of the intention: it reads what Vite actually emitted into dist/.
 *
 * The markers are taken from the mock dataset itself rather than written out
 * here — every mock record id ('user-002', 'notif-001' …) and the opening of
 * every mock description — so the check follows the data if it changes,
 * instead of watching for one name that might be edited away.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT = fileURLToPath(new URL('..', import.meta.url))
const MOCK = join(PROJECT, 'src', 'mock')
const ASSETS = join(resolve(PROJECT, process.argv[2] ?? 'dist'), 'assets')

if (!existsSync(ASSETS)) {
  console.error(`No build found at ${ASSETS}. Run \`npm run build\` first.`)
  process.exit(2)
}

const mockSource = readdirSync(MOCK)
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(join(MOCK, name), 'utf8'))
  .join('\n')

// Mock ids have a shape the database never produces: the API's ids are
// integers. Descriptions are long, distinctive sentences; the first 40
// characters are enough to identify one and short enough to survive minifying.
const ids = [...mockSource.matchAll(/\bid:\s*['"]([a-z]+-\d{3,})['"]/g)].map((m) => m[1])
const descriptions = [...mockSource.matchAll(/\bdescription:\s*['"]([^'"]{40,})/g)]
  .map((m) => m[1].slice(0, 40))
const markers = [...new Set([...ids, ...descriptions])]

if (markers.length < 10) {
  console.error(`Only ${markers.length} markers found in src/mock/ — the check would prove nothing.`)
  process.exit(2)
}

const bundle = readdirSync(ASSETS)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, text: readFileSync(join(ASSETS, name), 'utf8') }))

const found = []
for (const marker of markers) {
  for (const file of bundle) {
    if (file.text.includes(marker)) found.push(`${marker}  (in ${file.name})`)
  }
}

console.log(`Checked ${bundle.length} bundle file(s) for ${markers.length} mock markers ` +
  `(${ids.length} record ids, ${descriptions.length} descriptions).`)

if (found.length > 0) {
  console.log(`\nFAIL  mock data is in the production bundle:`)
  for (const line of found.slice(0, 20)) console.log(`  ${line}`)
  if (found.length > 20) console.log(`  … and ${found.length - 20} more`)
  process.exit(1)
}

console.log('PASS  no mock data in the production bundle.')
