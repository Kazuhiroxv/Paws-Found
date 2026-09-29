# Handoff — the state of Paws&Found

**Written 27 September 2026.** Everything below was read from the running
system, the live site or `git` on the day it was written. Where a number
appears, it was measured, not remembered.

This document assumes you have no access to the conversation that produced it.
Read it, then check `git status`, `git log` and the remotes yourself before
changing anything — a document is a snapshot and the repository is the truth.

---

## 1. The project

**Paws&Found** — a web-based community system for lost and found pets. Owners
file a lost report, finders file a found report, the system suggests possible
matches from structured characteristics and location, a coordinator helps
verify, and the report is closed when the pet is home.

- Course: Web Systems and Technologies 2, **ITS122P – AM5, Group 3**
- Student / project manager: **Kyle Michael V. Austria**
- Live: **https://paws-found-production.up.railway.app**
- Phase: **stable production.** The next work is final UI/UX polish — see
  [UI_UX_POLISH.md](UI_UX_POLISH.md).

The full course brief, roles, and the rules this project is built under are in
[../CLAUDE.md](../CLAUDE.md). Read that too; it is not optional context.

---

## 2. Architecture

```
React 19 + Vite + Tailwind 4       the interface
        |  fetch, same origin
PHP 8.3 REST API (api/)            sessions, authorisation, validation
        |  PDO, prepared statements, emulation off
MySQL                              the state
```

Served by Apache inside one Docker image on **Railway**. Mail goes out over
**Brevo's HTTPS API**. Registration is gated by **Cloudflare Turnstile**.
Uploads and sessions live on a **Railway persistent volume**.

### The principle everything follows

> **The frontend displays state. PHP enforces state. MySQL owns state.**

Route guards in React exist so the interface is coherent, not so it is secure.
Every endpoint re-checks the session, re-reads the role and account status from
the database, and decides for itself. `npm run audit` proves it by calling the
endpoints directly with the wrong role.

### Production does not depend on anyone's laptop

This matters and is easy to get wrong. The live site runs entirely on Railway.
Normal operation — including the presentation — does **not** require:

- XAMPP, local Apache, or local MySQL
- `npm run dev`, `npm run build`, or Node at all
- Docker on anybody's machine
- PowerShell, a terminal, or the Railway console
- Kyle's laptop being switched on, or even existing

XAMPP is now **only a local development environment**. If the live site is
broken, the cause is on Railway, not on a laptop.

---

## 3. Roles

| Role | What it is |
| --- | --- |
| **Guest** | Not signed in. Can browse the list and the map, search and filter, and see each report's public summary (photo, species, breed, colours, area, date, status). Opening a full report asks them to sign in; the API answers `401 auth_required`. Cannot file anything. |
| **Customer / User** | A community member. Files lost and found reports, uploads photos, reviews possible matches, submits and answers match claims, manages their own reports and profile. |
| **Staff / Pet Coordinator** | Reviews reports and possible matches, compares a lost case against a found one, requests more information, moves statuses, keeps case notes. Not an administrator. |
| **Administrator** | Manages accounts and roles, manages pet categories, moderates flagged content, reviews system activity. Not everyday case processing. |

Role boundaries are a hard requirement of the course, and 31 of the audit cases
exist to prove them.

Ten demonstration accounts are seeded by `database/seed.sql`, with realistic
Philippine names across the three roles — Maria Santos is the customer used by
most tests, Patricia Lim is staff, Grace Bautista is the administrator. They
all share one weak password, which is stated in `docs/team-setup.md` and is
fine for a demonstration and the reason the live URL should not be shared
beyond the class while they exist. It is not repeated here.

---

## 4. The database

Read from `information_schema` on 27 September 2026, and independently
confirmed on MySQL 9.4 by importing the same files into a database named
`railway`.

| | |
| --- | --- |
| Physical tables | **17** |
| On the ERD | **15** |
| Foreign keys | **24** |
| Primary keys | 17 |
| CHECK constraints | 2 |
| Engine | InnoDB throughout |
| Migrations applied | `001`–`007` |
| Seeded rows | 10 users, 32 pet_reports, 4 match_claims |
| Users with `email_verified_at IS NULL` | **0** |

