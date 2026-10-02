/**
 * No mock data in anything that ships.
 *
 *   npm run test:contract
 *
 * Every workflow in the application reads and writes MySQL through the PHP
 * API. Until October 2026 the production bundle still carried the whole
 * `src/mock/` dataset anyway: three services imported the old in-browser mock
 * database for a small error class, and that import dragged fake users, pets
 * and notifications into the JavaScript every visitor downloads. Nothing used
 * them, but anyone reading the source could reasonably ask why a system that
 * claims to be database-backed ships a second, fake dataset.
 *
 * This is the source-level half of the guard: the architectural rule, checked
 * on every run. The other half, `npm run check:bundle`, proves the built
 * bundle itself is clean.
 */
const { default: test } = await import('node:test')
const { default: assert } = await import('node:assert/strict')
const { existsSync, readdirSync, readFileSync, statSync } = await import('node:fs')
const { join, relative } = await import('node:path')
const { fileURLToPath } = await import('node:url')

const PROJECT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(PROJECT, 'src')

/** Every .js/.jsx file under src/, except the mock dataset itself. */
function sourceFiles(dir = SRC) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return path === join(SRC, 'mock') ? [] : sourceFiles(path)
    }
    return /\.jsx?$/.test(name) ? [path] : []
  })
}

const files = sourceFiles().map((path) => ({
  name: relative(PROJECT, path).replaceAll('\\', '/'),
  text: readFileSync(path, 'utf8'),
}))

test('the in-browser mock database is gone', () => {
  assert.equal(existsSync(join(SRC, 'services', 'mockDb.js')), false,
    'src/services/mockDb.js has come back')
})

test('nothing in src/ statically imports the mock dataset or the mock database', () => {
  // A static import is always bundled, whatever code path uses it.
  const pattern = /\bfrom\s+['"](?:@\/mock(?:\/[^'"]*)?|(?:\.\.?\/)+mock(?:\/[^'"]*)?|\.\/mockDb)['"]/
  const offenders = files.filter((file) => pattern.test(file.text)).map((file) => file.name)
  assert.deepEqual(offenders, [], `static mock import in: ${offenders.join(', ')}`)
})

test('the mock dataset is only ever loaded inside a development-only branch', () => {
  // `import.meta.env.DEV` is replaced with `false` in a production build, so a
  // dynamic import inside that branch is removed along with it. Outside it,
  // Vite would emit the dataset as a separate chunk and ship it.
  const offenders = []
  for (const file of files) {
    const lines = file.text.split('\n')
    lines.forEach((line, index) => {
      if (!/import\(\s*['"]@\/mock['"]\s*\)/.test(line)) return
      const before = lines.slice(Math.max(0, index - 4), index + 1).join('\n')
      if (!/if\s*\(\s*import\.meta\.env\.DEV\s*\)/.test(before)) {
        offenders.push(`${file.name}:${index + 1}`)
      }
    })
  }
  assert.deepEqual(offenders, [], `mock dataset loaded outside a DEV branch at: ${offenders.join(', ')}`)
})
