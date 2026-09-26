# Paws&Found — technical hardening audit

**Date:** 23 September 2026 · ITS122P–AM5 · Group 3
**Purpose:** establish what the system actually does today, before any hardening
work is written, so the implementation checklist at the end is a list of real
gaps rather than a list of guesses.

Everything below was read out of the code in this repository. Where a claim is
made about behaviour, the file and line that makes it true is named.

---

## 1. What is already correct

These are not aspirations. They are in the code now, and they cover a
surprising amount of what the instructor is expected to test.

### 1.1 The role is read from the database on every request

This is the single most important finding, because it decides most of the
three-device scenarios by itself.

`api/helpers.php:current_user()` does **not** read the role out of the session.
The session holds one thing:

    $_SESSION['user_id'] = (int) $user['user_id'];     // api/auth.php:69

and every protected request then re-loads the account:

    SELECT user_id, full_name, email, contact_number, role, account_status, ...
      FROM users WHERE user_id = :id                    -- api/helpers.php:150

Consequences, all of them already true:

* An administrator demoted to `user` loses administrator API access on the
  **next request** from every device, with no re-login and no cache to expire.
* A suspended account is refused everywhere, because `current_user()` returns
  `null` for `account_status = 'suspended'` (`api/helpers.php:167`).
* An account deleted mid-session has its session destroyed (`api/helpers.php:161`).

The architecture the brief asks for — *session identifies the user → load the
current user → check status → check role → check ownership* — is what the code
already does.

### 1.2 Authorisation is enforced in PHP, not in React

`require_login()` and `require_role()` (`api/helpers.php:174`, `:195`) are called
by every endpoint that needs them. Verified guard by guard:

| Endpoint group | Guard |
| --- | --- |
| `GET /users`, `PATCH /users/{id}` | `require_role('admin')` |
| `GET /reports/stats` | `require_role('staff','admin')` |
| `GET /moderation`, `PATCH /moderation/{id}` | `require_role('admin')` |
| `POST/PATCH/DELETE /categories` | `require_role('admin')` |
| `PATCH /matches/{id}` | `require_login()` plus a per-action role check inside |
| `/notifications/*` | `require_login()`, scoped to the caller's own rows |
| `POST /reports`, `PATCH /reports/{id}` | `require_login()` plus an ownership check |

`src/components/RequireAccess.jsx` is a route guard only, and its own comment
says so. Deleting it would change nothing about who can reach the data.

### 1.3 Object-level authorisation (IDOR) is checked

* `report_update()` — `api/reports.php:202`: refuses unless
  `report.user_id === session user_id`.
* `report_add_photos()` — `api/reports.php:476`: same check.
* `report_set_status()` — `api/reports.php:258`: owner **or** staff/admin.
* `match_decide()` — `api/matches.php:74`: reporter-only actions are separated
  from coordinator-only actions by an action-to-roles table.
* `report_update()` also whitelists the editable columns
  (`api/reports.php:211`), so an extra field in the request body — `user_id`,
  `status`, `role` — is ignored rather than written.

### 1.4 SQL injection

`api/db.php` opens PDO with `ATTR_EMULATE_PREPARES => false`, so values are sent
to MySQL separately from the SQL text. A sweep of all 3,590 lines of PHP found
no query that concatenates request input. The two places where a value *cannot*
be parameterised — `ORDER BY` columns and ENUM values — go through
`require_one_of()` (`api/helpers.php:84`), which rejects anything not on a list
we control. `wants_notification()` builds a column name into SQL, but from a
fixed `match` expression, never from the caller (`api/helpers.php:127`).

### 1.5 Passwords

`password_hash($password, PASSWORD_DEFAULT)` and `password_verify()`
(`api/auth.php:131`, `:57`). bcrypt, correct API, no home-made comparison.
The 72-byte bcrypt limit is validated rather than silently truncated
(`api/auth.php:110`).

### 1.6 Session fixation and account enumeration

* `session_regenerate_id(true)` on both login and registration
  (`api/auth.php:67`, `:146`).
* `httponly` and `SameSite=Lax` cookie parameters (`api/helpers.php:110`).
* One message — "That email address and password do not match." — for both a
  wrong password and an unknown address (`api/auth.php:56`).

### 1.7 File upload

