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
| `a11y`, `test:signout` | The dev build; Chrome. |
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

### `npm run test:contract` — 15 checks

Node's built-in test runner. **No server, no database.** These exist because
two real defects got through every other suite by being *agreements between two
files* rather than faults in either one: the collar answer (`"yes" | "no" |
"unknown"` from the form through the API to MySQL and back) and the contact
preferences. They assert the shape of what the form sends and what the API
returns.

`sign-in-destination.test.mjs` adds two: after signing in, somebody is sent
back to the page they were headed for only when their role can open it. Signing
out inside a workspace leaves that workspace as the way back, and the next
person on the same browser may hold a different role.

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

### `npm run audit` — 299 checks

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
| I. Location privacy | 8 |
| J. Report access | 27 |
| K. Information requests | 17 |
| L. Report editing | 31 |
| M. Report QA rules | 8 |
| N. Final integrity | 38 |

`RA-01`–`RA-27` pin down who receives what. A guest's list row is exactly the
public summary, a guest opening a report gets `401 auth_required` (a missing
one is still 404), and guest search cannot find a word that exists only in a
description or the markings. Another member gets no `reporter_id`, no history
notes, and roles instead of names; the owner and staff still get all three.
Contact details still follow each report's sharing choice. Pairings need a
session, a customer sees only pairings involving their own reports, and staff
and administrators see all of them. Run against the previous API, 19 of these
fail.

`IR-01`–`IR-17` follow a coordinator's request for more information to its
answer. Only a reporter in the pairing may answer (guest 401, unrelated
customer and staff 403), only while the question is open (409 before it and on
a decided pairing), not empty, and at most 255 characters (256 is refused, not
cut). The answer reaches every active coordinator and nobody else: not the
other reporter, whether through their notifications or the pairing they can
open. The pairing stays under review, and proof_notes, staff_notes and both
case histories are unchanged.

`ED-01`–`ED-31` hold the edit contract: whatever the edit form lets an owner
change must persist. Species with breed, sex, collar, date and time, label,
city, province, the pin and the three contact choices are each edited and read
back from the database. The report's own location row is updated in place,
with no orphaned locations. Photos can be added, described, made main and
removed (the file goes too); removing the main one hands the role to the
earliest left; five is the limit; another report's photo cannot be touched;
and no report anywhere ends up with zero or several main photos. Non-owners get
403, guests 401, and a closed report refuses edits, photo changes and uploads.
Run against the API before this change, 20 of them fail.

`QA-01`–`QA-08` are the final QA rules, enforced by the server as well as the
form: a found report must answer the collar question, and "not sure" is a
valid answer; a report must keep at least one contact method, on filing and on
edit; and "Other" stores the named animal in breed.

`FI-01`–`FI-38` are the final integrity rules. A hand-built request cannot skip
anything the form requires (every required field, breed-or-feature, naming an
"Other" animal, sex), every text field over its limit is a 422 rather than a 500,
and impossible times and map pins are refused, on filing and on edit. "Show
phone" does not count when the account has no phone. Ruling out a pairing needs
a note, and notes over 255 characters are refused. When a report is marked
returned or closed, its open pairings are dismissed, the other report goes back
to Active, and its reporter is told; unrelated and already-decided pairings are
untouched. Moderation removal needs a reason.

`LP-01`–`LP-08` pin down the location promise. The database keeps the pin as
dropped. Anybody who is not the reporter or staff (a guest or another signed-in
user) gets it snapped to a 0.004° grid, which is always within the 400 m circle
the map draws. The reporter and coordinators still get the stored pin. `LP-08`
files a pair 14.93 km apart that the grid would put 15.14 km apart, either side
of matching's 15 km cut-off, to prove the matcher measures from the stored pin.

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

### `npm run test:signout` — 23 checks

A real Chrome and the real Sign out button. The API has always refused a guest
the full report; this is about the browser. A report opened while signed in
must leave the screen when the session does — as its owner, another member, a
coordinator and an administrator — and must not come back through Back, a
refresh or the same address. On Back it must not even flash up: a DOM observer
records whether the private text is ever painted before the gate. With the report open in one tab and Sign out
pressed in another, the first tab shows the gate as soon as it regains focus,
or at the next ten-second re-check if it is left alone. Not real time.

