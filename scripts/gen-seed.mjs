// Generates database/seed.sql from the mock data the frontend has been using,
// so the database starts with exactly the demo the team already knows.
//
// The mock files are ES modules that import image assets and '@/constants'.
// Node cannot resolve either, so each file is rewritten into a temp module:
//   '@/constants'        -> the real file URL
//   '@/assets/foo.jpg'   -> the string "foo.jpg" (which is what image_path stores)

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

// Derived from this file's own location, not hard-coded: the folder is named
// differently on different machines, and a fixed path meant the generator only
// ran on the computer it was written on.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').split(path.sep).join('/')
const TMP = path.join(process.env.TEMP || '.', 'pawsseed')
fs.mkdirSync(TMP, { recursive: true })

const constantsUrl = pathToFileURL(`${ROOT}/src/constants/index.js`).href

async function load(name) {
  let src = fs.readFileSync(`${ROOT}/src/mock/${name}.js`, 'utf8')
  src = src.replace(/from ['"]@\/constants['"]/g, `from '${constantsUrl}'`)
  src = src.replace(
    /import\s+(\w+)\s+from\s+['"]@\/assets\/([^'"]+)['"]\s*;?/g,
    (_m, id, file) => `const ${id} = ${JSON.stringify(file)};`,
  )
  const out = path.join(TMP, `${name}.mjs`)
  fs.writeFileSync(out, src)
  return import(pathToFileURL(out).href)
}

// --- SQL helpers -----------------------------------------------------------
const q = (v) =>
  v === null || v === undefined || v === ''
    ? 'NULL'
    : `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
const n = (v) => (v === null || v === undefined ? 'NULL' : Number(v))
const b = (v) => (v ? 'TRUE' : 'FALSE')
// '2026-08-11T03:41:00.000Z' -> '2026-08-11 03:41:00'
const ts = (v) => (v ? q(String(v).replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '')) : 'NULL')
const dateOnly = (v) => (v ? q(String(v).slice(0, 10)) : 'NULL')

// A real bcrypt hash from PHP, so login works the moment the API exists.
const DEMO_PASSWORD = 'demo1234'
const hash = execFileSync('C:/xampp/php/php.exe', [
  '-r',
  `echo password_hash('${DEMO_PASSWORD}', PASSWORD_DEFAULT);`,
]).toString().trim()

// --- Load ------------------------------------------------------------------
const { users } = await load('users')
const { petReports } = await load('petReports')
const { matches } = await load('matches')
const { notifications } = await load('notifications')
const { moderationCases } = await load('moderationCases')

// --- ID maps: mock uses strings, the schema uses AUTO_INCREMENT ints -------
// Reports and matches keep the number from their mock id, so 'report-009' is
// report_id 9 and the team can cross-reference the two datasets while
// debugging. The mock array is NOT in id order (report-009 was appended last),
// so position would have silently renumbered them.
const num = (id) => Number(String(id).split('-').pop())

// Users cannot use the suffix — 'user-001' and 'staff-001' would collide — so
// they are numbered by array order, which is already users, staff, admin.
const userId = new Map(users.map((u, i) => [u.id, i + 1]))
const reportId = new Map(petReports.map((r) => [r.id, num(r.id)]))
const matchId = new Map(matches.map((m) => [m.id, num(m.id)]))

// schema.sql seeds these in this exact order, so the ids are known.
const categoryId = { dog: 1, cat: 2, bird: 3, rabbit: 4, other: 5 }
const seededBreeds = [
  ['dog', 'Aspin (Philippine Native Dog)'], ['dog', 'Shih Tzu'],
  ['dog', 'Labrador Retriever'], ['dog', 'Chihuahua'],
  ['dog', 'Pomeranian'], ['dog', 'Golden Retriever'],
  ['cat', 'Puspin (Philippine Domestic Shorthair)'], ['cat', 'Persian'],
  ['cat', 'Siamese'], ['bird', 'Cockatiel'], ['bird', 'Lovebird'],
  ['rabbit', 'Holland Lop'],
]
const breedId = new Map(seededBreeds.map(([sp, name], i) => [`${sp}|${name}`, i + 1]))

// Any breed in the reports that schema.sql did not seed gets appended.
const extraBreeds = []
let nextBreed = seededBreeds.length + 1
for (const r of petReports) {
  if (!r.breed) continue
  const key = `${r.species}|${r.breed}`
  if (!breedId.has(key)) {
    breedId.set(key, nextBreed)
    extraBreeds.push([nextBreed, categoryId[r.species] ?? 5, r.breed])
    nextBreed += 1
  }
}

// --- Build -----------------------------------------------------------------
const L = []
L.push('-- =============================================================================')
L.push('-- Paws&Found — seed data')
L.push('--')
L.push('-- GENERATED from src/mock/ by scripts/gen-seed.mjs. Do not hand-edit: change')
L.push('-- the mock data and regenerate, so the frontend demo and the database stay')
L.push('-- identical.')
L.push('--')
L.push('-- Run AFTER database/schema.sql, which creates the tables and seeds the')
L.push('-- categories and breeds this file depends on.')
L.push('--')
L.push(`-- Every demo account's password is "${DEMO_PASSWORD}" (bcrypt via PHP's`)
L.push('-- password_hash). Fictional accounts for demonstration only.')
L.push('-- =============================================================================')
L.push('')
L.push('USE pawsandfound;')
L.push('')
L.push('-- Re-runnable: clear in reverse dependency order first.')
L.push('--')
L.push('-- audit_logs and login_attempts are cleared here rather than left to')
L.push('-- cascade. login_attempts would go with its account anyway, but')
L.push('-- audit_logs is ON DELETE SET NULL — the trail deliberately outlives the')
L.push('-- accounts it describes — so reseeding would otherwise leave every')
L.push('-- previous run\'s sign-ins behind. Resetting the demonstration should')
L.push('-- produce the same database every time, including an empty log.')
L.push('DELETE FROM audit_logs;')
L.push('DELETE FROM login_attempts;')
L.push('DELETE FROM privacy_consents;')
L.push('DELETE FROM moderation_cases;')
L.push('DELETE FROM notifications;')
L.push('DELETE FROM status_logs;')
L.push('DELETE FROM match_signals;')
L.push('DELETE FROM match_claims;')
L.push('DELETE FROM report_images;')
L.push('DELETE FROM pet_reports;')
L.push('DELETE FROM locations;')
L.push('DELETE FROM users;')
L.push('')

if (extraBreeds.length) {
  L.push('-- Breeds present in the demo data but not seeded by schema.sql.')
  L.push('-- INSERT IGNORE so this file stays re-runnable: schema.sql owns the first')
  L.push('-- twelve breeds and this seed does not delete them.')
  L.push('INSERT IGNORE INTO pet_breeds (breed_id, category_id, breed_name) VALUES')
  L.push(extraBreeds.map(([id, cat, name]) => `  (${id}, ${cat}, ${q(name)})`).join(',\n') + ';')
  L.push('')
}

// users
L.push('-- 10 accounts: 7 community members, 2 coordinators, 1 administrator.')
L.push('INSERT INTO users (user_id, full_name, email, password_hash, contact_number, role, account_status, preferred_location, created_at) VALUES')
L.push(users.map((u, i) =>
  `  (${i + 1}, ${q(u.fullName)}, ${q(u.email)}, ${q(hash)}, ${q(u.phone)}, ${q(u.role)}, ` +
  `${q(u.accountStatus ?? 'active')}, ${q(u.preferredLocation)}, ${ts(u.createdAt) === 'NULL' ? 'CURRENT_TIMESTAMP' : ts(u.createdAt)})`
).join(',\n') + ';')
L.push('')

// Every account carries the acknowledgement it would have given when it
// registered. Without this, a reseeded demonstration shows ten accounts and no
// consent on file — which reads as a bug in the very thing the consent record
// exists to prove.
L.push('-- The privacy acknowledgement each demonstration account gave when it')
L.push('-- registered, dated to the account rather than to today.')
L.push('INSERT INTO privacy_consents (user_id, notice_version, consented_at) VALUES')
L.push(users.map((u, i) =>
  `  (${i + 1}, '2026-09-23', ${ts(u.createdAt) === 'NULL' ? 'CURRENT_TIMESTAMP' : ts(u.createdAt)})`
).join(',\n') + ';')
L.push('')

// locations — one per report, numbered by the report's own id. The report
// row below points at location_id = report_id, so numbering these by their
// position in the file instead put 17 of 32 reports at another report's
// place wherever src/mock/ is not in id order (report-010 sits before 008).
L.push('-- One location per report. Coordinates are barangay-level (approximate).')
L.push('INSERT INTO locations (location_id, label, city, province, latitude, longitude, `precision`) VALUES')
L.push(petReports.map((r) => {
  const l = r.location
  return `  (${reportId.get(r.id)},${q(l.label)}, ${q(l.city)}, ${q(l.province)}, ${n(l.lat)}, ${n(l.lng)}, ${q(l.precision ?? 'approximate')})`
}).join(',\n') + ';')
L.push('')

// pet_reports
L.push('-- 24 reports across both types, five species, four statuses and many regions.')
L.push('INSERT INTO pet_reports (report_id, user_id, category_id, breed_id, location_id, report_type, status, pet_name, pet_size, pet_sex, primary_color, secondary_color, distinct_features, description, has_collar, pet_condition, incident_date, incident_time, allow_platform_contact, show_phone, show_email, created_at, updated_at) VALUES')
L.push(petReports.map((r) => {
  const id = reportId.get(r.id)
  const cp = r.contactPreferences ?? {}
  const bId = r.breed ? breedId.get(`${r.species}|${r.breed}`) ?? 'NULL' : 'NULL'
  const collar = r.hasCollar === 'yes' || r.hasCollar === 'no' ? r.hasCollar : 'unknown'
  const created = r.statusHistory?.[0]?.createdAt ?? r.incidentDate
  return `  (${id}, ${userId.get(r.reporterId)}, ${categoryId[r.species] ?? 5}, ${bId}, ${id}, ` +
    `${q(r.reportType)}, ${q(r.status)}, ${q(r.petName)}, ${q(r.size)}, ${q(r.sex ?? 'unknown')}, ` +
    `${q(r.primaryColor)}, ${q(r.secondaryColor)}, ${q(r.distinctiveMarkings)}, ${q(r.description)}, ` +
    `${q(collar)}, ${q(r.condition)}, ${dateOnly(r.incidentDate)}, ${r.incidentTime ? q(r.incidentTime + ':00') : 'NULL'}, ` +
    `${b(cp.allowPlatformContact)}, ${b(cp.showPhone)}, ${b(cp.showEmail)}, ${ts(created)}, ${ts(r.updatedAt ?? created)})`
}).join(',\n') + ';')
L.push('')

// report_images
const images = []
petReports.forEach((r) => {
  ;(r.photos ?? []).forEach((p) => {
    if (!p.url) return // report-009 (the scam report) was filed with no photo
    images.push([reportId.get(r.id), p.url, p.alt, p.isPrimary])
  })
})
L.push(`-- ${images.length} photographs. report-009 has none: the scam report was filed`)
L.push('-- without one, which is part of why it was flagged.')
L.push('INSERT INTO report_images (report_id, image_path, alt_text, is_primary_photo) VALUES')
L.push(images.map(([rid, url, alt, prim]) =>
  `  (${rid}, ${q(url)}, ${q(alt)}, ${b(prim)})`).join(',\n') + ';')
L.push('')

// match_claims
L.push('-- Possible pairings, with the score the matching algorithm produced.')
L.push('INSERT INTO match_claims (match_id, lost_report_id, found_report_id, submitted_by_user_id, reviewed_by_user_id, match_score, match_status, proof_notes, staff_notes, created_at, updated_at) VALUES')
L.push(matches.map((m) =>
  `  (${matchId.get(m.id)}, ${reportId.get(m.lostReportId)}, ${reportId.get(m.foundReportId)}, ` +
  `${m.submittedByUserId ? userId.get(m.submittedByUserId) : 'NULL'}, ` +
  `${m.reviewedByStaffId ? userId.get(m.reviewedByStaffId) : 'NULL'}, ` +
  `${n(m.score)}, ${q(m.status)}, ${q(m.proofNotes)}, ${q(m.staffNotes)}, ${ts(m.createdAt)}, ${ts(m.updatedAt)})`
).join(',\n') + ';')
L.push('')

// match_signals
const signals = []
matches.forEach((m) => {
  ;(m.signals ?? []).forEach((s) =>
    signals.push([matchId.get(m.id), s.key, s.matched, s.weight, s.detail]))
})
L.push('-- Why each match scored what it scored — one row per compared characteristic.')
L.push('-- This is what makes the matching explainable rather than a black box.')
L.push('INSERT INTO match_signals (match_id, signal_key, is_matched, weight, detail) VALUES')
L.push(signals.map(([mid, key, matched, weight, detail]) =>
  `  (${mid}, ${q(key)}, ${b(matched)}, ${n(weight)}, ${q(detail)})`).join(',\n') + ';')
L.push('')

// status_logs
const logs = []
petReports.forEach((r) => {
  let previous = null
  ;(r.statusHistory ?? []).forEach((e) => {
    logs.push([reportId.get(r.id), e.actorId ? userId.get(e.actorId) : null, previous, e.status, e.note, e.createdAt])
    previous = e.status
  })
})
L.push('-- Case history. Appended to, never overwritten, so a case stays auditable.')
L.push('INSERT INTO status_logs (report_id, updated_by_user_id, previous_status, new_status, note, created_at) VALUES')
L.push(logs.map(([rid, uid, prev, next, note, at]) =>
  `  (${rid}, ${uid ?? 'NULL'}, ${q(prev)}, ${q(next)}, ${q(note)}, ${ts(at)})`).join(',\n') + ';')
L.push('')

// notifications
L.push('-- Notifications for members and coordinators.')
L.push('INSERT INTO notifications (user_id, notification_type, title, body, report_id, match_id, is_read, created_at) VALUES')
L.push(notifications.map((x) =>
  `  (${userId.get(x.userId)}, ${q(x.type)}, ${q(x.title)}, ${q(x.body)}, ` +
  `${x.reportId ? reportId.get(x.reportId) : 'NULL'}, ${x.matchId ? matchId.get(x.matchId) : 'NULL'}, ` +
  `${b(x.isRead)}, ${ts(x.createdAt)})`).join(',\n') + ';')
L.push('')

// moderation_cases
L.push('-- Community flags for an administrator to decide on.')
L.push('INSERT INTO moderation_cases (report_id, reported_by_user_id, reason, details, case_status, resolved_by_admin_id, resolution_note, created_at) VALUES')
L.push(moderationCases.map((c) =>
  `  (${reportId.get(c.reportId)}, ${c.reportedByUserId ? userId.get(c.reportedByUserId) : 'NULL'}, ` +
  `${q(c.reason)}, ${q(c.details)}, ${q(c.status)}, ` +
  `${c.resolvedByAdminId ? userId.get(c.resolvedByAdminId) : 'NULL'}, ` +
  `${q(c.resolutionNote)}, ${ts(c.createdAt)})`).join(',\n') + ';')
L.push('')

fs.writeFileSync(`${ROOT}/database/seed.sql`, L.join('\n'))

console.log('users            ', users.length)
console.log('locations        ', petReports.length)
console.log('pet_reports      ', petReports.length)
console.log('report_images    ', images.length)
console.log('match_claims     ', matches.length)
console.log('match_signals    ', signals.length)
console.log('status_logs      ', logs.length)
console.log('notifications    ', notifications.length)
console.log('moderation_cases ', moderationCases.length)
console.log('extra breeds     ', extraBreeds.length, extraBreeds.map((e) => e[2]).join(', '))
console.log('\nwrote database/seed.sql')
