# Feature Status

Single source of truth for what actually works. Update it at the end of every
phase — an item is only ticked when it works in the browser, not when the file
exists.

**Legend:** `[ ]` not started · `[~]` partial · `[x]` done — working in the browser
against the live PHP API and MySQL database, unless a note says otherwise.

_Last updated: account lifecycle — verification, password reset, safe email change,
rate limiting — 2026-09-27_

## Foundation

| Item | Status | Notes |
| --- | --- | --- |
| Project scaffold (React + Vite + Tailwind) | `[x]` | Phase 0 |
| Design tokens (colour, shape, spacing, type, containers) | `[x]` | **Teal + Amber approved.** `src/index.css`, documented in `docs/design-system.md` |
| Homepage | `[x]` | Hero, 3 primary actions, recent reports, how it works, safety |
| `PetCard` + type/status badges | `[x]` | Reused by every later listing |
| UI primitives (button, inputs, card, modal) | `[x]` | `src/components/ui/` |
| Service abstraction | `[x]` | `src/services/` — now calls the PHP API. The boundary is why the UI did not change when the data source did. |
| Seed data | `[x]` | 32 reports across 4 statuses, 4 species, 15 cities and **six months** (April–September: 3, 3, 4, 6, 9, 7). Generated from `src/mock/` by `scripts/gen-seed.mjs`. Matched pairs were shifted by identical offsets, so every seeded match score is unchanged — verified against the algorithm afterwards. |
| Image assets | `[x]` | Every seeded report carries a photograph (33 images across 32 reports). Reports 025 and 026 are the same dog from either side, so the 100% pairing demonstrates convincingly. Help header band (IMG-012) in place. |
| Routing & navigation | `[x]` | All 25 routes, navbar, mobile nav, footer, sidebar, breadcrumb, 404, unauthorized |
| Role-aware navigation + route guards | `[x]` | Route guards keep the interface coherent; they are not security — every endpoint checks the session again. The demo role selector is **development only** and is removed from production builds along with the demo password (see below). |
| Email verification | `[x]` | Registration creates the account and sends a link; it does **not** sign anybody in. Sign-in refuses an unverified address with 403 `verification_required`, and only **after** the password check, so the refusal says nothing to somebody who does not already know the password. `api/auth.php`, `api/tokens.php`. |
| Forgot / reset password | `[x]` | One answer for every address — registered, unknown, unverified, suspended. Anything that varies is a way of asking which addresses have accounts. The reset ends every other session on that account, and does **not** unlock a locked one. |
| Safe email change | `[x]` | The new address goes in `users.pending_email` and the link is sent **to the new address**. The account address only moves once that link is followed, so a typo cannot lock anybody out of the address they still control. |
| One-time links | `[x]` | `auth_tokens` stores only a SHA-256 of each link. Single use is one conditional `UPDATE`, not a `SELECT` then an `UPDATE`, so two clicks arriving together cannot both be honoured. Expiry is explicit since migration `006`. |
| Rate limiting | `[x]` | `auth_rate_limits`, counted per action against an HMAC of the address, with a rolling window and a 429 carrying `Retry-After`. Separate from the three-attempt account lock, which is a different rule with a different consequence. |
| Turnstile on registration | `[~]` | Implemented and verified server-side; **off until the group supplies keys**. The site key is served at run time by `GET /api/config`, never built into the bundle; the secret never leaves the server. Production refuses to start with `TURNSTILE_ENABLED=true` and no keys rather than silently allowing everything through. |
| Email delivery | `[x]` | Four transports behind one `send_mail()`: `smtp`, `brevo_api` (HTTPS, because Railway's trial plan blocks outbound 587), `log` for a laptop and `capture` for the tests. Every path that cannot deliver throws — nothing returns a quiet false that a caller can forget to check, because the one unacceptable outcome is telling somebody their verification email is on its way when it is not. |
| Session revocation | `[x]` | `users.session_version` against `$_SESSION['session_version']`, compared on every request. A password reset or a suspension ends every session everywhere without hunting through session files on disk. |

## Core workflows

| Item | Status | Phase |
| --- | --- | --- |
| Authentication | `[x]` | **Real, and reachable from the interface.** The sign-in form posts to `POST /api/auth/login`; PHP sessions, `password_hash`/`password_verify`, session ID regenerated on sign-in, HttpOnly cookies. Guest by default; browsing stays public. Every seeded account uses `demo1234`. |
| Demo sign-in removed from builds | `[x]` | The role selector and the one-click "Development sign-in" panel are behind `import.meta.env.DEV`, so a production build contains neither them nor the demo password. Verified by searching the built bundle: `demo1234` no longer appears. Signing out is a separate action and works in both builds. |
| Registration | `[x]` | `POST /api/auth/register` — server-side validation, bcrypt hashing, duplicate email rejected by the unique index (409); the new account must verify its address before it can sign in. **The role is never read from the request**, so an account cannot register itself as staff or admin. Password rule, shared with the reset (`password_policy_error()` in `api/helpers.php`): 15+ characters, at most 72 bytes, not an obvious long password (a local list, not a breach database), not simply the person's own name or email; no rule about capitals, digits or symbols. A Weak / Fair / Strong label is guidance; Fair is accepted. Existing passwords still sign in. Names need at least two letters (letters, spaces, apostrophes, hyphens, periods), on registration and the profile alike. |
| Profile | `[x]` | `PATCH /api/users/me` — name, email, phone, preferred location and the three notification preferences. The account comes from the session, so it can only ever edit your own; `role` and `account_status` are not readable there, so an account cannot promote or un-suspend itself. |
| Lost report | `[x]` | 3 — multi-step form, validation, submits via `petService` |
| Found report | `[x]` | 3 — same form, found-specific fields, no pet name |
| Photo upload | `[x]` | 3 — `POST /api/reports/{id}/photos`, multipart. Owner only. Validated by what the file *is* (`getimagesize`), not by its name or the type the browser claims; a PHP script renamed `.jpg` is refused. Stored under a generated name in `api/uploads/`, which is configured never to execute anything. |
| Search | `[x]` | 4 — free text across name, breed, colours, markings, description, place |
| Filters | `[x]` | 4 — type, species, size, colour, city, status, date range; chips, clear, sort, load-more |
| Pet report detail | `[x]` | 5 — photos, details, location, possible matches, privacy-safe contact |
| Flag a report for moderation | `[x]` | 5 — `POST /api/moderation`. The flagger is taken from the session, so nobody can flag in someone else's name. |
| Owner status controls | `[x]` | 5/6 — mark returned and close, from the detail page and My Reports |
| Edit a report | `[x]` | 6 — reuses the reporting wizard, prefilled; owner-only |
| Map | `[x]` | 8 — Leaflet + OpenStreetMap: Explore map view, report detail map, pin-drop in the form |
| Matching | `[x]` | 7 — explainable weighted algorithm, no AI. **Now runs on the server** in `api/matching.php` whenever a report is filed, so a newly filed report gets suggestions like any other. Creating a pairing writes its seven signals, notifies both reporters, and moves both reports to Possible Match, in one transaction. Verified to reproduce all four seeded pairings exactly. |
| Verification | `[x]` | 7/10 — users request it, coordinators confirm, request more information, or rule it out |
| Homepage composition | `[x]` | 2 — **rebuilt 2026-09-20:** an urgent line, one raised panel holding the headline, IMG-006, three promises and the quick search, a species row that filters Explore, recently reported, community numbers counted from the reports, how it works, the reunion chapter, safety, and a closing teal call. |
| Notifications | `[x]` | 9 — written to the `notifications` table by the same transaction as the event that caused them. No outbound delivery (email/push); in-app only. **The three profile switches are honoured**: `wants_notification()` in `api/helpers.php` skips a notification the person has switched off (possible matches, status updates, coordinator messages). Moderation decisions about your own report are always sent. |
| Status workflow & history | `[x]` | 9 — every change appends to `status_logs`; the case timeline and the dashboard activity feed both read it. |

## Dashboards

| Item | Status | Phase |
| --- | --- | --- |
| User dashboard | `[x]` | 6 — overview with stats and activity, My Reports, Profile. **Overview reworked 2026-09-19:** personal summary row (active reports, open possible matches, pets returned, unread when any), compact quick actions, possible matches first with one link per match, active reports three across, a five-entry activity timeline, reunion cards. Sidebar counts on My Reports, Possible Matches and Notifications. **My Reports reworked 2026-09-20:** Open · Returned · Closed tabs, a "New report" menu, case cards with a 112px photo, "Last seen" / "Found on" dates, a state-dependent main action (Review match / View report), and Close report moved into a More menu behind a confirmation. **Possible Matches reworked 2026-09-20:** Needs attention · Under review · Confirmed stages with counts, a pairing title and plain-language stage, the score shown as a compatibility score with "n of 7 characteristics align", 320px photos that open full size, a single evidence list with both values side by side, and a status panel per stage — the "suggestion, not a confirmation" note only on unconfirmed pairings. **Notifications refined 2026-09-20:** compact activity cards — a thin teal bar and bold title for unread, plain white for read; amber / teal / green icons by kind; count pills on All and Unread; following View report or See match marks the notification read. Shared with the Staff notifications page. **Profile refined 2026-09-20:** Personal information and Contact information groups, the location privacy note made prominent, Account type as a read-only badge, preferences as rows, server field errors shown under their fields, and the "Profile saved" confirmation now actually shows. |
| Staff dashboard | `[x]` | 10 — overview, report queue, match queue, verification workspace. **Refined 2026-09-20:** light sidebar with counts and a compact section menu below `lg`; attention rows with both photos, "85% compatibility", Verify / Review; Report queue search, type and species filters (over the loaded list) with case cards below `lg` and clickable table rows above; Match queue stage tabs (Open · With a coordinator · Confirmed · Ruled out) using the same pairing card as the reporter's page; Verification decision panel with a staff-only privacy note, confirmations before Confirm and Not the same pet, and the outcome kept on the page after a decision. |
| Admin dashboard | `[x]` | 11 — overview, user management, record oversight, pet categories. **Refined 2026-09-20:** the same light sidebar as the other workspaces, with a flags count and a compact section menu below `lg`; Overview split into "Needs your attention" (flags, suspended accounts) and "Activity" (chart, breakdowns, recently closed), with only the flag count emphasised; Users rebuilt as a table with Change role and Suspend behind confirmations, cards below `lg`; Reports turned from 32 tall cards into a paginated 12-per-page table with search, status, type and species filters and a sort; categories and moderation given confirmations before anything destructive. |
| Moderation API | `[x]` | `GET/POST /api/moderation`, `PATCH /api/moderation/{id}`. Admin-only, verified: a customer gets 403, signed-out gets 401. |
| Moderation queue | `[x]` | 11 — dismiss, warn, remove, remove-and-suspend; the reporter is always told. The flag's own words and the flagged report are labelled separately, the two destructive decisions are set apart from the two that are not and both confirm first, and a decided case becomes a read-only record. Each decision is one transaction: case, report status, account status and notification move together or not at all. |

## Audit

`npm run audit` runs every documented test case against the running system and
prints a table per category. It restores the demonstration data afterwards, so
it can be run again at any time.

| Category | Cases | Passing |
| --- | --- | --- |
| A. Input validation | 19 | 19 |
| B. SQL injection | 14 | 14 |
| C. Authentication | 41 | 41 |
| D. Authorization | 31 | 31 |
| E. Cross-site scripting | 4 | 4 |
| F. File upload | 7 | 7 |
| G. Functional | 44 | 44 |
| H. Error handling | 10 | 10 |
| **Total** | **170** | **170** |

Authentication grew with the three-attempt lockout and CSRF; error handling
grew when a routing fault was found — see below; functional grew again in the
final hardening pass with the contact-preference and collar-answer cases.
SQL-12 and SQL-14 assert the table and foreign-key counts, so the ERD cannot
be wrong quietly.

    python scripts/auth_lifecycle.py

**53 checks over the account lifecycle**: registration no longer signing
anybody in, an unproved address being refused, following the link, the
password reset, the session revocation that comes with it, a reset *not*
unlocking a locked account, the safe email change, and rate limiting. It reads
every link out of captured mail, exactly as a person reads it out of an inbox,
because there is no endpoint that hands out a token and there is not going to
be one.

    npm run multi-device

**73 checks across independent sessions** — separate cookie jars and
CSRF tokens, as three browsers on three machines have. It proves the shared
database is the authority for a report change, a read-state change, a role
downgrade, a suspension, a three-attempt lock, an administrator unlock, a
server-side session expiry, and five forbidden addresses; and that a coordinator or an administrator keeps one session at a time (signing in again ends the last one), while a customer may be signed in on several devices. It takes `PAWS_API`
so it can be pointed at the LAN address or at the hosted site.

    npm run test:mail

**15 checks over the one door every account email goes through.** `send_mail()`
is shared by registration, resend, forgot password, reset and the email change,
so what is worth testing is the door rather than five identical callers: the
payload Brevo is sent, that a display name cannot smuggle a newline into it,
and that every path which cannot deliver throws instead of returning quietly.
One check really does call Brevo with a deliberately invalid key and insists on
being refused — no credential is involved, and it proves what a fake server
cannot: that the host can reach the API over 443 and that a refusal ends as a
failure rather than as `email_sent: true`.

    npm run test:contract

**13 checks with no server at all** — the shape of what the report form sends
and what the API sends back. They exist because two defects got through
everything above by being agreements between two files rather than faults in
either one: the collar answer and the contact preferences.

    npm run a11y

axe-core over all 31 pages in every role: zero violations.

    npm run verify:deploy https://<domain>

**28 checks that only fail on a host**: whether the API answers JSON rather
than a challenge page, whether a deep link refreshes, whether an uploaded
photograph comes back to a signed-out visitor, the session cookie's `Secure`,
`HttpOnly` and `SameSite` flags on the real domain, whether errors leak SQL or
paths, whether CSRF survived the production build, whether `config.local.php`
is readable over the web, and whether any demo password reached the bundle.
27/28 against the local deployment — the one failure is HTTPS, correctly,
because localhost is plain HTTP.

Last run in full on 30 September 2026 on the development laptop: audit
382/382, auth lifecycle 100/100, multi-device 73/73, sign-out 24/24, UI 66/66,
contract 32/32, calendar 8/8, city 11/11, matching log 6/6, axe clean on 31
pages, lint clean, build green; and against production, `verify:deploy` 25/25
with 3 skipped (read-only). Details in `docs/TESTING.md` §3.

## Cross-cutting

| Item | Status | Notes |
| --- | --- | --- |
| Responsive (390 / 768 / 1366 / 1920) | `[x]` | Eight representative pages measured at all four widths against the deployed build — homepage, Explore, report detail, report form, customer dashboard, coordinator comparison, admin dashboard and admin table. No horizontal overflow anywhere. Explore overflowed by 16px at 390px until the results controls were allowed to wrap. |
| Accessibility | `[x]` | Focus ring, skip link, labels, `aria-describedby`, breadcrumb `aria-current`, reduced motion — and now **audited with axe-core** across all 31 pages in every role: zero violations. Run `npm run a11y`. Four rules had been failing: colour contrast in five places, an invalid `dl`, and headings skipping a level. |
| Empty / loading / error states | `[x]` | Swept by forcing each state: a new account for empty lists, a search matching nothing, aborted and 500 responses for errors, delayed responses for loading. Two faults found and fixed — a slow first load showed a blank page, and the report page called every failure "this report does not exist". |
| Real database | `[x]` | MySQL, **17 tables** and 24 foreign keys, verified against `information_schema` on MariaDB 10.4.32 via XAMPP — not against the file. `database/schema.sql`, defended table by table in `docs/erd-defense.md`. Fifteen are on the ERD; `schema_migrations` and `auth_rate_limits` are operational, have no foreign keys, and are deliberately left off it. |
| Prepared statements everywhere | `[x]` | PDO with `ATTR_EMULATE_PREPARES => false`. Injection tested with three payloads. |
| Session lifetime | `[x]` | Enforced on the server in `current_user()`, not by a browser timer. Idle **1 hour**, absolute **8 hours**, both in `api/config.php` so they can be changed in one place. An expired session is reported the way a signed-out visitor is, so `/auth/me` keeps answering "nobody" rather than growing a special case. Sessions that predate the check are adopted rather than thrown away. Proved by turning the timeouts down to a second in a gitignored local config — `npm run multi-device` section K. |
| Atomic state transitions | `[x]` | Every state-machine `UPDATE` carries the status it expects and checks the row count: `match_claims` (`matches.php:164`), `pet_reports` on a status change (`reports.php:371`) and on a confirmation closing both reports (`matches.php:284`). Zero rows means somebody else moved first, and the answer is **409** with `code: "stale_state"`. `json_response()` rolls back an open transaction on any error, so a losing request writes nothing, logs nothing and notifies nobody. Proved in `npm run multi-device` sections I and J. |
| Reasons on consequential actions | `[x]` | Required server-side, not only in React: ruling a pairing out, requesting more information, closing a report, suspending an account. Whitespace is trimmed first, so a note of spaces is refused. They land in the columns that already existed — `status_logs.note`, `match_claims.staff_notes`, `audit_logs.detail` — and no new table was created. Reinstating and unlocking take an optional note instead. |
| Contact preference round trip | `[x]` | `show_phone` / `show_email` are returned to whoever may edit a report (`reports.php`), and read directly by the frontend. Previously inferred from whether a phone number came back, which was wrong for any account without one: a stored `1` looked like `false` and an untouched edit saved it that way. The public payload is unchanged and carries no preferences. |
| Audit trail | `[x]` | `audit_logs`, append-only, thirteen actions. Account events (sign-in, failed sign-in, lock, unlock, role change, suspend, reinstate, register, sign-out) from migration `002`; case events (`report_status_changed`, `match_decided`, `moderation_resolved`, `category_changed`) from `004`. The specific action is written into `detail` as a readable sentence. Verified by performing each action and reading the table back. Deliberately excluded: report creation and the automatic move to "possible match", which are in `status_logs` and are the system rather than a person. |
| Uploads and category changes persist | `[x]` | Both were open limitations in the Phase 4 report, from before the backend existed; both are closed and were **re-proved against the running system on 25 September 2026**, not assumed. A photograph posted to `POST /api/reports/{id}/photos` lands in `report_images`, on disk under a generated name in `api/uploads/`, is returned to a signed-out visitor on the report, and serves as `image/png` over HTTP. A category created, renamed, retired and deleted by an administrator is in `pet_categories` at each step and visible to a fresh visitor. Those two lines can come out of the report. |
| Category management | `[x]` | `GET/POST /api/categories`, `PATCH/DELETE /api/categories/{code}`. Administrator only. Report counts come from SQL; deleting is refused while any report uses the category, and retiring it is offered instead. Verified to survive a reload. |
| Pagination | `[x]` | Explore pages through the database with `LIMIT`/`OFFSET`, nine to a page — one request per page, not a full list sliced in the browser. Numbered links, a "Showing 10–18 of 32" status, and the page resets when a filter or the sort changes. **The map view is deliberately not paged**: it asks for one large page so every pin is drawn, capped at the API's 50-row maximum. |
| Charts on dashboards | `[x]` | `GET /api/reports/stats` — three SQL `GROUP BY` queries behind a staff/admin-only endpoint. The administrator overview shows reports filed per month (lost vs found, six months), where reports stand, and most-reported animals; the coordinator overview shares the same breakdown component. No charting library. **The seed clusters 28 of 32 reports in August**, so the monthly chart is honest but lopsided until the dates are spread. |
| Deployment | `[x]` | The build deploys to `htdocs/pawsandfound/` and runs from Apache alone — no dev server, no proxy, one origin for the site and the API. Deep links and refreshes work via `public/.htaccess`. Still a local XAMPP deployment; no public hosting, which remains the team decision of 2026-08-19. |
