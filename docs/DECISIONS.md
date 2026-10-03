# Decisions, and why

Written 27 September 2026.

Each of these had an easier-looking alternative. This records why the easier
one was not taken, so nobody spends an afternoon rediscovering it — and so any
member can answer "why did you do it that way?" during the defence.

---

## Stack

### PHP and MySQL, not something more modern

**Because the course requires it.** Requirement 4 of the instructor's guide
says *MySQL database*, not "a relational database", and requirement 7 says
server-side processing in PHP. Supabase and PostgreSQL were the team's earlier
assumption and were dropped when the requirements arrived.

This is not a technical preference and is not open to revisiting. `CLAUDE.md`
§27: if a requirement conflicts with anything else, the requirement wins.

### Railway, for public deployment

The instructor's expectation is a system reachable outside localhost. Railway
builds from the repository's `Dockerfile`, provides MySQL, provides HTTPS and a
domain, and attaches a persistent volume. Shared hosting would also have
worked; Railway required no new tooling beyond Docker, which the project
already had.

### One origin for the site and the API

The frontend is served from the same origin as `/api`. There is therefore no
CORS configuration to get wrong, and the session cookie simply works —
`SameSite=Lax` is sufficient, and no credential has to be attached to
cross-origin requests.

Splitting them would mean CORS, a cookie domain, and `SameSite=None; Secure`.
More configuration, more to explain, nothing gained.

### A hand-written SMTP client instead of PHPMailer

PHPMailer is a better library than `api/mail.php` and would be the obvious
choice. It needs Composer, which is not installed on any machine in this
project. Adopting it means every member installing new tooling — or committing
somebody else's source into the repository — days before the presentation, to
send three fixed messages over one connection.

`CLAUDE.md` §15 asks whether a feature can be built with what is already here.
For three messages, it can. **If the project ever sends mail that is not one of
these, replace this with PHPMailer rather than growing it.**

---

## State

### MySQL is authoritative; the frontend only displays

Route guards in React exist so the interface is coherent, not so it is secure.
`current_user()` re-reads role and account status from the database on every
request, so a role downgrade or a suspension takes effect on the next click, on
every device.

The alternative — trusting a role in the session or in a token — means a
suspended user stays suspended only until they refresh. 31 authorization cases
and the whole multi-device suite exist to prove this one is real.

### Atomic conditional updates, not read-then-write

Every state-machine update carries the status it expects and checks the row
count:

```sql
UPDATE pet_reports SET status = 'closed' WHERE report_id = ? AND status = 'active'
```

Zero rows means somebody else moved first, and the answer is `409` with
`code: stale_state`.

Reading the current status and then updating lets two simultaneous requests
both pass the check and both be honoured. This was a real defect, found in
`matches.php` and `reports.php`, where the read and the write were sixty lines
apart. The database decides, and it decides once.

### `session_version`, not session enumeration

Revoking every session for one account is an integer that goes up by one,
compared against the session's own copy on each request. The alternative is
finding and deleting that user's PHP session files on disk, which means knowing
where they are, being able to read them, and doing it before the next request.

### Sessions and uploads on a persistent volume

Both are on `/var/lib/pawsandfound`. On the container filesystem, uploaded
photographs and everybody's session vanish on every redeploy — which is once
per push, and would happen mid-demonstration.

---

## Security

### Guests see a summary; members see the report

A lost-pet report describes a person's home area, their pet's markings and,
sometimes, how to reach them. The list and the map stay public, because being
found by strangers is the point, but they carry only what identifies a pet at a
glance: photo, species, breed, colours, area, date and status. The full report
needs an account. It is free, and it means the details are read by people who
have signed up to a community with rules rather than by anyone passing by.

It is enforced by the API rather than the page. `GET /api/reports` trims each
row for a guest. `GET /api/reports/{id}` answers `401 auth_required` after the
existence check, so a missing report is still a 404. Guest search looks only in
the fields a guest can see, because matching a hidden description would reveal
it one search at a time. `GET /api/matches` needs a session too: the comparison
sentences restate the reports ("Both locations are in Barangay San Antonio"),
so a public pairing endpoint would have been a way around the gate.

Signing in is not the same as being on the case. Another member sees every
status change on a report, but not the note written with it or the name of
whoever made it; those go to the reporter, coordinators and administrators. The
rule is decided by who is viewing, never by what a note says. A customer sees
only pairings that involve their own reports.

### The server holds every rule the form holds

