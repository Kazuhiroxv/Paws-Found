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

Every suite built on `scripts/audit.py` refuses a database that is not this
machine, and `audit` also refuses a non-local `PAWS_API` (`npm run
test:audit-guard` proves both). `multi-device` can still take a LAN `PAWS_API`
against this machine's database. Containers and LAN databases are refused
until the team decides they count as local.

`PAWS_MYSQL_ARGS` goes to a MySQL client. **XAMPP's `mysql.exe` is MariaDB's
and cannot authenticate against MySQL 8 or 9** — it fails with
`Plugin caching_sha2_password could not be loaded`. Use the official client
from Docker when pointing at Railway.

---

## 2. The suites

### `npm run lint` · `npm run build`

ESLint over everything; Vite production build. Touch nothing, need nothing.

### `npm run test:contract` — 36 checks

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

### `python scripts/auth_lifecycle.py` — 106 checks

Registration, verification, sign-in refusal, the password reset, the session
revocation that comes with it, a reset *not* unlocking a locked account, the
safe email change, and rate limiting.

Section I was rewritten for Correction 2: first and last name are refused or
accepted separately (`N1`–`N13`, including the profile saving both parts and
`full_name` following), and a password containing the first or last name
anywhere is refused at registration (`P9`–`P12`) and at reset (`R3`, `R3b`) —
where the name comes from the database, and the refusal leaves the link unspent
(`R6`) so the same link then sets a valid password (`R4`).

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
address itself are refused; pasting into Confirm password is refused with the
reason shown (reversed by Correction 2 — it used to assert paste was allowed);
both boxes keep `autocomplete="new-password"`; Show password works; a one-letter
first name is marked on the field; it fits at 390 px. On Reset, the same label and checklist
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

### `npm run a11y` — 36 pages

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

### `npm run test:identity` — 41 checks (Correction 2)

