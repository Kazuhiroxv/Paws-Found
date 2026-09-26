# Paws&Found

Web-Based Community System for Lost and Found Pets — an academic project for
Web Systems and Technologies 2.

Community members report lost and found pets, search structured listings, review
possible matches, and coordinate verification with a Pet Coordinator until the
pet is reunited with its owner.

## Status

**The application runs on a real MySQL database through a PHP REST API we
wrote.** All twelve frontend phases are complete, a full visual redesign pass
followed, and the mock data layer has been replaced with live data.

**The whole community-member journey works end to end.** Browse or search 32
reports, open a report's full case page, file a lost or found report, then track
it from your dashboard — edit it, mark it returned, close it, manage your
profile, and flag a listing for moderation.

**Matching works and explains itself.** Lost and found reports are compared
attribute by attribute and scored, and every point in a score is shown back to
the user. There is no AI in it — species, location, breed, colour, size, date
and distinguishing features, with species and location acting as gates.

**The case workflow closes the loop.** A possible match can be sent for
verification; confirming it marks both reports returned, records the change on
each report's timeline, and notifies both people — in one database transaction.

**Both staff workspaces are live.** Pet Coordinators get verification requests,
a report queue, a match queue and a side-by-side comparison view.
Administrators get accounts and roles, record oversight, pet category
management, and a moderation queue with the four approved decisions.

**Maps work.** Explore has a list/map toggle, each report shows its approximate
area, and reporters can drop a pin when filing. Leaflet + OpenStreetMap.

**Accounts are real.** You can register, and you can sign in with an email
address and password. Passwords are hashed with bcrypt, the session is a PHP
session, and a new account is always an ordinary user — the role is never taken
from the request.

**Photos and categories are live too.** Report photographs upload to the API and
are checked by what the file actually is; administrators add, rename, retire and
delete pet categories. Nothing the app shows comes from mock data any more. See
[`docs/feature-status.md`](docs/feature-status.md) for the item-by-item picture.

**It is tested.** `npm run audit` runs 117 test cases against the live API and
database; `npm run a11y` runs axe-core over 25 pages.

## Getting started

You need **XAMPP** (Apache + MySQL + PHP 8.2) and **Node.js 20+**.

### 1. Database

Start Apache and MySQL from the XAMPP Control Panel, then create and fill the
database:

```bash
mysql -u root -P 3307 -h 127.0.0.1 --default-character-set=utf8mb4 -e "CREATE DATABASE IF NOT EXISTS pawsandfound CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

```bash
mysql -u root -P 3307 -h 127.0.0.1 --default-character-set=utf8mb4 pawsandfound < database/schema.sql
```

```bash
mysql -u root -P 3307 -h 127.0.0.1 --default-character-set=utf8mb4 pawsandfound < database/seed.sql
```

**Do not leave out `--default-character-set=utf8mb4`.** On Windows the client
otherwise reads the files in the console code page, and every curly apostrophe
in the seed descriptions is stored as `ÔÇÖ`. Nothing errors — the corruption is
silent, and only shows up on the page.

> **Check your MySQL port first.** The machine this was built on runs XAMPP's
> MariaDB on **3307**, because a separate MySQL 8.0 Windows service already held
> 3306. Most XAMPP installations use the default **3306** — if yours does, drop
> the `-P 3307` from the commands above and change `DB_PORT` in
> [`api/config.php`](api/config.php) to `3306`. The XAMPP Control Panel shows the
> port next to MySQL when it is running.
>
> `mysql` returns exit code 0 even when a statement fails, so read the output
> rather than trusting the exit code.

### 2. API

Apache has to serve the `api/` folder at `/pawsandfound/api`. Either copy it to
`C:\xampp\htdocs\pawsandfound\api\`, or link it so edits take effect straight
away (run in an administrator Command Prompt, adjusting the project path):

```bash
mklink /J C:\xampp\htdocs\pawsandfound\api C:\Projects\paws-and-found\api
```

Then `http://localhost/pawsandfound/api/` should return a short JSON index
listing the endpoints.

### 3. Frontend

```bash
npm install
```

