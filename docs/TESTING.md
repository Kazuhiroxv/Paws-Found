# Testing

Every suite, what it needs, what it touches, and what it last returned.
Written 27 September 2026.

The short version: run `lint`, `build` and `test:contract` before any commit.
Run the rest before any push. Run `verify:deploy` after any deploy.

---

## 1. Prerequisites

| Suite | Needs |
| --- | --- |
| `lint`, `build`, `test:contract` | Node 20+. Nothing running. |
| `test:mail` | **`php` on PATH.** XAMPP installs PHP but does not add it — add `C:\xampp\php` and open a new terminal. Symptom otherwise: `'php' is not recognized`, which says nothing about mail. One check reaches `api.brevo.com` over 443. |
| `audit`, `multi-device`, `auth_lifecycle` | Python 3, Apache running, MySQL running. **XAMPP here runs MySQL on port 3307**, not 3306. |
| `a11y` | The dev build; Chrome. |
| `verify:deploy` | Python 3 and a reachable deployment. |
| Docker build | Docker Desktop running. |

`audit` and `multi-device` take `PAWS_API` and `PAWS_MYSQL_ARGS` so they can be
pointed at a container, the LAN address or production.

`PAWS_MYSQL_ARGS` goes to a MySQL client. **XAMPP's `mysql.exe` is MariaDB's
and cannot authenticate against MySQL 8 or 9** — it fails with
`Plugin caching_sha2_password could not be loaded`. Use the official client
from Docker when pointing at Railway.

---

## 2. The suites

### `npm run lint` · `npm run build`

ESLint over everything; Vite production build. Touch nothing, need nothing.

### `npm run test:contract` — 13 checks

Node's built-in test runner. **No server, no database.** These exist because
two real defects got through every other suite by being *agreements between two
files* rather than faults in either one: the collar answer (`"yes" | "no" |
"unknown"` from the form through the API to MySQL and back) and the contact
preferences. They assert the shape of what the form sends and what the API
returns.

**Mutates nothing.**

### `npm run test:mail` — 15 checks

The one door every account email goes through. `send_mail()` is shared by
registration, resend, forgot password, reset and the email change, so what is
worth testing is the door rather than five identical callers.

Covers the payload Brevo is sent, that a display name cannot smuggle a newline
into it, that `log` and `capture` still work, and that **every path which
cannot deliver throws** rather than returning a quiet false.

One check (`B1`/`B2`) really does call Brevo, with a deliberately invalid key,
and insists on being refused. No credential is involved — an invalid key is not
a secret — and it proves what a fake server cannot: that the machine can reach
the API over 443, that TLS verifies, and that a refusal ends as a failure
rather than as `email_sent: true`.

```bash
php scripts/mail_transport.php --offline
```

skips that one check when there is no network.

**Mutates nothing.** Sends no real email.

### `npm run audit` — 170 checks

The security and functional suite, against the running API and database.

| Category | Cases |
| --- | --- |
| A. Input validation | 19 |
| B. SQL injection | 14 |
| C. Authentication | 41 |
| D. Authorization | 31 |
| E. Cross-site scripting | 4 |
| F. File upload | 7 |
| G. Functional | 44 |
| H. Error handling | 10 |

`SQL-12` and `SQL-14` assert the table and foreign-key counts, so the ERD
cannot be wrong quietly. `AU-36`–`AU-38` assert that `GET /api/config` offers
the Turnstile flag and site key and **nothing else** — it is the only
settings-shaped thing the frontend reads, so it is where a secret would
plausibly be added by accident.

**Mutates data heavily.** Files reports, uploads files, suspends accounts,
locks accounts, decides matches. It **reseeds at the start and restores at the
end**, so it is safe to run repeatedly on a development database — and it will
**wipe** whatever is in the database it is pointed at. Never point it at
production without understanding that.

### `python scripts/auth_lifecycle.py` — 53 checks

Registration, verification, sign-in refusal, the password reset, the session
revocation that comes with it, a reset *not* unlocking a locked account, the
safe email change, and rate limiting.

It reads every link out of **captured mail**, exactly as a person reads one out
of an inbox, because there is no endpoint that hands out a token and there is
not going to be one.

