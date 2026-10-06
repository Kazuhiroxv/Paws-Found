# Paws&Found — project brief and history

> **Reference, not instructions.** This is the course brief and planning history that used
> to sit in `CLAUDE.md`. Current rules are in [`../CLAUDE.md`](../CLAUDE.md) and
> [`CURRENT_STATE.md`](CURRENT_STATE.md). Where this file describes a plan, the system as
> built is the truth. Useful for defense preparation and onboarding.

## Core problem

Lost-pet coordination currently happens through scattered social media posts:
reports live on different platforms, information is unstructured, searching by
characteristics or location is hard, possible matches get overlooked, finders
cannot easily verify a claimant is the real owner, and owners must repeatedly
re-check multiple sources.

Paws&Found centralizes this into one map-integrated, structured system.

## Main system goal

Support the complete recovery workflow:

**Report → Search → Match → Verify → Coordinate → Reunite → Close**

Users must be able to: report lost pets, report found pets, search reports,
filter by structured pet information, view reports geographically, receive and
review possible match suggestions, coordinate verification, track report status,
receive notifications, manage their reports via a dashboard, let Staff process
cases, and let Administrators manage and moderate the system.

## Role descriptions (as specified in the brief)

- **Customer/User** — ordinary community members (pet owners, finders, Good Samaritans,
  volunteers, advocates). Can register/log in, manage a profile, submit lost and found
  reports, upload pet images, search and filter, view the map, view possible matches,
  submit or respond to match claims, update their own reports, track status, receive
  notifications, mark their own pet returned, use their dashboard.
- **Staff / Pet Coordinator** — authorized personnel for operational cases. Reviews
  reports and possible matches, compares lost vs found cases, assists verification,
  requests more information, updates report/match statuses, coordinates with users,
  maintains case notes.
- **Administrator** — system management: users and roles, pet categories, lost/found
  records, reported posts and users, moderation of false/misleading/fraudulent content,
  removing reports where authorized, reviewing system activity, the admin dashboard.

The current, enforced matrix is `role-permissions.md`.

## Target users

- **Primary:** pet owners; finders / Good Samaritans.
- **Secondary:** animal shelters and rescue groups; veterinary clinics and
  emergency animal hospitals.
- **Tertiary:** volunteer search networks and animal advocates; animal control /
  LGU personnel.

These groups do **not** each require a separate software role. They map onto
Customer/User or Staff.

## Feature set (from the proposal)

### Registration and account management
Register, log in, log out, manage account info, and manage privacy and notification
preferences.

### Lost and Found reporting
Two report types — **Lost Pet** and **Found Pet** — sharing components but with
adapted fields: photo(s), species, breed, color, size, sex where known, distinctive
characteristics, description, date lost/found, approximate time, last-seen/found
location, notes. A Found report does not require a pet name.

### Search and filtering
Filters: Lost/Found, species, breed, primary color, size, date, location, status.
The UI supports active filter indicators, clear filters, sorting, responsive filter
controls, no-result states, and loading states.

### Map-based discovery
Leaflet + OpenStreetMap: lost/found markers, marker popups, approximate locations,
map/list views, nearby reports, location filtering, and dropped pins during report
submission. Exact home locations are not publicly exposed.

### Possible match suggestions
The system's primary "smart" capability: an explainable score comparing species,
breed, color, size, location proximity, date proximity, and distinguishing
characteristics. No generative AI, no image recognition. The proposal kept the scoring
formula configurable until the group approved it; `matching-explanation.md` documents
the formula as built.

### Match verification
**Possible Match → User Review → Verification Request → Staff Review →
Coordination → Returned / Rejected**

May involve report comparison, private identifying information, proof notes,
additional photographs, and ownership questions. Verification information is
never exposed publicly.

### Report status workflow
Initial statuses: **Active**, **Possible Match**, **Returned**, **Closed**, extensible,
with status history retained.

### Notifications
Triggers: possible match discovered, verification requested, staff review completed,
report updated, status changed, match confirmed, match rejected, pet marked returned.

### Dashboards
- **User:** overview statistics, active/lost/found reports, possible matches,
  notifications, recent activity, status, profile. Useful case information over
  decorative analytics.
- **Staff:** pending reports, reports awaiting review, possible matches,
  verification requests, active cases, recently updated cases, returned pets.
  Actions: review report, compare reports, review match, request more info,
  confirm match, reject match, update status, coordinate with users.