The server's own name and password-identity rules, called directly — no
database, no HTTP. First and last name each accept real names of every shape
("Ma.", "Anne-Marie", "D'Angelo", "O’Connor", "José", "Dela Cruz") and refuse
"A", "1", "!!!!" and "-"; a password containing either name anywhere is refused,
case-insensitively, piece by piece ("Anne-Marie" refuses "…marie…"). The cases
live in `scripts/identity-cases.json`, which `identity-rules.test.mjs` (in
`test:contract`) runs against the browser's copy — so the two copies are held to
the same list and cannot drift. Needs `php` (XAMPP's: `C:\xampp\php\php.exe`).

### `npm run test:feedback` — 49 checks (Correction 2)

What was seen at the defense, driven through the interface.

- `CF-1`–`8`: Confirm password is absent until the password qualifies (and
  while it contains the first name), refuses a paste and a drop with a reason,
  accepts typing, keeps Create account disabled on a mismatch, and is emptied
  and hidden if the password stops qualifying.
- `SB-*`: a form submitted from the **bottom** of the page ends with its answer
  on screen and focused — registration refused by the server, the wizard's
  Continue refused, and a found report filed — at 1280 and at 820 px.
- `RW-*`: at 390, 768, 820, 912, 1023, 1024, 1280, 1440 and 1920 px, the date
  filter is visible (on arrival from 1024; one click on Filters below), a filter
  can be set and cleared, navigation has a way through, and no control is under
  24 px (the map's attribution links are exempt as inline text).

Files one found report and tries one registration with a taken address. Reseed
afterwards.

### Correction 3 suites

**`npm run test:report-rules` — 50 checks** (`scripts/report_rules.php`). The
server's own name, description and time rules, called directly. The cases live
in `scripts/report-rules-cases.json`; `scripts/report-rules.test.mjs` (in
`test:contract`) holds the browser's copy to the same list. `RN` pet name, `RD`
description, `RT` time.

**`npm run test:scores` — 11 checks** (`scripts/match_scores.php`, needs the
seeded database). Matching weights unchanged; the four demonstration pairings
still score 85, 75, 100, 100 through the real `compare_reports()`; "Mixed
breed" and "Other" never count as agreement; XL matches XL; two reports
without pins compare the city code when both have one. **If a demonstration
score moves, stop and explain — do not edit the number.**

**`npm run test:controls` — 62 checks** (`scripts/report_controls.py`, local
only, reseeds). Through the API: `BR` breeds (listed per species; a typed
breed stored but unlisted; another case reuses the listed row), `CO` colours,
`PH` areas and cities (dependent; a city outside its area refused;
names written by the server; Explore filters), `RS` XL, `RN/RD/RT-API`,
`CONTACT` (a crafted `show_phone` is ignored; no report detail carries the
number, even with `show_phone = 1` in the database; coordinators still see the
account's number), `MAP-API` (Tokyo, Kota Kinabalu, Sandakan and Miangas
refused; Kalayaan, Batanes, Tawi-Tawi, the Turtle Islands, Mangsee and
Sitangkai accepted), `MG` (009 recorded, 84/1642/17 rows, every seeded place
coded, ñ stored as UTF-8).

**`npm run test:report-ui` — 47 checks** (`scripts/report_ui.mjs`). The form
in Chrome at 820 px and as an iPhone 13 at 390 px with touch: the map opens on
Batanes-to-Tawi-Tawi, a tap places a pin without touching province or city, a
point outside is refused in words; photo rules stated, "2 of 5 photos added",
"Main photo" moves, a sixth and a non-image refused; the city list follows the
province; the description counter; AM/PM; no phone option; no `tel:` link on
ten seeded report pages; Explore's XL, colour and place filters. Files one
report; reseed afterwards.

**`npm run check:psgc`.** The place CSVs and the two generated SQL blocks
(`schema.sql`, `009`) are in step, and the counts are PSA's: 82 areas of type
province, plus Metro Manila (`ncr`) and the Special Geographic Area
(`special_area`); 149 cities; 1,493 municipalities. Given PSA's workbook too
(`python scripts/psgc_reference.py check <xlsx>`), it re-extracts it and
requires the CSVs to be exactly what it gives.

**Correction 3A — `PSGC1`–`PSGC10`.** In `test:controls`: `PSGC1` 82 areas are
provinces; `PSGC2` 149 cities; `PSGC3` 1,493 municipalities; `PSGC4` the area
list is 82 + Metro Manila + the SGA = 84, each typed; `PSGC5` NCR is typed
`ncr` in the database and the API (and in `test:report-ui`, `PSGC5-UI`: the
form's label is "Province or Metro Manila", and `EX-2`: Explore's chip says
"Metro Manila", never "Province: Metro Manila"); `PSGC6` all 1,642 places are
reachable through their area, once each; `PSGC7` the 32 seeded reports resolve
to a city and an area; `PSGC8` "City of Las Piñas" is UTF-8 in MySQL and
through the API; `PSGC10` the 30 June 2026 names (Sawata, Don Victoriano,
Sanchez Mira, Tagoloan II). `PSGC9` is its own suite:

**`npm run test:migrations` — 23 checks** (`scripts/migration_parity.py`).
On MySQL 9.4 in strict mode (Docker) and on XAMPP's MariaDB (scratch databases,
never `pawsandfound`), it builds production's path — the `2947a43` schema and
seed, then 008, then 009, then 009 again — and a fresh `schema.sql` +
`seed.sql`, and requires them to match: every file imports without an error,
the counts (20 tables, 26 keys, migrations 001–009, 82/1/1 areas, 1,642
places, 17 colours, 32 listed breeds, no uncoded place, ñ as UTF-8), the table
structure and every reference row. The two engines must also hold the same
rows. Never touches Railway.

The existing suites changed with the rules they test: `audit` 382 → 384
(`XSS-00`: markup in a pet name is now refused, so the stored-and-escaped
payload moved to the place label; `ED-08b`: the place is stored by code;
`FN-41` and `RA-20` reversed — a phone is never published; table and key counts
20 / 26); `test:contract` 36 → 45; `test:feedback` files its report with the
new lists. `scripts/audit.py`'s `file_report()` turns an old-style city name
into PSGC codes: a real place by name, a made-up one ("Audit QA City") into a
municipality of its own chosen by hash, so each case still files where no
other report is.

### Correction 4 suites

**`npm run test:publication` — 71 checks** (`scripts/publication_workflow.py`,
local only, reseeds). `PUB` the state machine: filed means pending (a crafted
`publication_status`/`status` is ignored), customers cannot approve, a
coordinator cannot approve their own report, the reviewer is the session,
rejection needs a reason, resubmission keeps the rejection in history, unknown
actions (including "cancel") are refused. `VIS` direct access: a pending or
rejected report is 404 to a guest and another member, 200 to its reporter,
coordinators and administrators; never in public lists or search; asking for
unpublished lists is 401/403; nobody can flag one. `MATCH-PUB-1`…`9`: drafts,
pending and rejected reports are never paired; approval pairs at once; report
2's twin, approved, pairs with report 1 at **85**; a published edit is
compared again; the open-match freeze holds; removal withdraws open pairings
and a removed report is never paired again. `DR` drafts: almost-empty drafts
save, bad values do not, nobody else (coordinators included) can read or
change one, an incomplete draft cannot be submitted, a complete one becomes a
pending report and disappears, deletion deletes. `RM1`–`12` removal: not
public, not Closed, reason shown to the reporter, 404 to the public, open to
coordinators and administrators, logged and audited, no Closed event, nothing
turns it back. `NT` notifications. `CNT` dashboards count published reports.
`LEG` migration 010 on the seed.

**`npm run test:workflow-ui` — 33 checks** (`scripts/workflow_ui.mjs`). In
Chrome: a report saved as a draft, then continued in a second browser on a
phone (another device, same account), restored exactly; another account cannot
open it; never in Explore. Submit for review: the confirmation on screen and
focused at 820 px and on a phone, saying a coordinator must approve it; not
public, not matched; the coordinator's queue and sidebar count; Approve from
the full report; published, matched, the reporter notified. A rejection with a
required reason, the reporter sees it, edits, submits again, approved. An
administrator removes it: 404 to the public, under Removed — not Closed — for
its reporter.

`npm run test:migrations` now runs 008 → 009 → 010 → 010 (25 checks), and
compares the publication states, report 9's conversion and the pairings too.
`audit.py`'s `file_report()` publishes what it files (a coordinator approves
it) unless `publish=False`, so the existing suites keep testing public
reports; it signs in again if a suite ended the coordinator's session. The
audit's table and key counts are 22 and 32.