```bash
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to Apache, so both servers
must be running.

### 4. Deploying the built site

Development runs two servers. A deployment runs one: Apache serves the built
site and the API from the same address, so there is no proxy and no CORS.

```bash
npm run build
```

Copy everything in `dist/` into `C:\xampp\htdocs\pawsandfound\`, beside the
`api` junction that is already there. Then open
<http://localhost/pawsandfound/>.

That is the whole deployment. Three details make it work, and all three live in
the repository rather than being typed on the server:

- `vite.config.js` sets `base` to `/pawsandfound/` for a build, so the page asks
  for `/pawsandfound/assets/...` rather than `/assets/...`.
- `src/services/api.js` builds its URLs from `import.meta.env.BASE_URL`, so the
  same code calls `/api` through the proxy in development and
  `/pawsandfound/api` in production.
- `public/.htaccess` is copied into `dist/` by the build. It hands back
  `index.html` for any address that is not a real file, which is what lets
  someone open `/pawsandfound/explore` directly or refresh while on it. It
  leaves `/pawsandfound/api/...` to the API's own `.htaccess`.

Do not serve `dist/` from the htdocs root: the API lives under
`/pawsandfound/api`, and a site at the root would ask for `/api` and get a 404.

### Signing in

Every seeded account uses the password **`demo1234`**.

| Role | Email |
| --- | --- |
| Customer/User | `maria.santos@example.com` |
| Pet Coordinator | `patricia.lim@example.com` |
| Administrator | `grace.bautista@example.com` |

The demo role selector in the navigation bar switches between them quickly
**while running `npm run dev`**. It is development scaffolding: it signs in
without asking for a password, so it is removed from production builds along
with the password itself. On a built site everyone signs in through the form.

| Script | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over the project |
| `npm run audit` | 117 test cases against the live API and database (reseeds it) |
| `npm run a11y` | axe-core accessibility scan of the deployed site |

## Stack

React 19 · Vite 8 · JavaScript · Tailwind CSS 4 · React Router 7 · Lucide icons ·
Leaflet + OpenStreetMap

## How the code is organised

```
src/
├── components/ui/   Reusable presentational primitives
├── pages/           One component per route, grouped by area
├── layouts/         RootLayout (nav + footer), WorkspaceLayout (sidebar)
├── services/        THE DATA BOUNDARY — all reads and writes go through here
├── mock/            The source the database seed is generated from
├── hooks/           Shared React hooks
├── utils/           Small helpers
├── constants/       Roles, statuses, species, moderation reasons
└── assets/          Hero, logo, empty-state and placeholder images

api/                 The PHP REST API — flat files, no framework
├── index.php        Front controller; dispatches on the first path segment
├── config.php       Database, allowed origins, page sizes
├── db.php           One PDO connection
├── helpers.php      JSON responses, sessions, require_login / require_role
└── auth · reports · matches · users · notifications · categories · moderation

database/
├── schema.sql       15 tables (14 on the ERD + schema_migrations)
└── seed.sql         Generated — do not hand-edit

scripts/gen-seed.mjs  Turns src/mock/ into database/seed.sql
```

The structure does not grow beyond this without team approval. See CLAUDE.md §15.

## Important constraints

All data access goes through `src/services/` — that boundary is the reason
swapping mock data for the real API did not require rewriting the UI.
**Components must never import from `src/mock/` directly.**

`src/mock/` is no longer what the app reads. It is now the *source the seed is
generated from*: `node scripts/gen-seed.mjs` turns it into
`database/seed.sql`. Change the mock, regenerate, re-import.

Every SQL statement in `api/` uses a **prepared statement** with bound
parameters, and PDO runs with `ATTR_EMULATE_PREPARES => false` so MySQL itself
does the binding. A consequence worth knowing: each named placeholder may appear
only **once** per statement — reusing `:q` across several columns fails with
`HY093 Invalid parameter number`. Give them distinct names rather than
re-enabling emulation, which would weaken the guarantee.

The visual identity is **Teal + Amber**, defined once as semantic tokens in
`src/index.css` and documented in [`docs/design-system.md`](docs/design-system.md).
Components must use those tokens — never raw Tailwind colours like
`bg-teal-600` — so the whole app can be recoloured from one file.

Full rules for contributors and for AI assistance are in
[`CLAUDE.md`](CLAUDE.md). Read it before making changes.

## Documentation

| File | Contents |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Master project context and development rules |
| [`docs/roadmap.md`](docs/roadmap.md) | The 12 development phases |
| [`docs/feature-status.md`](docs/feature-status.md) | What is actually built |
| [`docs/page-inventory.md`](docs/page-inventory.md) | Every route and who can reach it |
| [`docs/design-system.md`](docs/design-system.md) | Approved palette, shape tokens, accessibility rules |
| [`docs/ui-inventory.md`](docs/ui-inventory.md) | Reusable components — check before creating one |
| [`docs/mock-data-guide.md`](docs/mock-data-guide.md) | How `src/mock/` feeds the database seed |
| [`docs/image-requirements.md`](docs/image-requirements.md) | Every visual asset and where it is used |
| [`docs/img-005-pet-photos.md`](docs/img-005-pet-photos.md) | Shot list for the 24 demo pet photos |

## Demo data

All seeded people, pets and incidents are fictional. Emails use `example.com`
and phone numbers use an invented block. Locations are real Philippine
barangays, but coordinates are barangay-level approximations and do not point at
any residence.
