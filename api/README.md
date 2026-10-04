# Paws&Found API

PHP 8 + MySQL (MariaDB via XAMPP). No framework: eight files, each one readable
in a sitting, because every member has to be able to explain the whole system.

## Files

| File | What it does |
| --- | --- |
| `index.php` | Front controller. Every request lands here and is dispatched by its first path segment. |
| `.htaccess` | Rewrites `/api/reports/12` to `index.php?_route=reports/12`. |
| `config.php` | Database credentials, allowed origins, page sizes. |
| `db.php` | The PDO connection. |
| `helpers.php` | JSON responses, request input, sessions, and the authorisation guards. |
| `auth.php` | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. |
| `reports.php` | `GET /reports` (search, filter, sort, page) and `GET /reports/{id}`. |
| `categories.php` | `GET /categories`. |
| `reference.php` | `GET /reference/{colours,breeds,provinces,cities}` — the lists the report form and Explore choose from (Correction 3). |
| `moderation.php` | `GET /moderation`, `POST /moderation`, `PATCH /moderation/{id}`. |
| `logs.php` | `POST /activity/page-view`; `GET /logs/{activity,sessions,audit}` — the activity trail and the administrators' log viewer (Correction 5). |

## Local setup

The API is developed in this repository but served by Apache. A directory
junction links it into `htdocs` so there is only one copy:

```
mklink /J "C:\xampp\htdocs\pawsandfound\api" "C:\Projects\paws-and-found\api"
```

Then start **Apache** and **MySQL** in the XAMPP Control Panel and visit
<http://localhost/pawsandfound/api/>.

**MySQL runs on port 3307 here**, not 3306, because a separate MySQL 8.0 Windows
service holds 3306. That is set in `config.php`.

During development the React app runs on `localhost:5173` and Vite proxies
`/api` to Apache (see `vite.config.js`), so the frontend can call `/api/reports`
without worrying about origins.

## Endpoints

```
GET    /api/                     what this API offers

POST   /api/auth/register        { full_name, email, password, contact_number? }
                                 -> creates an ordinary user and signs them in (201)
POST   /api/auth/login           { email, password } -> user, sets a session cookie
POST   /api/auth/logout          ends the session
GET    /api/auth/me              the signed-in user, or { user: null }
POST   /api/auth/privacy-acknowledgement   the signed-in account has read the current Privacy Notice (Correction 7)

GET    /api/reports              list; see the parameters below
POST   /api/reports              file a report            (signed in)
GET    /api/reports/{id}         one report with photos, location and history
GET    /api/reports/stats        dashboard figures       (staff or admin)
PUT    /api/reports/{id}         edit details             (the reporter only)
PATCH  /api/reports/{id}         change status            (reporter or coordinator)

GET    /api/matches              ?report_id= ?user_id= ?status=
GET    /api/matches/{id}         one pairing with its seven signals
PATCH  /api/matches/{id}         decide a pairing; see the actions below

GET    /api/notifications        your own; meta.unread carries the badge count
PATCH  /api/notifications        mark them all read
PATCH  /api/notifications/{id}   mark one read

GET    /api/users                every account            (administrators)
GET    /api/users/{id}           one account              (signed in)
PATCH  /api/users/{id}           role or suspension       (administrators)

GET    /api/categories           active species

PATCH  /api/reports/{id}/publication   {action, note}: approve | reject (note) |
                                 resubmit | remove (note)        (Correction 4)
GET    /api/drafts               your drafts                      (signed in)
POST   /api/drafts               save a new draft (report_type required)
GET    /api/drafts/{id}          one of your drafts
PUT    /api/drafts/{id}          save it again
DELETE /api/drafts/{id}          delete it

GET    /api/reference/colours                   the colour list, {code, name}
GET    /api/reference/breeds?species=dog        that species' listed breeds
GET    /api/reference/areas                     84 areas {code, name, type}: 82 PSA provinces
                                                (type province), Metro Manila (ncr),
                                                BARMM's Special Geographic Area (special_area)
GET    /api/reference/cities?area=<code>        that area's cities and municipalities

GET    /api/moderation           the flag queue, with the report and both
                                 people attached          (administrators)
POST   /api/moderation           flag a report            (signed in)
PATCH  /api/moderation/{id}      decide a case            (administrators)

POST   /api/activity/page-view   { path } — the page a signed-in browser opened  (Correction 5)
GET    /api/logs/activity        pages and actions        (administrators)
GET    /api/logs/sessions        sign-ins: IP, browser, start, last seen, end and why
GET    /api/logs/audit           security and administrative events
```

