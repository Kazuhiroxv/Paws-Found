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
git branch --show-current          # team/current
git fetch portfolio
git log --oneline -5
git log --oneline portfolio/team/current..HEAD   # local commits not yet deployed
curl.exe -s https://paws-found-production.up.railway.app/api/health
```

Expected at the time of writing: on `team/current`, `HEAD` = `portfolio/team/current`
= **`2947a43`**, health `{"status":"ok","database":"ok"}`, and the working tree
holding the uncommitted changes listed in §4.

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
| Stack | React 19 + Vite 8 + Tailwind 4 + React Router 7 + Leaflet; PHP REST API in `api/`; MySQL schema `database/schema.sql` (17 tables, 24 FKs) |

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

## 4. Uncommitted on the laptop (not in production)

Kyle said **"don't commit this yet."** These are finished and tested locally,
waiting for his word. Do not commit or push them without it.

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
Interface only — the API is unchanged.

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
npm run test:contract                                         # 29
PAWS_PW=<seeded password> npm run audit                       # 382  (reseeds, restores)
PAWS_PW=<seeded password> python scripts/auth_lifecycle.py    # 100
PAWS_PW=<seeded password> npm run multi-device                # 73
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:ui       # 66
PAWS_BASE=http://localhost:5173 PAWS_PW=<…> npm run test:signout  # 24
PAWS_BASE=http://localhost:5173 npm run a11y                      # 31 pages
C:\xampp\php\php.exe scripts/city_fallback.php                # 11
C:\xampp\php\php.exe scripts/calendar_today.php               # 8
C:\xampp\php\php.exe scripts/matching_log.php                 # 6
```

**699 checks in total** with the uncommitted work (689 in production). Reseed
after the browser suites; they change data.

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

---

## 10. Still open

- **Section 4 is waiting for Kyle.**
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
