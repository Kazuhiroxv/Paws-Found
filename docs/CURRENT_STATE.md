# Current state — read this first

**Written 1 October 2026** for a new Claude session (or person) with no access
to the conversations that produced the last week of work. It says what is
live, what is sitting on the laptop uncommitted, the rules Kyle has set for
changing anything, and how to pick up the next change safely.

A document is a snapshot; the repository is the truth. Run §1 before you trust
any line below.

Deeper reference: [HANDOFF.md](HANDOFF.md) (architecture, database, auth,
email, deployment — written 27 September, still accurate except where this
file says otherwise), [TESTING.md](TESTING.md), [DECISIONS.md](DECISIONS.md),
[../CLAUDE.md](../CLAUDE.md) (course brief and coding rules).

---

## 1. First five minutes

```bash
cd C:\Projects\paws-and-found
git status --short
git branch --show-current          # post-defense/revisions
git fetch portfolio
git log --oneline -5
git log --oneline portfolio/team/current..HEAD   # local commits not yet deployed
curl.exe -s https://paws-found-production.up.railway.app/api/health
```

Expected at the time of writing (4 October, Correction 7): on branch
**`post-defense/revisions`**; production (`portfolio/team/current`) runs
**`2947a43`**. **Do not count the commits by hand — derive them:**

```bash
git log --oneline 2947a43..HEAD
```

At Correction 7 that lists **12 commits**, none pushed or deployed (newest
first):

| # | Commit | Subject |
| --- | --- | --- |
| 12 | *(the Correction 7 commit)* | Correction 7: add localization, disclaimer, and report export |
| 11 | `e87b0b9` | Correction 6A: enforce coordinator-only publication review |
| 10 | `0731b26` | Correction 6: add administrator privilege levels |
| 9 | `29c8aa8` | Correction 5A: harden Railway client IP resolution |
| 8 | `75e67b5` | Correction 5: add session and activity audit logging |
| 7 | `31e87b3` | Correction 4: add reviewed publication workflow and report drafts |
| 6 | `42b802c` | Correction 3A: verify current PSGC reference data |
| 5 | `31bbcab` | Correction 3: improve report data quality and PH location controls |
| 4 | `ad3f622` | docs: instructor feedback, transcribed, and the correction register |
| 3 | `3cce5ea` | Correction 2: strengthen identity, password, and form feedback |
| 2 | `5da6aee` | Correction 1: no mock data in anything that ships |
| 1 | `6abdb56` | WIP checkpoint: reopen after "Not my pet", and the administrator stays in Administration |

(An earlier report said "four commits ahead"; that was wrong — it was eleven
before Correction 7. This table is the corrected inventory; re-run the command
rather than trusting it.) Health `{"status":"ok","database":"ok"}`.
Untracked: `docs/dbeaver-defense-queries.pdf`.

**The local database has migrations `008` to `013` applied** (first and last
name; the report reference data; reviewed publication and drafts; session
records and the activity trail; administrator levels; the removal of the
unused `pet_reports.assigned_staff_id`). The production database has none of
them, and must get all six, in order, immediately before the code is pushed —
see §4a. **Correction 7 adds no migration**; 013 is the final schema cleanup.

---

## 2. Where everything is

| Thing | Value |
| --- | --- |
| Repository | `C:\Projects\paws-and-found`, branch **`team/current`** |
| Production | **https://paws-found-production.up.railway.app** (Railway: PHP 8.3 + Apache, MySQL 9.4) |
| What Railway deploys | remote **`portfolio`** → `Kazuhiroxv/Paws-Found`, branch `team/current`. A push there triggers a build. |
| Team repository | remote **`origin`** → `Arkemic/paws-and-found`. **Its push URL is disabled on purpose** (`DISABLED-do-not-push-to-team-repo`). Do not re-enable it. |
| Last deployed commit | **`2947a43`** "docs: reopening a decision; counts to 689" (bundle `assets/index-C9niofAT.js`) |
| Local stack | XAMPP at `C:\xampp`: Apache + PHP 8.3, **MariaDB 10.4 on port 3307** (not 3306), database `pawsandfound`. Vite dev server on `:5173`. |
| Stack | React 19 + Vite 8 + Tailwind 4 + React Router 7 + Leaflet; PHP REST API in `api/`; MySQL schema `database/schema.sql` (24 tables, 34 FKs, through migration 013) |

---

## 3. What is live in production (as of `2947a43`)

Everything through 30 September is deployed. The last day added, in order:

1. **Profile:** a pending email change is stated plainly ("waiting for verification").
2. **One session at a time for staff and admin.** A privileged sign-in bumps
   `users.session_version`, so any earlier session for that account stops
   working; customers may still be signed in on several devices.
   (`PRIVILEGED_ROLES` in `api/config.php`; `auth_login()` in `api/auth.php`.)
   *Demo hazard:* signing the same staff/admin account in on a second machine
   signs the first one out.