`report_validated()` in `api/reports.php` is the one place a report's rules
live on the server: required fields, breed-or-feature, naming an "Other"
animal, the collar and sex answers, at least one contact method that works (a
phone only counts if the account has one), and the form's length limits. Filing
checks the request; an edit checks the report as it would be after the change,
so a rule about a pair of fields holds whichever one is edited. A request built
by hand gets the same 422 the form would have shown, never an incomplete report
and never a 500 from strict MySQL.

### A finished report ends its open pairings

When a report becomes returned or closed (by its owner, by a coordinator, by a
moderation removal, or by confirming a different pairing), every pairing still
open on it is dismissed. Nobody decided those were or were not the same pet;
the case simply ended. The other report goes back to Active if nothing else is
open on it, and its reporter is told the pairing was withdrawn. Confirmed and
rejected pairings are decisions and are never touched. Before this, a finished
report left pairings in the Verification queue that could only fail with 409.

### Editing saves everything the edit form offers

The edit form showed every field of a report, but `PUT /api/reports/{id}`
accepted seven of them. Species, breed, sex, collar, date and time, location,
pin, contact choices and photos were dropped without a word, and "Save
changes" still said it worked. For a system whose data is its whole value,
false success is worse than a missing feature.

So the update takes the same fields filing does, validated by the same
functions (`report_category`, `report_incident_date`, `report_place`), through
an explicit allowlist: nothing else in the body is read. A new species brings
its breed with it. The location row the report already has is updated in
place. Photos are changed with one `PATCH /api/reports/{id}/photos` (remove,
choose main, describe), because the router takes no deeper path; every id
must belong to the report, and a file is deleted only if this server generated
its name. New photos use the existing upload endpoint. Finished reports refuse
all of it, uploads included.

The form saves the details first, then the photos. If a photo step fails, the
owner lands on the report with a message saying which part did not save.

### A reporter's answer to a coordinator travels as a notification

When a coordinator asks for more information, the reporter answers from
Possible Matches (`PATCH /api/matches/{id}`, `provide_information`). The
answer has to reach the coordinators and must not reach the other reporter in
the pairing: what an owner offers to prove a pet is theirs is what an impostor
would need.

No existing column could hold it that way. `proof_notes` is readable by both
reporters, `staff_notes` is the coordinator's own field and is overwritten by
each decision, and a status-history entry would add a phantom status change to
the case. A `match_responses` table is the right shape, but it would have meant
a production migration and new table and key counts on the ERD days before the
freeze.

So the answer is delivered as a `verification_requested` notification to each
active coordinator, the existing type for "a reporter has sent something to be
verified", and kept nowhere else. It is 255 characters at most, which is
`notifications.body`, and is refused rather than cut. The Verification page
shows each coordinator the answers in their own notifications that are dated
after the pairing's `updated_at`: asking writes to the pairing, answering does
not, so those are exactly the answers to the open question. The reporter gets a
confirmation, not a message history.

### Turnstile, not a homemade CAPTCHA

Registration is the one endpoint an anonymous stranger can use to create rows.
Turnstile is free, does not track users across sites, and the verification
happens **server-side**: the token the browser supplies proves nothing until
the server asks Cloudflare about it.

Production refuses to start with `TURNSTILE_ENABLED=true` and a key missing,
rather than silently allowing everything through. A CAPTCHA that switches
itself off quietly is worse than none, because nobody notices.

### One-time links are stored hashed

`auth_tokens.token_hash` is a SHA-256. The link itself exists in the email and
nowhere else — not in the database, not in `audit_logs`, not in the server log.
Somebody who obtains a copy of the database does not obtain a set of working
links.

Same reasoning as `password_hash`, applied to the thing that can *replace* a
password.

### Forgot-password gives one answer to everyone

A registered address, an address nobody has used, an unverified account and a
suspended one all get the identical response and status code. Anything that
varied — a different message, a different delay — is a way of asking the site
which addresses have accounts, one guess at a time.

The same reasoning puts the lockout counter on the **email typed** rather than
on the account: an address belonging to nobody counts down identically, so
"2 attempts remain" reveals nothing.

### A password reset does not unlock a locked account

They are different facts about different things. The lock is what the system
decided after three wrong passwords, and only an administrator lifts it.
Letting a reset clear it would make the lock worth nothing, because whoever
triggered it can ask for a reset.

### Verification is not an `account_status`

`account_status` is `active | suspended | locked` — what an administrator
decides. `email_verified_at` is a timestamp or NULL — what the person proved.
Overloading one column would mean an administrator reinstating somebody
accidentally marks their address proved.

### The email change is two-phase

The new address goes in `users.pending_email` and the link is sent **to the new
address**. The account address only moves once that link is followed.

