# Paws&Found — Master Project Context

> This file is persistent context for every Claude session in this repository.
> Read it before any development work. The detailed phase plan lives in
> [docs/roadmap.md](docs/roadmap.md) — read that only when working on a phase.

---

## 1. Project Identity

- **Name:** Paws&Found
- **Full title:** Paws&Found: Web-Based Community System for Lost and Found Pets
- **Course:** Web Systems and Technologies 2
- **Type:** Web-Based Smart Service Management System
- **Stage:** Proposal approved. Implementation is incremental, frontend-first.

**Course code:** ITS122P – AM5. **Group 3, five members.** Roles are settled:

| Member | Responsibility |
| --- | --- |
| Austria, Kyle Michael V. | Project Manager / System Analyst |
| Velasco, Calvin Kristian C. | Frontend Developer |
| Zaulda, Heinz Myjie P. | Backend Developer |
| Citra, Dominic S. | Database / API Developer |
| Espiritu, Francezka Avery | QA / Security |

Every member must be able to explain the whole system, not only their part.

An academic system by Computer Science students. It should be polished and
functional, but must remain realistic, maintainable, and **defendable by the
students during a demonstration**.

---

## 2. Core Problem

Lost-pet coordination currently happens through scattered social media posts:
reports live on different platforms, information is unstructured, searching by
characteristics or location is hard, possible matches get overlooked, finders
cannot easily verify a claimant is the real owner, and owners must repeatedly
re-check multiple sources.

Paws&Found centralizes this into one map-integrated, structured system.

---

## 3. Main System Goal

Support the complete recovery workflow:

**Report → Search → Match → Verify → Coordinate → Reunite → Close**

It must feel like a service-management system, not a CRUD listings site.

Users must be able to: report lost pets, report found pets, search reports,
filter by structured pet information, view reports geographically, receive and
review possible match suggestions, coordinate verification, track report status,
receive notifications, manage their reports via a dashboard, let Staff process
cases, and let Administrators manage and moderate the system.

---

## 4. Required User Roles

Three application roles. Role boundaries are a hard requirement.

### 4.1 Customer/User
Ordinary community members — pet owners, finders, Good Samaritans, volunteers,
advocates.

Can: register/log in, manage profile, submit lost and found reports, upload pet
images, search and filter reports, view the map, view possible matches, submit or
respond to match claims, update their own reports, track status, receive
notifications, mark their own pet returned, use their dashboard.

**Must not** access Staff or Administrator functionality.

### 4.2 Staff / Pet Coordinator
Authorized personnel responsible for operational pet cases.

Can: review submitted reports, review possible matches, compare lost vs found
cases, assist with verification, request more information, update report/match
statuses, coordinate with involved users, review active cases and verification
requests, maintain case notes.

**Must not** have unrestricted administrator privileges.

### 4.3 Administrator
Responsible for system management, not everyday case processing.

Can: manage users and roles, manage pet categories, review lost/found records,
review reported posts and users, moderate false/misleading/fraudulent content,
remove reports where authorized, review system activity, use the admin dashboard.

---

## 5. Target Users

- **Primary:** pet owners; finders / Good Samaritans.
- **Secondary:** animal shelters and rescue groups; veterinary clinics and
  emergency animal hospitals.
- **Tertiary:** volunteer search networks and animal advocates; animal control /
  LGU personnel.

These groups do **not** each require a separate software role. They map onto
Customer/User or Staff depending on future requirements.

---

## 6. Proposed Feature Set

### 6.1 Registration and account management
Register, log in, log out, manage account info, and eventually manage privacy and
notification preferences. Production auth arrives only with the backend phase;
until then authentication is **simulated**.

### 6.2 Lost and Found reporting
Two report types — **Lost Pet** and **Found Pet** — sharing components but with
adapted fields. Structured information eventually includes: photo(s), species,
breed, color, size, sex where known, distinctive characteristics, description,
date lost/found, approximate time, last-seen/found location, notes.

