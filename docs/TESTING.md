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
| `a11y`, `test:signout`, `test:ui` | The dev build; Chrome. |
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

### `npm run test:contract` — 32 checks

Node's built-in test runner. **No server, no database.** These exist because
two real defects got through every other suite by being *agreements between two
files* rather than faults in either one: the collar answer (`"yes" | "no" |
"unknown"` from the form through the API to MySQL and back) and the contact
preferences. They assert the shape of what the form sends and what the API
returns.

`no-mock-in-production.test.mjs` adds three, and they guard an architectural
rule rather than a behaviour: nothing that ships may depend on the mock dataset
in `src/mock/`. Every workflow already went through the API to MySQL, but until
2 October three services imported the old in-browser mock database for a small
error class, which dragged fake users, pets and notifications into the
production bundle. The tests check that `mockDb.js` is gone, that nothing in
`src/` imports `@/mock` statically, and that the one place allowed to load it
(the development-only role selector) does so inside an `import.meta.env.DEV`
branch, which a production build removes.

The other half of that guard is `npm run check:bundle`, run after a build. It
reads what Vite actually emitted into `dist/` and fails if any of the mock
dataset is in it. Its markers are taken from `src/mock/` itself — every mock
record id and the opening of every mock description, 91 in all — so it
follows the data rather than watching for one name. It was checked against the
pre-fix build, where it fails, before being trusted on the fixed one.

`sign-in-destination.test.mjs` adds two: after signing in, somebody is sent
back to the page they were headed for only when their role can open it. Signing
out inside a workspace leaves that workspace as the way back, and the next
person on the same browser may hold a different role.

`dates.test.mjs` adds six, with the zone pinned to Asia/Manila. The API sends
a recorded moment (`created_at` and the like) as `2026-09-29 12:38:00` in UTC
with no zone on it, and every connection now uses UTC (`api/db.php`), so
local and production send the same thing. Read as local time it was eight
hours out: a notification five minutes old said "8 hours ago" and a reply at
8:38 PM said 12:38 PM. They check it reads as 8:38 PM and "5 minutes ago";
that an ISO value carrying its zone is read as it says; and that an incident
date such as `2026-09-24` stays on the 24th, also in a zone behind UTC, where
it used to show the 23rd. And with the clock pinned at 06:00 in Manila (22:00
UTC the day before), the report form accepts a report dated today and refuses
tomorrow; it used to read today as UTC midnight, 8 AM in Manila, and refuse it
every morning. Against the previous code, five of the six fail.

`match-wording.test.mjs` adds three. A pairing is stored as dismissed both
when a reporter says "Not my pet" and when it is withdrawn because one of its
reports was marked Returned or Closed; `wasWithdrawn()` tells the two apart by
the reports, so the second reads "Withdrawn · a report was finished" instead
of "Ruled out · by the reporter".

The password and name rules add five more. The checklist states the rule the
server enforces (15 characters at least; 72 **bytes** at most, tested with a
65-character, 72-byte accented passphrase and the same plus one letter); the
JavaScript and PHP copies agree on the limits and the common-word list (read
out of `api/helpers.php`); obvious long passwords are refused and real
passphrases are not; a password equal to the person's own name or address is
refused and one merely containing a first name is not; the strength label is
Weak until the rules are met and then Fair or Strong; and names of every shape
pass while "A", "1" and "!!!!" do not.

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

### `npm run audit` — 382 checks

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
| O. Match rejection | 24 |
| P. Repeat matching | 11 |
| Q. Calendar dates | 3 |
| R. City names | 2 |
| S. Editing and matching | 18 |
| T. Reopening a decision | 25 |

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

`MR-01`–`MR-24` separate a pairing's decision from a report's lifecycle. A
coordinator's "Not the same pet" rejects that pairing only: with no other open
pairing both reports go back to Active, with a history line each and both
reporters told; with another pairing still open the report stays Possible
Match. A rejected pairing takes no second decision (confirm, reject again or a
verification request are all 409) and sits in no open queue. A reporter may
still finish their own report later: it becomes Returned, the rejected pairing
stays rejected and never turns confirmed, and only pairings still open are
dismissed.