Writing the new address immediately is simpler and means a typo locks somebody
out of the account they still control — which is the failure that actually
matters.

---

## Email

### Brevo's HTTPS API instead of SMTP

**Railway's trial plan blocks outbound SMTP.** The container cannot open a
connection to `smtp-relay.brevo.com:587` at all; the attempt times out. This
was tested from inside the running container, not assumed. Port 443 is open,
because the site is served over it.

So the same messages go to the same provider over HTTPS. It is a **transport**
behind the existing `send_mail()`, not a rewrite: the messages, the templates
and every caller are unchanged, and `smtp` still works anywhere outbound 587 is
allowed.

Alternatives considered: upgrading the Railway plan (costs money for a student
project), a different host (a week before the presentation), Gmail SMTP (same
blocked port).

### cURL rather than a stream

`ext-curl` is compiled into the official `php:8.3-apache` image — `php -m`
confirms it in the built image — and `turnstile_or_fail()` has been using it in
production already. It is not an added dependency, and it keeps the two
outbound calls consistent.

### Delivery is loud

Every function in `api/mail.php` either sends or throws. Nothing returns a
quiet false that a caller can forget to check, because the one unacceptable
outcome is telling somebody their verification email is on its way when it is
not.

An unknown `MAIL_TRANSPORT` fails by name in the log rather than falling
through to SMTP — a typo used to surface fifteen seconds later as a complaint
about a mail server nobody had configured.

---

## Database

### MySQL 9.4 compatibility, found before it hit production

Railway runs MySQL 9.4.0; development runs MariaDB 10.4.32. Rehearsing the
import against a real MySQL — rather than trusting that "MySQL-compatible" is
the same as compatible — found two things that would each have stopped the
import on the day:

1. `schema.sql` did not import at all (see migration 007 below).
2. **XAMPP's `mysql.exe` cannot authenticate against MySQL 8 or 9.** It is
   MariaDB's client and does not implement `caching_sha2_password`. The
   official client from Docker is used instead.

**Rule this produced:** check every migration on MySQL 9.4, not only on XAMPP.

### Migration 007 — the CHECK survives, the cascade goes

MySQL refuses a `CHECK` over a column that a foreign key's referential action
could rewrite; MariaDB allows it. `chk_match_distinct` is over
`lost_report_id` and `found_report_id`, and both keys carried
`ON UPDATE CASCADE`.

Something had to give, and it is not the `CHECK`. `ON UPDATE CASCADE` means
"follow the parent key if it changes", and `report_id` is an `AUTO_INCREMENT`
surrogate that nothing ever updates — the clause had never done anything.
`chk_match_distinct` is the database's own guarantee that a report cannot be
paired with itself, and it is the first of the three refusals in the cheat
sheet. `ON DELETE CASCADE` is kept. 24 foreign keys either way.

### Migration 006 — name every `TIMESTAMP` default

`auth_tokens.expires_at` was `TIMESTAMP NOT NULL` with no `DEFAULT`, and both
engines silently give the first such column `ON UPDATE CURRENT_TIMESTAMP`.
Spending a token therefore reset its expiry: a one-hour link read as having
expired the instant it was used.

Nothing was exploitable — both writing statements also set `used_at` and
require `used_at IS NULL` — but the stored expiry was a lie and the safety was
accidental rather than stated.

**Rule this produced:** give every `TIMESTAMP` column an explicit `DEFAULT`.

### Import SQL byte-safely

`Get-Content seed.sql -Raw | docker run -i ... mysql` imports with **zero
errors** and silently corrupts the data. PowerShell re-encodes through the
pipe, and the seed contains em-dashes and curly apostrophes:

```
Closed at the reporter's request.   ->   Closed at the reporterÃ¢â‚¬â„¢s request.
```

Mount the file and let the container read it. Check afterwards with
`LIKE BINARY` — `utf8mb4_unicode_ci` treats the mojibake characters as equal to
their base letters, so a plain `LIKE` reports every row as suspect and means
nothing.

### `schema_migrations` and `auth_rate_limits` are off the ERD

Neither holds domain data and neither has a foreign key. One records which
migrations have run; the other counts requests against an address that usually
has no account — a `user_id` would be NULL for exactly the traffic a rate
limiter exists to stop.

The omission is stated in the figure's own note, because a diagram showing 15
tables against a database with 17 looks like an omission rather than a decision.

---

## Reopening a decided pairing (30 September 2026)

