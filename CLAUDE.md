# Paws&Found — project context

Web-based community system for lost and found pets. Built, deployed, and past its
defense; work now arrives as numbered **Corrections** from the instructor's feedback.

**Before any change, read [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)** (what is live,
what is committed but not deployed, the local setup, the test gate), then run `git status`
yourself. A document is a snapshot; the repository is the truth.

## 1. Production safety (always)

- Commit or push only when Kyle asks. Never force-push, amend, rebase, or squash.
- Work on `post-defense/revisions`. Production deploys from remote `portfolio`, branch
  `team/current`. Keep `origin`'s push URL disabled.
- The production database is read-only: `SELECT`, `SHOW`, `DESCRIBE` only. No `UPDATE`,
  `DELETE`, reseeding, or destructive upload checks (`verify:deploy --upload` only locally).
- **Never run `npm run audit` (or `scripts/audit*.py`) against production.** It reseeds
  whatever database it points at. `scripts/audit.py` now refuses any API or database that
  isn't this machine; don't work around that check.
- Never display secrets: Railway variables, DB credentials or connection strings,
  `BREVO_API_KEY`, the Turnstile secret, `RATE_LIMIT_SECRET`, `api/config.local.php`,
  cookies, session ids, raw auth tokens.
- Type passwords only into a local development host. Checks that need a production sign-in
  go on Kyle's manual checklist.
- Do not enable `MATCH_DEBUG`. Leave production report 43 alone (see CURRENT_STATE §5).

## 2. Project

- **Course:** Web Systems and Technologies 2 (ITS122P – AM5), Group 3.
- **Roles in the team:** Kyle Michael V. Austria (Project Manager / System Analyst),
  Calvin Kristian C. Velasco (Frontend), Heinz Myjie P. Zaulda (Backend),
  Dominic S. Citra (Database / API), Francezka Avery Espiritu (QA / Security).
- Every member must be able to explain the whole system, so everything built here must
  stay realistic, maintainable, and **defendable by students in a demonstration**.
- Core workflow: **Report → Search → Match → Verify → Coordinate → Reunite → Close.**
  It must behave as a service-management system, not a listings site.
- Course brief, feature narrative, and phase history: [docs/project-brief.md](docs/project-brief.md).

## 3. Roles and access (hard requirement)

- **Customer/User:** owners, finders, volunteers. Must not reach Staff or Administrator
  functionality.
- **Staff / Pet Coordinator:** processes cases (reports, matches, verification, case notes).
  Must not have unrestricted administrator privileges.
- **Administrator:** system management, not everyday case processing. Three levels in
  `users.admin_level`: moderator, manager, super_admin.
- Authorization is enforced server-side. Endpoints check capabilities
  (`ADMIN_CAPABILITIES` in `api/helpers.php`); hiding UI is never access control. Don't
  scatter hard-coded role checks. The full matrix: `docs/role-permissions.md`.

## 4. Domain invariants

- Matching is explainable scoring (species, breed, colour, size, location, date,
  distinguishing marks). No generative AI or image recognition unless the instructor
  requires it and the group approves.
- Wording: "Possible Match" / "Potential Match" / "Match Suggestion". Never say or imply
  "this is definitely your pet".
- Never publicly expose exact home locations, private email or phone numbers, or
  verification information.
- A Found report never requires a pet name.
- Report status history is retained, never overwritten. Don't hard-code the status
  workflow so it can't be extended.

## 5. Stack and data boundary

| Area | Current |
| --- | --- |
| Frontend | React + Vite + JavaScript, Tailwind CSS, React Router, Lucide icons |
| Maps | Leaflet + OpenStreetMap |
| Backend | PHP REST API in `api/` (instructor-specified), real PHP sessions |
| Database | MySQL (MariaDB 10.4 via XAMPP locally, **port 3307**); schema in `database/schema.sql` |
| Images | Local filesystem via PHP upload; path stored in MySQL |
| Production | Railway (Docker); local development on XAMPP |

Not used: Supabase, PostgreSQL, or any hosted backend-as-a-service.

Components get data only through `src/services/`, which call the PHP API via
`src/services/api.js`. Components never call `fetch` directly. Shipped code never imports
`src/mock/` (the fictional demo dataset); `npm run check:bundle` and
`scripts/no-mock-in-production.test.mjs` guard this.

## 6. Student-scale engineering

Use the simplest clean implementation that satisfies the current requirement. A little
duplication beats an abstraction the team can't explain.

- No new abstractions, service layers, error hierarchies, event systems, state machines,
  or future-work stubs without approval.
- Never create folders such as `controllers/`, `repositories/`, `providers/`, `adapters/`,
  `factories/`, `domain/`, `infrastructure/`, `usecases/`, `entities/`, `dtos/`,
  `mappers/`, `middleware/`, `state-machine/`, `event-bus/`.
- No new npm package unless an approved feature being built now clearly needs it.
- No Kubernetes, Kafka, microservices, Redis, blockchain, AI agents, or piles of
  third-party services.
- Testing stays proportionate: the test gate in CURRENT_STATE §7, not new harnesses.

## 7. Working in Corrections

- Treat each Correction (or a batch Kyle explicitly defines) as one unit: finish it, verify
  it, report it. Don't start the next Correction unless Kyle asked you to continue through
  several.
- Report once per Correction or batch, not after every small edit. Include what changed,
  how it was verified, known limitations, anything possibly over-engineered, and
  decisions the team needs to make.

## 8. Priority order

1. **Kyle's explicit instructions for the current task or Correction** decide what to do.
   They don't make a false fact true or override §1 or the security requirements: if an
   instruction conflicts with verified evidence or a safety rule, say so before acting.
2. **Verified implementation and runtime state** decide what the system currently is.
3. **Instructor requirements and corrections** (`docs/final-project-guide-requirements.md`,
   `docs/report-corrections.md`) decide what the system must do. When they conflict with
   this file, the instructor wins.
4. **This file and `.claude/rules/`.**
5. **The approved project proposal** (submitted as the guide's Phase 1; not stored in this
   repository, summarized in `docs/project-brief.md`). It is authoritative for course scope.
   Where it describes an earlier plan, the verified implementation controls.
6. **Other current docs** (`docs/CURRENT_STATE.md`, `docs/HANDOFF.md`, …), then older
   history (`docs/project-brief.md` history, `docs/roadmap.md`).
7. External sources only when asked or materially needed; label inference as inference.

When a decision hasn't been approved, choose the least-coupled temporary option, record
the decision needed, and continue only if that won't make later changes harder.

## 9. Where things live

- Path-scoped rules load automatically when you touch matching files:
  `.claude/rules/frontend.md` (`src/`), `php-api.md` (`api/`), `database.md`
  (`database/`), `assets-and-demo-data.md` (images, demo and seed data).
- `docs/CURRENT_STATE.md` — live state, Kyle's rules, local setup, test gate, shipping.
- `docs/HANDOFF.md` — architecture, database, auth, email, deployment.
- `docs/TESTING.md`, `docs/DECISIONS.md`, `docs/PRODUCTION_RUNBOOK.md`,
  `docs/role-permissions.md`, `docs/ui-inventory.md`, `docs/design-system.md`.
- AI Usage Log (a course requirement; keep it current): `docs/ai-usage-log.md`.
- Comments and docs that cite `CLAUDE.md §N` use the numbering before 2026-10-06 (commit
  `d7f7435`). The map to current locations is at the end of `docs/project-brief.md`.
