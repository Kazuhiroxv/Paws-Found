# Final Project Requirements — ITS122P – AM2

Transcribed from the instructor's *Final Project Guide* (8 pages), received
2026-08-19. This is the checklist the project is graded against. Where a row is
already satisfied, the evidence is named.

**The Requirement column is the instructor's wording and is never edited.** Only
Status and Where are ours. Row 4 says *MySQL database*, not "a relational
database", and that is why `docs/deployment-architecture-audit.md` treats the
engine as fixed rather than as a team preference.

Statuses reconciled against the running system on **27 September 2026**. The
reconciliation before it, on 26 September, found eleven rows still saying "Not
started" or "Partly done" for work finished weeks earlier; this one brought the
security checklist and the phase table in line with the same evidence.

Topic: **Campus Lost-and-Found System** — assigned to this group as Paws&Found.

## Mandatory

| # | Requirement | Status | Where |
| --- | --- | --- | --- |
| 1 | Responsive web application | **Done** | Verified at 390 / 768 / 1366 / 1920 across all routes |
| 2 | Login / logout | **Done** | Real PHP sessions. `api/auth.php`; bcrypt, CSRF, three-attempt lock, administrator unlock, email verification before first sign-in, and a password reset that revokes every other session |
| 3 | Minimum 3 user roles | **Done** | Customer/User, Staff/Pet Coordinator, Administrator |
| 4 | MySQL database | **Done** | MariaDB 10.4.32 via XAMPP. `database/schema.sql`, six migrations, `database/seed.sql` |
| 5 | Minimum 8 related tables | **Done** | 17 tables, 24 foreign keys, counted from `information_schema`. Fifteen are on the ERD; the other two, `schema_migrations` and `auth_rate_limits`, are operational tables with no foreign keys. |
| 6 | CRUD operations | **Done** | Reports, users, categories, matches, moderation — all SQL behind the REST API |
| 7 | Server-side processing (PHP) | **Done** | `api/index.php` front controller; sessions, authentication, per-request authorisation |
| 8 | JavaScript interaction | **Done** | React 19 + Vite, client-side routing, dynamic content |
| 9 | REST API | **Done** | `/api/auth`, `/reports`, `/matches`, `/notifications`, `/users`, `/categories`, `/moderation` |
| 10 | API consumption | **Done** | The requirement reads *our own or an external API*. Both: every screen reads and writes through `fetch` against our REST API (`src/services/api.js`), and the server consumes Cloudflare's Turnstile `siteverify` with cURL. OpenStreetMap tiles are a third, weaker instance. See the audit below. |
| 11 | Search / filter | **Done** | Explore: text, type, species, size, colour, city, status, date |
| 12 | Sort | **Done** | Explore sort; staff queue sorts on six columns |
| 13 | Pagination | **Done** | `LIMIT`/`OFFSET` in SQL, nine per page, numbered links and a range status |
| 14 | Dashboard | **Done** | Customer, staff and admin dashboards |
| 15 | Reports | **Done** | `GET /api/reports/stats` — three SQL `GROUP BY` queries behind charts on the staff and administrator dashboards |
| 16 | Form validation | **Done** | Report wizard, per-step, with error messages |
| 17 | Security implementation | **Done** | bcrypt, PDO prepared statements with emulation off, server-side validation, CSRF, audit log. 170 cases in `npm run audit`, plus 53 in `scripts/auth_lifecycle.py` |
| 18 | Error handling | **Done** | Loading, error and empty states on every async view; 401/403/404/409/422 from the API, with no SQL or paths in any response |
| 19 | Deployment | **Ready; hosting pending** | Runs from Apache at `http://localhost/pawsandfound/`, one origin for site and API. Host-agnostic: `npm run build:deploy` + `api/config.local.php`. The eighteen-step runbook is `docs/deployment-plan.md` §3. **Not yet on a public URL.** |
| 20 | Technical documentation | **Done** | `docs/` — ERD defence, database cheat sheet, role permissions, matching explanation, deployment plan, presentation defence, design system, feature status |

## Security checklist (guide page 3)

Every box is ticked against behaviour, not against a file existing. The case
identifiers are the ones `npm run audit` prints, so any of them can be re-run
in front of her.

- [x] **Password hashing** — `password_hash()` with `PASSWORD_DEFAULT` (bcrypt);
      the column is `password_hash` and no code path can read a password back.
      One-time links get the same treatment: `auth_tokens` stores a SHA-256, so
      a copy of the database is not a set of working links.
- [x] **Role-based access on the server** — 31 cases in category D. Every
      endpoint re-reads role and account status from the database on each
      request (`current_user()`), so a downgrade or a suspension takes effect
      on the next click, on every device. The route guards in React are for
      coherence, not security, and the suite proves it by calling the endpoints
      directly with the wrong role.