Home and Explore stay public, but a signed-in member is sent more of each row
(description, markings, condition, time, place name). After Sign out the lists
must be fetched again as the guest summary; the check reads the responses
themselves, so a row that is merely not displayed still fails.

It also signs in through the form: a guest bounced from a customer page is
returned to it, and a customer signing in after staff signed out inside a
workspace lands on their own dashboard.

Switching accounts on one browser (`SO-L`, `SO-O`, `SO-P`): Sign out goes home
first, so whoever signs in next starts at their own workspace rather than the
page the last person was on; a guest bounced from a page they asked for is
still returned to it (`SO-K`). `SO-Q` fills a Report Found form, signs out,
signs in as somebody else and opens the form again in the same page: it is
empty.

The map (`SO-R`-`SO-V`): every pin a guest is sent sits on the 0.004° public
grid; a guest's Explore map stops at zoom 15, at desktop and at 390 px; a
signed-in member's still zooms to 18; the owner still receives the stored pin.
The server's snapping is the protection, and the audit's `LP` cases pin it
down. The zoom limit only stops the map implying more precision than that.

Run against the code before each fix: 6 of the first 11 fail for the stale
report; `SO-P`, `SO-S` and `SO-T` fail for the account switch and the zoom.

**Mutates nothing.** Point it at the dev build, and give it the seeded password
from the environment so it is neither in the script nor in its output:
`PAWS_BASE=http://localhost:5173 PAWS_PW=<password> npm run test:signout`.

### `npm run a11y` — 31 pages

axe-core over every page in every role. Zero violations is the standard, not
the aspiration. The report page is audited three ways: the guest sign-in gate,
the owner's view and another member's view.

Point it at the current code: `PAWS_BASE=http://localhost:5173 npm run a11y`
with the dev server running. Its default, `localhost/pawsandfound`, serves
whatever frontend was last copied into htdocs. It fails outright if a signed-in
page bounces to /login, which is how it once reported sixteen workspaces clean
while auditing the sign-in form.

axe cannot judge text over a photograph, which is why contrast on the hero was
measured separately by sampling pixels.

**Mutates nothing.**

### `docker build --pull --no-cache`

A clean image build. Two checks happen at build time and fail the build rather
than shipping: exactly one Apache MPM is enabled, and `apache2ctl configtest`
passes.

### `npm run verify:deploy <url>` — 28 checks, 25 by default

The things that only fail on a host: whether the API answers JSON rather than a
challenge page, whether a deep link refreshes, whether an uploaded photograph
comes back to a signed-out visitor, the session cookie's `Secure`, `HttpOnly`
and `SameSite` flags on the real domain, whether errors leak SQL or paths,
whether CSRF survived the production build, whether `config.local.php` is
readable over the web, and whether any demo password reached the bundle.

**Changes no data by default.** A normal run reports the three upload checks
(`5.1`-`5.3`) as **SKIPPED**, so against production it reads **25/25 passed,
3 skipped**. The upload path is tested only when asked:

```bash
python scripts/verify_deployment.py https://paws-found-production.up.railway.app --upload
```

`--upload` attaches one small PNG to the demo account's newest report and
leaves it there: there is no delete endpoint, and a report holds at most five
photos. Before this was opt-in, every run did it, and report 1 (Milo) collected
three blank test images and hit the cap, which is what `5.1` failing with a 422
looks like. Use it after changing upload code or the storage volume, not as a
routine health check.

Against **plain HTTP** `7.1` fails, correctly, because localhost has no
certificate: 24/25 with 3 skipped, or 27/28 with `--upload`. Against HTTPS,
everything passes.

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
test:contract                            15/15
test:mail                                15/15
audit                                   299/299
auth_lifecycle                           53/53
multi-device                             55/55   (53/53 + 2 skipped vs a remote)
test:signout                             23/23
a11y                                     31 pages, 0 violations
docker build --pull --no-cache           clean, curl present, one MPM, Syntax OK
verify:deploy vs production              25/25 + 3 skipped (read-only default)
verify:deploy --upload vs local XAMPP    27/28   (7.1, correctly, on plain HTTP)
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