`MG-01`–`MG-11` (MG-REPEAT) replay the production sequence behind a pairing
that failed to appear: a lost report pairs with found report A at 95, that
pairing is dismissed and A closed, and the same reporter files found report B
with A's exact details and no map pin. B must pair again, at 95, with seven
signals that add up to the score, both reports Possible Match and both
reporters told, while the old pairing stays dismissed. It passes; the
production miss was not reproduced, and no deterministic cause has been found.
A matching failure is always written to the server log as one
`[pawsandfound][matching] ... FAILED at <stage>` line. With `MATCH_DEBUG=true`
(off by default) every filing also writes its trace: the candidates, each
score and gate, and what was stored, for a controlled reproduction.

`LP-01`–`LP-08` pin down the location promise. The database keeps the pin as
dropped. Anybody who is not the reporter or staff (a guest or another signed-in
user) gets it snapped to a 0.004° grid, which is always within the 400 m circle
the map draws. The reporter and coordinators still get the stored pin. `LP-08`
files a pair 14.93 km apart that the grid would put 15.14 km apart, either side
of matching's 15 km cut-off, to prove the matcher measures from the stored pin.

`EM-01`–`EM-18` hold the rule that a report under an open pairing cannot
change underneath the coordinator verifying it. While a report is Possible
Match, editing its details, adding a photo or changing a photo are all refused
with `409 match_open`, and nothing in the database moves; the pairing, its
score and both reports are exactly as they were. Once the pairing is settled
and the report is Active again, the same edits succeed. An edit to an Active
report re-runs matching, so a corrected species or place can surface a new
pairing, and a decided pairing is never rewritten. Against the previous API,
EM-03, EM-04, EM-05, EM-05b and EM-13 fail.

`RO-01`–`RO-25` hold reopening a decision. A guest (401) and a reporter (403)
cannot; an open pairing has nothing to reopen (409); a reason is required
(422). A rejection reopens to under review with both reports Possible Match,
a line in each case history, both reporters told and an audit row, and the
stored comparison untouched; the reports are frozen again, and the pairing can
then be confirmed as usual. A confirmation reopens too, taking both reports out
of Returned — unless a report has since been closed (409). A reporter's
"Not my pet" can be reopened too, back to under review with both reports
Possible Match; a pairing withdrawn because a report was closed cannot (409,
and nothing moves). And the dog/turtle case: a pairing ruled
out and then its found report edited into a turtle is refused with
`comparison_changed`, and nothing moves.

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

### `python scripts/auth_lifecycle.py` — 100 checks

Registration, verification, sign-in refusal, the password reset, the session
revocation that comes with it, a reset *not* unlocking a locked account, the
safe email change, and rate limiting.

`RS-1`–`RS-5` cover a reset to the password the account already has. It used
to be accepted, sign every other session out and say "Password changed". It is
now a 422 on the password field, and the link is **not** spent, no session is
revoked and no reset is recorded, so the same link then works for a password
that is actually new (which spends it, raises `session_version` once and
records one reset). A locked account is refused the same way and stays locked.
`RS-5` sends two resets with one link at the same moment: exactly one
succeeds. Against the previous API, RS-1a–g and RS-4a fail.

Section I holds the account rules (`api/helpers.php`). `N1`–`N12`: "A", "1"
and "!!!!" are refused as names; Jo Li, Ma. Ana Cruz, Anne-Marie Cruz,
D'Angelo Reyes, O’Connor and José Santos are accepted; spaces are tidied; and
the profile refuses "A" on the name field and changes nothing. `P1`–`P12`, at
registration: 14 characters, 73 bytes, a 66-character password that is 74
bytes, `passwordpassword`, one character repeated, a common word and digits,
the email, the part before the @ and the name run together are all refused;
15+ passphrases, Fair and Strong ones, and one that merely contains the first
name are accepted. `R1`–`R7`, at reset: too short, too common and the account's
own name are refused, the current password still has its own reason, **none
of those spends the link**, and a valid one is accepted and signs the other
session out. `X1`–`X2`: seeded accounts keep their old 8-character password
and still sign in; no password is forced to change.

It reads every link out of **captured mail**, exactly as a person reads one out
of an inbox, because there is no endpoint that hands out a token and there is
not going to be one.

**Cannot run against production.** It needs `MAIL_TRANSPORT=capture`, which
production must never have. It writes `api/config.local.php` while it runs and
restores whatever was there before.

**Mutates data.** Restores the demonstration data at the end.

### `npm run multi-device` — 73 checks

Three sessions with three cookie jars and three CSRF tokens, as three browsers
on three machines would have. It proves the **database** is the authority
rather than each session carrying its own copy of the truth: a report change, a
read-state change, a role downgrade, a suspension, a three-attempt lock, an
administrator unlock, a server-side session expiry, and two people moving the
same report at the same moment.