`report_add_photos()` is the strongest part of the API. It checks the upload
error code, `is_uploaded_file()`, the byte size, and then `getimagesize()`,
which reads the file's own header rather than believing the browser's declared
type. The stored filename is `bin2hex(random_bytes(16))` plus an extension
chosen from the detected image type — the original filename never touches the
disk, so `../../shell.php` has nothing to do. `api/uploads/.htaccess` then
disables the PHP engine, strips handlers, denies script extensions outright and
sets `X-Content-Type-Options: nosniff`.

### 1.8 Error handling

`api/index.php:74` catches `PDOException`, logs the real message with
`error_log()` and answers "The server could not complete that request." No SQL
or file path reaches the browser.

### 1.9 The demo role selector is already development-only

`src/App.jsx:changeRole()` opens with `if (!import.meta.env.DEV) return`, the
navbar renders the control behind `import.meta.env.DEV &&`
(`src/components/Navbar.jsx:174`, `:274`), and there is **no backend endpoint**
that grants a role — the selector signs in for real with a seeded password.
Confirmed against the built bundle: `demo1234` does not appear in `dist/`.

### 1.10 Concurrent devices already work

PHP sessions are per-cookie. Signing in on a second device does not disturb the
first, so "three devices, one account" works today without any change.

---

## 2. The gaps

Ranked by how likely they are to be found during the defence.

### ~~G1~~ — No failed-login lockout · **closed 23 September 2026**

`auth_login()` counted nothing. There was no lock state and no administrator
unlock, so a password could be guessed indefinitely.

**Was needed:** a counter that survives a browser refresh and a device change
because it lives in the database, a lock at the third failure that a correct
password does not lift, an administrator unlock control, and a log of all of it.

**Built:** `login_attempts` counts per email address typed, so an address
belonging to nobody is counted exactly like one that does — which is what lets
the countdown be said out loud without it becoming a way of asking which
addresses are registered. Verified: the three responses for a real account and
for `no.such.person@example.com` are identical, word for word. The third failure
moves the account to `account_status = 'locked'`, which also ends every session
it has open, because `current_user()` refuses anything that is not active. The
lock is checked before the password is verified, so a correct password arrives
at the same refusal. An administrator unlocks it from the Users page, which
clears the counter in the same transaction. Ten new regression cases, AU-14 to
AU-24.

### ~~G2~~ — The frontend never re-checks who it is · **closed 23 September 2026**

`src/App.jsx` fetched `/auth/me` **once**, in a `useEffect` with `[]`. The
backend already refused a demoted administrator, but devices B and C kept
showing the Administration navigation until somebody pressed refresh — the
security was sound and the screen lied.

**Built:** `src/hooks/useSession.js` re-asks on load, on window focus, on tab
visibility, on every route change and every ten seconds. When the answer
differs from the last one, `SessionNotice` says so at the top of the page —
a role change is named in both directions — and `RequireAccess` moves the
person out of a workspace they no longer hold.

Verified live: one browser signed in as Patricia Lim sitting on
`/staff/matches`, her role changed to `user` from a separate session. Within
ten seconds, untouched, that browser raised *"Your access level changed — Staff
/ Pet Coordinator to Customer/User"* and left the workspace. Her direct API
calls to `/reports/stats`, `/users` and a self-promotion `PATCH /users/8` all
answered 403.

### ~~G3~~ — No privacy notice or consent record · **closed 23 September 2026**

Nothing in `RegisterPage.jsx` or `auth_register()` mentioned privacy at all.

**Was needed:** a readable Privacy Notice page, a required acknowledgement at
registration, and a stored record of what was agreed and when.

**Built:** `/privacy`, linked from the footer and from the registration form,
written to be read by the person it is about. Every claim on it was checked
against what the system actually does — including the one most likely to be
assumed wrong, that the reporter's **name is public on every report** while
their phone and email are not unless they publish them per report.

The acknowledgement sits immediately above the Create account button, unticked,
with the submit button disabled until it is ticked. The API refuses
registration without it and compares with `=== true`, so the string `"true"` is
refused too. The account and the consent row are written in one transaction:
verified that a duplicate-email failure leaves neither behind.

The record lives in `privacy_consents` rather than a column, because the notice
has a version — if the wording changes we need to know who agreed to which one,
and a column would be overwritten by the second agreement.

### ~~G4~~ — No report state machine · **closed 23 September 2026**

`report_set_status()` accepted any of the four statuses from any of the four,
so `closed → active` went through. The interface never offered it, which is
exactly the distinction the brief warns about.

**Was needed:** a transition table validated server-side, with `409` for an
invalid move.