A Found report must **not** require a pet name.

### 6.3 Search and filtering
Filters: Lost/Found, species, breed, primary color, size, date, location, status.
The UI must support active filter indicators, clear filters, sorting, responsive
filter controls, no-result states, and loading states. Search should feel genuinely
useful, not a bare text input.

### 6.4 Map-based discovery
Leaflet + OpenStreetMap. Eventually: lost/found markers, marker popups,
approximate locations, map/list views, nearby reports, location filtering, and
dropped pins during report submission.

Exact home locations must not be publicly exposed.

### 6.5 Possible match suggestions
The system's primary "smart" capability. **No generative AI, no image
recognition.** Build an explainable score comparing species, breed, color, size,
location proximity, date proximity, and distinguishing characteristics.

The scoring formula is **not final** and must stay configurable until the group
approves it.

Wording rule — always use "Possible Match" / "Potential Match" / "Match
Suggestion". **Never** state "This is definitely your pet."

### 6.6 Match verification
**Possible Match → User Review → Verification Request → Staff Review →
Coordination → Returned / Rejected**

May involve report comparison, private identifying information, proof notes,
additional photographs, and ownership questions. Verification information is
never exposed publicly.

### 6.7 Report status workflow
Initial statuses: **Active**, **Possible Match**, **Returned**, **Closed**.

Additional statuses may be required later — do not hard-code the workflow in a way
that makes extension difficult. Status **history** should be retained rather than
overwriting the previous value.

### 6.8 Notifications
Triggers include: possible match discovered, verification requested, staff review
completed, report updated, status changed, match confirmed, match rejected, pet
marked returned. Mock data only for now.

### 6.9 Dashboards
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
  user, suspend account. Do not build aggressive moderation tooling without approval.

---

## 7. Technical Direction

| Area | Choice |
| --- | --- |
| Frontend | React + Vite + JavaScript, HTML5, CSS3, Tailwind CSS |
| Icons | Lucide (or equivalent lightweight SVG set) |
| Routing | React Router |
| Maps | Leaflet + OpenStreetMap |
| Backend | **PHP** (instructor-specified) |
| Database | **MySQL via phpMyAdmin / XAMPP** (instructor-specified) |
| Image storage | Local filesystem via PHP upload, path stored in MySQL |
| Data access | **Own REST API** consumed with Fetch/AJAX |
| Deployment | Local (XAMPP) for now — team decision, 2026-08-19 |
| Tooling | VS Code, Git, GitHub |

Additional libraries only when justified.

---

## 8. DATABASE REQUIREMENTS (RECEIVED 2026-08-19)

**The instructor requirements have arrived. The old "do not build the database"
rule is lifted.** See `docs/final-project-guide-requirements.md` for the full
list; the mandatory items are:

- **MySQL**, minimum **8 related tables**, proper PK/FK, relationships,
  normalisation, CRUD, SQL queries
- **PHP** server-side: routing, sessions, authentication, authorization
- **A REST API** we build, plus consumption of our own or an external API
- Password hashing, input validation, **prepared statements**, SQL-injection
  protection, basic XSS protection, session management
- Search, filter, sort **and pagination**
- Dashboard and reporting
- Deployment and technical documentation
- An **AI Usage Log** — see `docs/ai-usage-log.md`, and keep it current

The proposal ERD (`docs/` — draft, not yet reviewed by the instructor) is a
starting point, not a specification. Known gaps are recorded when the schema is
written. It is 8 tables; the application needs roughly 11.

Still deferred: Supabase, PostgreSQL and any cloud backend. Those were the
team's earlier assumption and are **no longer the target**.

## 9. Temporary Data Architecture

```text
React/Vite frontend
        ↓
Service abstraction        ← the stable boundary
        ↓
Mock data / local state    ← today
PHP REST API → MySQL       ← next, swapped in behind the same interface
```