Section L holds the one-session rule. A coordinator or an administrator keeps
one session at a time: signing in on a second device ends the first on its next
request (401), the account moves on exactly one `session_version`, and the new
device is told any earlier session ended. A wrong password from elsewhere ends
nothing. A customer keeps every device, and signing out ends only the device it
is on. Section D: a demotion keeps the session (it carries on as a customer's);
a promotion into staff ends every session the account had open. The
three-devices-at-once checks (A, E) use a customer, because that is the case
the rule still allows.

**Expected skips against a remote.** Pointed at a container or a host it
reports **71/71 with 2 skipped**, not 73/73. Checks `K3` and `K4` turn the
session timeout down by writing `api/config.local.php` on the machine running
the suite, and a server elsewhere never reads it. The suite names them as
skipped rather than reporting a failure it did not observe. Both run for real
locally.

**Mutates data.** Restores at the end.

### `npm run test:city` — 11 checks

How places compare when a report has no map pin. Location is a gate: when it
fails, no pairing is suggested at all. Without a pin the city name decides,
and it had to be character for character the same, so "Pasig City" and
"Pasig" never met. Now case and repeated spaces never matter, and a trailing
"City" is optional only when both reports give the same province: "Quezon
City", Metro Manila and "Quezon", Quezon province stay apart. With pins on
both reports, distance decides as before. Against the previous matcher the
four cases that should now match fail and the rest pass. Audit section `R`
files real reports through the API. Needs `php` on PATH; no database.

Still compared as written, on purpose: colour and breed spellings ("Grey" and
"Gray", "Tricolour" and "Tricolor", "Gold" and "Golden", "Shih Tzu" and
"Shih-Tzu") and province spellings ("Metro Manila" and "NCR"). A different
colour or breed costs that signal's points but is not a gate; it is a known
limitation of rule-based matching, left alone rather than guessed at.

### `npm run test:calendar` — 8 checks

Which day "today" is, and which zone the database speaks. An incident date is
a Philippine calendar day but the server runs in UTC, which is still on
yesterday until 8 AM in Manila, so the API refused a report dated today every
morning. `app_today()` (api/helpers.php) answers on the Manila calendar with
an injectable clock: at 22:00 UTC on the 29th it is the 30th, a report dated
the 30th is accepted and the 1st is refused, and PHP's own time zone is left
alone. The last check asks the database: every connection is `+00:00` and
`NOW()` equals UTC. Audit section `Q` checks the same on the live API with the
real clock. Needs `php` on PATH and the local database; **changes no data**.

### `npm run test:matching-log` — 6 checks

What matching writes to the server log. With `MATCH_DEBUG` off, the normal
setting, a routine run writes nothing; on, it writes its one trace line. A
failure (the database made unreachable) is written either way, once, with the
stage and exception, and still reaches the caller. No line carries
coordinates, addresses, passwords or tokens. Needs `php` on PATH and the local
database; **changes no data** (it asks about a report that is already finished).

### `npm run test:ui` — 66 checks

Two interface regressions from final manual testing, in a real Chrome.
`MOD-LINK-1`–`4`: on Administrator > Moderation, "Open the full report" is a
real link (it used to be a span sitting over the title's stretched link and
swallowing the click), reachable with Tab and opened with Enter; the title
opens the same report; the decision note and the tabs do not navigate.
`REG-1`–`10`: registration marks nothing on a fresh form or while a field is
being typed, says what is wrong once a field is left, clears it as soon as
it is fixed, blocks a submit with a bad email without sending it, and the API
still refuses that email when it is sent by hand.
`MOD-FLAG-1`–`4` and `MOD-DECIDE-1`: a member raises a flag from a report's own
"Report this listing" dialog (201, thanked, recorded as theirs), it reaches the
administrator's queue, the report itself is untouched, and its owner is not
shown who flagged it; the administrator then dismisses it from the queue with a
note (200). Both used to send a plain object where JSON was declared and got
"The request body was not valid JSON". `MOD-JSON`: the API still refuses a body
that is not JSON. `MOD-WORDING` and `MOD-DECIDE-2`: the button says "Warn report
author", because the person who flagged a listing also "reported" it, and the
decision reaches the person who filed the pet report and not the person who
flagged it (unchanged behaviour, now said on the page).
`NAV-MOBILE-1`–`5`, `K`, `T`: on a phone or tablet, the workspace menu
(Administration, Pet Coordinator) opens directly under its button however far
down a long list it is tapped, without moving the page; choosing a section goes
there and closes it; Enter opens it and Tab moves into it; the desktop rail is
unchanged. The menu used to open at the top of the page, 1,200 to 3,000px out of
sight.
`HISTORY-1`–`5` (local only): a ruled-out pairing whose report was edited
afterwards reads "Historical comparison" in the Match Queue and on the report
page, with its stored reasons in the past tense beside today's report; an open
pairing carries no label; the customer's Possible Matches still leaves ruled-out
pairings out; and the stored score still equals its seven signals.
`PWD-1`–`12`: on Register, the label is Weak while a requirement is not met
(Create account disabled), Fair once every one is (accepted, and not drawn as
an error), Strong for a long passphrase; a long common password and the email
address itself are refused; pasting into "Type it again" is allowed; both boxes
keep `autocomplete="new-password"`; Show password works; a one-letter name is
marked on the field; it fits at 390 px. On Reset, the same label and checklist
(no name/email item: the link does not say whose account). On Profile, "A" is
refused on the field and nothing is sent.
`REOPEN-1`–`2` (local only): in the Match Queue a ruled-out pairing offers
Reopen for review, which asks first and cannot be sent without a reason, and
reopening sends it back to a coordinator. `REOPEN-3`–`4`: a reporter's "Not
my pet" offers Reopen for review; a withdrawn pairing does not.
`ADMIN-SITE-1`–`4`: a signed-in administrator opening Home, Explore, Report a
pet, About, Help or Privacy is sent to `/admin`; a report page (`/pet/1`) still
opens; the admin rail has no "Back to the public site" and its logo goes to
the Overview; a Pet Coordinator is unaffected. `DECIDE-ASK-1`–`2`: in Verification,
Confirm match asks "Confirm this match?" and Not the same pet asks "Rule this
pairing out?", each with Go back focused, and Go back decides nothing.
`REPORT-ACTIONS-1`–`5`: on My Reports, a returned report shows Close report as a
button inside its own card at 360, 390, 768 and 1366px, instead of a More menu
holding only that item whose panel hung over the next card; an open report
keeps its More menu with Edit and Close; closing still asks first, Keep it open
keeps it, and a confirmed close moves the card to Closed, which offers nothing.
`EDIT-MATCH-2`: a report with an open possible match shows no Edit on My
Reports, and its edit address says editing is paused.
`TABLE-HEAD-1`–`2`: scrolled, a table's sticky header sits at the top of the
page on desktop Users and exactly under the workspace bar on tablet Categories,
with no rows showing through a gap; it used to stick 72px down.
`WITHDRAWN-1`–`2` (local only: they finish a report): a pairing withdrawn
because a report was marked Returned reads "Withdrawn · a report was finished"
in the coordinator's queue and on the other reporter's report page, not
"Ruled out · by the reporter" or "Dismissed by User".

**Mutates local data**: the MOD-FLAG checks raise one flag and dismiss it, and
REPORT-ACTIONS closes one returned report, so they run only against localhost and are skipped anywhere else. The one
hand-built registration is refused.
`PAWS_BASE=http://localhost:5173 PAWS_PW=<password> npm run test:ui`.

### `npm run test:signout` — 24 checks

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
signed-in member's still zooms to 18; the owner still receives the stored pin;
and a map first drawn signed in stops at 15 once the person has signed out and
come back to Explore without a reload (`SO-W`).
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

2 October 2026, on the development laptop unless stated, on branch
`post-defense/revisions`. `test:mail` and the clean-build Docker line are from
27 September (nothing they cover has changed).

```
lint                                     clean
build                                    green
test:contract                            32/32
check:bundle                             0 of 91 mock markers in dist/
test:calendar                             8/8
test:mail                                15/15
audit                                   382/382
auth_lifecycle                          100/100
multi-device                             73/73   (71/71 + 2 skipped vs a remote)
test:signout                             24/24
test:ui                                  66/66
test:city                                11/11
test:matching-log                         6/6
a11y                                     31 pages, 0 violations
docker build --pull --no-cache           clean, curl present, one MPM, Syntax OK
verify:deploy vs production              25/25 + 3 skipped (read-only default)
verify:deploy --upload vs local XAMPP    27/28   (7.1, correctly, on plain HTTP)
verify:deploy vs local production image 24/25 + 3 skipped  (7.1, correctly, on plain HTTP)
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