### Correction 5 suites

**`npm run test:sessions` — 88 checks** (`scripts/session_activity.py`,
local only, reseeds; writes `api/config.local.php` to turn the session clocks
down to seconds and capture email, and puts back what was there). `SES-01`…`19`
one record per sign-in (user, IP, user agent, start, a 32-hex reference, the
PHP session id stored nowhere), and every end: sign-out, idle (dated when it
expired), time limit, password reset (every device), a coordinator signing in
elsewhere, a wrong password ending nothing, two customer devices coexisting,
lock, suspension (reinstating does not revive it), promotion (demotion keeps
the session), last seen moving on, and an unended three-day-old record shown
as expired, never open. `ACT-01`…`23` page views (one per page; queries,
fragments, outside URLs and control characters refused; nothing with a token
stored), reads and the background check not logged, guests not tracked, a
forged actor/action/IP ignored, an invented action stored nowhere, a flood cut
at 60 a minute, and each meaningful action — report filed and approved, draft
saved/updated/deleted, rejection, edit, a match decision, a flag and its
moderation decision, profile update, sign-in and sign-out — in the trail with
its target. `LOG-01`…`13` administrators read all three logs; coordinators and
customers 403, guests 401; ten thousand rows page 50 at a time with no overlap
in under 2 s, newest first; filters by Manila day, person, IP, action, session
reference; malformed filters 422. `IP-01`…`12` through the real Apache: off
Railway a spoofed `X-Real-IP` or `X-Forwarded-For` reaches no session, activity
or audit row and the connecting address is recorded; with Railway simulated
(`BEHIND_RAILWAY_EDGE` in `config.local.php`) the edge's `X-Real-IP` is on the
session record, its activity rows and its audit row alike, `X-Forwarded-For`
is still ignored, a malformed `X-Real-IP` falls back, and the reset-link rate
limit keeps a separate bucket per visitor address (Correction 5A). `SENS-01`…`09` sentinel values — a password, any
bcrypt hash, every CSRF token and PHP session id handed out, the reset and
verification tokens, a Turnstile token, a cookie header, the new password —
appear in none of the three log tables.