3. **Explore:** the filter sidebar scrolls with the page (no longer sticky).
4. **"Historical comparison" label** on ruled-out pairings. A pairing's score
   and seven reasons are stored once, when it is made (`match_signals`), and
   never recalculated; once ruled out, its reports can be edited, so the old
   reasons are labelled as history.
5. **Password and name rules.** At least 15 characters, at most 72 bytes, not a
   common password, not the person's name or email; a Weak/Fair/Strong meter
   is guidance only. Names: at least two letters; letters, spaces, apostrophes,
   hyphens, periods. One rule each, server and browser kept identical by a
   contract test: `password_policy_error()` / `validate_full_name()` in
   `api/helpers.php` ↔ `src/utils/passwordRules.js` / `src/utils/nameRules.js`.
   Existing accounts keep their old passwords (the seeded `demo1234` still
   signs in).
6. **Reopen for review.** A Pet Coordinator can reopen a pairing they rejected
   or confirmed by mistake, with a required reason both reporters are told.
   Refused if a report has been closed since, or if re-running the comparison
   gives different signals (`comparison_changed`). Confirm and Reject both ask
   first ("Go back" is focused).

The full list since the 27 September handoff is `git log --oneline e97116b..2947a43`
(58 commits).

---

## 4. Finished, committed locally, not in production

**Committed on 2 October** as the checkpoint `6abdb56` on branch
`post-defense/revisions`, at Kyle's instruction, so the instructor's
corrections could start from a clean tree. Not pushed, not deployed. The
description below still applies; only its status changed.

**A. Reopen also covers a reporter's "Not my pet".**
A coordinator can reopen a pairing the owner or finder dismissed. A
*withdrawal* — a pairing dismissed automatically because one of its reports was
marked Returned or Closed — stays final. The two are told apart the way the
queue already labels them: a withdrawn pairing has a finished report
(`wasWithdrawn()` in `src/constants/index.js`).

- `api/matches.php` `reopen_preflight()`: accepts `dismissed`; a withdrawn one
  gets 409 "This pairing was withdrawn because one of its reports was marked
  returned or closed…".
- `src/pages/staff/StaffMatchesPage.jsx`: the Ruled out card shows
  Reopen for review unless the pairing was withdrawn.
- Accepted consequence (in DECISIONS.md): reopening a *confirmed* pairing gives
  the pairings it withdrew open reports again, so they become reopenable one at
  a time.

**B. The administrator stays in Administration.**
A signed-in admin opening `/`, `/explore`, `/report/lost|found`, `/about`,
`/help` or `/privacy` is redirected to `/admin`. `/pet/:id` stays open (admin
pages link to it), as do `/login`, `/register` and the email-link pages.
Interface only — the API is unchanged. *(Since Correction 7, `/privacy` and
`/disclaimer` are no longer redirected: the Privacy Notice update message
links to the notice, so an administrator must be able to read it.)*

- `src/components/RequireAccess.jsx`: new `AdminStaysInWorkspace` layout route.
- `src/App.jsx`: the community routes are nested under it.
- `src/layouts/WorkspaceShell.jsx`: no "Back to the public site" for the
  admin; the logo goes to `/admin`.
- `src/layouts/RootLayout.jsx`: an admin signing out from a report page ends the
  session first, then goes home (otherwise home bounced to `/admin` and then to
  `/login`).

**C. Tests and documents for A and B.**
`scripts/audit_cases.py` (RO-18 now expects 200; RO-19–RO-22 new, the
dog/turtle checks renumbered RO-23–RO-25), `scripts/ui_regressions.mjs`
(REOPEN-3/4, ADMIN-SITE-1–4), `scripts/print_sheets.py` and the regenerated
`docs/diagrams/*-a4.*`, plus README, TESTING, HANDOFF, DECISIONS,
role-permissions, matching-explanation, feature-status, report-corrections,
final-project-guide-requirements, page-inventory, a "Start here" section at
the top of `CLAUDE.md`, and this file.

**D. `docs/dbeaver-defense-queries.pdf` (untracked).** Read-only SQL for DBeaver
to show the database to the instructor. Kyle has not decided whether it goes
into the repository.

**Verified locally on 30 September:** lint clean, build green, contract 29/29,
audit 382/382, UI 66/66, sign-out 24/24, a11y 31 pages with no violations.
Not re-run (they do not touch the changed code): auth lifecycle, multi-device.

**When Kyle says to ship it**, a sensible split is three commits — the reopen
change (A, with its audit checks), the admin change (B, with its UI checks),
then the documents — pushed with `git push portfolio team/current`, followed
by §8's production check.

---

## 4a. Instructor corrections (from 2 October)

