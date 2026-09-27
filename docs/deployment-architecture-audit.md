# Can Paws&Found run on Vercel and Supabase?

**ITS122P–AM5 · Group 3** · 26 September 2026 · **audit only, nothing changed**

The instructor expects the finished site to be reachable from her own devices,
not only from `localhost`. This is what stands between the system as it is now
and that being true, and what each possible route would cost.

No application code was modified while writing this.

---

## The short answer

**A single PHP + MySQL host gets us online with no migration at all.** The
eighteen steps in `deployment-plan.md` already describe it, the three
verification commands already take a URL, and none of the 191 automated checks
would change.

**Vercel + Supabase is not a deployment of this system. It is a rewrite of its
bottom half** — and the repository documents MySQL as an instructor
requirement, not as our choice.

---

## §6 first, because it decides everything else

`docs/final-project-guide-requirements.md` is transcribed from the instructor's
Final Project Guide, received 19 August 2026. Line 16:

```
| 4 | MySQL database | **Not started** | Next deliverable |
```

Not "a relational database". **MySQL**, as mandatory requirement number four.

Supporting it, `CLAUDE.md:193`:

```
| Database | **MySQL via phpMyAdmin / XAMPP** (instructor-specified) |
```

and `CLAUDE.md:209`:

```
- **MySQL**, minimum **8 related tables**, proper PK/FK, relationships,
  normalisation, CRUD, SQL queries
```

**How the repository treats it: instructor requirement, twice, with
"instructor-specified" written next to it.** Nothing in `docs/` treats the
database engine as a team preference.

Supabase is PostgreSQL. Every Supabase project is a Postgres database — that is
the product. So choosing Supabase means answering requirement 4 with something
that is not MySQL.

**This is not a technical judgement I can make for you. It is a question for
Ma'am**, and it has to be asked before anything is migrated:

> "The guide says MySQL. Is that specifically MySQL, or would another
> relational database be acceptable?"

If the answer is "MySQL", §8 below is moot and we take Path A.

*Separately: that requirements table is badly out of date. It still says "Not
started" for MySQL, PHP, the REST API, security and deployment, all of which
are done, and "Not done" for pagination, which is done. Worth correcting before
it is read by anybody.*

---

## §1 Frontend — **LOW risk**

Vercel-ready essentially as it stands.

| | |
| --- | --- |
| Build | `vite build`. Standard, no custom server |
| Base path | `vite.config.js:24` — `base: process.env.VITE_BASE ?? '/pawsandfound/'` |
| API URL | `src/services/api.js:34` — `` const API_BASE = `${import.meta.env.BASE_URL}api` `` |
| Env vars needed | **none of our own.** Only `VITE_BASE=/` |
| Dev-only code | `import.meta.env.DEV` in 5 files, all tree-shaken from a production build |

The API URL is **derived from the base path, never hard-coded**. That decision —
made for the local Apache deployment — means the frontend already works at a
domain root with no source change. `npm run build:deploy` exists and does
exactly this.

**Deep links** need an SPA fallback. On Apache that is `public/.htaccess`; on
Vercel it is a `rewrites` entry. One config file either way.

---

## §2 PHP API — **MEDIUM risk on Vercel, zero on a PHP host**

Three Apache/XAMPP dependencies, all real:

**1. URL rewriting.** `api/.htaccess`:

```apache
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php?_route=$1 [QSA,L]
Options -Indexes
```

Every request reaches `api/index.php`, which dispatches on `$_GET['_route']`.
Outside Apache this has to be reproduced by the platform's own routing. The
router itself does not care where `_route` came from — `index.php:33` reads it
from the query string, with the comment that this "keeps the API usable if
mod_rewrite is ever unavailable". That foresight helps here.

**2. The local filesystem**, `api/reports.php:604`:

```php
$directory = __DIR__ . '/uploads';
if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) { … }
```

plus `move_uploaded_file` at `:655` and `@unlink` at `:719`. See §5.

**3. `api/uploads/.htaccess`**, which is what stops an uploaded file being
executed. On a platform without `.htaccess` that protection has to be
reimplemented, and it is not optional.

**Good news:**

* **No absolute Windows paths anywhere in `api/` or `src/`.** Verified by
  search. The only ones are in `scripts/`, which is developer tooling.
* Extensions needed are `pdo_mysql` and `gd`/`getimagesize` — both ordinary.
* No persistent in-process state other than sessions (§4).

---

