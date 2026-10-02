/**
 * The browser's copy of the name and password-identity rules, held to the
 * server's.
 *
 *   npm run test:contract
 *
 * The server decides (api/helpers.php); the form only says it sooner. These
 * cases live in scripts/identity-cases.json, which scripts/identity_rules.php
 * runs against the PHP rules — so every case here is checked on both sides,
 * and the two copies cannot quietly come to disagree.
 *
 * Post-defense Correction 2: first and last name separately, and a password
 * that may not contain either one anywhere.
 */
const { default: test } = await import('node:test')
const { default: assert } = await import('node:assert/strict')
const { readFileSync } = await import('node:fs')
const { nameProblem } = await import('@/utils/nameRules')
const { passwordChecks } = await import('@/utils/passwordRules')

const cases = JSON.parse(readFileSync(new URL('./identity-cases.json', import.meta.url), 'utf8'))

test('every name the server accepts, the form accepts', () => {
  for (const [first, last] of cases.names_accepted) {
    assert.equal(nameProblem(first, 'first'), null, `first name "${first}"`)
    assert.equal(nameProblem(last, 'last'), null, `last name "${last}"`)
  }
})

test('every name the server refuses, the form refuses', () => {
  for (const bad of cases.names_refused) {
    assert.notEqual(nameProblem(bad, 'first'), null, `first name "${bad}"`)
  }
})

test('a password containing the first or last name is refused exactly where the server refuses it', () => {
  for (const { first, last, password, accepted } of cases.passwords) {
    const identity = { email: 'person@example.com', firstName: first, lastName: last }
    const nameCheck = passwordChecks(password, password, { identity }).find((check) => check.id === 'name')
    assert.equal(nameCheck.met, accepted, `${first} / ${last}: "${password}" should be ${accepted ? 'accepted' : 'refused'}`)
  }
})

test('the rule is case-insensitive and needs no name to be known', () => {
  const checks = passwordChecks('SECURE-JA-PASSWORD', '', { confirm: false, identity: { email: '', firstName: 'Ja', lastName: 'Lim' } })
  assert.equal(checks.find((check) => check.id === 'name').met, false)

  // A reset link does not tell the form who is choosing; the server checks it.
  const anonymous = passwordChecks('maria-santos-passphrase', '', { confirm: false })
  assert.equal(anonymous.some((check) => check.id === 'name'), false)
})