**Built:** `REPORT_TRANSITIONS` in `api/reports.php`. `Active` and
`Possible Match` may go to `Returned` or `Closed`; `Returned` may go to
`Closed`; `Closed` is the end. `Active → Possible Match` and
`Possible Match → Active` are deliberately absent from the person-facing
endpoint: the matching algorithm and the rule-out path own those, and both run
as `UPDATE ... WHERE status = 'the expected one'` so they cannot skip a step
either.

Every refusal is a `409` naming the state in the same words the status pill
uses, and carrying the moves that *are* available. Confirming a match is the
one other path that writes `returned`, so the same rule is applied there —
otherwise a pairing raised before a moderation decision closed a report could
be confirmed afterwards, quietly reopening a closed case as a reunion.

Editing a `Returned` or `Closed` report is refused as well (was G11), and the
interface no longer offers an Edit button that could only fail.

### G5 — No audit log  ·  **closed 25 September 2026**

`status_logs` records report status changes and nothing else. Logins, failed
logins, locks, unlocks, role changes, suspensions and moderation decisions leave
no trace. "Who suspended this account, and when?" currently has no answer.

**Needs:** an `audit_logs` table and writes at each of those points.

**Done in two parts.** Migration `002` created the table and the account events:
`login`, `login_failed`, `account_locked`, `account_unlocked`, `logout`,
`register`, `role_changed`, `account_suspended`, `account_reinstated`.

That left the half of the question actually asked about a *case*. Each of those
events did record a person on its own row — `status_logs.updated_by_user_id`,
`match_claims.reviewed_by_user_id`, `moderation_cases.resolved_by_admin_id` —
but in three different places and three different shapes, none readable in time
order, and a category had no record at all: renaming or deleting a species left
nothing behind but the changed row.

Migration `004` adds four more verbs — `report_status_changed`, `match_decided`,
`moderation_resolved`, `category_changed` — written at
`api/reports.php:397`, `api/matches.php:157`, `api/moderation.php:274` and three
points in `api/categories.php`. The specific action goes in `detail`, as a
sentence: `reject: suggested -> rejected`, `dismiss on report 6`,
`Audit Trail Renamed: retired`.

`target_type` needed nothing — `002` had already allowed `report`, `match`,
`category` and `moderation_case`.

Two deliberate exclusions, both visible in the code: a report's *creation* and
the automatic move to "possible match" are in `status_logs` but not here.
Neither is a person changing something, and an audit log full of the system
talking to itself is harder to read than one that is not.

### G6 — No session inventory, so sessions cannot be revoked

Role change and suspension propagate because the role is re-read, which covers
most cases. But a password change cannot end the other two sessions, there is no
idle timeout, and nothing can answer "which devices is this account signed in
on?"

**Needs:** a `user_sessions` table keyed by a hash of the session id, with
`last_activity_at`, `expires_at` and `revoked_at`; idle timeout; revoke-others
on password change and on suspension.

### ~~G7~~ — No CSRF token · **closed 24 September 2026**

Cookie-based sessions with no token. `SameSite=Lax` blocked the common
cross-site `POST`, which is a real defence, but it is the browser's promise
rather than ours and it stops applying the moment the cookie has to become
`SameSite=None`.

**Built:** a 32-byte token per session, handed out in the body of `/auth/me`,
`/auth/login`, `/auth/register` and `/auth/logout`, and required back in an
`X-CSRF-Token` header. A response body cannot be read cross-origin and a plain
HTML form cannot set a header, which is the pair of facts the whole thing rests
on.

Checked in **one place** — `verify_csrf()` called from `api/index.php` before
the router — so an endpoint added later is protected by existing rather than by
somebody remembering. Compared with `hash_equals`, not `===`. The token rotates
whenever the session id does, and the browser retries once on a stale token, so
a tab left open all afternoon is a nuisance rather than a failure.

Verified: a fully valid request from a genuinely signed-in session is refused
with 403 when the token is left off, refused when another session's token is
used, and accepted with the right one — and none of the refused writes changed
anything. Reads still need no token. Six regression cases, AU-30 to AU-35.

### G8 — Production configuration does not exist

* `api/config.php` holds `root` and an empty password, is committed to git, and
  is the only configuration mechanism.
* `ALLOWED_ORIGINS` lists localhost only.
* The session cookie's `secure` flag is a commented-out line
  (`api/helpers.php:113`).
* `display_errors` is never set, so it follows whatever the host's `php.ini`
  says — on a default XAMPP that is **on**.
* Nothing is deployed. There is no URL.