## §3 Database — **MEDIUM-HIGH risk to convert**

Counted in `database/schema.sql`:

| MySQL feature | Count | PostgreSQL |
| --- | --- | --- |
| `AUTO_INCREMENT` | 14 | → `GENERATED … AS IDENTITY`. Trivial syntax |
| `ENUM(...)` | 18 | → `CREATE TYPE … AS ENUM`, declared separately. **Behavioural**: our `ALTER TABLE … MODIFY COLUMN action ENUM(...)` in migration 004 becomes `ALTER TYPE … ADD VALUE`, which has different rules |
| `INT UNSIGNED` | 41 | **No `UNSIGNED` in Postgres.** Becomes `INT` + a `CHECK (col >= 0)`, or `BIGINT`. Touches every PK and FK |
| `ENGINE=InnoDB` | 15 | Delete. Postgres has one engine |
| `CHARSET=utf8mb4` / `COLLATE` | 31 | Delete. Postgres databases are UTF-8 |
| `ON UPDATE CURRENT_TIMESTAMP` | 2 | **No equivalent.** Needs a trigger per table |
| `TINYINT` | 3 | → `SMALLINT` or `BOOLEAN` |

In `api/*.php`:

| | Count | Note |
| --- | --- | --- |
| Backtick identifier quoting | 32 | Postgres uses `"` — every one has to change |
| `NOW()` | 4 | Works, but returns `timestamptz` |
| `DATE_FORMAT` | 1 | → `to_char`, different format string |
| `ON DUPLICATE KEY UPDATE` | 1 | → `ON CONFLICT … DO UPDATE` |
| `LIMIT … OFFSET` | 2 | Works unchanged |

**Verdict: no major redesign, but a great many small changes, each of which can
be silently wrong.** The ERD does not change — 15 domain tables, 24 foreign
keys, the same relationships and the same delete rules. What changes is
`schema.sql`, all four migrations, `seed.sql`, every query in `api/`, and the
PDO DSN.

**The risk is not difficulty, it is coverage.** An `UNSIGNED` that becomes a
plain `INT` without its `CHECK` loses a constraint nobody would notice until a
negative id appears.

---

## §4 Sessions — **MEDIUM risk**

`api/helpers.php:105-124`. Sessions use **PHP's default handler, which writes
files to local disk**. The cookie is configured carefully — `httponly`,
`SameSite=Lax`, and `secure` computed from `request_is_https()` so the same
code is correct on HTTP and HTTPS — but the *storage* is a local file.

On one server that is fine, and it is fine on any shared PHP host. On a
stateless or autoscaled platform, two requests can land on different instances
and the second one does not find the session. Signing in and then being signed
out on the next click is the symptom.

**Option A — keep our authentication, move the session store.** A
database-backed session handler, or a `sessions` table. Our bcrypt hashing, the
three-attempt lock, the administrator unlock, the role-read-per-request model,
CSRF, suspension and all 191 tests survive untouched. This is the small change.

**Option B — Supabase Auth.** Would bring email verification, password reset
and CAPTCHA, which are genuinely the largest gaps in our account lifecycle. It
would also discard: the lock/unlock workflow, `login_attempts`, the per-request
role read, our CSRF scheme, 35 authentication cases and 40 multi-device checks.
**Not recommended as part of a deployment.** If it is ever done, it is its own
project with its own regression run.

---

## §5 File storage — **HIGH risk on Vercel, zero on a PHP host**

Every upload path is local disk: `api/reports.php:604, 655, 719`. Photographs
are written under a generated name into `api/uploads/` and served straight from
there.

Per the Vercel material you supplied, function filesystems are read-only apart
from a temporary `/tmp`. If that is accurate, **`api/uploads/` cannot be
production storage on Vercel** — files would vanish between requests. This is
the hardest blocker of the three for that platform, and it is not a
configuration setting.

Supabase Storage would be a genuinely good answer to it, and the two-bucket
split you sketched is better than our single directory:

```
report-public-images    public listing photographs
verification-private    ownership evidence, signed URLs only
```

But note this cuts both ways: **we do not currently store private evidence
files at all.** Proof of ownership is free text in `match_claims.staff_notes`,
protected by `may_read_proof()` (`matches.php:468`). So the second bucket would
be a new feature, not a migration.

On an ordinary PHP host, none of this applies. `api/uploads/` works exactly as
it does now, which `npm run verify:deploy` already proves end to end by
uploading a file and fetching it back as a signed-out visitor.