```text
src/
├── services/
│   ├── petService.js
│   ├── matchService.js
│   ├── userService.js
│   ├── notificationService.js
│   └── moderationService.js
└── mock/
    ├── pets.js
    ├── users.js
    ├── matches.js
    └── notifications.js
```

Components request data **only** through services:

```javascript
petService.getReports()
petService.getReportById(id)
petService.createReport(data)
petService.updateReport(id, data)
```

Services operate on mock data now; only their internals change when they start
calling the PHP API with `fetch`. Connecting the real backend must not require
rewriting the UI — that is the whole reason this boundary exists.

The database is built: `database/schema.sql` — **15 tables**, the 14 on the
ERD plus `schema_migrations`, with 23 foreign keys. Counted from
`information_schema` on MariaDB 10.4.32 via XAMPP, not from the file. **This XAMPP runs MySQL on port 3307**, not 3306, because a
separate MySQL 8.0 Windows service holds 3306.

Changes made after a database already exists go in `database/migrations/` as
numbered, additive files, and are mirrored back into `schema.sql` so a fresh
import and a migrated database stay identical. See that folder's README.

---

## 10. Development Philosophy

Build incrementally. Never attempt the whole application in one pass.
**Implement only the phase explicitly requested — do not start later phases
automatically.** See [docs/roadmap.md](docs/roadmap.md).

| Phase | Scope |
| --- | --- |
| 0 | Project foundation, architecture, coding rules |
| 1 | Site structure, navigation, routing |
| 2 | Homepage & public discovery — *design checkpoint* |
| 3 | Lost/found reporting workflow — *design checkpoint* |
| 4 | Search, filtering, explore |
| 5 | Pet report detail page — *design checkpoint* |
| 6 | User account & dashboard |
| 7 | Smart matching UI & mock logic |
| 8 | Map & location experience |
| 9 | Notifications & status workflow |
| 10 | Staff / Pet Coordinator workspace |
| 11 | Administrator workspace |
| 12 | Frontend integration, QA, accessibility, polish |
| — | *(complete; a full visual redesign pass followed)* |

Instructor requirements arrived 2026-08-19. The remaining work follows the
guide's own phases:

| Phase | Scope |
| --- | --- |
| DB1 | MySQL schema — **done**, `database/schema.sql` |
| DB2 | Seed data generated from `src/mock/` |
| API | PHP REST API + sessions, auth, authorization |
| SEC | Hashing, prepared statements, validation, XSS, injection testing |
| FIN | Pagination, charts, deployment, documentation |

---

## 11. Visual Design Rule

The team guides the visual identity personally. Do **not** independently establish
a complete final design language before approval.

Use: clean structure, consistent spacing, readable typography, responsive layouts,
neutral component styling, reusable components.

Avoid by default: excessive glassmorphism, generic SaaS gradients, glow effects,
excessive animation, oversized border radii, invented color systems, decorative
dashboards, designs lifted from unrelated apps.

**Design checkpoints** — pause for human direction before heavily styling:
Homepage, Explore/Search, Pet Report Detail, Lost/Found forms, User Dashboard,
Matching interface, Staff Dashboard, Admin Dashboard. Functional structure may be
built beforehand.

---

## 12. Responsive Design

Must support desktop, laptop, tablet, and mobile. Design mobile-aware from the
start; do not build desktop-only layouts and retrofit later. Pay particular
attention to navigation, filters, forms, map controls, dashboards, modals, image
upload, cards, and status controls.

Test targets: 1920, 1366, 768, 390.

---

## 13. Accessibility

Integrate during implementation, not only at polish time: semantic HTML, keyboard
usability, visible focus states, proper form labels, useful error messages,
descriptive button text, image alt text, adequate contrast, correct heading
hierarchy, and status indicators that do not rely on color alone.

---

## 14. Privacy and Safety