A Pet Coordinator can reopen a pairing they **rejected** or **confirmed** by mistake, with a reason both reporters are told. The pairing goes back to under review and both reports back to Possible Match (frozen again). A reporter's "Not my pet" pressed on the wrong pairing can be reopened the same way. It is refused for a withdrawal (a pairing dismissed because one of its reports was marked returned or closed), when a report has been closed since, and when a report has changed so that the stored comparison no longer describes it — the comparison is run again and must come out the same (`api/matches.php`, `reopen_preflight()`). It re-runs the comparison rather than rewriting it, so a reopened pairing can never show old
evidence as current. No schema change: the pairing returns to `under_review`,
the notification is `staff_reviewed`, and the audit row is `match_decided` with
the detail `reopen: rejected -> under_review`.

**Amended the same day: a reporter's "Not my pet" can be reopened too.** At
first only the coordinator's own decisions could be, so that a reporter's
answer was never overridden. In QA that left no way back when a reporter
pressed "Not my pet" on the wrong pairing, and the coordinator is who they
would ask. A withdrawal stays final: the case it belonged to has ended. The
two are told apart the way the queue already labels them (`wasWithdrawn()`):
a withdrawn pairing has a finished report. One consequence, accepted: if a
confirmation is reopened, the pairings it withdrew have open reports again,
so they read as "Not my pet" and may be reopened one at a time.

## The administrator stays in Administration (30 September 2026)

A signed-in administrator opening Home, Explore, Report a pet, About, Help or
Privacy is sent to `/admin` (`AdminStaysInWorkspace` in
`src/components/RequireAccess.jsx`). The administrator manages the system; they
do not look for pets or file reports. A report's own page, `/pet/:id`, stays
open, because Moderation, Records and the Overview link to it and it is where
the report being decided about is read. Sign-in and the pages reached from an
email stay open too. The admin rail loses "Back to the public site" and its
logo goes to the Overview. This is interface only: the API is unchanged, so the
roles sheet marks the administrator's browsing and filing with †. Staff are
unaffected.

## Post-defense corrections (October 2026)

After the demonstration on 2 October the instructor asked for corrections, and
under `CLAUDE.md` §27 an instructor requirement outranks an earlier decision of
ours. Where one of them reverses something recorded above, it is said here,
with what it costs. The full list and where each item came from is
`docs/feedback/post-defense-correction-register.md`.

### First name and last name, with `full_name` generated (Correction 2)

Registration and the profile ask for the two separately, and the password rule
below needs them separately. The database stores `first_name` and `last_name`
and generates `full_name` from them (migration `008`).

Kept as a generated column rather than dropped, because some twenty queries and
every screen read it, and none of them had to change. It also cannot drift:
nothing writes it. Production's strict MySQL refuses a write to it outright;
XAMPP's non-strict MariaDB ignores one with a warning — so locally a missed
writer is silent, which is why the two writers (registration and the profile)
were found by search, not trusted to fail.

Existing names were split by rule: the last word is the last name, unless the
word before it is a particle (Dela, De, Delos, San, …), which stays with it —
"Jomar Dela Cruz" is *Jomar* / *Dela Cruz*. The migration carries a preview
query for checking a database before running it.

**It deploys together with the code.** Old code against the new schema writes
`full_name` (refused); new code against the old schema writes columns that do
not exist. Run `008` on Railway immediately before pushing.

### A password may not contain the first or last name (Correction 2)

*Supersedes* the earlier rule, which refused a password that **was** the name
and allowed one that merely contained it. Now any piece of either name, two
letters or more, refuses the password if it appears anywhere, ignoring case:
for "Ja", `123jaabcdefghijk` is refused. Deterministic — no misspellings, no
look-alikes.

The cost is real and accepted: a two-letter name rules out every password
containing those two letters. "Li" refuses "harbour **li**ghts at six". The
checklist shows the rule live as the password is typed, so the person sees why
rather than discovering it on submit. The email rule stays an equality rule.

### Confirm password: hidden until the password qualifies, and retyped (Correction 2)

*Supersedes* the earlier paste-friendly form. The second box appears only once
every requirement is met; if the password stops qualifying it is emptied and
hidden again, so a stale match never carries over. A paste or a drop into it is
refused **with a reason** shown and announced — a box that silently ignores
Ctrl+V looks broken.

The cost: refusing paste on the confirmation is unfriendly to password
managers, which is why it is only the confirmation — the password itself can
still be pasted or generated. This is an explicit instructor requirement.

### A result is brought into view (Correction 2)