The two tables not on the ERD are `schema_migrations` (which migrations have
run) and `auth_rate_limits` (how recently an address asked for something).
Neither holds domain data, neither has a foreign key, and the figure says so in
its own note. **Say both numbers**: `SHOW TABLES` gives 17, the diagram draws
15, and a diagram that says 15 without that sentence looks like an omission.

Table-by-table defence: [erd-defense.md](erd-defense.md). One page for the
demonstration: [database-defense-cheatsheet.md](database-defense-cheatsheet.md).

### Engine compatibility

Local development runs **MariaDB 10.4.32** (XAMPP). Railway runs **MySQL
9.4.0**. They are not the same engine and they disagree about things a
migration can walk into. `database/schema.sql` has been verified to import
cleanly on MariaDB 10.4, MySQL 8.0.46 and MySQL 9.4.0, with identical columns,
indexes and foreign keys on all three.

One difference is cosmetic and will look alarming if you diff the two: MariaDB
reports an omitted `ON UPDATE` rule as `RESTRICT`, MySQL reports it as
`NO ACTION`. InnoDB treats them identically — both refuse — and this was
confirmed by running the same `UPDATE` against both and getting the same
`ERROR 1451`.

### Why migration 006 exists

`auth_tokens.expires_at` was declared `TIMESTAMP NOT NULL` with no `DEFAULT`.
MySQL and MariaDB silently give the first column declared that way both
`DEFAULT CURRENT_TIMESTAMP` **and** `ON UPDATE CURRENT_TIMESTAMP`. The second
half meant spending a token reset its expiry: a one-hour reset link read as
having expired the instant it was used.

Nothing was exploitable, because both statements that write to that table also
set `used_at` and both require `used_at IS NULL`, so no live token could have
its life extended. But the stored expiry was a lie and the safety was
accidental. Naming the `DEFAULT` explicitly suppresses the implicit
`ON UPDATE`.

**Rule this produced:** give every `TIMESTAMP` column an explicit `DEFAULT`.

### Why migration 007 exists

`database/schema.sql` would not import into MySQL 8 or 9 at all:

```
ERROR 3823 (HY000): Column 'lost_report_id' cannot be used in a check
constraint 'chk_match_distinct': needed in a foreign key constraint
'fk_match_lost' referential action.
```

MySQL refuses a `CHECK` over a column that a foreign key's referential action
could rewrite. MariaDB allows it, which is why the file imported cleanly on
every laptop and would have stopped dead on the host. `007` drops
`ON UPDATE CASCADE` from `fk_match_lost` and `fk_match_found` and keeps the
`CHECK`: `report_id` is an `AUTO_INCREMENT` surrogate nothing ever updates, so
the cascade never did anything, while the `CHECK` is the database's own
guarantee that a report cannot be paired with itself. `ON DELETE CASCADE`
stays. 24 foreign keys before, 24 after.

### Schema and migration parity

`database/schema.sql` is the baseline; `database/migrations/` holds the changes
made after a database already exists. They are kept identical, and this is
checked rather than assumed — a fresh import diffed against the migrated
database, table by table, matched on all 17.

One cosmetic exception: re-adding a foreign key puts its index at the *end* of
the key list, so a database that ran `007` prints `KEY fk_match_found` in a
different place than a fresh import does. The set of keys and constraints is
identical; only the print order differs.

### The Railway database was empty, and that is resolved

Before 27 September the Railway MySQL service had **zero** application tables.
The final 17-table schema and the seed were imported once, directly, and
verified. There is no earlier version of Paws&Found on it, so there was nothing
to migrate — and **migrations `005`, `006` and `007` must not be run separately
against it.** `schema.sql` already contains everything they do and records all
seven as applied.

### The UTF-8 seed trap

**Do not pipe `seed.sql` through PowerShell.** The obvious command imports with
zero errors and silently corrupts the data:

```powershell
Get-Content seed.sql -Raw | docker run -i ... mysql      # WRONG
```

PowerShell re-encodes on the way through the pipe, and the seed contains
em-dashes and curly apostrophes. Tested: it turned `Closed at the reporter's
request.` into `Closed at the reporterÃ¢â‚¬â„¢s request.` — which is then in
the database and on screen during the demonstration.

Mount the file and let the container read it instead:

```powershell
docker run --rm -v "${PWD}\database\railway:/sql:ro" mysql:9.4 sh -c "mysql -h HOST -P PORT -u USER -pPASSWORD --default-character-set=utf8mb4 railway < /sql/schema.sql"
```