**`npm run test:session-ui` — 26 checks** (`scripts/session_ui.mjs`, reseeds,
writes and restores `api/config.local.php`). `RACE-1`…`4`: the cross-tab
sign-out race **made to happen**, with no CPU load. The Chrome DevTools Fetch
domain pauses tab A's `/auth/me` *after the server has answered* "signed in";
tab B signs out; tab A asks again (focus, or a route change); the stale answer
is released. The app's ten-second poll is switched off inside these browsers,
so only the code under test can correct the tab. Then: this tab signing out
while its own stale check is in flight must never show the account again,
even for a frame (a MutationObserver watches); ten focus events during one
check make one extra check, not ten. **Against the old `useSession` RACE-1,
RACE-3 and RACE-4 fail every time; RACE-2 passes against both** (the old code
recovers that path another way), so it guards the behaviour without
discriminating the bug. `MSG-01`…`07` the words for a sign-out, inactivity, the
time limit, another device, a password change, suspension and lock, each
announced (`role="alert"`, a labelled Dismiss). `PV-01`…`06` page views from a
real browser: once per page, a link followed, none for re-renders, refocus or
the poll, never a query or fragment, none for a reset link, none for a guest.
`LOGUI-1`…`6` the Logs page: sign-ins with IP and session, why each session
ended, failures-only, a filter in the address, no sideways scroll at 390 px, a
coordinator turned away.

**`npm run test:client-ip` — 18 checks** (`scripts/client_ip.php`, no
database; rewritten in Correction 5A). Each situation in a PHP process of its
own, because the decision is a constant: `DET` production + Railway's variable
is Railway, the production image without it is not, development never is;
`IP-01`…`03` locally every header is ignored, a 100.x peer is not special;
`IP-04`…`08` behind the edge `X-Real-IP` is taken (IPv4, IPv6), a malformed or
missing one falls back to `REMOTE_ADDR` and is logged without its value, and
`X-Forwarded-For` / `CF-Connecting-IP` are never read.

`npm run test:migrations` now runs 008 → 009 → 010 → 011 → 011 (27 checks):
24 tables, 35 keys, migrations to 011, and both new tables empty — nothing
invented. The audit's table and key counts are 24 and 35. `a11y` adds Logs
(activity) and Logs (sessions): 36 pages.

### Correction 6 suites

**`npm run test:admin-levels` — 93 checks** (`scripts/admin_levels.py`,
local, reseeds). The seed's one administrator (a Super Administrator)
promotes a coordinator to Moderator and a customer to Manager through the API.
`CAP` what `/auth/me` sends each kind of account. `MOD` a Moderator by direct
call: logs, account changes, promotions, level changes, categories and the
`suspend` moderation decision refused; the queue, a `remove` decision (logged
with the level) and removing a published report allowed; the account list
without contact details. `MAN` a Manager: logs, any role change, another
administrator's level or status refused; suspending (with a reason),
reinstating and unlocking customers and coordinators, categories allowed.
`SUP` a Super Administrator: logs; promotion only with a level; `god`,
`root`, `""` and a level for a non-administrator refused; a level change and
a role removal each end the target's session (`privilege_changed`); own
account refused. `OUT` coordinators, customers and guests refused everything.
`BIZ` the Super Administrator cannot edit a customer's report, resubmit it
for them, answer as a reporter, or write the audit log. `SA-01`…`07` always
an active Super Administrator; **`SA-08` ten rounds of two Super
Administrators demoting each other at the same instant: every round, one
succeeds, the other is refused, one remains, no server error.** `SES`
newest-login-wins at every level, customers unchanged, a level change ends
the target's session only. `AUD` audit and activity rows: actor, target,
`old -> new`, IP, session.