---

## §9 Test impact — **HIGH**

| Suite | Cases | If we stay on MySQL | If we move to PostgreSQL |
| --- | --- | --- | --- |
| `npm run audit` | 170 | **Config only.** `PAWS_API` + `PAWS_MYSQL_ARGS` already exist | **Rewrite.** 49 assertions shell out to `mysql.exe`; 3 read `information_schema` with MySQL-specific column names |
| `npm run multi-device` | 55 | **Config only.** `PAWS_API` | Mostly config — it is nearly all API-level |
| `npm run a11y` | 29 pages | None | None |
| `npm run verify:deploy` | 28 | **None.** Takes a URL | None |

Staying on MySQL costs **two environment variables**. Moving to PostgreSQL
costs a rewrite of the harness that produces our strongest evidence — and it
would have to be re-proved before we could trust it again.

---

## The two routes

### Path A — one PHP + MySQL host · **LOW risk, ready now**

```
    https://<domain>/          React build at the root
    https://<domain>/api/      the PHP API, unchanged
    https://<domain>/api/uploads/   photographs, on the host's disk
                     │
                     └── hosted MySQL
```

**Changes required: none to application code.** One `api/config.local.php` with
four values, and `RewriteBase /`. `deployment-plan.md` §3 is the runbook and it
is already written.

Preserves MySQL, the ERD, the schema defence, the migration system, the
authentication design and all 191 checks.

### Path B — Vercel + Supabase · **HIGH risk, and it answers requirement 4 with Postgres**

```
    Vercel ── React frontend
       └───── PHP API (container)
                 ├── Supabase PostgreSQL
                 └── Supabase Storage
```

What would have to change, by risk:

| Area | Risk | Why |
| --- | --- | --- |
| Frontend | **LOW** | One env var |
| SPA fallback / API routing | **LOW** | `vercel.json` replaces two `.htaccess` files |
| Sessions | **MEDIUM** | Local files → database-backed |
| Schema + migrations + seed | **MEDIUM-HIGH** | 18 ENUMs, 41 UNSIGNED, 14 AUTO_INCREMENT, 2 ON UPDATE triggers |
| Every SQL query in `api/` | **MEDIUM-HIGH** | 32 backtick quotes, `ON DUPLICATE KEY`, `DATE_FORMAT` |
| Uploads | **HIGH** | Local disk is not durable there; needs a Storage client and a rewritten upload path |
| The test harness | **HIGH** | 49 direct database assertions |
| Rubric requirement 4 | **HIGH** | The guide says MySQL |

### A hybrid worth knowing about

If Vercel is wanted specifically for the frontend, this works without touching
the backend at all:

```
    Vercel ── React frontend   ──►  https://<php-host>/api
```

It costs a **cross-origin** setup — `ALLOWED_ORIGINS` (`config.php:57`),
`SameSite=None; Secure` on the session cookie, and third-party-cookie blocking
in some browsers. That last one is why `deployment-plan.md` §1 chose same-origin
in the first place, and it is the one thing most likely to fail in front of an
examiner on an unfamiliar device. **Not recommended.**

---

## What must not be rewritten

Regardless of route:

* the three-attempt lock, the administrator unlock, and `login_attempts` keyed
  on the email typed;
* `current_user()` re-reading the role on every request — the reason a role
  change reaches three devices without a sign-out;
* the CSRF check in `index.php` before the router;
* `REPORT_TRANSITIONS` and the match decision state machine;
* `may_read_proof()`;
* the 170 + 55 + 53 + 15 case suites, as behaviour rather than as files.

---

## Questions for Ma'am, before anything is migrated

1. **Is requirement 4 specifically MySQL, or is any relational database
   acceptable?** Everything else depends on this.
2. Does "accessible online" mean a public URL she can open, or would a LAN
   address on the presentation day satisfy it?
3. Is email verification / password reset expected? It is our largest genuine
   product gap and it does not depend on the hosting decision.

---

## Recommendation

**Take Path A now.** It is a day's work, it is already documented step by step,
it preserves the rubric answer for requirement 4, and it costs nothing we would
have to re-prove.

Then, with the system actually online, spend the remaining time on the things
the mock defence suggests Ma'am tests — state integrity, recovery workflows,
concurrency, and the account lifecycle — rather than on re-earning 191 green
checks we already have.

Revisit Path B only if Ma'am says the database engine is open, and then as its
own project with its own regression run, not as a deployment.