Seen at the defense: Ma'am submitted from the bottom of a page and the
confirmation appeared above, out of sight. After a submit, whatever answers it
— a success message, an error, the first wrong field — is scrolled to and
focused (`src/utils/reveal.js`), with smooth scrolling only when reduced motion
is not requested. Two places gave no confirmation at all and now do: a
moderation decision (the case left "Awaiting review" silently) and reopening a
pairing (its card moved tab silently).

### The date filter sits under species and starts open (Correction 2)

It existed and the API enforced it; it was the last group in the panel and
closed. Below 1024px that was two clicks deep. Moved up and opened by default.
The filter group toggles became 44px tall: at 20px they were the smallest
controls on Explore, and on a touchscreen laptop they are what gets tapped.

The interface looked different on Ma'am's touchscreen laptop because of **width,
not touch** — nothing in the code detects touch. Windows scaling of 150–175% on
a 1920px screen gives about 1100–1280 CSS pixels, where the navigation becomes a
menu button.

### The place lists are PSA's PSGC, loaded into MySQL (Correction 3, 3A)

The place is chosen, not typed, from PSA's PSGC Publication Datafile **as of 30
June 2026** (the 2Q 2026 release), downloaded from psa.gov.ph by Kyle — PSA's
site blocks automated requests, and that check was not bypassed. Its codes are
the keys. The rows live in `ph_areas` and `ph_cities` and reach the browser
through `/api/reference` — no geography is typed into JSX.

**Official fact and application grouping are kept apart (3A).** PSA has 82
provinces, 149 cities and 1,493 municipalities, and NCR has no provinces; the
data keeps all of that exactly. The form's first list, though, has 84 entries,
because 25 places have no province to sit under. So it is a list of **areas**,
each typed: 82 `province`, Metro Manila `ncr`, and BARMM's Special Geographic
Area `special_area`. Correction 3 first called all 84 "provinces" — table, API
and label — which made Metro Manila a province it is not. The table became
`ph_areas`, the API `/reference/areas` with each area's type, and the label
"Province or Metro Manila". The stored text column keeps its old name,
`locations.province`; it holds the area's name.

Two placements are choices, not facts in the file. **Metro Manila** is one
area, because the National Capital Region has no provinces and a person in
Makati looks for "Metro Manila", not for a district. A **highly urbanized
city** (Cebu City, Davao City, Baguio, …) is listed under the province it is
inside, read from PSA's Correspondence Code, because nobody looks for Cebu City
anywhere but under Cebu. Barangay is not asked: the reporter's own words for
the spot already carry it.

### Where a report is: a code, two names, words and a pin — kept apart (Correction 3)

`locations.city_code` (a foreign key to `ph_cities`) says *which* place; the
`city` and `province` text the report always had stays, written by the server
from the reference row, never from the request. The label is the reporter's
own words; the pin is optional and approximate. A pin never changes the city.

Why a code plus names rather than only a code: every query, card, poster and
test that reads `city` and `province` keeps working unchanged, reports filed
before the lists keep exactly the words they were filed with, and the code is
what matching and the place filter compare. Rewriting 30 queries to join for a
name would have been the large rewrite this correction was told to avoid.

Reports filed before 009 are given a code only where their text names one
place without doubt ("Makati City" in Metro Manila is the City of Makati);
otherwise the code stays NULL and nothing is guessed.

### Breeds: a curated list, and typed breeds kept but never suggested (Correction 3)

`pet_breeds.is_listed` marks the breeds the form offers for each species,
"Mixed breed" last, with "Not sure" (empty) and "Not in the list — type it".
A typed breed is still stored — the report should say what the reporter wrote
— but as an unlisted row, so it is never offered to anybody else. That ends
Correction 10 (every spelling became a choice) without refusing the honest
"it looks like a Shiba Inu". The 20 breeds added to the 12 seeded ones are
common in the Philippines and **are a proposal for the team to edit**.

### Colours: a list, stored by name (Correction 3)

17 colours with stable codes in `pet_colours`; reports keep storing the name,
so nothing that reads a colour changed. The report columns are not a foreign
key on purpose: reports filed before the list keep the colour they were typed
with (spelling variants such as "Tricolor" and "gray" were normalised by 009;
nothing else was reinterpreted). "Other" means "describe it in the features".

### "Other" and "Mixed breed" never count as two reports agreeing (Correction 3)

Matching weights are unchanged (species 25, location 20, breed 15, colour 15,
size 10, date 10, features 5), and the four demonstration pairings still score
85, 75, 100 and 100. What is new: two reports that both say "Other" colour or
"Mixed breed" have agreed on nothing, so those signals do not fire; and two
reports without pins compare the city **code** when both have one, so "Makati
City" and "City of Makati" are one place.