`node scripts/railway-sql.mjs` generates `database/railway/` — copies with
`CREATE DATABASE` and `USE` removed, for importing into a database a host has
already created and named. That folder is gitignored so it cannot drift from
the real schema.

Check afterwards with a **binary** comparison, because `utf8mb4_unicode_ci`
treats the mojibake characters as equal to their base letters and a plain
`LIKE` reports every row as suspect:

```sql
SELECT COUNT(*) FROM pet_reports WHERE description LIKE BINARY '%Ã%';   -- 0
```

Full procedure: [deployment-plan.md](deployment-plan.md) §0.5.

---

## 5. Persistent storage

One Railway volume, mounted at **`/var/lib/pawsandfound`**, holding:

```
/var/lib/pawsandfound/uploads/     the photographs
/var/lib/pawsandfound/sessions/    PHP session files
```

`api/uploads` is a **symlink** to `uploads/` on the volume. The entrypoint
creates it and prints six `[paws]` lines at startup naming both paths — read
them in the deploy log when something is wrong.

Sessions are on the volume deliberately. Without that they live on the
container filesystem, and every redeploy signs everybody out mid-demonstration.

**Never casually detach, delete or remount this volume, or the MySQL service's
own volume.** Uploaded photographs exist nowhere else — they are not in the
repository and not in the seed.

---

## 6. Authentication

All of it is enforced server-side. The frontend never decides any of it.

| Behaviour | How |
| --- | --- |
| **Email verification** | Registration creates the account and sends a link; it does **not** sign anybody in. Sign-in refuses an unverified account with `403` and `code: verification_required` — but only **after** the password check, so the refusal tells nothing to somebody who does not already know it. |
| **Password reset** | One answer for every address: registered, unknown, unverified, suspended. Anything that varied would be a way of asking which addresses have accounts, one guess at a time. |
| **Safe email change** | The new address goes in `users.pending_email` and the link is sent **to the new address**. The account address only moves once that link is followed, so a typo cannot lock anybody out of the address they still control. |
| **One-time links** | `auth_tokens` stores only a SHA-256. Single use is one conditional `UPDATE` (`WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()`), not a `SELECT` then an `UPDATE`, so two clicks arriving together cannot both be honoured. A spent token is kept, not deleted, so a replay is recognisable as a replay. |
| **Account lock** | Three wrong passwords locks the account; only an administrator lifts it. Counted per **email typed**, not per account, so an address belonging to nobody counts down identically. |
| **A reset is not an unlock** | A locked account can complete a password reset and is still locked. Otherwise the lock is worth nothing, because whoever triggered it can ask for a reset. |
| **Session revocation** | `users.session_version` against `$_SESSION['session_version']`, compared on every request. A password reset or a suspension ends every other session at once, without hunting through session files on disk. |
| **Session expiry** | Idle and absolute timeouts, enforced on the server. Nothing in the browser is asked. |
| **Rate limiting** | `auth_rate_limits`, counted per action against an HMAC of the address, rolling window, `429` with `Retry-After`. Separate from the account lock — a different rule with a different consequence. |
| **Turnstile** | The widget produces a string that proves nothing; it means something only when the server asks Cloudflare whether that token was issued for this site and has not been spent. The site key is public and served at runtime by `GET /api/config`; the secret never leaves the server. Production refuses to start with `TURNSTILE_ENABLED=true` and a key missing, on purpose. |
| **Server-authoritative everywhere** | `current_user()` re-reads role and account status from the database on every request, so a role downgrade or a suspension takes effect on the next click, on every device. Proved by `npm run multi-device` across three independent sessions. |

Concurrent state changes use conditional updates —
`UPDATE ... WHERE id = ? AND status = ?` plus `rowCount()` — and answer `409`
with `code: stale_state` when somebody else moved first. `json_response()`
rolls back an open transaction on any error, so a losing request writes
nothing, logs nothing and notifies nobody.

---

## 7. Email

### What happened, because it explains the design

SMTP was configured first: Brevo's relay on `smtp-relay.brevo.com:587`, with
`MAIL_TRANSPORT=smtp`. Every verification email failed. Testing from inside the
Railway container showed why:

```
smtp-relay.brevo.com:587 -> Connection timed out
```

