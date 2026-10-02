# Page Inventory

Every route the application will have, who can reach it, and which phase builds
it. Phase 1 creates the shells for all of them; later phases fill them in.

Keep this in step with the router — if a route exists in code and not here, one
of the two is wrong.

_Last updated: 1 October 2026, against `src/App.jsx`. Every route below exists and loads._

**Status key:** `Shell` — route, layout, title and breadcrumb are in place, contents
come in the phase named. `Built` — the page is finished for now.

## Public

| Route | Page | Access | Contents from | Status |
| --- | --- | --- | --- | --- |
| `/` | Homepage | Everyone **but the administrator**¹ | — | Built |
| `/explore` | Explore / search results | Everyone but the administrator¹ | — | Built |
| `/report/lost` | Report a lost pet | **Signed in**, not the administrator¹ | — | Built |
| `/report/found` | Report a found pet | **Signed in**, not the administrator¹ | — | Built |
| `/pet/:id` | Pet report detail | Everyone (full details need sign-in) | — | Built |
| `/about` | About Paws&Found | Everyone but the administrator¹ | — | Built |
| `/help` | Help & community safety | Everyone but the administrator¹ | — | Built |
| `/privacy` | Privacy notice | Everyone but the administrator¹ | — | Built |
| `/login` | Sign in | Everyone | PHP session | Built |
| `/register` | Create an account | Everyone | PHP API | Built |
| `/verify-email` | Confirm an email address (link from an email) | Everyone | PHP API | Built |
| `/forgot-password` | Ask for a reset link | Everyone | PHP API | Built |
| `/reset-password` | Set a new password (link from an email) | Everyone | PHP API | Built |

¹ A signed-in administrator is sent to `/admin` (`AdminStaysInWorkspace`,
`src/components/RequireAccess.jsx`). A report's own page stays open to them,
because Moderation, Records and the Overview link to it.

## Customer / User

| Route | Page | Access | Contents from | Status |
| --- | --- | --- | --- | --- |
| `/dashboard` | Overview | User | — | Built |
| `/dashboard/reports` | My reports | User | — | Built |
| `/dashboard/reports/:id/edit` | Edit a report | Owner only | — | Built |
| `/dashboard/matches` | Possible matches | User | — | Built |
| `/dashboard/notifications` | Notification centre | User | — | Built |
| `/dashboard/profile` | Profile & preferences | User | — | Built |

## Staff / Pet Coordinator

| Route | Page | Access | Contents from | Status |
| --- | --- | --- | --- | --- |
| `/staff` | Staff overview | Staff | — | Built |
| `/staff/reports` | Report queue | Staff | — | Built |
| `/staff/matches` | Match queue | Staff | — | Built |
| `/staff/verification` | Verification workspace | Staff | — | Built |
| `/staff/notifications` | Notification centre | Staff | — | Built |

## Administrator

| Route | Page | Access | Contents from | Status |
| --- | --- | --- | --- | --- |
| `/admin` | Admin overview | Admin | — | Built |
| `/admin/users` | User management | Admin | — | Built |
| `/admin/reports` | Record oversight | Admin | — | Built |
| `/admin/categories` | Pet categories | Admin | — | Built |
| `/admin/moderation` | Moderation queue | Admin | — | Built |

## System

| Route | Page | Access | Contents from | Status |
| --- | --- | --- | --- | --- |
| `*` | 404 — page not found | Everyone | — | Built |
| `/unauthorized` | No access for this role | Everyone | — | Built |

## Notes

- Route guards keep the interface coherent; they are not the security
  boundary. The PHP API checks the session and role on every request
  (`docs/role-permissions.md`).
- **Visitors arrive signed out.** Browsing is public — homepage, Explore, a
  report, About and Help. Filing a report and every workspace require signing
  in; those routes redirect to `/login` and return you to where you were headed
  once you do.
- Each role reaches only its own workspace: a user cannot open `/staff`, and
  staff cannot open `/admin`. Wrong-role routes redirect to `/unauthorized`.
  The administrator is also kept out of the community pages (¹ above). Switch
  account with the demo role selector, or the development sign-in panel on
  `/login` (both exist only under `npm run dev`).
- Every page sets its document title through `PageHeader`. A page that does not
  render a `PageHeader` will keep the previous page's title.