### A phone number is never published (Correction 3) — awaiting confirmation

The "show my phone number" option is gone from the form, and the server
enforces it whatever is sent: `show_phone` is written as 0, reported as false,
and the report query does not even read the number. The column stays (no data
is dropped). The account keeps its number and Pet Coordinators still see it
when handling a case, so a reporter remains reachable. Email is unchanged:
opt-in per report, visible only to signed-in members. The privacy notice was
revised and its version moved to 2026-10-02.

**This is the current implementation, not a confirmed requirement.** The
recording (register N1) could mean that a contact number should be collected,
required, publicly shown, or only that there should be a clear way to reach the
reporter. Until Ma'am confirms which, the secure behaviour stays and the
privacy notice is not changed again for this item.

### The map is the Philippines (Correction 3)

The report form's map opens on the whole country, cannot be dragged far off
it, and a point outside it places no pin — in the browser and in the API,
which refuses one whatever is sent. "Outside" is a box (Kalayaan to Pusan
Point, Saluag to Y'Ami) minus three rectangles of other countries' land:
Sabah's north-west and east coasts and Miangas. A sketch, not a coastline:
the open sea inside it is accepted. It is a **practical input guard** — it
stops a pin dropped in Tokyo or Kota Kinabalu — and must not be described as a
territorial-boundary validator; it is not one, and does not need to be. The place lists, not the pin, are what a
report is found and matched by. Moving the map to the chosen city was not
done: PSGC has no coordinates, and inventing centre points would be
fabricated data.

### Publication is its own dimension, not another status (Correction 4)

A report filed is not published: a Pet Coordinator reviews it first
(`pet_reports.publication_status`: pending_review → published, or rejected;
published → removed). It is a second column rather than more values for
`status`, because the two answer different questions — *may the public see
it?* and *where is the case?* — and a report needs one answer to each: a
published report can be Possible Match; a removed one keeps the case status it
had. Folding them into one list is how "removed" ended up meaning "closed".

The moves are a table in one place (`PUBLICATION_ACTIONS`, `api/reports.php`):
approve and reject (a coordinator or administrator, never on their own report;
a rejection needs a reason), resubmit (the reporter, after a rejection),
remove (an administrator, with a reason). Nothing else exists, so draft →
published, rejected → published and removed → anything are refused by
construction. The reviewer is always the session's account. Each move changes
the state only from the one expected (`WHERE publication_status = :from`), so
two coordinators deciding at once cannot both win.

**Matching starts at publication**, after the approval is committed — as
filing always did — so a matching fault cannot take a publication back; it is
logged and the next edit compares again. The matcher also refuses an
unpublished report on its own, as subject or as candidate.

### History: three tables, three questions (Correction 4)

`status_logs` is the case (active, possible match, returned, closed);
`publication_logs` is the publication (submitted, approved, rejected,
resubmitted, removed — who, when, why); `audit_logs` is the security trail
(`report_reviewed`, `report_removed` among it). A report's case history starts
when it is published ("Published after review."). A rejection is never
overwritten: resubmitting adds a row.

### Drafts have their own table (Correction 4)

A draft may be a species and a name. `pet_reports` requires a species, a
place and a date, and keeping those NOT NULL is what lets every query trust a
report. Storing drafts there would have meant loosening those columns for
everybody, or inventing placeholder values. So `report_drafts` holds the
form's fields, all optional but typed and checked (a listed colour, a real
place, a real date); Submit applies the full rules, files the report and
deletes the draft in one transaction. Drafts are their author's only — not a
coordinator's, not an administrator's — and deleting one deletes it: it was
never published, so there is nothing to keep. Save draft is manual; auto-save
was not added, because manual saving meets the requirement with less to go
wrong. Photographs are not kept with a draft: they are uploaded with the
report, and the confirmation says so. Described accurately, a saved draft is
not "the whole form": **text and structured report data are saved; photos
must be added again when the draft is resumed.**

### Removed is not Closed (Correction 4)

Moderation used to "remove" a report by closing it, so a scam report sat in
its reporter's Closed tab looking like a finished case. Removal is now a
publication state: not public, not matched, its open pairings dismissed, kept
with its history, visible to coordinators and administrators. Closed means
the case ended normally, and nothing else writes it. Migration 010 converts
earlier removals only on evidence (an actioned moderation case and a closure
written by the administrator who resolved it), and invents no approval for
the reports that were already public.

### What was not built (Correction 4)