**Railway's trial plan blocks outbound SMTP.** Not slowly — the connection
cannot be opened at all. That is a property of the hosting plan and not
something the code can argue with. Port 443 is open, because the site is served
over it.

So production sends the same messages to the same provider over HTTPS instead:

```
MAIL_TRANSPORT=brevo_api
POST https://api.brevo.com/v3/smtp/email
headers: api-key, Content-Type, Accept
```

This is a **transport, not a rewrite**. The messages, the templates and every
caller are unchanged. Registration verification, resend, forgot password, reset
and the email change all still go through the single `send_mail()` function.

**Verification email has been received successfully in real production.**

### The four transports

| `MAIL_TRANSPORT` | Where | What it does |
| --- | --- | --- |
| `brevo_api` | **Production** | HTTPS to Brevo. Needs `BREVO_API_KEY`. |
| `smtp` | Anywhere outbound 587 is allowed | The hand-written SMTP client in `api/mail.php`. |
| `log` | A laptop | Writes the message to the PHP error log. The default outside production. |
| `capture` | Tests only | Writes the message to a file so `scripts/auth_lifecycle.py` can read a link the way a person reads an inbox. **Must never be set in production.** |

`BREVO_API_KEY` is read from the environment only. It is never committed, never
logged, and never reachable from the browser — `GET /api/config` returns the
Turnstile flag and site key and nothing else, and three audit cases
(`AU-36`–`AU-38`) exist to keep it that way.

### Delivery is honest

Brevo accepting the request is the only thing that counts as sent. A transport
error or any non-2xx becomes a `MailFailure`, and the API reports
`email_sent: false`. Nobody is told their verification email is on its way when
it is not. Brevo's own words go to the log — where they explain a wrong key or
an unverified sender — and never to the browser.

An unknown `MAIL_TRANSPORT` fails **by name** in the log rather than quietly
falling through to SMTP, because a typo used to surface fifteen seconds later
as a complaint about a mail server nobody had configured.

`MAIL_FROM_ADDRESS` must be a sender Brevo has verified, or it refuses the
message with a `400`.

### Note on the SMTP variables