**Privacy Notice acknowledgement (Correction 7).** `GET /api/auth/me` adds
`user.privacy_notice: { version, acknowledged }` for a signed-in account: whether
its latest `privacy_consents` row is for `PRIVACY_NOTICE_VERSION`.
`POST /api/auth/privacy-acknowledgement` (CSRF token, signed in, no body read)
records the current version for the session's own account, once, and writes a
`privacy_notice_acknowledged` activity row; it answers
`{ ok: true, privacy_notice: { version, acknowledged: true } }`. It never
blocks anything else.

**The list's `created_at` (Correction 7).** `GET /api/reports` rows carry
`created_at` for a signed-in viewer (the printed list's "Filed" column); a
guest's rows omit it, as they omit `updated_at`.

**Messages stay English.** The API's `error` sentences are English; the
interface translates the ones people meet in the normal workflow by exact
text (`src/i18n/apiErrors.js`). Rewording one of those sentences here means
updating that map, or the Filipino interface shows it in English.

**Sessions and the activity trail (Correction 5).** `GET /api/auth/me`
answers `{ user: null, session_ended: "<reason>" }` when the server ended this
browser's session, and every 401 from a protected endpoint carries the same
`session_ended`: `idle_timeout`, `absolute_timeout`, `password_reset`,
`new_privileged_login`, `role_promoted`, `account_locked`,
`account_suspended`, or `session_ended` when no reason is known. It is kept
until the next sign-in and concerns only this browser's own session.
`POST /activity/page-view` takes a path (`/pet/43`) and nothing else: 422 for
a query string, `#`, `//`, a control character or more than 200 characters;
the same path again within 3 s is `{ logged: false }`; more than 60 a minute
from one session is 429. Every other action is written by the endpoint that
did it (`ACTIVITY_ACTIONS` in `helpers.php`). The three log lists take `user`
(name or email), `ip`, `from`/`to` (YYYY-MM-DD, Philippine days), `page`,
`per_page` (≤ 100); activity also `action` (one action, or `actions` for
everything but page views), `route` (a prefix) and `session` (a reference
prefix, 4+ hex); sessions `state` (`open` | `ended` | `expired`) and
`session`; audit `action` and `outcome`. Newest first, with the same `meta`
as `/reports`. Details: `docs/security-activity-logging.md`.

`GET /api/moderation` accepts `status` (`open` | `actioned` | `dismissed`) and
`reason`. `PATCH` takes an `action` — `dismiss`, `warn`, `remove` or `suspend` —
and an optional `note`. The four are the approved list in `CLAUDE.md` §6.9 and
nothing else is accepted. `remove` and `suspend` close the report rather than
deleting it, write the reason onto its status history, and notify the person who
filed it; `suspend` additionally sets `account_status`. All of it runs in one
transaction, and a case that has already been decided answers `409`.

`GET /api/reports` accepts `q`, `type`, `status`, `species`, `size`, `city`,
`area_code`, `city_code`, `colour`, `date_from`, `date_to`, `publication`, `sort`
(`newest` | `oldest` | `updated`), `page` and `per_page`. It answers with
`data` and a `meta` block carrying `page`, `per_page`, `total` and
`total_pages`. `size` includes `xl`. A `colour` that is on the list matches
exactly; anything else is the old substring search. Each row's `location`
carries `city_code` and `area_code` (null for an old report whose place
could not be identified). `location.province` is the column's old name: it
holds the area's name, which for NCR is "Metro Manila" — not a province.

**Publication (Correction 4).** `POST /api/reports` files a report as
`pending_review` — not public, not matched — whatever the request says;
`draft_id` submits a saved draft and deletes it. `GET /api/reports` returns
published reports unless `publication` (`pending_review`, `rejected`,
`removed`, `all`) is asked for: allowed to coordinators and administrators,
and to a member listing their own reports (`reporter_id` = them); otherwise
401/403. `GET /api/reports/{id}` of an unpublished report is 404 to anybody but
its reporter, coordinators and administrators, who also receive
`publication_history`. `approve` and `reject` are **Pet Coordinators
only** (`role = 'staff'`, never their own report): every administrator level
gets 403 (Correction 6A); `remove` is an administrator's. Rows carry `publication_status` (except in a guest's
summary, which is always published). `PATCH .../publication` refuses a move
that is not allowed from the current state with 409, a missing reason with
422, the wrong role with 403. `GET /reports/stats` counts published reports and
adds `publication` (counts by state).

**Filing and editing a report (Correction 3).** The place is sent as
`area_code` and `city_code` (PSGC); the server checks the city is in the
area and writes `city` and `province` itself — text sent under those names
is ignored. `primary_color` / `secondary_color` must be listed colours (code or
name, any case). `pet_name` on a lost report needs two letters or digits;
`description` thirty characters; `lat`/`lng` must be inside the Philippines.
`incident_time` is 24-hour `HH:MM`. `show_phone` is accepted and ignored: a
phone number is never published, the detail's `reporter.phone` is always null
and `contact_preferences.show_phone` always false.

