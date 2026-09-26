# Final Project Requirements — ITS122P – AM2

Transcribed from the instructor's *Final Project Guide* (8 pages), received
2026-08-19. This is the checklist the project is graded against. Where a row is
already satisfied, the evidence is named.

Topic: **Campus Lost-and-Found System** — assigned to this group as Paws&Found.

## Mandatory

| # | Requirement | Status | Where |
| --- | --- | --- | --- |
| 1 | Responsive web application | **Done** | Verified at 390 / 768 / 1366 / 1920 across all routes |
| 2 | Login / logout | **Simulated only** | `userService` + `RequireAccess`; needs real PHP sessions |
| 3 | Minimum 3 user roles | **Done** | Customer/User, Staff/Pet Coordinator, Administrator |
| 4 | MySQL database | **Not started** | Next deliverable |
| 5 | Minimum 8 related tables | **Done** | 15 tables, 23 foreign keys, counted from `information_schema`. Fourteen are on the ERD; the fifteenth, `schema_migrations`, is infrastructure. |
| 6 | CRUD operations | **Frontend only** | Service layer exists; needs SQL behind it |
| 7 | Server-side processing (PHP) | **Not started** | Routing, sessions, auth, authorization |
| 8 | JavaScript interaction | **Done** | React 19 + Vite, client-side routing, dynamic content |
| 9 | REST API | **Not started** | We build it; endpoints mirror `src/services/` |
| 10 | API consumption | **Partly done** | Leaflet + OpenStreetMap tiles (maps/location API) |
| 11 | Search / filter | **Done** | Explore: text, type, species, size, colour, city, status, date |
| 12 | Sort | **Done** | Explore sort; staff queue sorts on six columns |
| 13 | Pagination | **Not done** | Currently "Show more"; must become pagination |
| 14 | Dashboard | **Done** | Customer, staff and admin dashboards |
| 15 | Reports | **Partly done** | Status breakdown, counts; charts still to add |
| 16 | Form validation | **Done** | Report wizard, per-step, with error messages |
| 17 | Security implementation | **Not started** | Hashing, prepared statements, XSS, sessions |
| 18 | Error handling | **Done (frontend)** | Loading, error and empty states on every async view |
| 19 | Deployment | **Not started** | Local XAMPP for now (team decision) |
| 20 | Technical documentation | **Partly done** | `docs/` — design system, UI inventory, image requirements |

## Security checklist (guide page 3)

- [ ] Password hashing
- [ ] Role-based access **on the server** (the current guard is UI-only)
- [ ] Input validation server-side
- [ ] Prepared statements
- [ ] SQL-injection protection
- [ ] Basic XSS protection
- [ ] Session management

## Deliverable phases (guide pages 5–6)

| Phase | Contents | Status |
| --- | --- | --- |
| 1 — Proposal | Title, problem, users, features, roles, architecture, initial ERD, stack | Submitted |
| 2 — Database + Backend | Database, tables, relationships, CRUD, authentication, basic backend | **Next** |
| 3 — Frontend + API | Responsive UI, JavaScript, API, AJAX/Fetch, validation, search/filter | UI largely built; API pending |
| 4 — Security + Testing | Injection, auth, authorization, XSS, functional and usability testing | Not started |
| 5 — Final Presentation | 15–20 minute demonstration, presented as if to a real client | Not started |

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