After the demonstration, Ma'am gave a list of corrections. Kyle's written notes
are the **master list** (nineteen items). They are being worked one at a time,
each as its own commit on `post-defense/revisions`, in dependency order rather
than the order written. Nothing is pushed until Kyle says so.

**Recordings.** Two recordings of the session were transcribed locally with
Whisper into `docs/feedback/`: `maem-maylyn-raw.txt` and `maem-maylyn2-raw.txt`
(unedited), `instructor-feedback-notes.md` (an interpretation, kept separate
from the raw text), and `post-defense-correction-register.md` — every
correction with its **source**: the audio, Kyle's written notes, or a team
observation (Hayns), so nothing is attributed to Ma'am that she did not say. **The recordings do not cover** the API/database item, the
password-confirmation rule, activity logging, admin levels, Reset or drafts, so
those still come from the written notes alone. They do add seven items the notes
miss (contact number, photo guidance, submit feedback, PDF export of the list,
an XL size, presentation flow, and a date filter that exists but was not found).

| # | Correction | State |
| --- | --- | --- |
| 1 | API should connect to the database | **Done** — audit plus cleanup, see below |
| 2 | Identity, password, form feedback, responsive follow-up | **Done** — see below |
| 3 | Report data quality, PH places, contact safety, report-form quality | **Done** — see below |
| 4 | Drafts, Pet Coordinator review before publication, Removed apart from Closed | **Done** (Cancel awaiting clarification) — see below |
| 5 | Session and IP logging, page/action history, login/logout, "signed out" messages, the sign-out race | **Done** — see below |
| 6 | Different levels of administrator privilege | **Done** (the three levels are the team's design) — see below |
| 7 | Disclaimer, English/Filipino, print / PDF of the report list, Privacy Notice acknowledgement | **Done** — see below |
| 10 | Breed / colour / city / province: suggested values | **Done in Correction 3** |
| others | | Reset and Cancel: **AWAITING CLARIFICATION**; contact number: **AWAITING INSTRUCTOR-INTENT CONFIRMATION**; final ERD: **PENDING FINAL SCHEMA PASS**; final presentation: **PENDING** — the register in `docs/feedback/` is the list |

**Correction 7.** A `/disclaimer` page (academic and non-commercial, no
payments — "Paws&Found does not process payments or financial
transactions." — no affiliation, information from users may be inaccurate,
no guarantee, meeting and handover safety), with short notices in the footer,
on the report form's review step and on a confirmed match's handover; worded
without any claim of immunity. **English and Filipino** for the whole
interface (`src/i18n/`, `docs/localization.md`): a labelled language control,
kept in this browser's `localStorage`, English by default, no database
change; stored values keep their codes and only their labels are translated;
what people typed, notifications, match reasons and emails stay as written.
**Print / Save as PDF** of the report list on Explore, the Pet Coordinator's
Report queue and Administration's Reports — the browser's own print dialog,
every report the current filters select, public fields only, a disclaimer
footer. **Privacy Notice acknowledgement**: an account whose latest consent is
for an older notice version sees a message that does not block anything,
with "Review Privacy Notice" and "Acknowledge"; acknowledging writes a
`privacy_consents` row and a `privacy_notice_acknowledged` activity row
(`POST /api/auth/privacy-acknowledgement`). The notice version stays
2026-10-03. The report list API now also returns `created_at` to signed-in
viewers (not to guests), for the printed "Filed" column. **No migration.**
Administrators can now open `/privacy` and `/disclaimer`.

**Correction 3.** The place is chosen from PSA's PSGC — an *area* (one of
PSA's 82 provinces, or Metro Manila, or BARMM's Special Geographic Area: 84 in
`ph_areas`, each typed), then a city or municipality (1,642 in `ph_cities`)
depending on it;
`locations.city_code` records which place, and the names the report shows are
written by the server. Breed is chosen from the species' listed breeds
(`pet_breeds.is_listed`; a typed breed is kept, never suggested), colour from
`pet_colours` (17). All lists come through `/api/reference`. Size gains
Extra Large (XL). A lost pet's name needs 2 letters or digits; a description
30 characters, counted live. Time is Hour / Minutes / AM or PM on screen,
24-hour in the API. The map is the Philippines and refuses a pin outside it.
A phone number is never published (the API ignores `show_phone`); coordinators
still see it. Photo rules are stated and counted. Matching weights and the
four demonstration scores are unchanged. Field-by-field before/after:
`docs/feedback/correction-3-field-audit.md`; reasons: `docs/DECISIONS.md`;
the place data's provenance: `database/reference/README.md`.