With `brevo_api` set, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`,
`MAIL_PASSWORD` and `MAIL_ENCRYPTION` are **not read at all**. They are
harmless to leave in place and worth leaving — they are what `smtp` needs if
the plan is upgraded or the host changes. `MAIL_ENCRYPTION` takes the exact
lowercase literal `starttls` (port 587) or `tls` (implicit TLS, port 465);
both comparisons are `===`, so `STARTTLS` does not match.

---

## 8. Deployment

| | |
| --- | --- |
| Host | Railway |
| Production URL | https://paws-found-production.up.railway.app |
| Builder | `DOCKERFILE`, per `railway.json` |
| Healthcheck | `/api/health`, 120s timeout |
| Restart policy | `ON_FAILURE`, max 5 |
| Replicas | 1 |
| Volume | one, at `/var/lib/pawsandfound` |
| Database | a separate Railway MySQL service, **9.4.0** |

**Railway deploys `team/current` from `Kazuhiroxv/Paws-Found`** — the
`portfolio` remote in this clone, not `origin`. This is confirmed by the live
site running code that only exists on that remote's branch tip. Verify it
yourself in the Railway service settings before relying on it.

The application reaches MySQL over Railway's **private** network. The MySQL
service's **public TCP proxy** was needed only to import the schema and seed
from a laptop, and to run the test suites against production. **It should be
disabled once that work is done** and re-enabled only when needed again.

One origin serves both the site and the API, which is why there is no CORS
configuration to get wrong and why the session cookie simply works.

### Environment variables

Names only. Values live in Railway and nowhere else.

```
DB_HOST DB_PORT DB_NAME DB_USER DB_PASS      (Railway references, not pasted values)
APP_ENV=production
APP_URL                                      every link in every email is built from this
MAIL_TRANSPORT=brevo_api
BREVO_API_KEY
MAIL_FROM_ADDRESS MAIL_FROM_NAME
TURNSTILE_ENABLED TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY
```

`PORT` is injected by Railway. `PERSIST_ROOT` and `SESSION_SAVE_PATH` default
to the volume path and need setting only if the mount path changes.

`MATCH_DEBUG` is unset (false) in normal running. Set it to `true` only to
diagnose a pairing that should have appeared: each filing then writes one
`[pawsandfound][matching]` trace line to the Railway log. Remove it afterwards.
A matching failure is logged either way.

`api/config.php` reads `DB_*` first and falls back to Railway's own `MYSQL*`
spellings, so either naming works.

---

## 9. Git — verified 27 September 2026

**Check these yourself before trusting them.** Remote-tracking refs go stale,
and this document was wrong about exactly that once already.

```bash
git fetch --all
git branch --show-current
git log --oneline -8
git for-each-ref --format='%(refname:short)  %(objectname:short)' refs/remotes
```

At the moment of writing:

| Where | Branch | Commit |
| --- | --- | --- |
| Local | `team/current` (checked out) | **this documentation commit**, sitting directly on `3ad16be` |
| Local | `feature/final-auth-hardening` | `aae0ce8` (merged; keep or delete) |
| `portfolio` → `Kazuhiroxv/Paws-Found` | `team/current` | **`e97116b`** ← what Railway deploys |
| `origin` → `Arkemic/paws-and-found` | `team/current` | `aae0ce8` |
| `origin` | `main` | `6c8d0ec` |

**`origin`'s push URL is deliberately disabled** (`DISABLED-do-not-push-to-team-repo`).
Pushing to the team repository is not done from this clone by accident. Do not
re-enable it without asking Kyle.

**Unpushed at the time of writing:** `3ad16be` and this documentation commit
are on neither remote. The team repository (`origin`) is also behind Kyle's by
those two plus `e97116b`.

Run `git log --oneline portfolio/team/current..team/current` for the current
answer rather than trusting this paragraph.

### The commits, and what each is

| Commit | Status | What it is |
| --- | --- | --- |
| `58d02f0` | historical | One volume at `/var/lib/pawsandfound`, and a startup log worth reading. The last commit before the account lifecycle. |
| `16331da` | historical | **Account lifecycle** — verification, password reset, safe email change, `auth_tokens`, rate limiting, Turnstile, migrations `005` and `006`. |
| `cfa17b3` | historical | Reconciled the documents with the system; gave `multi_device.py` an honest "skipped" state. |
| `54c7bbe` | historical | Made the schema import on MySQL 8; migration `007`; the Railway fresh-install procedure. |
| `aae0ce8` | **on both remotes** | The PowerShell UTF-8 seed corruption fix. Tip of `origin/team/current`. |
| `e97116b` | **deployed** | Brevo HTTPS transport. Tip of `portfolio/team/current`; this is what production runs. |
| `3ad16be` | **local only** | Case-insensitive response headers in `verify_deployment.py`. Test harness only — no application behaviour. |
| *this commit* | **local only** | These five documents. Documentation only. |

---

## 10. Tests

All run on 27 September 2026 unless noted. Commands and prerequisites:
[TESTING.md](TESTING.md).

| Suite | Result | Needs |
| --- | --- | --- |
| `npm run lint` | clean | — |
| `npm run build` | green | — |
| `npm run test:contract` | **15/15** | nothing running |
| `npm run test:mail` | **15/15** | `php` on PATH; one check calls Brevo |
| `npm run audit` | **334/334** | API + database |
| `python scripts/auth_lifecycle.py` | **53/53** | API + database, local only |
| `npm run multi-device` | **55/55** local | API + database |
| `npm run test:matching-log` | **6/6** | `php` on PATH, local database |
| `npm run test:ui` | **20/20** | the dev build (`PAWS_BASE=http://localhost:5173`), `PAWS_PW`, Chrome |
| `npm run test:signout` | **24/24** | the dev build (`PAWS_BASE=http://localhost:5173`), `PAWS_PW`, Chrome |
| `npm run a11y` | 31 pages, **zero violations** | the dev build (`PAWS_BASE=http://localhost:5173`) |
| `docker build --pull --no-cache` | clean, one MPM, `Syntax OK` | Docker |
| `npm run verify:deploy` against production | **25/25 + 3 skipped** (read-only default; `--upload` for 28) | the live URL |

### Expected skips against a remote

`multi_device.py` reports **53/53 with 2 skipped**, not 55/55, when pointed at
a container or a host. Checks `K3` and `K4` prove the session timeout is
enforced by the server, and they do it by turning the timeout down to one
second in `api/config.local.php` on the machine running the suite — a server
somewhere else never reads that file. The suite names them as skipped rather
than reporting a failure it did not observe. Both run for real locally.

