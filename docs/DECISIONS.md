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

## Features deliberately not built

| Rejected | Why |
| --- | --- |
| **WebSockets / real-time** | Polling is sufficient for this workload, and a socket layer is a second connection model to explain and defend. |
| **AI or image-recognition matching** | `CLAUDE.md` §16. The matching engine is an explainable weighted comparison of seven signals — it can be added up out loud. A model cannot. The guide lists an AI feature as *bonus only*, so this is a design choice, not a gap. |
| **Exact addresses in public** | Locations are barangay-level and drawn as a circle, so the imprecision is visible rather than implied. A lost-pet listing that publishes a home address is a burglary notice. |
| **Forced-scroll consent** | Making somebody scroll a notice before a checkbox unlocks measures patience, not understanding. Consent is recorded per notice version in `privacy_consents`. |
| **Password strength meter** | A coloured bar rewards `P@ssw0rd!` and punishes a long passphrase. The checklist states the rule the server actually enforces. *Revisited 30 September 2026:* a Weak / Fair / Strong label now sits **beside** the checklist as guidance only — Weak means a requirement is not met, Fair is accepted, Strong is recommended — and it rewards length, not symbols. The rule is still the checklist. |
| **Draft reports** | A whole second lifecycle — expiry, cleanup, "is this a report?" everywhere. The wizard already has a review step. |
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