## How the security requirements are met

- **SQL injection** — every caller value is a bound parameter; the SQL text is
  fixed. `PDO::ATTR_EMULATE_PREPARES` is off, so MySQL prepares the statement
  and the value can never be parsed as SQL. Verified with `' OR '1'='1`,
  `'; DROP TABLE pet_reports; --` and a `UNION SELECT` against `users`: all three
  return zero rows and the table is untouched.
- **The two things that cannot be parameterised** — the `ORDER BY` clause and
  ENUM comparisons — are chosen from fixed lists in the code, so the caller
  supplies a key, never SQL.
- **Password hashing** — `password_hash()` / `password_verify()` with bcrypt.
  Plain passwords are never stored or compared.
- **Session fixation** — `session_regenerate_id(true)` on sign-in.
- **Cookie theft** — the session cookie is `HttpOnly`, so injected JavaScript
  cannot read it. Set `secure` once the site is served over HTTPS.
- **Authorisation** — `require_login()` and `require_role()` check on the
  server. The React route guard only keeps the interface coherent; it is not a
  security boundary and must never be treated as one.
- **Account suspension** — a suspended or locked user is refused even with a
  valid session, and that session ends for good (Correction 5).
- **Session records** — each sign-in is a `user_sessions` row known by a random
  reference; the PHP session id is never stored. The visitor's IP is Railway's
  `X-Real-IP` only when the deployment is Railway (`BEHIND_RAILWAY_EDGE`,
  decided from the environment, never the request); anywhere else
  `REMOTE_ADDR`, so a forged header cannot choose the logged address.
- **Privacy** — a reporter's phone and email are filtered out in PHP unless that
  report chose to publish them, so unshared details never reach the browser.
- **Error messages** — database errors are logged server-side; the client gets a
  plain sentence with no SQL, paths or exception text.

## Authorisation, endpoint by endpoint

| Route | Who |
| --- | --- |
| `POST /reports` | any signed-in account |
| `PUT /reports/{id}` | the reporter only |
| `PATCH /reports/{id}` | the reporter, or staff/admin |
| `GET /users` | administrators |
| `GET /users/{id}` | any signed-in account; contact details only for staff, admin, or yourself |
| `PATCH /users/{id}` | administrators, and never on your own account |
| `PATCH /matches/{id}` — `request_verification`, `dismiss` | either reporter on the pairing, or staff |
| `PATCH /matches/{id}` — `confirm`, `reject`, `request_information` | staff and administrators only |
| `GET`/`PATCH /notifications` | your own only — the account comes from the session, never the URL |
| `POST /activity/page-view` | any signed-in account, about itself only; guests 401 |
| `GET /logs/*` | Super Administrators (`view_security_logs`); other administrators, staff and customers 403, guests 401 |
| `PATCH /users/{id}` status | Managers and Super Administrators (`manage_accounts`); another administrator's status: Super Administrators only |
| `PATCH /users/{id}` `role`, `admin_level` | Super Administrators (`manage_admins`); never your own account |
| `POST`/`PATCH`/`DELETE /categories` | Managers and Super Administrators (`manage_reference_data`) |
| `GET /moderation`, `PATCH /moderation/{id}` | every administrator (`moderate_reports`); the `suspend` decision needs `manage_accounts` and never touches an administrator |

Administrator levels (Correction 6) are capabilities, not roles: see
`docs/role-permissions.md` §0 for the matrix. `PATCH /users/{id}` takes
`admin_level` (`moderator` | `manager` | `super_admin`) with `role: "admin"`;
promoting without one is 422, a level for a non-administrator is 422, your own
account is 422, and leaving no active Super Administrator is 409
`last_super_admin`. `/auth/me` adds `admin_level` and `capabilities` for an
administrator.

### Deciding a pairing

`PATCH /api/matches/{id}` with `{ "action": "...", "note": "..." }`:

| Action | Effect |
| --- | --- |
| `request_verification` | a reporter asks a coordinator to check the pairing |
| `dismiss` | a reporter says it is not their pet |
| `request_information` | coordinator asks for more; the note is required |
| `reject` | ruled out; **both reports stay active** so the search continues |
| `confirm` | **both reports become `returned`**, each gets a history entry, and both reporters are notified — all inside one transaction |

Confirming is the cascade the whole workflow builds towards. It is a
coordinator's decision alone: a claimant cannot confirm their own claim.

All of these were tested by signing in as different accounts and checking the
refusals, not only the successes.

## Still to build

Category management and photo upload. Both have working interfaces that
still write to mock data rather than the database.