**Needs:** environment-based configuration with a committed `.env.example` and
no real credentials in git; `display_errors=0` and `log_errors=1` in production;
`secure` cookies over HTTPS; a host; and the three devices pointed at one
database.

### G9 — No migrations  ·  **closed 23 September 2026**

`database/schema.sql` drops and recreates every table. Adding one column
during a live demonstration means rebuilding the database and losing the data on
screen.

**Needs:** `database/migrations/` with numbered, additive files.

**Done.** `database/migrations/` holds `001` to `004`, each additive, each
recording itself in `schema_migrations`. The baseline is kept in step: a fresh
import of `schema.sql` was diffed against the migrated database table by table
on 25 September and came back identical, 15 tables each.

### G10 — The defence documents do not exist  ·  **closed 25 September 2026**

None of `erd-defense.md`, `role-permissions.md`, `presentation-defense.md`,
`database-defense-cheatsheet.md`, `live-database-change-playbook.md` or
`matching-explanation.md` is written. Since every member may be asked about any
part of the system, these are deliverables, not decoration.

**All six written**, each read out of the code or the running database rather
than out of memory, each carrying `file:line` or a runnable query:

| | |
| --- | --- |
| `erd-defense.md` | The database, table by table, from `information_schema` |
| `database-defense-cheatsheet.md` | One page: the counts, the delete rules, three refusals to run live |
| `role-permissions.md` | What the **server** allows per role, with the guard for each |
| `matching-explanation.md` | The seven weights, the two gates, a worked example that adds to 85 |
| `live-database-change-playbook.md` | Adding a column during the demonstration without losing the data |
| `presentation-defense.md` | The page everyone reads: the request traced end to end, eleven likely questions, what is honestly missing |

A seventh, `report-corrections.md`, lists what to change in the written Phase 4
report — the two persistence limitations that are no longer true, and the test
and table counts that moved.

### G11 — Smaller items

* ~~`report_update()` does not refuse edits to a finished report.~~ Closed with
  G4.
* No rate limit on registration.
* The demo selector's dead code still ships in the bundle (the *password* does
  not). "It is not in the production build" is a better sentence than "it is in
  the build but never runs."
* No `429` anywhere; no `409` outside `match_decide()`, `moderation_decide()`
  and `report_update()`.
* ~~A third path segment was silently dropped, so the router answered a URL
  that does not exist: `GET /matches/1/claims` returned the match, and
  `GET /users/1/password` returned the user.~~ Closed 25 September 2026.
  `api/index.php` now refuses any third segment except `/reports/{id}/photos`,
  which is the only route that has one. Found by asking the API for endpoints
  it does not have, not by reading it. Cases EH-07 to EH-10.

---

## 3. ERD truth check

**Superseded, 25 September 2026.** This section was written when the schema had
eleven tables and it was true then. Three tables arrived with the hardening pass
— `login_attempts`, `privacy_consents`, `audit_logs` — and the diagram was not
redrawn, so for two days the ERD showed eleven boxes against fourteen tables.
That is exactly the fault this section exists to catch, and it was caught by
counting `information_schema` rather than by reading the diagram.

The figure now shows 14 tables and 23 foreign keys, and the count is asserted
by case SQL-12. The table-by-table defence is `docs/erd-defense.md`.

**The number to say out loud:** the database has **15** tables. Fourteen are on
the ERD. The fifteenth is `schema_migrations`, which records which files in
`database/migrations/` have been applied — it is infrastructure, it holds no
domain data, it has no foreign keys, and a filing cabinet does not belong on a
family tree.

The relationships below are the eleven-table list as it stood; the full,
current list of all 23 is in `docs/erd-defense.md`.

    users              1 ─── N  pet_reports            (user_id, RESTRICT)
    users              1 ─── N  pet_reports            (assigned_staff_id, SET NULL)
    users              1 ─── N  notifications          (CASCADE)
    users              1 ─── N  status_logs            (SET NULL)
    users              1 ─── N  match_claims           (submitted_by / reviewed_by, SET NULL)
    users              1 ─── N  moderation_cases       (reporter / resolver, SET NULL)
    pet_categories     1 ─── N  pet_breeds             (RESTRICT)
    pet_categories     1 ─── N  pet_reports            (RESTRICT)
    pet_breeds       0..1 ─── N pet_reports            (SET NULL, breed is optional)
    locations          1 ─── N  pet_reports            (RESTRICT)
    pet_reports        1 ─── N  report_images          (CASCADE)
    pet_reports        1 ─── N  status_logs            (CASCADE)
    pet_reports        1 ─── N  notifications          (CASCADE)
    pet_reports        1 ─── N  moderation_cases       (CASCADE)
    pet_reports (lost) 1 ─── N  match_claims           (CASCADE)
    pet_reports (found)1 ─── N  match_claims           (CASCADE)
    match_claims       1 ─── N  match_signals          (CASCADE)
    match_claims       1 ─── N  notifications          (CASCADE)