Never automatically display exact home address, private email, private phone
number, or sensitive verification information. Public reports should carry enough
detail to help a search while preserving reasonable privacy. Exact contact and
location-precision behavior will be decided later.

---

## 15. Student-Scale Engineering Rule

Paws&Found is a university Web Systems and Technologies project. Code quality
matters, but the implementation must stay **proportional to the academic scope
and understandable by the student development team**. Every important piece must
be explainable by a student during a demonstration.

**Use the simplest clean implementation that satisfies the current requirement.
Do not introduce abstractions solely because they might be useful later.**

### Do not add

- service layers beyond what is currently required
- custom error hierarchies
- repositories, factories, providers, adapters
- event systems, state machines
- complex utility layers
- artificial network simulation
- premature optimization
- elaborate testing infrastructure
- future-phase code stubs
- dependencies for features not currently being implemented

Also excluded, as before: Kubernetes, Kafka, microservices, Redis clusters,
blockchain, complex cloud infrastructure, AI agents, dozens of third-party
services. Prefer one frontend, one backend service layer, one relational
database, understandable algorithms, reusable components, clear workflows.

**A small amount of duplication is preferable to an abstraction that makes the
project harder for the team to understand.**

Never create folders such as `controllers/`, `repositories/`, `providers/`,
`adapters/`, `factories/`, `domain/`, `infrastructure/`, `usecases/`,
`entities/`, `dtos/`, `mappers/`, `middleware/`, `state-machine/`, `event-bus/`.
The project structure is the one in §9 and the README, and it does not grow
without approval.

### Dependencies

Before installing an npm package, determine whether the feature can reasonably
be built with React, browser APIs, or a package already installed. Install only
when it provides clear value for an approved feature that is being implemented
**now**.

### Current phase only

Do not write code belonging to a future phase — no placeholder functions, no
"seams", no helpers for an algorithm eight phases away — unless the current
phase needs infrastructure that genuinely cannot be added later.

Documentation may describe future phases. Source code should not.

### Proportionate testing

Testing should match a university web-development project. At minimum:

- the application builds
- lint passes
- the implemented workflow works
- the browser console is clear
- major responsive layouts work
- relevant validation and role restrictions work

Do not build testing harnesses or investigate artificial browser/runtime edge
cases unless they affect functionality a real user will encounter.

### End-of-phase honesty

At the end of every phase, explicitly identify any implementation that may be
more complex than necessary, so the team can decide whether to simplify it.
This is a required part of the report in §24.

---

## 16. Smart Feature Philosophy

"Smart" does not mean AI. Prioritize matching algorithms, location proximity,
structured filtering, recommendations, status automation, duplicate detection, and
notifications. Generative AI or image recognition only if required by the
instructor, technically realistic, clearly beneficial, and approved by the group.

---

## 17. Reusable Component Requirement

Before creating a new reusable component, **check `docs/ui-inventory.md`** for an
equivalent. Maintain that file.

Expected components: Button, Input, Select, Textarea, Modal, Dialog, Toast,
PetCard, StatusBadge, ReportTypeBadge, MatchCard, NotificationItem, EmptyState,
LoadingSkeleton, SearchBar, FilterPanel, Sidebar, PageHeader, MapPopup, Timeline,
Tabs, Breadcrumb.

Do not end up with `PetCard` + `PetListingCard` + `AnimalCard` + `ReportCard` +
`LostPetCard` that are all the same component.

---

## 18. IMAGE ASSET RULE

Do not generate, download, or permanently select stock imagery without explicit
approval.

Whenever implementation requires a visual asset that does not exist yet, add an
entry to `docs/image-requirements.md` with:

1. Asset ID  2. Page/component  3. Image description  4. Purpose  5. Subject(s)
6. Recommended orientation  7. Recommended dimensions/aspect ratio
8. Whether a transparent background is preferred  9. Priority  10. Status