- [x] **Input validation server-side** — 19 cases in category A. The forms
      validate too, but the API is the one that decides; ENUMs are constrained
      in the database as a third line.
- [x] **Prepared statements** — PDO throughout with
      `ATTR_EMULATE_PREPARES => false`, so values are sent to the server
      separately from the statement and are never part of the SQL text.
- [x] **SQL-injection protection** — 14 cases in category B, each a payload
      aimed at a real parameter. After every one, the row counts and the table
      count are re-checked, so a silent success cannot pass as a refusal.
- [x] **Basic XSS protection** — 4 cases in category E. React escapes by
      default and nothing uses `dangerouslySetInnerHTML`; stored payloads come
      back as text, not as markup.
- [x] **Session management** — `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS,
      the id regenerated on sign-in, idle and absolute timeouts enforced on the
      server, and `session_version` so a password reset or a suspension ends
      every other session at once. Proved in `multi-device` section K and
      `auth_lifecycle` section E.

## Audit: what satisfies requirement 10

Recorded 27 September 2026, because "API consumption" was carried as *Partly
done* for weeks on the strength of map tiles alone, and that is the weakest of
the three things that actually qualify.

The requirement's own wording is **consumption of our own or an external API**,
so it does not have to be a third party's.

**1. Our own REST API, consumed with Fetch — the strongest evidence.** Every
screen in the application reads and writes through `src/services/api.js`, which
is `fetch` against `/api/...` with `credentials: 'include'`, a CSRF header on
anything that writes, and JSON parsed on the way back. This is the whole data
layer: there is no other source of data in the application. It is also the
clearest thing to demonstrate — open the network panel, submit a report, and
the request and response are both there.

**2. An external API, consumed server-side.** `turnstile_or_fail()` in
`api/tokens.php` calls `https://challenges.cloudflare.com/turnstile/v0/siteverify`
with cURL and parses the JSON verdict. The token the browser supplies proves
nothing until that call answers, which is exactly why the check is on the
server. It is switched off until the group supplies keys, so demonstrate (1)
rather than this one.

**3. OpenStreetMap tiles, through Leaflet.** `src/components/mapSetup.js`. Real
HTTP requests to a third-party service, and defensible as a maps API, but it is
a library fetching images rather than our code calling an endpoint and reading a
response. Worth mentioning, not worth leading with.

**Reverse geocoding was considered and not built.** Calling Nominatim to turn a
dropped pin into a street name would add a fourth instance, but it would be a
new feature after the freeze, it would put a third-party dependency in the
middle of the report form, and Nominatim's usage policy is not written for a
student project hammering it during a demonstration. The requirement is already
met three times over. The decision is recorded here so nobody re-opens it the
night before.

## Deliverable phases (guide pages 5–6)

| Phase | Contents | Status |
| --- | --- | --- |
| 1 — Proposal | Title, problem, users, features, roles, architecture, initial ERD, stack | Submitted |
| 2 — Database + Backend | Database, tables, relationships, CRUD, authentication, basic backend | **Done** — 17 tables, 24 foreign keys, the REST API and real sessions |
| 3 — Frontend + API | Responsive UI, JavaScript, API, AJAX/Fetch, validation, search/filter | **Done** — the UI calls the PHP API through `src/services/`; nothing is mock any more |
| 4 — Security + Testing | Injection, auth, authorization, XSS, functional and usability testing | **Done** — 972 automated checks in fifteen suites, all passing (audit 384, account lifecycle 106, multi-device 73, API report controls 53, report rules 50, form feedback 49, report form in a browser 45, contract 45, sign-out 24, interface 66, identity rules 41, matching scores 11, city 11, calendar 8, matching log 6); axe-core clean over 31 pages; no mock data in the production bundle; production verifier 25/25 (read-only). Counts as of 2 October 2026 (Correction 3), `docs/TESTING.md` §3 |
| 5 — Final Presentation | 15–20 minute demonstration, presented as if to a real client | Prepared — `docs/presentation-defense.md`; not yet delivered |

## Other graded items

- **AI Usage Log** — `docs/ai-usage-log.md`. Columns: Date, AI Tool, Prompt,
  AI Output, What Student Changed, Reason. Keep it current.
- **Individual responsibilities** — assigned per member; every member must be
  able to explain the entire system.

## Bonus / advanced (optional)

Email notification · QR code · **Maps (already done)** · real-time notification ·
file upload · PDF report generation · PWA features · **accessibility features
(largely done)** · AI-powered feature.

Note: the guide lists an "AI-powered feature" as bonus only. Our matching engine
is deliberately **not** AI — it is an explainable weighted comparison
(`CLAUDE.md` §16), which is a defensible design choice rather than a gap.