**Correction 3A** (before anything was deployed). Correction 3 called its 84
place entries "provinces" and used PSA's July 2025 file from a public copy.
PSA has **82** provinces and NCR has none: the 84 are 82 provinces plus two
application groupings. Now the table is `ph_areas` with `area_type`
(`province` 82 / `ncr` 1 / `special_area` 1), the API is `/reference/areas`
and takes `area_code`, the form says "Province or Metro Manila", and the data
is PSA's own **30 June 2026** file, downloaded by Kyle (4 municipality names
changed; San Isidro, Davao del Norte is now Sawata). Migration 009 was revised
in place — it had never left this laptop — and `npm run test:migrations` now
proves upgrade = fresh install on MySQL 9.4 and MariaDB. **The contact-number
item (register N1) is IMPLEMENTED, AWAITING INSTRUCTOR-INTENT CONFIRMATION:**
the current behaviour is not a confirmed requirement.

**Correction 4.** A filed report is not published: it waits for a Pet
Coordinator (`pet_reports.publication_status`, migration 010), who approves it
(published, then matched) or marks it not approved with a reason (the reporter
edits and resubmits). Unpublished reports are their reporter's and the
coordinators' only — 404 to anybody else, by URL, list, search or flag.
Matching starts at publication. Removal by an administrator or moderation is
the publication state `removed`, never Closed. Drafts are saved to MySQL
(`report_drafts`) and continued from My reports on any device. History:
`publication_logs` beside `status_logs`. Staff have a **Report review** queue.
Before/after, the state machine and a demonstration sequence:
`docs/feedback/correction-4-lifecycle.md`; reasons: `docs/DECISIONS.md`.
**Cancel** (Ma'am's third decision) is not built: its meaning is unconfirmed.
A saved draft keeps the text and structured report data; **photos must be
added again when the draft is resumed** (the form says so on Save draft).

**Correction 5.** Every successful sign-in is a row in `user_sessions`
(migration 011): account, IP address, browser user agent, start, last seen
(written at most every 5 minutes), end and why — signed out, idle, time limit,
password changed, signed in on another device (coordinator/admin), promoted,
locked, suspended. It is known by a random `session_reference`, never the PHP
session id. `user_activity_logs` records each page a signed-in person opens
(the path only) and every meaningful action, written by the PHP endpoint that
did it; the browser cannot name an action. The browser is told why its session
ended (`session_ended` on `/auth/me` and on any 401) and says so in words. The
cross-tab sign-out race (register D1) is fixed: a check asked for while one is
running is queued, and an answer that started before a sign-in or sign-out in
this tab is discarded. Administrators have **Logs** (Activity / Sessions /
Security events), filtered and paged on the server. `client_ip()` uses
Railway's `X-Real-IP` only when the deployment itself is Railway (Correction
5A: production + `RAILWAY_ENVIRONMENT_ID`; no proxy address range is
trusted), and `REMOTE_ADDR` everywhere else — on Railway every visitor used to
be logged as the proxy. Suspension and lock now end the PHP
session for good (it used to revive on reinstatement). Privacy Notice
2026-10-03. Design, before/after and limitations:
`docs/security-activity-logging.md`.