**`npm run test:admin-levels-ui` — 33 checks** (`scripts/admin_levels_ui.mjs`,
reseeds). In Chrome, per level: the navigation each sees; a typed
`/admin/users`, `/admin/logs` or `/admin/categories` answered "You don't have
permission to access this page." with nothing of the page rendered; no link
left for the keyboard; a Moderator dismissing a flag without the suspend
option; a Manager suspending a customer (the button waits for a reason) and
reinstating them, with administrators' rows closed to them; a Super
Administrator whose confirm waits until a level is chosen, promoting a
customer and then changing her level — and her open sessions told why each
time.

**Correction 6A adds** `REV-ROLE-01`…`12` to `test:admin-levels` (now 93):
a customer, a Moderator, a Manager and a Super Administrator each refused
(403) approving and rejecting a pending report; the report still pending and
compared with nothing; the Super Administrator still able to open it; a Pet
Coordinator approving one report and rejecting another (200), refused on
their own; every `published` and `rejected` row of `publication_logs` written
by a coordinator, none by an administrator. `MAN-05b`: a coordinator's
session that made no request while the account was suspended stays ended
after reinstatement, saying why. And `REV-UI-1`…`6` to
`test:admin-levels-ui` (now 33), the demonstration itself: a customer files;
a Moderator, a Manager and a Super Administrator open the report and see no
"Approve and publish" or "Not approved" button, only "Only a Pet Coordinator
can approve it or not"; the report is still pending; the coordinator sees
both buttons, approves, and it is published with the coordinator as
reviewer.

`npm run test:migrations` now runs to 012 (29 checks), comparing the role and
level of every account and the CHECK constraint count as well. `a11y` adds the
Moderator's Overview, the permission-denied page, the Manager's Users page and
the role-and-level dialog: 40 pages.

### Correction 7 suites

**`npm run test:i18n` — 22 checks** (`scripts/i18n_check.mjs`, needs nothing
running; after `npm run build` for the bundle check). `I18N-18` every key
path in English exists in Filipino and the other way round, compared as
normalised paths; `I18N-P` no empty value, the same `{placeholders}`, `<tags>`
and plural forms in both; `I18N-K` every key the source asks for exists
(`t('…')`, `tList('…')`, `<Rich k="…">`, and the families built at run time);
`I18N-H` no hard-coded interface text left in the components
(`scripts/i18n-scan.mjs`; `i18n-ignore` and `i18n: stored` markers are the
only exceptions, each a stored value or development scaffolding); `I18N-16`
the stored values — report types, statuses, publication states, species,
sizes, roles, levels — equal the ENUMs in `schema.sql`, and switching
language changes their words, never the values; `I18N-T` one Filipino word
per status; `I18N-B` the bundle carries both languages; `I18N-D` no duplicate
keys.

**`npm run test:disclaimer` — 21 checks** (`scripts/disclaimer_check.mjs`,
needs nothing running). `DISC-01` a public route, not bounced for an
administrator, linked from the footer; `DISC-02`…`07` academic and
non-commercial, no payments, no affiliation (and none claimed), information
may be inaccurate, nothing guaranteed, safety guidance; `DISC-08` no waiver,
immunity or hold-harmless wording in either language; `DISC-09` English and
Filipino have the same sections, paragraphs and safety points.

**`npm run test:privacy-ack` — 29 checks** (`scripts/privacy_ack.py`, local
API, reseeds at the start and the end). `PRIV-01`/`02` `/auth/me` says
whether the account has acknowledged the current notice version; `PRIV-04`
acknowledging writes the version into `privacy_consents` (the one consent
table) and `/auth/me` agrees; `PRIV-05` it is not a consent to optional
processing — no body is read, nothing to decline, the security and activity
records are kept either way; `PRIV-06` an unacknowledged account works as
usual; `PRIV-07` nobody acknowledges for another account, a guest cannot, no
CSRF token is refused; `PRIV-08` one activity row, with the version, the
address and the session.