**Cannot run against production.** It needs `MAIL_TRANSPORT=capture`, which
production must never have. It writes `api/config.local.php` while it runs and
restores whatever was there before.

**Mutates data.** Restores the demonstration data at the end.

### `npm run multi-device` — 55 checks

Three sessions with three cookie jars and three CSRF tokens, as three browsers
on three machines would have. It proves the **database** is the authority
rather than each session carrying its own copy of the truth: a report change, a
read-state change, a role downgrade, a suspension, a three-attempt lock, an
administrator unlock, a server-side session expiry, and two people moving the
same report at the same moment.

**Expected skips against a remote.** Pointed at a container or a host it
reports **53/53 with 2 skipped**, not 55/55. Checks `K3` and `K4` turn the
session timeout down by writing `api/config.local.php` on the machine running
the suite, and a server elsewhere never reads it. The suite names them as
skipped rather than reporting a failure it did not observe. Both run for real
locally.

**Mutates data.** Restores at the end.

### `npm run a11y` — 29 pages

axe-core over every page in every role. Zero violations is the standard, not
the aspiration.

axe cannot judge text over a photograph, which is why contrast on the hero was
measured separately by sampling pixels.

**Mutates nothing.**

### `docker build --pull --no-cache`

A clean image build. Two checks happen at build time and fail the build rather
than shipping: exactly one Apache MPM is enabled, and `apache2ctl configtest`
passes.

### `npm run verify:deploy <url>` — 28 checks

The things that only fail on a host: whether the API answers JSON rather than a
challenge page, whether a deep link refreshes, whether an uploaded photograph
comes back to a signed-out visitor, the session cookie's `Secure`, `HttpOnly`
and `SameSite` flags on the real domain, whether errors leak SQL or paths,
whether CSRF survived the production build, whether `config.local.php` is
readable over the web, and whether any demo password reached the bundle.

**Uploads one small PNG.** Does not reseed.

Against **plain HTTP it scores 27/28**, failing `7.1` — correctly, because
localhost has no certificate. Against HTTPS, 28/28.

> **A note on `7.1`.** It once reported a false failure against production:
> `Actual: 301 ->`. The redirect was correct; the harness was reading
> `Location` case-sensitively and Railway sends `location`. Fixed globally with
> a case-insensitive header mapping. If `7.1` fails again, check the actual
> response first — `curl.exe -s -o NUL -D - http://<domain>/` — before touching
> Apache.

---

## 3. Last verified results

27 September 2026, on the development laptop unless stated.

```
lint                                     clean
build                                    green
test:contract                            13/13
test:mail                                15/15
audit                                   170/170
auth_lifecycle                           53/53
multi-device                             55/55   (53/53 + 2 skipped vs a remote)
a11y                                     29 pages, 0 violations
docker build --pull --no-cache           clean, curl present, one MPM, Syntax OK
verify:deploy vs production              28/28
verify:deploy vs local container         27/28   (7.1, correctly, on plain HTTP)
schema.sql vs migrated database          identical across all 17 tables
schema.sql on MySQL 8.0.46 and 9.4.0     imports clean; 17 tables, 24 FKs
```

Against production:

```bash
npm run verify:deploy https://paws-found-production.up.railway.app
```

---

## 4. Presentation-day smoke test

Two minutes, in a browser, no terminal. Do it the evening before and again an
hour before.

1. **Homepage** loads, hero image renders, recent reports appear.
2. **Explore** — filter by species, then by city. Results change. Clear the
   filters; the count returns.
3. **A report detail page** — photograph, structured details, status badge, the
   location circle on the map.
4. **Sign in** as the customer account. The dashboard greets by name.
5. **Sign in** as staff in a second browser, and as the administrator in a
   third. Each workspace is different, and the customer cannot reach either.
6. **One possible match** — open it, see the seven signals and the score that
   adds up to the headline number.

Optional, if you want a number on screen:

```bash
curl.exe -s https://paws-found-production.up.railway.app/api/health
```

`{"status":"ok","database":"ok"}`.

**Do not run `npm run audit` against production before a demonstration.** It
reseeds.
