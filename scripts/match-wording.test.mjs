/**
 * How a settled pairing is described.
 *
 *   npm run test:contract
 *
 * A pairing is stored as dismissed both when a reporter says "Not my pet" and
 * when it is withdrawn because one of its reports was finished (Returned or
 * Closed). The coordinator's queue and the report page used to call every one
 * of them "Ruled out · by the reporter" or "Dismissed by User", even when
 * nobody had ruled anything out. wasWithdrawn() tells them apart by the reports.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { MATCH_STATUSES, REPORT_STATUSES, wasWithdrawn } from '../src/constants/index.js'

const open = { status: REPORT_STATUSES.ACTIVE }
const returned = { status: REPORT_STATUSES.RETURNED }
const closed = { status: REPORT_STATUSES.CLOSED }

test('a dismissed pairing with a finished report was withdrawn', () => {
  assert.equal(wasWithdrawn(MATCH_STATUSES.DISMISSED, returned, open), true)
  assert.equal(wasWithdrawn(MATCH_STATUSES.DISMISSED, open, closed), true)
})

test('a dismissed pairing with both reports still open was a reporter saying no', () => {
  assert.equal(wasWithdrawn(MATCH_STATUSES.DISMISSED, open, open), false)
  assert.equal(wasWithdrawn(MATCH_STATUSES.DISMISSED, open, { status: REPORT_STATUSES.POSSIBLE_MATCH }), false)
})

test('only a dismissal can be a withdrawal, and missing reports are safe', () => {
  assert.equal(wasWithdrawn(MATCH_STATUSES.REJECTED, returned, open), false)
  assert.equal(wasWithdrawn(MATCH_STATUSES.CONFIRMED, returned, returned), false)
  assert.equal(wasWithdrawn(MATCH_STATUSES.DISMISSED, null, undefined), false)
})