**Cancel** — Ma'am's third decision. Its meaning is not established, so it is
not guessed; the dialogs' "Go back" only closes the dialog. **Withdraw
submission** — turning a filed report back into a draft would undo a filing
with its photographs; not needed for the required flow. **Flagging** an
unpublished report is impossible: only published reports can be flagged.

### Time: AM/PM on screen, 24-hour in the API (Correction 3)

Hour, minutes and AM or PM as three choices, because a native time box shows
AM/PM only in some locales. The API and the TIME column stay 24-hour, which is
unambiguous; the browser converts (12:00 AM is 00:00, 12:00 PM is 12:00). Half
a time is refused rather than guessed.

### Five logs, not one (Correction 5)

`user_sessions` (which session, from where), `user_activity_logs` (where a
person went, what they did), `audit_logs` (security and administrative
events), `status_logs` (a case), `publication_logs` (a review). They differ in
who writes them, how fast they grow and who may read them; one table would be
mostly empty columns and would bury the security events under page views.
`audit_logs` keeps its job and its rows; nothing was migrated into it.

### A session reference, not the session id (Correction 5)

The PHP session id signs a browser in; storing it would turn the log into a
list of keys. Each session gets its own random 32-hex `session_reference`,
which only names it. Considered: a hash of the session id — rejected because
`session_regenerate_id()` changes the id, and the reference must stay one
value for the life of the session.

### The server writes the actions; the browser only reports pages (Correction 5)

An action is recorded by the endpoint that did it, after it succeeded, from a
fixed list (`ACTIVITY_ACTIONS`). The browser has no way to name an action, so
it cannot forge one. Page views are the one thing only the browser knows (it
is a single-page app); for those it sends the path and nothing else, and the
server adds who, which session, the IP and the time. Reads are not logged:
"where they went" is the page view, and logging every API read behind a page
would multiply each visit by its requests.

### Last seen every five minutes, not every request (Correction 5)

The page re-checks the session every ten seconds; a write per request would be
a database write every ten seconds per open tab, for a value nobody reads to
the second. Five minutes is precise enough to say "last used around …".

### The visitor's IP: X-Real-IP, only when the deployment is Railway (Correction 5A)

On Railway, `REMOTE_ADDR` is Railway's edge for every visitor. Correction 5
believed `X-Forwarded-For` when the connection came from 100.0.0.0/8; Railway
publishes no stable proxy range, so that tied a security decision to an
implementation detail. Now the deployment decides: production with
`RAILWAY_ENVIRONMENT_ID` set (a variable Railway sets, nothing a visitor can
send) uses `X-Real-IP`, which Railway documents as the client's address and
overwrites on every request; everything else uses `REMOTE_ADDR` and ignores
all forwarding headers. A missing or malformed `X-Real-IP` falls back to
`REMOTE_ADDR` and is logged. `X-Forwarded-For` is not used: Railway itself
recommends `X-Real-IP` over parsing it, and its forum gave conflicting answers
about which end of `X-Forwarded-For` is the client. Considered and rejected:
keeping the CIDR as a second condition (it would fail silently the day Railway
moves its proxies). Checked after deploy, not assumed
(docs/security-activity-logging.md).

### Suspension and lock end the session (Correction 5)

Before, a suspended account's session was refused but kept, and worked again
when the account was reinstated. The session record says it ended; so now it
has. Reinstated or unlocked people sign in again — one more step, and the log
tells the truth.

### The sign-out race: queue the check, discard the stale answer (Correction 5)

Considered: polling every second (rejected: load, and it only narrows the
window), a lock that waits (rejected: a stale answer still lands). Chosen: a
check asked for during another runs right after it (at most one extra), and a
check that began before this tab signed in or out cannot apply its answer.
Tested by holding the server's answer at the network, not by loading the CPU.

### No forced re-consent (Correction 5)

Consent is recorded per notice version at registration. Asking existing
members to agree again at their next sign-in is not built; the notice no
longer promises it, and the record shows which version each person agreed to.
**Decision for the team:** build a "please review the updated notice" step, or
accept the current position.

### Administrator levels: three, as capabilities (Correction 6)

Ma'am asked for "different admin levels of privileges" and nothing more
specific, so the levels are the team's: Moderator, Manager, Super
Administrator — the fewest that separate three real jobs (content, accounts,
the administrators and the security record). They refine `role = 'admin'`
in their own column (`users.admin_level`) rather than becoming three more
roles: they are all administrators, the ERD says so, and a Pet Coordinator
stays outside the hierarchy. Endpoints ask for a named capability
(`moderate_reports`, `manage_accounts`, `manage_reference_data`,
`manage_admins`, `view_security_logs`) from one table, not for a level; not a
general role-based-access framework — five names, three rows.