- **Admin:** users, roles, pet categories, reports, moderation, reported content,
  system activity. Moderation categories: false report, spam, scam, harassment,
  inappropriate content, duplicate, other. Actions: dismiss, remove content, warn
  user, suspend account.

## Smart feature philosophy

"Smart" does not mean AI. The brief prioritized matching algorithms, location
proximity, structured filtering, recommendations, status automation, duplicate
detection, and notifications.

## Development history (all complete)

Frontend phases, built incrementally with design checkpoints:

| Phase | Scope |
| --- | --- |
| 0 | Project foundation, architecture, coding rules |
| 1 | Site structure, navigation, routing |
| 2 | Homepage & public discovery (design checkpoint) |
| 3 | Lost/found reporting workflow (design checkpoint) |
| 4 | Search, filtering, explore |
| 5 | Pet report detail page (design checkpoint) |
| 6 | User account & dashboard |
| 7 | Smart matching UI & mock logic |
| 8 | Map & location experience |
| 9 | Notifications & status workflow |
| 10 | Staff / Pet Coordinator workspace |
| 11 | Administrator workspace |
| 12 | Frontend integration, QA, accessibility, polish |
| — | A full visual redesign pass followed |

After the instructor's requirements arrived (2026-08-19), the work followed the guide's
phases:

| Phase | Scope |
| --- | --- |
| DB1 | MySQL schema, `database/schema.sql` |
| DB2 | Seed data generated from `src/mock/` |
| API | PHP REST API + sessions, auth, authorization |
| SEC | Hashing, prepared statements, validation, XSS, injection testing |
| FIN | Pagination, charts, deployment, documentation |

Then the defense, then post-defense Corrections (see `report-corrections.md` and
`CURRENT_STATE.md`). The detailed frontend phase plan is in `roadmap.md`.

**Design checkpoints (historical):** during the frontend phases the team paused for
direction before heavily styling the Homepage, Explore/Search, Pet Report Detail,
Lost/Found forms, User Dashboard, Matching interface, Staff Dashboard, and Admin
Dashboard. The approved direction is now in `design-system.md`.

## Definition of success

The system should let the team demonstrate this story end to end:

> An owner loses a pet and files a structured lost-pet report. A community member
> later finds a similar pet and files a found-pet report. The system surfaces a
> possible match from report characteristics and location. The users and a Pet
> Coordinator review the match, verify identifying information, coordinate the
> return, and update the report to show the pet was reunited with its owner.

Administrator functionality supports this through user management, category
management, record oversight, and moderation. Every major feature should serve
this workflow.

## Old CLAUDE.md section numbers

Code comments and docs written before 2026-10-06 cite `CLAUDE.md §N` from the version at
commit `d7f7435`. That content now lives here:

| Old § | Topic | Now |
| --- | --- | --- |
| 0 | Start here | `CLAUDE.md` intro + §1 Production safety |
| 1 | Project identity | `CLAUDE.md` §2 |
| 2, 3, 5 | Problem, goal, target users | this file |
| 4, 4.1–4.3 | Roles (Customer, Staff, Administrator) | `CLAUDE.md` §3; descriptions in this file; matrix in `role-permissions.md` |
| 6, 6.1–6.9 | Feature set (6.5 matching, 6.6 verification, 6.7 status workflow, 6.9 dashboards) | this file; the invariants in `CLAUDE.md` §4 |
| 7 | Technical direction | `CLAUDE.md` §5 |
| 8 | Database requirements | `.claude/rules/database.md`, `.claude/rules/php-api.md` |
| 9 | Data architecture | `CLAUDE.md` §5; `.claude/rules/database.md` |
| 10 | Phases | this file (Development history) |
| 11, 12, 13 | Visual design, responsive, accessibility | `.claude/rules/frontend.md` |
| 14 | Privacy and safety | `CLAUDE.md` §4; `.claude/rules/php-api.md` |
| 15 | Student-scale engineering | `CLAUDE.md` §6 |
| 16 | Smart feature philosophy | `CLAUDE.md` §4; this file |
| 17 | Reusable components | `.claude/rules/frontend.md` |
| 18, 19 | Image assets, demo data | `.claude/rules/assets-and-demo-data.md` |
| 20, 21, 22 | Error/empty states, forms, coding standards | `.claude/rules/frontend.md` |
| 23, 24 | Change discipline, end-of-work report | `CLAUDE.md` §7 |
| 25 | Project boundary | `CLAUDE.md` intro and §5 |
| 26 | Definition of success | this file |
| 27 | Priority order | `CLAUDE.md` §8 |
