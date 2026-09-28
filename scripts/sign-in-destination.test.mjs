/**
 * Where sign-in sends somebody, given where the route guard says they were
 * headed.
 *
 *   npm run test:contract
 *
 * Signing out inside a workspace leaves that workspace as the way back, and
 * the next person to sign in on the same browser may hold a different role.
 * These pin down that the way back is honoured only when the new role can
 * open it. The guards are not tested here: they are unchanged, and the a11y
 * suite already fails if a signed-in page bounces.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { destinationAfterSignIn } from '../src/constants/navigation.js'
import { ROLES } from '../src/constants/index.js'

test('another role\'s workspace is never restored; the role\'s own home is used', () => {
  assert.equal(destinationAfterSignIn(ROLES.USER, '/staff/verification'), '/dashboard')
  assert.equal(destinationAfterSignIn(ROLES.USER, '/admin'), '/dashboard')
  assert.equal(destinationAfterSignIn(ROLES.STAFF, '/dashboard/matches'), '/staff')
  assert.equal(destinationAfterSignIn(ROLES.STAFF, '/admin/users'), '/staff')
  assert.equal(destinationAfterSignIn(ROLES.ADMIN, '/staff'), '/admin')
  assert.equal(destinationAfterSignIn(ROLES.ADMIN, '/dashboard'), '/admin')
})

test('a way back the role can open is kept, and no way back means home', () => {
  assert.equal(destinationAfterSignIn(ROLES.USER, '/dashboard/matches'), '/dashboard/matches')
  assert.equal(destinationAfterSignIn(ROLES.USER, '/report/lost'), '/report/lost')
  assert.equal(destinationAfterSignIn(ROLES.STAFF, '/staff/verification'), '/staff/verification')
  assert.equal(destinationAfterSignIn(ROLES.ADMIN, '/pet/12'), '/pet/12')
  assert.equal(destinationAfterSignIn(ROLES.USER, undefined), '/dashboard')
  assert.equal(destinationAfterSignIn(ROLES.STAFF, null), '/staff')
})