**`npm run test:i18n-ui` — 57 checks** (`scripts/i18n_ui.mjs`, Chrome, dev
server, reseeds). `I18N-01`…`17` in the browser: English by default; Filipino
chosen from the header; remembered across pages and a reload; `<html lang>`
follows; switching keeps the page, the session and a half-filled report form,
re-renders its field messages, and sends nothing; the public site, a
customer's dashboard and the wizard, the coordinator's review queue (a
coordinator approving in Filipino stores `published`), Administration, a
session-end message and the permission-denied page all in Filipino; what a
reporter typed is shown unchanged. `PRIV-01`…`06` and `PRIV-A` the update
message: shown to an older agreement, blocks nothing, offers Review and
Acknowledge (never Agree/Decline), Review opens the notice (also for an
administrator), Acknowledge records it and it is gone. `DISC-01`, `DISC-F`,
`DISC-H` the page signed out in both languages, the footer notice, the
handover notice. `PRINT-01`…`12` on Explore, Administration's Reports and the
coordinator's queue: the browser's print opens; the filters are named and
every matching report prints (all pages, not only the one on screen); only
what that account may list (a guest gets no pending report); no session, IP,
email or phone; Lost/Found in words; script-like text printed as text; in
print only the list shows, black on white; A4 portrait; a row never splits
and the heading repeats; Chrome's Save as PDF produces a PDF; headings in the
language showing.

`a11y` adds the Disclaimer in both languages and eight more pages in Filipino
(public, customer with the update message, the wizard, review queue,
Administration, Logs, permission denied): **50 pages, 0 violations**, with
`<html lang="fil">` accepted. `test:ui` ADMIN-SITE-1 now expects `/privacy`
and `/disclaimer` to stay open to an administrator.

**Responsive check (not a suite; run once for Correction 7):** 22 pages —
public, customer, coordinator and administrator — at 390, 820 and 1280 px in
English and in Filipino, 132 combinations: no horizontal page overflow, and
`<html lang>` correct on each. The header with the language control was
first measured overflowing at 1280 px in development (the development role
selector beside it) and fixed with a compact EN/FIL control.

### Migration 013 (schema freeze)

`npm run test:migrations` — **41 checks** (29 before). The upgrade path runs
008 → … → 013 and 013 again; the expected counts are 24 tables, 34 foreign
keys, migrations to 013. New on each engine, a `guard` database built to 012
with one report's `assigned_staff_id` set: 013 must **refuse** (error 1054
naming the refusal), leave the column, the foreign key, the value and
`schema_migrations` untouched; then, with every row NULL, 013 must succeed and
remove the column and key. Five checks per engine, ten in all, plus the two
013 imports per engine on the upgrade path.

## 3. Last verified results

4 October 2026 (Correction 7), on the development laptop unless stated, on
branch `post-defense/revisions`. **1,515 checks in twenty-seven suites, all
passing, on a quiet tree with a reseed before each browser suite;
a11y 50 pages** (1,374 at Correction 6A; 1,353 at Correction 6; 1,246 at Correction 5A; 1,238 at Correction 5). Plain `npm run lint` again: the `PawsAndFound_*`
folders were moved out of the repository.

**Two lessons from this gate.** (1) Do not edit any file in the repository
while a browser suite runs: Tailwind 4 scans every tracked file for class
names, so saving even a Markdown file makes Vite push an update into the open
test pages, and some become full reloads mid-test. The first run of this gate
lost feedback, report-ui, workflow-ui, signout, ui and session-ui that way;
all passed when re-run on a quiet tree. (2) Reseed between the browser
suites: `test:ui` relies on seeded pairings that `test:workflow-ui` changes
(it failed WITHDRAWN-2 and HISTORY-1 straight after it, and passed 66/66 after
a reseed).