`match_claims` is the junction that resolves the many-to-many between lost
reports and found reports, and it carries its own attributes — score, status,
decider, notes — which is why it is a table rather than a plain link.

Tables this pass will add, and only these:

| Table | Why it must exist |
| --- | --- |
| `user_sessions` | So a session can be listed, timed out and revoked. Without it, G6 has no answer. |
| `audit_logs` | So "who did this, and when" has an answer for anything that is not a report status change. |
| `login_attempts` *(or columns on `users`)* | So the three-attempt lock survives a refresh and a second device. |
| `privacy_consents` *(or columns on `users`)* | So consent is a record, not a checkbox that vanished. |

Whether the last two are their own tables or columns on `users` is a genuine
design decision, and it is the first thing to settle in the table-by-table
walkthrough — a separate `login_attempts` table gives a history worth showing;
two columns on `users` give a simpler ERD to defend.

---

## 4. Implementation checklist

Ordered so that each phase is demonstrable on its own. `[x]` is done and
tested; `[ ]` is not started.

**Phase A — database**
1. `[x]` `database/migrations/` established, with `schema_migrations` recording
   what a database has had applied. `schema.sql` stays the baseline.
2. `[x]` `001` — `login_attempts`, and `locked` added to `users.account_status`.
3. `[ ]` `user_sessions`.
4. `[x]` `002` — `audit_logs`.
5. `[x]` `003` — `privacy_consents`.
6. `[ ]` ERD diagram regenerated; `docs/erd-defense.md` written table by table.

**Phase B — authentication**
7. `[x]` Three-attempt lock, persisted in the database, not lifted by a correct
   password, counted per address typed so the countdown says nothing about
   which addresses are registered.
8. `[x]` Administrator unlock, in the Users workspace, behind a confirmation
   that names the account and says what unlocking does not do.
9. `[x]` Audit entries for login, failed login, lock, unlock, logout, register,
   role change, suspension and reinstatement.
10. `[ ]` Session records written, refreshed, expired on idle, revoked on
    suspension and password change.

**Phase C — authorisation and state**
11. `[x]` Report state machine validated server-side; `409` on an invalid move,
    naming the state and listing the moves that are available.
12. `[x]` Edits refused on a `returned` or `closed` report, in the API and in
    the interface.
13. `[x]` CSRF token issued and required on every state-changing request,
    verified in one place before the router.
14. `[x]` Role change and suspension write audit entries.

**Phase D — the interface telling the truth**
15. `[x]` `/auth/me` re-fetched on focus, on tab visibility, on every route
    change and every ten seconds; the workspace is exited when the role no
    longer allows it, and the change is announced rather than only applied.
16. `[ ]` Every mutation shows pending, then done or error, with the button
    disabled while it runs and a state that is not colour alone.
17. `[x]` Privacy Notice page, plus the acknowledgement at registration.
18. `[ ]` `401 / 403 / 409 / 429` handled with a page that says what happened
    and what to do next.

**Phase E — production**
19. Environment configuration, `.env.example`, no credentials in git.
20. `display_errors=0`, `log_errors=1`, `secure` cookies, HTTPS.
21. Deployed, one database, reachable by URL from three devices.

**Phase F — proof**
22. The eight multi-device tests (A–H in the brief) run and recorded.
23. Existing Puppeteer suites extended, not replaced.
24. `role-permissions.md`, `presentation-defense.md`,
    `database-defense-cheatsheet.md`, `live-database-change-playbook.md`,
    `matching-explanation.md`.

---

## 5. One thing to decide before Phase A

The brief says the choice between user, employee and administrator "must not be
seen" during the presentation. That reads two ways:

* **The demo role selector in the navbar** — a control that hands out roles with
  no password. This is the security risk, and it is already development-only.
* **The administrator's role control in Users** — assigning a role to somebody
  else, from an administrator account, after an authorisation check. This is a
  required feature of the Administrator role, and it is what the role-downgrade
  test needs in order to be demonstrated at all.

This audit assumes the first. If the second was meant as well, the
role-downgrade test has nowhere to happen and the Administrator workspace loses
a graded function — worth confirming before anything is removed.