**Logs are Super Administrator only.** IP addresses, browsers and browsing
history are the most sensitive data in the system; neither moderation nor
account care needs them.

**Only a Super Administrator manages administrators, and nobody manages
themselves.** "Anyone may manage those below them" was rejected: it needs
an ordering rule at every endpoint and lets a Manager disable a Moderator
over a disagreement. One rule is easier to defend.

**Roles are the Super Administrator's too** — including customer ↔
coordinator, because a coordinator sees contact details and decides cases.

**Existing administrators became Super Administrators** (migration 012):
they had one unrestricted role, and this keeps exactly that. No history of
a "promotion" is invented.

**A level change ends the account's sessions** (`privilege_changed`), so a
browser never keeps a screen built for powers it no longer has.

**Never no active Super Administrator.** Structurally (self-changes refused,
only Super Administrators change administrators), and against two
simultaneous demotions by row locks taken in user_id order and a re-read of
the acting administrator inside the transaction. A locked account cannot be
prevented — three wrong passwords lock anyone — so if the last Super
Administrator is locked, the recovery is the database owner setting
`account_status = 'active'` (PRODUCTION_RUNBOOK). A second Super
Administrator is the practical safeguard.

**Administrators keep approving from a report page.** Correction 4 let any
administrator approve or reject; Correction 6 does not change the publication
workflow, so every level still may. The review queue remains the Pet
Coordinator's workspace.

**The Privacy Notice was not changed.** It says administrators can see the
session, activity and security records; that is still true — it is now only
the Super Administrators — and narrowing access does not alter what anybody
agreed to, so the version stays 2026-10-03.

### No automatic retention (Correction 5)

Nothing deletes old sessions or activity. A scheduled purge needs a scheduler
this deployment does not have, and the period is the team's (and the course's)
decision. Suggested: activity 90 days, sessions one year, audit indefinitely.

## Features deliberately not built

| Rejected | Why |
| --- | --- |
| **WebSockets / real-time** | Polling is sufficient for this workload, and a socket layer is a second connection model to explain and defend. |
| **AI or image-recognition matching** | `CLAUDE.md` §16. The matching engine is an explainable weighted comparison of seven signals — it can be added up out loud. A model cannot. The guide lists an AI feature as *bonus only*, so this is a design choice, not a gap. |
| **Exact addresses in public** | Locations are barangay-level and drawn as a circle, so the imprecision is visible rather than implied. A lost-pet listing that publishes a home address is a burglary notice. |
| **Forced-scroll consent** | Making somebody scroll a notice before a checkbox unlocks measures patience, not understanding. Consent is recorded per notice version in `privacy_consents`. |
| **Password strength meter** | A coloured bar rewards `P@ssw0rd!` and punishes a long passphrase. The checklist states the rule the server actually enforces. *Revisited 30 September 2026:* a Weak / Fair / Strong label now sits **beside** the checklist as guidance only — Weak means a requirement is not met, Fair is accepted, Strong is recommended — and it rewards length, not symbols. The rule is still the checklist. |
| **Draft reports** | *Reversed by Correction 4* — the instructor asked for saved drafts. Built as a separate table so a real report's columns stay strict (see "Drafts have their own table"). |
| **Social login / OAuth** | A second authentication path to secure and explain, for accounts that already work. |
| **SMS verification** | Costs money per message and adds a provider. |
| **PWA / offline** | Nothing in the workflow is useful offline. |
| **Self-service account deletion** | Accounts are suspended, never deleted, so case histories stay readable. The privacy notice says so in those words. |
| **A new role system** | Three roles are a hard requirement and they are implemented. |

---

## Testing

### Tests that need no server

`npm run test:contract` exists because two real defects got through every
server-side suite by being **agreements between two files** rather than faults
in either one: the collar answer and the contact preferences. Both were valid
on each side and wrong between them.

It uses Node's built-in test runner and a twenty-line alias hook — no test
framework was added.

### One test really calls Brevo

`test:mail` sends a request with a deliberately invalid key and insists on
being refused. No credential is involved, and it proves what a fake server
cannot: that the machine can reach the API over 443, that TLS verifies, and
that a refusal ends as a `MailFailure` rather than as `email_sent: true`.

### A skipped check is not a passing check

`multi_device.py` has three outcomes, not two. Run against a remote, the two
checks that turn the session timeout down by writing a local config file are
reported as **skipped, with the reason named** — counting them as passes would
hide that they did not run, and counting them as failures would report the
product as broken when it is the harness that cannot reach far enough.