| ID | Page | Description | Orientation | Size | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| IMG-001 | Homepage | Dog + cat hero visual | Landscape | 1600×1200 | High | Needed |

Use neutral placeholders during implementation. **Do not alter a page layout
solely because an image is currently unavailable.**

Eventual dataset: multiple dogs and cats, a few birds/other pets, varied breeds,
sizes, colors, and Philippine locations, both report types, several returned/closed
cases. Some lost and found images should intentionally look similar so the match
workflow demos convincingly. No photos of identifiable private individuals.

---

## 19. Demo Data Philosophy

No "Test User", "Pet 1", "Lorem ipsum", "Sample Dog". Use realistic pet names,
believable Philippine cities/areas, realistic descriptions, plausible dates, varied
statuses. Data must be clearly fictional and must not impersonate real people.

---

## 20. Error and Empty States

Every important feature accounts for failure and emptiness: loading, no lost pets
found, no possible matches, no notifications, no reports submitted, empty search
results, invalid form, map unavailable, image unavailable, unauthorized, 404,
network error. Do not build only the happy path.

---

## 21. Form Behavior

Clear labels, required-field indicators, useful validation, meaningful error
messages, a review step where appropriate, success confirmation, cancellation
behavior, responsive mobile layout.

Reporting flow: **Pet Details → Location & Date → Photos → Review → Submit**

---

## 22. Coding Standards

**Prefer:** small reusable components, descriptive naming, clear folder
organization, minimal duplication, readable logic, comments only where useful,
separation between UI and data access, consistent patterns.

**Avoid:** giant single-file pages, deeply nested conditional JSX, duplicated
business logic, hard-coded role checks scattered everywhere, mock arrays embedded
directly in page components, unnecessary dependencies.

---

## 23. Change Discipline

For any development phase:

1. Read the current project structure.
2. Read this file.
3. Read the phase-specific requirements.
4. Inspect existing reusable components.
5. Implement only the requested scope.
6. Do not rewrite unrelated modules or silently refactor.
7. Run available lint/test/build checks.
8. Fix errors introduced by the work.
9. Report exactly what changed.

---

## 24. End-of-Phase Report (required)

At the end of every phase, provide:

- **Completed** — functionality implemented
- **Files Added**
- **Files Modified**
- **Functional Testing Performed**
- **Known Limitations** — anything intentionally deferred
- **Possibly Over-Engineered** — anything that may be more complex than the
  project needs, so the team can decide whether to simplify it (§15)
- **Image Assets Needed** — new entries in `docs/image-requirements.md`
- **Decisions Needed From Team** — design/functionality questions needing approval
- **Next Recommended Phase** — state it, but **do not begin it**

---

## 25. Current Project Boundary

In scope now: **UI + frontend functionality + workflow simulation.**

Now in scope, since the instructor requirements arrived: MySQL schema (done),
PHP REST API, sessions and real authentication, server-side authorization,
file upload, and local deployment.

No longer the target: Supabase, PostgreSQL, RLS and any cloud backend.

---

## 26. Definition of Success

The system should let the team demonstrate this story end to end:

> An owner loses a pet and files a structured lost-pet report. A community member
> later finds a similar pet and files a found-pet report. The system surfaces a
> possible match from report characteristics and location. The users and a Pet
> Coordinator review the match, verify identifying information, coordinate the
> return, and update the report to show the pet was reunited with its owner.

Administrator functionality supports this through user management, category
management, record oversight, and moderation. Every major feature should serve
this workflow.

---

## 27. Priority Order

1. Instructor requirements
2. Approved project proposal
3. This project context
4. Current phase instructions
5. Existing project architecture and reusable components

If a later instructor requirement conflicts with this document, **the instructor
requirement wins.**

If a decision has not been approved: do not invent a major permanent solution.
Choose the least-coupled temporary implementation, document the decision needed,
and continue only where doing so will not make later changes unnecessarily hard.