```
lint                                     clean
build                                    green
test:contract                            45/45
test:identity                            41/41
test:report-rules                        50/50
test:scores                              11/11
test:controls                            62/62
test:report-ui                           47/47   (820 px, and 390 px with touch)
test:migrations                          41/41   (MySQL 9.4 strict + MariaDB; 008→…→013→013 = fresh; 24 tables, 34 FKs, 3 CHECKs; 013 refuses a populated assigned_staff_id on both engines; 6 October)
test:publication                         71/71
test:sessions                            88/88   (session records, activity trail, log access, client IP end to end, sentinel secrets)
test:session-ui                          26/26   (race held at the network, session-end messages, page views, Logs page)
test:client-ip                           18/18   (Railway detection, X-Real-IP policy)
test:admin-levels                        93/93   (each level by direct API call; SA-08 ten rounds of simultaneous demotions; REV-ROLE coordinator-only review)
test:admin-levels-ui                     33/33   (navigation, permission-denied page, Manager suspend, Super Admin promote/level change; REV-UI no review buttons for any level)
test:workflow-ui                         33/33   (drafts on two devices, review, rejection, removal)
test:feedback                            49/49
check:psgc                               ok vs PSA's 30 June 2026 workbook: 82 provinces + NCR + SGA, 1,642 places
check:bundle                             0 of 91 mock markers in dist/
test:calendar                             8/8
test:mail                                15/15
audit                                   384/384
auth_lifecycle                          106/106
multi-device                             73/73   (71/71 + 2 skipped vs a remote)
test:signout                             24/24
test:ui                                  66/66
test:city                                11/11
test:matching-log                         6/6
a11y                                     50 pages, 0 violations (+ Disclaimer in both languages, eight more pages in Filipino)
test:i18n                                22/22   (Correction 7: key parity, placeholders, plurals, no hard-coded text, stored values = schema ENUMs)
test:disclaimer                          21/21   (Correction 7: required points in both languages, no immunity wording)
test:privacy-ack                         29/29   (Correction 7: acknowledgement in privacy_consents, non-blocking, own account only, activity row)
test:i18n-ui                             57/57   (Correction 7: language switch in Chrome, privacy message, disclaimer, print/PDF on three pages)
responsive sweep, Correction 7           132/132 (22 pages x 390/820/1280 px x English/Filipino, no horizontal overflow)
docker build --pull --no-cache           clean, one MPM, Syntax OK  (4 October, Correction 7)
image on MySQL 9.4 strict, Correction 7  migrations 001-012, health ok; /disclaimer deep link; bundle carries Filipino and the payment sentence; seeded customer not acknowledged -> acknowledge 200 -> acknowledged; guest refused; list created_at signed in only; Super Admin approve 403, coordinator approve 200; coordinator logs 403; Super Admin logs show the acknowledgement with its version; super_admin capabilities: 15/15
image in Chrome, Correction 7            English by default, no development selector, Filipino from the header, Disclaimer in Filipino, Explore print (Lost only, NAWAWALA, no email/phone), privacy message shown and acknowledged, review queue in Filipino, Super Admin Logs and Privacy Notice, Administration print, Moderator refused Logs (page and API 403): 22/22 (Administration print first read before the 50 ms print delay; re-checked directly: 33 rows, print called)
image on MySQL 9.4 strict, Correction 6A customer files (pending); Super Admin approve 403, reject 403, may open it 200; Pet Coordinator approves 200; Super Admin logs 200: 6/6
image on MySQL 9.4 strict, Correction 6  migrations to 012, seed admin = super_admin; Moderator moderates, logs/suspend 403; Manager suspends/reinstates, logs/levels 403; Super Admin logs and level change 200, own level 422: 13/13
image on MySQL 9.4 strict, Correction 5  health ok; sign-in writes a session record (IP, UA, 32-hex ref); page view 201; filed = pending, guest refused, approved = public; admin reads all three logs, staff 403; sign-out recorded: 14/14
verify:deploy vs production              25/25 + 3 skipped (read-only default; production untouched since)
verify:deploy vs local production image 24/25 + 3 skipped  (7.1, correctly, on plain HTTP; image on MySQL 9.4, fresh schema + seed; 4 October, Correction 7)
verify:deploy --upload, local only       24/27   (7.1 as above; 5.1-5.2 409 — the verifier picks report 1, which the seed has as Possible Match; register D2)
2947a43 schema + seed -> 008 -> 009 -> 009, MySQL 9.4 strict and MariaDB   clean, idempotent
migrated vs fresh schema.sql + seed.sql   identical structure (24 tables, 34 FKs, 3 CHECKs, after 013) and reference data, on both engines
migration 008 on MySQL 9.4 and MariaDB   from the 007 schema: all 10 names split, full_name unchanged
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
