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
```

`GET /api/moderation` accepts `status` (`open` | `actioned` | `dismissed`) and
`reason`. `PATCH` takes an `action` — `dismiss`, `warn`, `remove` or `suspend` —
and an optional `note`. The four are the approved list in `CLAUDE.md` §6.9 and
nothing else is accepted. `remove` and `suspend` close the report rather than
deleting it, write the reason onto its status history, and notify the person who
filed it; `suspend` additionally sets `account_status`. All of it runs in one
transaction, and a case that has already been decided answers `409`.

`GET /api/reports` accepts `q`, `type`, `status`, `species`, `size`, `city`,
`area_code`, `city_code`, `colour`, `date_from`, `date_to`, `sort`
(`newest` | `oldest` | `updated`), `page` and `per_page`. It answers with
`data` and a `meta` block carrying `page`, `per_page`, `total` and
`total_pages`. `size` includes `xl`. A `colour` that is on the list matches
exactly; anything else is the old substring search. Each row's `location`
carries `city_code` and `area_code` (null for an old report whose place
could not be identified). `location.province` is the column's old name: it
holds the area's name, which for NCR is "Metro Manila" — not a province.

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
- **Account suspension** — a suspended user is refused even with a valid session.
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