`auth_lifecycle.py` cannot run against production at all: it needs the
`capture` mail transport, which production must never have. Prove mail on the
host by registering one throwaway account and reading the inbox.

### The header-case bug, because it will look like a regression otherwise

`verify:deploy` reported `7.1 http:// redirects to https://` as a failure
against production, with `Actual: 301 ->`. The `301` was read; its target was
not.

HTTP header names are case-insensitive and servers disagree about
capitalisation. Apache sends `Location`; Railway's edge sends `location`.
`urllib` returns a case-insensitive object, but `fetch()` did `dict()` of it,
and a plain dict is not. Fixed at the source with a small `dict` subclass that
lowercases on the way in and out, so `Content-Type`, the CORS header and
anything looked up in future all work whatever the server sends — the other
three lookups only passed because those headers happened to arrive with the
capitalisation the script expected.

The check was **not** weakened: pointed at a plain-HTTP deployment it still
fails, correctly. Production then passed **28/28**.

---

## 11. Where to read next

| Document | For |
| --- | --- |
| [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md) | Operating the live site, deploying, rolling back, troubleshooting |
| [TESTING.md](TESTING.md) | Every test command, what each mutates, the smoke test |
| [UI_UX_POLISH.md](UI_UX_POLISH.md) | The current phase of work, and its boundaries |
| [DECISIONS.md](DECISIONS.md) | Why things are the way they are, and what was rejected |
| [../CLAUDE.md](../CLAUDE.md) | The course brief and the rules this project is built under |
| [design-system.md](design-system.md) | The visual language, in detail |
| [erd-defense.md](erd-defense.md) | Every table, defended |
| [deployment-plan.md](deployment-plan.md) | The Railway procedure in full |
| [feature-status.md](feature-status.md) | What works, item by item |
| [presentation-defense.md](presentation-defense.md) | Nineteen questions and their answers |

---

## 12. Things that are still open

Stated plainly so nobody rediscovers them the hard way.

- **`3ad16be` is unpushed**, and the team repository (`origin`) is two commits
  behind. Kyle decides when and where those go.
- **The MySQL public TCP proxy should be disabled** once the remote suites have
  been run.
- **`npm run test:mail` needs `php` on PATH**, which XAMPP does not add. The
  symptom is `'php' is not recognized`, which says nothing about mail.
- **The demonstration accounts share one weak password.** Fine for a
  demonstration; the reason the live URL should not be shared widely while they
  exist.
- **`origin`'s push URL is disabled on purpose.** Do not re-enable it casually.
- **Editing a report does not re-run matching.** Filing a report looks for
  possible matches once. Editing now saves every field (species, location,
  pin, colours and the rest), but existing pairings are not re-scored and new
  ones are not searched for. A coordinator still sees the edited report.
- **Removing a seeded photo removes its row, not a file.** The seed photos ship
  with the frontend rather than living in `api/uploads/`; only files this server
  generated (32 hex characters) are ever deleted from disk.
- **Optional mobile polish, deliberately left for after the freeze** (found by
  the final 390px sweep, none of them broken):
  - Explore on a phone: Map view lists every result under the map as a
    full-height card (32 cards, about 16,000px); List view pages at 9.
  - Staff Overview "Recent cases": a status pill sometimes wraps under the name.
  - Admin Overview: five stat tiles in a two-column grid leave the fifth alone.
- **A reporter's answer to "request more information" lives only in
  notifications.** It is delivered to each active coordinator as a
  `verification_requested` notification (255 characters, the column's size) and
  is stored nowhere else, so that the other reporter never sees it. The
  reporter sees a "sent" confirmation, not a history. That is a deliberate
  no-migration choice made just before the freeze; a `match_responses` table is
  the proper long-term shape (see DECISIONS.md).
- **`match_claims.staff_notes` can be written but not read.** A coordinator's
  note on a pairing decision is stored, and no endpoint returns it to anybody,
  staff included. That is safe, not leaky; it becomes a gap only if the staff
  UI needs to show those notes. Left alone on purpose until it does.
- **`htdocs/pawsandfound` holds a stale copy of the frontend** (its `api/` is a
  symlink to the repository, the rest is a September 25 build). `npm run a11y`
  defaults to it; point it at the dev server instead, as above.