**Correction 6.** Ma'am asked for "different admin levels of privileges"
without saying which; the team chose three, all `role = 'admin'`, refined by
`users.admin_level` (migration 012): **Moderator** (moderation, removing
published reports), **Manager** (+ suspending, reinstating and unlocking
customers and coordinators, pet categories, contact details), **Super
Administrator** (+ roles, levels, other administrators, and the Logs). Pet
Coordinators stay `staff`, outside the hierarchy.
**Correction 6A:** only Pet Coordinators approve or reject a report before
it is published; every administrator level gets 403 and no button (Ma'am's
"pet coordinator muna sa reports bago mapost"; Correction 4 and 6 had left
an administrator able to approve from a report's page). Suspension and lock
now also bump `session_version`, so an idle session does not revive on
reinstatement. Endpoints ask for a
capability (`require_capability()`, `ADMIN_CAPABILITIES` in
`api/helpers.php`); `/auth/me` sends an administrator their capabilities, and
the interface asks `can()`. Nobody changes their own role, level or status;
promotion to administrator needs a level chosen on purpose; a level change or
removing the role ends that account's sessions (`privilege_changed`); there is
always an active Super Administrator (row locks against two simultaneous
demotions). Existing administrators became Super Administrators. The matrix
and every role's limits: `docs/role-permissions.md` §0–§0a. Found on the way:
the Users page's Suspend never sent the reason the server requires, so it
always failed; fixed.
**Deploying Corrections 2–7 — the database goes first, all five migrations,
in the same sitting** (Correction 7 adds none; the order below is unchanged,
and `docs/PRODUCTION_RUNBOOK.md` §2 has the full inventory). New code reads `ph_cities`, `pet_colours`,
`publication_status`, `publication_logs`, `report_drafts`, `user_sessions`,
`user_activity_logs` and `users.admin_level`, none of which exist before
009–012; and each migration assumes the one before. Use the official MySQL client with
`--default-character-set=utf8mb4`, naming the database on the command line —
the migrations have no `USE` line (release hardening), so the committed files
run unchanged against `railway` (exact command: `PRODUCTION_RUNBOOK.md` §2):

1. back up the Railway database (`docs/PRODUCTION_RUNBOOK.md`)
2. preview 008 (query at the top of `008_split_user_names.sql`), run 008
3. preview 009 (queries at the top of `009_report_reference_data.sql`), run 009
4. preview 010 (query at the top of `010_report_publication_workflow.sql` —
   it lists the reports that will become Removed), run 010
5. run 011 (two new, empty tables; nothing to preview)
5a. preview 012 (`SELECT user_id, email FROM users WHERE role = 'admin';` —
   every one becomes a Super Administrator), run 012
5b. preview 013 (queries at the top of `013_remove_unused_staff_assignment.sql`
   — `assigned_reports` must be 0; on 6 October production had 0 of 48), run
   013 (it refuses, changing nothing, if any report has the column set)
6. push; check `/api/health`; run `npm run verify:deploy <url>`
7. **check the recorded IP** (`docs/security-activity-logging.md`, "IP
   address"): (a) sign in from network A, e.g. home Wi-Fi; (b) sign in from
   network B, e.g. mobile data; (c) Admin → Logs → Sessions must show **two
   different real public addresses**. If both are an internal address, or the
   Railway log has "X-Real-IP missing" lines, Railway is not keeping its
   documented `X-Real-IP` contract: diagnose with a temporary log line of
   `REMOTE_ADDR` and *whether* `X-Real-IP` / `X-Forwarded-For` are present
   (never their values, never persisted), and stop relying on the IP for
   per-client rate limiting until it is resolved.

All five were tested from the `2947a43` schema and seed on MySQL 9.4 (strict)
and on MariaDB, the last run twice, and compared with a fresh install
(`npm run test:migrations`): identical. Never run any against Railway without
Kyle.

**Correction 2.** First and last name replace full name: migration `008` adds
`first_name` and `last_name`, backfills them (particles stay with the surname:
"Jomar Dela Cruz" is *Jomar* / *Dela Cruz*), and makes `full_name` a
**generated** column, so every query that reads it is unchanged and nothing can
write it. A password may not contain the first or last name anywhere
(`password_policy_error()` and `password_name_pieces()` in `api/helpers.php`,
mirrored in `src/utils/passwordRules.js`, held together by
`scripts/identity-cases.json`). Confirm password appears only once the
password qualifies and must be retyped (`ConfirmPasswordField` in
`src/components/PasswordField.jsx`). After a submit, the answer is scrolled to
and focused (`src/utils/reveal.js`) on registration, reset, profile, the report
wizard, verification, moderation and the match queue. The date filter is under
species and open. Reasons and costs: `docs/DECISIONS.md`, "Post-defense
corrections".

**Deploying Correction 2 — the database goes first, in the same sitting.** Old
code against the new schema writes `full_name`, which production's strict
MySQL refuses (registration and profile saves would fail); new code against
the old schema writes columns that do not exist. So: back up, preview the
split with the query at the top of `008_split_user_names.sql`, run `008` on
Railway, then push. The migration was tested on MySQL 9.4 from the `007`
schema with the seeded data.

**Correction 1.** The audit found every workflow already goes through the PHP
API to MySQL; nothing falls back to mock data. What remained was scaffolding
from before the backend existed: three services imported `src/services/mockDb.js`
for its `NotFoundError` class, which dragged the entire `src/mock/` dataset
into the production bundle; the production login page loaded the mock users on
every visit; and `createNotification()` was dead mock code. Fixed by moving
`NotFoundError` to `src/services/errors.js`, deleting `mockDb.js` and
`createNotification`, and loading the demo accounts only inside an
`import.meta.env.DEV` branch. Guarded twice: `scripts/no-mock-in-production.test.mjs`
(source rule, in `test:contract`) and `npm run check:bundle` (reads `dist/`).
No API, schema or live behaviour changed.

**Correction 10 — found during Correction 1, deliberately not fixed yet.**
Breed, colour, city and province are free-text inputs, and
`breed_id_for()` (`api/reports.php:1258`) **inserts every new spelling into
`pet_breeds`**, so "Golden Retriever", "golden retriever" and "Golden Retriver"
become three rows. The table is seeded but no endpoint lists it, so the form
cannot suggest from it. This needs one design across the API, the form, the
matching rules and probably the ERD, not a patch. Ma'am's own words on it are in
`docs/feedback/instructor-feedback-notes.md` (colours with an "other" field).

**The intermittent sign-out race — fixed in Correction 5.** `SO-I`/`SO-J`
failed under heavy load because `refresh()` in `src/hooks/useSession.js`
dropped a check asked for while another was in flight. Production (`2947a43`)
still has it until Correction 5 is deployed. It is now reproduced on purpose,
without load, by `npm run test:session-ui` (RACE-1…4): against the old hook
RACE-1, RACE-3 and RACE-4 fail every time; with the fix all pass.

## 5. Rules Kyle has set (they still apply)

- **Commit and push only when Kyle asks.** Report first, then wait.
- **No history rewriting:** no force push, amend, rebase or squash.
- **Production database: read only.** `SELECT`, `SHOW`, `DESCRIBE`. No
  `UPDATE`/`DELETE`, no reseeding, no destructive upload checks
  (`verify:deploy --upload` only against local).
- **Never run `npm run audit` against production.** It reseeds whatever it points at.
- **Never display secrets:** Railway variables, DB credentials or connection
  strings, `BREVO_API_KEY`, the Turnstile secret, `RATE_LIMIT_SECRET`,
  `api/config.local.php`, cookies, session ids, raw auth tokens.
- **Do not type passwords into anything but a local development host.**
  Checks that need signing in to production go on Kyle's manual checklist.
- **Do not enable `MATCH_DEBUG`.**
- **Leave production report 43 alone.** It (a found "Other: turtle") has a
  stale dog/Shih Tzu pairing with Milo from before the edit freeze. It is
  settled; nobody repairs `match_signals` by hand. Reopening it is correctly
  refused (`comparison_changed`).
- **Keep `origin`'s push URL disabled.**
- The project rules in `CLAUDE.md` still govern code: student-scale (§15), no new
  abstractions or dependencies without need, check `docs/ui-inventory.md`
  before adding a component, report changes in the §24 format.

---

## 6. Running it locally

```bash
# MySQL (MariaDB, port 3307) and Apache — or use the XAMPP Control Panel
C:\xampp\mysql\bin\mysqld.exe --defaults-file=C:\xampp\mysql\bin\my.ini --standalone
C:\xampp\apache\bin\httpd.exe

# Frontend (or preview_start "paws-and-found-dev" from .claude/launch.json)
npm run dev                      # http://localhost:5173, proxies /api to Apache

# Fresh demo data (wipes the local database)
C:\xampp\mysql\bin\mysql.exe -uroot -P3307 -h127.0.0.1 --default-character-set=utf8mb4 pawsandfound < database/seed.sql
```

- Seeded accounts and their shared password: README, "Signing in". Customer
  `maria.santos@`, finder `liza.ocampo@`, Pet Coordinator `patricia.lim@`,
  Administrator `grace.bautista@` (all `@example.com`).
- `php` is not on PATH; use `C:\xampp\php\php.exe` (e.g. `php.exe -l api/matches.php`).
- **`C:\xampp\htdocs\pawsandfound` is a stale 25 September build.** The browser
  suites default to it; always pass `PAWS_BASE=http://localhost:5173`.
- Use the official MySQL client (Docker), not XAMPP's, against Railway's MySQL 9.

---

## 7. The test gate, and where the counts live

```bash
npm run lint
npm run build
npm run test:contract                                         # 45
C:\xampp\php\php.exe scripts/identity_rules.php              # 41
C:\xampp\php\php.exe scripts/report_rules.php                # 50
C:\xampp\php\php.exe scripts/match_scores.php                # 11
python scripts/report_controls.py                             # 62  (reseeds)
python scripts/migration_parity.py                            # 41  (needs Docker; scratch databases only)
python scripts/publication_workflow.py                        # 71  (reseeds)
python scripts/session_activity.py                            # 88  (reseeds; writes config.local.php, restores it)
python scripts/admin_levels.py                                # 93  (reseeds)
C:\xampp\php\php.exe scripts/client_ip.php                   # 18
python scripts/psgc_reference.py check                        # place data and SQL in step
PAWS_PW=<seeded password> npm run audit                       # 384  (reseeds, restores)
PAWS_PW=<seeded password> python scripts/auth_lifecycle.py    # 106
PAWS_PW=<seeded password> npm run multi-device                # 73
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:ui       # 66
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:signout  # 24
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:feedback # 49
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:report-ui # 47
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:workflow-ui # 33
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:session-ui  # 26 (reseeds)
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:admin-levels-ui # 33 (reseeds)
PAWS_BASE=http://localhost:5173 npm run a11y                      # 50 pages
C:\xampp\php\php.exe scripts/city_fallback.php                # 11
C:\xampp\php\php.exe scripts/calendar_today.php               # 8
C:\xampp\php\php.exe scripts/matching_log.php                 # 6
npm run test:i18n                                             # 22  (Correction 7; needs nothing running)
npm run test:disclaimer                                       # 21  (Correction 7; needs nothing running)
python scripts/privacy_ack.py                                 # 29  (Correction 7; reseeds)
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:i18n-ui  # 57 (Correction 7; reseed first)
```

**1,515 checks in total, in twenty-seven suites** on `post-defense/revisions`
(1,503 after Correction 7; 1,374 after Correction 6A; 1,353 after Correction 6; 1,246 after Correction 5A; 1,238 after Correction 5; 1,112 in eighteen after Correction 4; 1,006 in sixteen after 3A; 972 after 3;
802 after 2; 689 in production). a11y: 50 pages, nine of them in Filipino. Plain `npm run lint` is the
gate again: the four `PawsAndFound_*` folders that had appeared in the
repository root were moved to `C:\Projects\_archives\paws-and-found\` on
3 October (Kyle's decision; nothing deleted).
Reseed after the browser suites; they change data.

**Local MariaDB was unstable on 3 October.** It crashed twice (access
violations, Windows Application log) and its Aria system tables needed
`aria_chk --safe-recover`; the stale `aria_log.*` files and `ib_buffer_pool`
were set aside. phpMyAdmin's own `phpmyadmin.pma__bookmark` has a corrupt
page (not a Paws&Found table). Every `pawsandfound` table passes `CHECK TABLE`.
Start it detached (the XAMPP Control Panel, or a process that outlives the
terminal) — a `mysqld` started from a tool's shell dies with that shell.

After `npm run build`, also run `npm run check:bundle`: it fails if any of the
mock dataset reached `dist/` (Correction 1, §4a).

When a count changes, `docs/TESTING.md` §3 is the source. Then update the same
number in: README (`npm run audit` / `test:ui` rows), `docs/HANDOFF.md` §10,
`docs/feature-status.md`, `docs/final-project-guide-requirements.md`
(Phase 4 row), `docs/report-corrections.md` (section table),
`docs/role-permissions.md` (audit line), and regenerate the A4 sheets with
`python scripts/print_sheets.py` (it reads §3 and verifies 34 rules against
the code; it refuses to print if one is false).

**Writing tests here — things that bit last time:**

- Staff and admin get **one session**: signing the same account in from a second
  browser context kills the first. Do it last, or in a fresh context.
- `scripts/ui_regressions.mjs` shares seed data across sections. Match 3
  (Mochi) has a report that REPORT-ACTIONS closes; WITHDRAWN finishes Milo's
  report 1 (match 1); REOPEN/DECIDE-ASK use match 4. Pick untouched data.
- Field labels include "(required)"; dialogs' safe button is **"Go back"**, not "Cancel".
- Some files are CRLF (`CLAUDE.md`, `docs/page-inventory.md`,
  `src/components/RequireAccess.jsx`); exact-match edits must allow for that.

---

## 8. Shipping a change

1. Run §7 locally; reseed.
2. Show Kyle what changed and the results; wait for the go-ahead.
3. `git push portfolio team/current`. Railway builds in a few minutes.
4. Verify read-only:
   ```bash
   npm run verify:deploy https://paws-found-production.up.railway.app   # 25/25 + 3 skipped
   curl.exe -s https://paws-found-production.up.railway.app/api/health
   ```
   and confirm the bundle name in the page source has changed.
5. Update the "Last deployed commit" line in §2 of this file.

Rolling back and operating the live site: [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md).

---

## 9. Code map for the recent work

| Concern | Where |
| --- | --- |
| Pairing actions and who may take them | `MATCH_ACTIONS`, `match_decide()` in `api/matches.php` |
| Reopen rules / effect | `reopen_preflight()`, `match_reopen()` in `api/matches.php`; `ReopenAction` in `StaffMatchesPage.jsx` |
| Withdrawal when a report finishes | `dismiss_open_pairings_for_report()` in `api/matches.php` |
| Scoring and gates | `api/matching.php` (`MATCH_WEIGHTS`, `MATCH_MIN_SCORE = 65`, 15 km, 14 days) |
| Edit freeze while a pairing is open | `api/reports.php` (409 `match_open`); re-match after an edit |
| Single session | `PRIVILEGED_ROLES` (`api/config.php`), `auth_login()` (`api/auth.php`), `user_update()` (`api/users.php`) |
| Password / name rules | `api/helpers.php` ↔ `src/utils/passwordRules.js`, `nameRules.js`, `src/components/PasswordField.jsx` |
| Route guards | `RequireAccess`, `AdminStaysInWorkspace` (`src/components/RequireAccess.jsx`); routes in `src/App.jsx` |
| Where sign-in lands | `destinationAfterSignIn()` in `src/constants/navigation.js` |
| Workspace chrome | `src/layouts/WorkspaceShell.jsx` (staff/admin), `RootLayout.jsx` (public + customer) |
| Audit log | `audit_log()` in `api/helpers.php`; table `audit_logs` |
| Session records | `session_record_start()`, `touch_session_record()`, `end_open_sessions()`, `end_this_session()` in `api/helpers.php`; table `user_sessions` |
| Why a session ended | `current_user()` + `session_end_notice()` (`api/helpers.php`); `SessionNotice.jsx` says it |
| Activity trail | `activity_log()` + `ACTIVITY_ACTIONS` (`api/helpers.php`); page views `RootLayout.jsx` → `POST /api/activity/page-view` (`api/logs.php`) |
| Log viewer | `GET /api/logs/{activity,sessions,audit}` (`api/logs.php`); `src/pages/admin/AdminLogsPage.jsx` |
| Visitor IP | `client_ip()` (`api/helpers.php`), `BEHIND_RAILWAY_EDGE` (`api/config.php`) |
| Administrator levels | `ADMIN_CAPABILITIES`, `require_capability()`, `user_can()` (`api/helpers.php`); `user_update()` (`api/users.php`); `can()` (`src/utils/permissions.js`), `RequireCapability` (`src/components/RequireAccess.jsx`) |
| Session re-check | `useSession()` (`src/hooks/useSession.js`); `SESSION_CHECK_EVENT` in `src/services/api.js` |
| Words on screen (Correction 7) | `t()` in `src/i18n/index.js`; dictionaries `src/i18n/en/`, `src/i18n/fil/`; `useLanguage()` subscribed in `App.jsx`; `LanguageSwitcher.jsx`; enum labels via `translatedLabels()` in `src/constants/index.js`; API sentences `src/i18n/apiErrors.js` |
| Disclaimer | `src/pages/public/DisclaimerPage.jsx`; `FooterNotice` in `Footer.jsx`; `data-submit-notice` in `ReviewStep.jsx`; `HandoverNotice.jsx` |
| Privacy Notice acknowledgement | `privacy_notice_acknowledged()`, `auth_acknowledge_privacy_notice()` in `api/auth.php` (`PRIVACY_NOTICE_VERSION`); `PrivacyUpdateNotice.jsx` |
| Printed report list | `PrintReportList.jsx` (portal, `window.print()`); the print stylesheet at the end of `src/index.css`; triggers on `ExplorePage`, `StaffReportsPage`, `AdminReportsPage` |

---

## 10. Still open

- **Section 4 and Corrections 1–7 are committed locally, not deployed**
  (12 commits; §1). Shipping them is Kyle's call, and they need migrations
  `008` to `013` on Railway first (§4a), then the IP check.
- **Schema freeze status (6 October 2026)** — `docs/final-schema-audit.md`
  is the schema source of truth. Cancel (register 16): **DEFERRED PENDING
  INSTRUCTOR CLARIFICATION**, no Cancel publication state. Reset (11):
  **AWAITING CLARIFICATION**. Contact number (N1): **IMPLEMENTED, AWAITING
  INSTRUCTOR-INTENT CONFIRMATION**. `match_claims.staff_notes`: **KEEP**
  (written, not shown). `pet_reports.assigned_staff_id`: **REMOVED** by
  migration 013 (production 0 of 48 reports, local 0 of 32, no use in code,
  tests or seed).
  The freeze, the final ERD and then the production backup and migrations
  follow, in that order (`docs/DECISIONS.md`, "Schema freeze notes").
- **No automatic log retention** (`docs/security-activity-logging.md`). The
  re-consent gap is closed by Correction 7's non-blocking acknowledgement.
- **The Filipino has not had a native-speaker review**; recommended before the
  final presentation (`docs/localization.md` §7).
- **Feature freeze after Correction 7**: nothing new unless a clarification
  arrives; then the final schema freeze, final ERD, role scope and
  limitations, a deployment rehearsal and the final presentation.
- **The ERD figure still shows `full_name` and lacks the three 009 tables.**
  `docs/erd-defense.md` describes them in text; the figure is redrawn once, in
  the final ERD pass.
- **The place data is PSA's 30 June 2026 file.** PSA publishes quarterly;
  re-check before the final submission whether a newer release exists
  (`database/reference/README.md` says how to refresh it).
- **Contact number (register N1) — IMPLEMENTED, AWAITING INSTRUCTOR-INTENT
  CONFIRMATION.** Built as "never published, coordinators see it". Ma'am may
  have meant: collected, required, shown publicly, or simply a clear way to
  reach the reporter. Do not present the current behaviour as her requirement.
- **Instructor corrections in progress** — see §4a.
- **The printed defense packet** from the morning of 30 September says 590
  checks; reprint from `docs/diagrams/` if a current copy is needed.
- **The demonstration accounts share one weak password.** Fine for a demo; don't
  spread the live URL widely while they exist.
- **The Railway MySQL public TCP proxy** should be disabled when remote suites
  are no longer needed.
- Known, deliberate gaps (details in HANDOFF.md §12): a reporter's answer to a
  coordinator's question lives only in notifications; `match_claims.staff_notes`
  is written but never read back; optional phone polish on Explore map view,
  Staff Overview pills and the Admin Overview tile grid.
