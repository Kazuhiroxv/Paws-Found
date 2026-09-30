# Paws&Found — deployment plan

**Written:** 25 September 2026 · ITS122P–AM5 · Group 3
**Why now:** the final presentation has to run from a real URL, on three
devices at once, against one database. That is a different problem from
`npm run dev`, and it has a few decisions in it that are painful to change
late.

Nothing here is deployed yet. This is the plan and the list of code changes it
needs.

---

## 0. The architecture is settled — 26 September 2026

**React/Vite → PHP REST API → MySQL/MariaDB. This does not change.**

The reason is one line of the instructor's guide, transcribed at
`docs/final-project-guide-requirements.md:16`:

```
| 4 | MySQL database |
```

Not "a relational database". **MySQL**, as mandatory requirement four, with
`CLAUDE.md:193` recording it as "(instructor-specified)".

**Supabase is therefore not adopted.** Supabase is PostgreSQL; choosing it would
answer requirement 4 with something that is not MySQL. That is not a trade any
of us can make without the instructor saying the engine is open — and the full
cost, counted rather than guessed, is in
`docs/deployment-architecture-audit.md`.

**Vercel is not the submission host either.** A React build on Vercel calling a
PHP API elsewhere means two deployments, two domains, CORS, `SameSite=None`
cookies and third-party-cookie blocking on whichever device the examiner
happens to open it on. It buys nothing academically. If Vercel is used later
for a portfolio front end, that is a separate thing.

**One public PHP + MySQL host, serving the site and the API from one origin.**
That preserves, with no migration:

    same-origin requests          the PHP API as written
    the current session model     the MySQL schema and every query
    upload handling               the regression harness (170 + 55 + 53 + 15)
    the ERD                       the defence documents

There is to be exactly one authoritative backend. No React → Supabase beside
React → PHP, and no PHP → MySQL beside PHP → Supabase.

This decision is revisited only if the instructor states that the database
engine is open, and then as its own project with its own regression run — not
as part of a deployment.

---

## 0.5 Railway — the chosen host, 26 September 2026

Railway runs **actual MySQL**, which is the whole point: requirement 4 names
MySQL, and it would be strange to rule out Supabase over that and then lose it
to a host. It also gives a persistent volume for uploads and a TCP proxy so the
164-case suite can reach the database from a laptop.

Two services in one project:

    Paws-Found  ──private network──▶  MySQL
    (this Dockerfile)                 (Railway's MySQL image)

### The variables on the Paws-Found service

Set as **references**, not pasted values, so they follow the database if it is
ever recreated:

```
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASS=${{MySQL.MYSQLPASSWORD}}
APP_ENV=production
```

Then the account lifecycle, which needs somewhere to send mail from and a URL
to put in the links:

```
APP_URL=https://<domain>
MAIL_TRANSPORT=smtp
MAIL_HOST=<smtp host>
MAIL_PORT=587
MAIL_USERNAME=<smtp user>
MAIL_PASSWORD=<smtp password>
MAIL_FROM_ADDRESS=<the address the mail comes from>
MAIL_FROM_NAME=Paws&Found
MAIL_ENCRYPTION=starttls
```

On Railway, use `MAIL_TRANSPORT=brevo_api` and `BREVO_API_KEY` instead of the
five SMTP lines — see below for why.

`MAIL_ENCRYPTION` takes `starttls` (the default, and what port 587 wants),
`tls` for implicit TLS on port 465, or anything else for an unencrypted
connection, which no real provider will accept. Match it to the port: `587`
with `starttls`, `465` with `tls`. Getting this pair wrong is the usual reason
mail appears to be configured and silently never sends.

`APP_URL` falls back to `RAILWAY_PUBLIC_DOMAIN_URL`, so it is usually already
right — but check it, because **every link in every email is built from it**.
A wrong `APP_URL` sends people to a verification page that does not exist, and
nothing in the app will complain.

`MAIL_TRANSPORT` defaults to `log`, which writes the message to the error log
instead of sending it. That is right on a laptop and wrong on a host: with it
left at `log`, registration appears to work and no email ever arrives. The
value `capture` exists only for `scripts/auth_lifecycle.py` and must never be
set in production.

**On Railway, `smtp` does not work, and the reason is the hosting plan.** The
trial plan blocks outbound SMTP: the container cannot open a connection to
`smtp-relay.brevo.com:587` at all, and the attempt ends in a timeout. Port 443
is open, because the site is served over it. So the fourth transport sends the
same message to the same provider over HTTPS instead:

```
MAIL_TRANSPORT=brevo_api
BREVO_API_KEY=<the HTTPS API key, not the SMTP key>
```

They are different credentials. The SMTP key is the one ending up in
`MAIL_PASSWORD`; the API key is issued separately under Brevo's **API Keys**
page. With `brevo_api` set, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`,
`MAIL_PASSWORD` and `MAIL_ENCRYPTION` are not read at all — harmless to leave
in place, and worth leaving, because they are what `smtp` needs if the plan is
ever upgraded or the host changed.

`MAIL_FROM_ADDRESS` and `MAIL_FROM_NAME` are still used, and the from address
must be a sender Brevo has verified or it refuses the message.

A misspelled transport is refused by name rather than quietly attempted as
SMTP — `[pawsandfound] unknown MAIL_TRANSPORT: brevo-api` in the log — because
the failure that costs an evening is the one that looks like a mail server
problem and is not.

Turnstile is optional and **off** until the group has keys:

```
TURNSTILE_SITE_KEY=<site key>
TURNSTILE_SECRET_KEY=<secret key>
TURNSTILE_ENABLED=true
```

The site key is public and is served to the browser at run time by
`GET /api/config`; the secret is read only by the server. Setting
`TURNSTILE_ENABLED=true` with either key missing makes the app refuse to start
in production, deliberately — a CAPTCHA that silently switches itself off is
worse than none, because nobody notices.

`PERSIST_ROOT` and `SESSION_SAVE_PATH` need no variables — the image defaults
them to the volume's path. Set them only if the mount path changes.

`api/config.php` reads `DB_*` first and falls back to Railway's own `MYSQL*`
spellings, so either naming works. `PORT` is injected by Railway and read by
the entrypoint; nothing else is needed.

**No credential is in the repository.** `api/config.local.php` is gitignored
and also excluded from the Docker build context.

### One volume

| | |
| --- | --- |
| Mount path | **`/var/lib/pawsandfound`** |

It holds both:

    /var/lib/pawsandfound/
    |-- uploads/     served through a symlink at api/uploads
    `-- sessions/    outside the document root, 0700

**Not `/app/...`.** This image is `php:8.3-apache`, whose document root is
`/var/www/html`; `/app` is Railway's Nixpacks convention, which a Dockerfile
replaces.

Nothing persistent is mounted over `/var/www/html`, `/var/www/html/api` or
`/etc/apache2`. `api/uploads` is a **symlink** into the volume, made at build
time, so the application still writes to `__DIR__ . '/uploads'` and knows
nothing about any of this — no report or photograph logic changed in order to
deploy it. Apache serves through it because the `<Directory>` block carries
`Options FollowSymLinks`; without that it answers 403 for everything.

The entrypoint restores `uploads/.htaccess` from a copy kept outside the mount
when the volume is empty, since that file is what stops an uploaded file being
executed and a first deploy would otherwise have no protection at all. It is
restored only when absent, never overwritten.

### Sessions

`/var/lib/pawsandfound/sessions`, on the same volume, outside the document
root, `chmod 700` and owned by `www-data`.

**Correct only for a single replica**, which `railway.json` pins. This is not a
shared session store: scaled to two instances, half the requests would not find
their session and people would be signed out at random. At that point sessions
move into MySQL, not onto a bigger disk.

### Proved, with a control

Fresh `docker build --pull --no-cache`, run with one volume:

```
[paws] persistent root : /var/lib/pawsandfound
[paws] upload path     : /var/www/html/api/uploads -> /var/lib/pawsandfound/uploads
[paws] session path    : /var/lib/pawsandfound/sessions
[paws] apache port     : 8091
[paws] apache mpm      : mpm_prefork_module (shared)
[paws] apache config   : Syntax OK
```

Those six lines print on every start, read out of the running container rather
than restated from the Dockerfile, and carry no credentials.

| | With the volume | Without it |
| --- | --- | --- |
| Container boots | yes | yes |
| Signed in, container destroyed and recreated | **still signed in** | signed out |
| Uploaded photograph after recreate | **200 `image/png`** | gone |

The right-hand column is the control. It is what makes the left-hand one mean
something.

### Putting the schema into an empty Railway MySQL

Deliberate and manual, **once**. Nothing in the image touches the database on
startup — a container that seeds itself is a container that erases production
on its next restart.

Railway's database is **empty** and is called `railway`. There is no earlier
version of Paws&Found on it, so there is nothing to migrate: install the final
17-table design once and record all seven migrations as applied. **Do not run
`005`, `006` or `007` separately here.** `schema.sql` already contains
everything they do, and running them afterwards would try to re-apply changes
that are already in place.

#### 1. Generate the Railway-safe copies

`schema.sql` and `seed.sql` both open by creating `pawsandfound` and selecting
it. Railway hands you a database that already exists, under a name it chose,
and the account it gives you generally cannot create another. Left unedited,
the import either fails on the `CREATE` or succeeds into a second database the
application is not pointed at.

```bash
node scripts/railway-sql.mjs
```

That writes `database/railway/schema.sql` and `database/railway/seed.sql` with
those two statements removed and nothing else changed. The folder is
gitignored: `database/schema.sql` stays the only source of truth, and these are
regenerated whenever they are needed.

#### 2. You need a MySQL 8 client, and XAMPP's is not one

This is the part that will otherwise waste an hour. XAMPP ships MariaDB's
client, and against Railway's MySQL 8 it fails before it even connects:

```
ERROR 1045 (28000): Plugin caching_sha2_password could not be loaded:
The specified module could not be found. Library path is 'caching_sha2_password.dll'
```

MySQL 8 authenticates with `caching_sha2_password` and the MariaDB client does
not implement it. Use the official client from Docker instead — it needs no
installation, and Docker is already set up for the image build.

#### 3. Test the connection before importing anything

In PowerShell, from the project folder. Take the host, port, user and password
from Railway's MySQL service; enable its public TCP proxy first.

```powershell
docker run --rm -it mysql:8.0 mysql -h RAILWAY_HOST -P RAILWAY_PORT -u RAILWAY_USER -p railway
```

It prompts for the password rather than taking it on the command line, so the
password does not end up in the PowerShell history. A `mysql>` prompt means you
are connected; `SELECT DATABASE();` should answer `railway`. Type `exit`.

#### 4. Import, schema first

Run these from the project folder in PowerShell. They mount `database\railway`
into the container read-only and let the **container** open the files, which is
deliberate — see the warning below.

```powershell
docker run --rm -v "${PWD}\database\railway:/sql:ro" mysql:8.0 sh -c "mysql -h RAILWAY_HOST -P RAILWAY_PORT -u RAILWAY_USER -pPASSWORD --default-character-set=utf8mb4 railway < /sql/schema.sql"
```

```powershell
docker run --rm -v "${PWD}\database\railway:/sql:ro" mysql:8.0 sh -c "mysql -h RAILWAY_HOST -P RAILWAY_PORT -u RAILWAY_USER -pPASSWORD --default-character-set=utf8mb4 railway < /sql/seed.sql"
```

`-pPASSWORD` has **no space** after `-p`. The password is on the command line
because the import reads a file and so cannot also prompt; run `Clear-History`
afterwards if that matters to you.

Expect no output at all. Any line beginning `ERROR` means the import stopped
there and the database is half-built — fix the cause, drop every table, and
start again rather than importing on top of the wreckage.

> **Do not pipe the file in with `Get-Content`.** The obvious command,
> `Get-Content seed.sql -Raw | docker run -i ... mysql`, imports without a
> single error and silently corrupts the data. PowerShell re-encodes on the way
> through the pipe, and the seed contains em-dashes and curly apostrophes.
> Tested on 27 September: it turned
>
> ```
> Closed at the reporter’s request.
> ```
>
> into
>
> ```
> Closed at the reporterÃ¢â‚¬â„¢s request.
> ```
>
> which is then in the database, on screen, during the demonstration. The
> mounted-file version above was checked the same way and came back clean:
> zero mojibake rows, em-dash and curly apostrophe both intact.
>
> This is the same trap as `--default-character-set=utf8mb4` in
> `docs/team-setup.md` §4.2, arriving by a different route.

#### 5. Verify, before deploying any code against it

```sql
SELECT DATABASE();                                                               -- railway
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE();  -- 17
SELECT COUNT(*) FROM information_schema.table_constraints
 WHERE table_schema = DATABASE() AND constraint_type = 'FOREIGN KEY';            -- 24
SELECT COUNT(*) FROM users;                                                      -- 10
SELECT COUNT(*) FROM pet_reports;                                                -- 32
SELECT COUNT(*) FROM match_claims;                                               -- 4
SELECT COUNT(*) FROM users WHERE email_verified_at IS NULL;                      -- 0
SELECT GROUP_CONCAT(version ORDER BY version) FROM schema_migrations;
                                                        -- 001,002,003,004,005,006,007

-- Nothing was re-encoded on the way in. Both must be 0.
SELECT COUNT(*) FROM pet_reports  WHERE description LIKE BINARY '%Ã%';         -- 0
SELECT COUNT(*) FROM status_logs  WHERE note        LIKE BINARY '%Ã%';         -- 0
```

Every one of these numbers was read from a real MySQL 8.0.46 on 27 September
2026, after importing these exact two files into a database called `railway`.
They are measurements, not expectations.

Of the 17 tables, **15 are on the ERD**; `schema_migrations` and
`auth_rate_limits` are operational, carry no foreign keys, and are the two the
figure deliberately leaves off.

**The `email_verified_at` line is the one that matters most.** Sign-in now
refuses an account whose address has never been proved. If that count comes
back as 10 rather than 0, the seed that was imported predates the account
lifecycle and **nobody will be able to sign in on the day** — not the
demonstration accounts, not the administrator. Re-import `seed.sql` from this
branch; it sets `email_verified_at` to each account's `created_at`.

#### Why there is a migration named after a database engine

Worth knowing, because it is a fair question. Rehearsing this import against a
real MySQL 8 rather than against XAMPP is what caught it:

```
ERROR 3823 (HY000): Column 'lost_report_id' cannot be used in a check
constraint 'chk_match_distinct': needed in a foreign key constraint
'fk_match_lost' referential action.
```

MySQL 8 refuses a `CHECK` over a column that a foreign key's referential action
could rewrite; MariaDB allows it. `fk_match_lost` and `fk_match_found` carried
`ON UPDATE CASCADE`, and `chk_match_distinct` is over exactly those two
columns, so `schema.sql` imported cleanly on every laptop and would have
stopped dead on the host.

Migration `007` drops the `ON UPDATE CASCADE` and keeps the `CHECK`.
`report_id` is an `AUTO_INCREMENT` surrogate that nothing ever updates, so the
cascade had never done anything; the `CHECK` is the database's own guarantee
that a report cannot be paired with itself, and it is the first of the three
refusals in the cheat sheet. `ON DELETE CASCADE` stays, so deleting a report
still takes its pairings with it. The foreign key count is 24 either way.

There is no SMTP on a fresh Railway service, so until `MAIL_*` is configured a
visitor who registers gets an account they cannot verify. Import the seed, and
demonstrate registration only once mail works.

### The order to do it in

**The database goes in before the code does.** This is backwards from ordinary
deployment, and it is deliberate. `api/auth.php` selects `email_verified_at`
and `session_version` on the sign-in path, so the new code against a database
that has not been imported yet does not degrade gracefully — it returns 500 on
every sign-in attempt, for everybody, immediately. There is no production data
to preserve, so there is nothing to be gained by deploying first.

Until step 7, `team/current` stays where it is and Railway keeps serving what
it is already serving.

1. Enable the MySQL service's public TCP proxy.
2. Import the schema and the seed, and run the verification queries above.
   **Do not continue until they all match.**
3. Set the database variables, `APP_URL`, and the `MAIL_*` block.
4. Set the Turnstile variables, or leave all three unset. Do not set
   `TURNSTILE_ENABLED=true` with a key missing — production refuses to start,
   on purpose.
5. Add **one** volume, mounted at `/var/lib/pawsandfound`.
6. Confirm the service is building from the `Dockerfile` rather than guessing
   Node.
7. **Now** merge `feature/final-auth-hardening` into `team/current` and push.
   Railway deploys on the push.
8. Watch the deploy log for `apache2-foreground`, and for the six `[paws]`
   lines the entrypoint prints — they name the upload path, the session path
   and the MPM, which is what the 502 on 26 September turned out to be.
9. `curl https://<domain>/api/health` → `{"status":"ok","database":"ok"}`.
   A **503** means the app is up but cannot reach MySQL: check the variables.
   HTML instead of JSON means the Dockerfile was not used.
10. `npm run verify:deploy https://<domain>`. **Target 28/28** — item 7.1 can
    finally pass, because Railway terminates TLS and forwards
    `X-Forwarded-Proto`, which `request_is_https()` already reads.
11. Run the full suites against the live site:

```bash
PAWS_API=https://<domain>/api PAWS_MYSQL_ARGS="-u root -p<password> -h <proxy-host> -P <proxy-port>" python scripts/audit_cases.py

PAWS_API=https://<domain>/api python scripts/multi_device.py
```

`PAWS_MYSQL_ARGS` goes to a MySQL 8 client, so this needs one that speaks
`caching_sha2_password` — the same constraint as the import, and the same
reason XAMPP's client will not do.

Against a host, `multi_device.py` reports **71/71 with 2 skipped**, not 73/73.
That is correct and not a regression. Checks K3 and K4 prove the session
timeout is enforced by the server, and they do it by turning the timeout down
to one second in `api/config.local.php` on the machine running the suite — a
server somewhere else never reads that file. The suite says so by name rather
than reporting a failure. The same two checks run for real against the local
build, which is where 73/73 comes from.

12. Register one throwaway account by hand and read the inbox. That is the only
    way to prove `MAIL_*` is right: the account-lifecycle suite reads captured
    mail, and the capture transport must never exist in production, so run that
    suite against the local build instead.
13. Open the site on a phone **on mobile data, not the same Wi-Fi**. That is
    the thing actually being asked for: it is no longer localhost.
14. Disable the public MySQL proxy again once the suites have run.

### Proved locally before any of this

The image was built and run on 26 September 2026 and answered:

```
/api/health     200  application/json
/api/reports    200  application/json
/               200  text/html
/explore        200  text/html      (deep link, no 404)
/pet/1          200  text/html
/api/uploads/   403                 (not browsable)
```

`npm run verify:deploy http://localhost:8088` against the container: **27/28**,
the one failure being HTTPS, which localhost cannot do.

**One real defect the smoke test found:** the image installed gd and then
purged its runtime libraries, so it failed to load on every request with a
startup warning. Nothing in `api/` uses gd at all — the upload check is
`getimagesize()`, which is PHP core. Removed. The Dockerfile had looked
perfectly reasonable; only running it showed otherwise.

---

## 1. The decision

**Shared cPanel hosting — Apache, PHP 8.2, MySQL, phpMyAdmin — with the built
site and the API on the same origin.**

### Why this and not something cleverer

The system is Apache + PHP + MySQL with `.htaccess` rewrites and a local
uploads folder. Shared cPanel hosting **is** that, which means the production
environment is the same shape as XAMPP and the deployment is a file copy plus a
database import. Nothing has to be rewritten, containerised or explained.

| Considered | Why not |
| --- | --- |
| Railway / Render / Fly.io | Container-based. PHP works, but it means a Dockerfile, a separate managed MySQL, and an ephemeral filesystem that would lose uploaded photographs on every restart. More moving parts to defend, and one of them eats our pet photos. |
| AWS / Google Cloud free tier | A card on file, IAM, security groups, and a bill if we forget to tear it down. Vastly more than this needs. |
| Vercel / Netlify | Static and serverless-JS hosts. They do not run PHP. Splitting frontend and backend across two origins would drag CORS and third-party-cookie problems into the one demonstration where a session has to work on three devices. |
| GitHub Pages | Static only. No PHP, no MySQL. |

### Same origin, and why it matters more than it sounds

The built site goes at the **domain root** and the API sits at **`/api`** under
it:

    https://<our-domain>/            →  index.html  (the React build)
    https://<our-domain>/assets/…    →  hashed JS and CSS
    https://<our-domain>/api/…       →  the PHP API
    https://<our-domain>/api/uploads/…  →  pet photographs

One origin means:

* **No CORS.** `send_cors_headers()` becomes dead weight in production; it
  exists for `npm run dev` only.
* **The session cookie just works.** No `SameSite=None`, no third-party-cookie
  blocking, and our existing `SameSite=Lax` stays as a real CSRF defence
  alongside the token.
* **One thing to type** into three devices.

This is the single most important deployment decision and it costs nothing to
take now.

### Paid or free

**Pay, and keep a free account as the rehearsal and the fallback.**

A month of entry-level shared hosting is roughly ₱100–300. The free hosts
(InfinityFree, AwardSpace and similar) do genuinely run PHP, MySQL and free
SSL, and Paws&Found is small enough for any of them — 32 reports, 10 accounts,
modest images.

The specific risk is not size, it is what free hosts do to *automated*
requests. Several of them answer a request that does not look like a browser
with an HTML interstitial — a JavaScript challenge or a "checking your
browser" page — instead of the response. For an ordinary page view that is
invisible. For a REST API it means `fetch` receives HTML where it expected
JSON, and our own `audit_cases.py` suite cannot run against the deployed site
at all. That is exactly the evidence we need on presentation day.

So: register the free account now and deploy to it first, because getting the
process right is worth doing on something that costs nothing. Then verify on
it, specifically:

* `https://<subdomain>/api/reports` returns **JSON**, not HTML, from `curl`;
* signing in works and survives a reload;
* the same account works on three devices at once.

If all three hold after a few days of use, keep it. If any of them wobbles,
move to the paid host — and find that out a week early rather than in front of
the person grading us.

Whoever we pick must be confirmed to have: **PHP 8.1+**, **MySQL 5.7+ or
MariaDB 10.4+**, **phpMyAdmin**, **`.htaccess` with `mod_rewrite`**, **free
SSL (Let's Encrypt)**, and **at least ~1 GB** of storage.

Have the free account registered as a **fallback** before the day, even if
unused.

---

## 2. What the code needs before it can go anywhere

**Done, 25 September 2026.** All six are in and verified; the list below now
describes what exists rather than what is wanted. Deploying is a file copy plus
one config file.

### 2.1 `vite.config.js` — the base path  ·  **done**

    npm run build           ->  /pawsandfound/   (local Apache, and the a11y run)
    npm run build:deploy    ->  /               (a deployed host)

`build:deploy` is a four-line Node script rather than
`VITE_BASE=/ npm run build`, because in Git Bash on Windows that does not work:
MSYS rewrites the bare `/` into the Git installation path and the build comes
out asking for `/Program Files/Git/assets/…`. Verified both ways — the symptom
is a blank page with four 404s, which is a miserable thing to meet on
deployment day.

`src/services/api.js` already derives the API path from
`import.meta.env.BASE_URL`, so nothing else changes.

### 2.2 `public/.htaccess` — `RewriteBase`  ·  **documented, one line to change**

    RewriteBase /pawsandfound/      ->      RewriteBase /

It must match the base the site was built with. **These two disagreeing is the
most likely way a first deploy fails**, so the file now says so directly above
the line, with both settings written out.

### 2.3 `api/config.php` — credentials  ·  **done**

`config.php` now reads `api/config.local.php` first when one exists, and every
default below it steps aside for whatever that file defined. Nothing else in
the API changed — the constants have the same names and the same meanings.

`api/config.example.php` is the tracked template; `api/config.local.php` is in
`.gitignore` and must stay there. Verified both ways: the API works with no
local file, and picks the file up when there is one.

The hosted database gets **its own user**, not `root`, with rights on the
`pawsandfound` schema only.

### 2.4 Session cookies and `Secure`  ·  **done**

Set from how the request actually arrived, not from a constant — a Secure
cookie is never sent back over plain HTTP, so hard-coding it true breaks every
sign-in on a laptop, and hard-coding it false ships the session cookie
unprotected on the deployed site.

`request_is_https()` also accepts `X-Forwarded-Proto`, because shared hosts
routinely terminate TLS at a proxy and hand plain HTTP to PHP — without it the
cookie would be left insecure on a site that is plainly padlocked in the
browser.

### 2.5 Errors must not be displayed in production  ·  **done**

`config.php` switches on `APP_ENV`: production turns `display_errors` off and
`log_errors` on; development turns them the other way. A warning printed into
a JSON response breaks the JSON *and* puts our file paths on somebody's
screen, and many shared hosts leave `display_errors` on by default.

`api/index.php` already caught `PDOException`; this closes the gap for
everything that is not one.

### 2.6 The uploads folder

`api/uploads/` must exist and be writable (755, or 775 if the host needs it),
and `api/uploads/.htaccess` **must** be uploaded with it — it is what stops an
uploaded file being executed. It is tracked in git and excluded from
`.gitignore`'s upload rule, so it will be in the archive; the thing to check is
that the FTP client did not skip it for being a dotfile.

Photographs uploaded during the demonstration live only on the server. They are
not in git and not in the backup unless we take one.

---

## 3. The deployment, as eighteen steps

Treated as a controlled migration rather than "upload the folder and hope".
Each step has something to check before the next one, because a failure found
at step 4 is a five-minute fix and the same failure found at step 14 looks like
the application being broken.

Roughly an hour the first time. Five minutes for every redeploy after.

### The account and the URL

**1. Register the account and note the public URL.**
Confirm it has PHP 8.1+, MySQL 5.7+ or MariaDB 10.4+, phpMyAdmin, `.htaccess`
with `mod_rewrite`, free SSL and at least ~1 GB.

**2. Confirm PHP actually runs**, before uploading anything that matters.
Upload one file, `public_html/ping.php`:

```php
<?php header('Content-Type: application/json');
echo json_encode(['php' => PHP_VERSION, 'pdo_mysql' => extension_loaded('pdo_mysql')]);
```

Then, **from a terminal, not a browser** — this is the check a browser cannot
make for you:

```bash
curl -i https://<domain>/ping.php
```

You want `Content-Type: application/json` and a body starting `{`. **If HTML
comes back, stop here.** Some free hosts answer non-browser requests with a
JavaScript challenge page. For a page view that is invisible; for a REST API it
means `fetch` receives HTML where it expected JSON, and neither the application
nor the test suites can run at all. That is a reason to change host, and it is
much better to learn it now.

**Delete `ping.php` immediately afterwards.** It reports the PHP version to
anyone who asks.

### The database

**3. Create the database and a user.** Its **own** user, never `root`, with
rights on this schema only. Note the database name, user, password and host —
shared hosts usually prefix the name with the account, e.g.
`username_pawsandfound`.

**4. Import the schema.** phpMyAdmin → Import → `database/schema.sql`.

It opens with `CREATE DATABASE IF NOT EXISTS pawsandfound` and `USE
pawsandfound`. On a host where the database is named `username_pawsandfound`,
**both lines have to be removed** and the import run against the
already-selected database. Migrations 001–004 are already folded into
`schema.sql`, so there is nothing else to apply to a fresh database — that is
what the fresh-import/migrated parity check is for.

> Verify: **17 tables**, **24 foreign keys**. (15 of the 17 are on the ERD.)
> ```sql
> SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE();
> SELECT COUNT(*) FROM information_schema.table_constraints
>  WHERE table_schema = DATABASE() AND constraint_type = 'FOREIGN KEY';
> ```

**5. Import the seed.** `database/seed.sql`, the same way.

> Verify: `SELECT COUNT(*) FROM pet_reports` returns **32**, and `users`
> returns **10**.

### The API

**6. Create the credentials file, outside the repository.**
`api/config.local.php` is in `.gitignore` and must stay there. Copy
`api/config.example.php`, fill in the four values:

```php
define('DB_NAME', 'username_pawsandfound');
define('DB_USER', 'username_paws');
define('DB_PASS', '...');
define('DB_HOST', 'localhost');   // not 3307 — that is one laptop's quirk
define('APP_ENV', 'production');  // display_errors off, log_errors on
```

`APP_ENV` is the one people forget. A PHP warning printed into a JSON response
breaks the JSON *and* puts the server's file paths on somebody's screen.

**7. Upload `api/` to `public_html/api/`.**
Check the FTP client did not skip the dotfiles: `api/.htaccess` and
`api/uploads/.htaccess` must both be there. The second is what stops an
uploaded file being executed. `api/uploads/` must exist and be writable — 755,
or 775 if the host needs it.

**8. Verify one endpoint from a terminal.**

```bash
curl -i https://<domain>/api/reports
```

JSON, `Content-Type: application/json`, and a non-empty `data` array.

### The frontend

**9. Build for the root and upload it.**

```bash
npm run build:deploy
```

Not `npm run build` — that one builds for `/pawsandfound/`. Upload the
**contents** of `dist/`, not the folder, into `public_html/`.

**10. Set `RewriteBase`.** `public_html/.htaccess` must say `RewriteBase /`,
matching the base the site was built with. **These two disagreeing is the most
likely way a first deploy fails**, and the symptom is a blank page with four
404s on `/assets/…`.

> Verify: the homepage loads; `/explore` **refreshed directly in the address
> bar** loads (that is the SPA routing check, not clicking a link); a report
> detail page opens.

### Proving it

**11–13 are all one command:**

```bash
npm run verify:deploy https://<domain>
```

28 checks. It uploads one small PNG to a report the demo account already owns
and fetches it back **as a signed-out visitor**, which is the only honest way
to test the upload path — the seeded photographs are bundled with the frontend
and never touch the server. It also checks the session cookie's `Secure`,
`HttpOnly` and `SameSite` flags on the real domain, that errors leak no SQL or
paths, that CSRF is enforced, that no wildcard CORS header is sent, that the
uploads directory is not browsable, that `config.local.php` is not readable,
and that no demo password or development host is in the bundle.

Everything it finds is something that only goes wrong on a host. Fix all of it
before step 14.

**14. Run the 170-case suite against production.**

```bash
PAWS_API=https://<domain>/api \
PAWS_MYSQL_ARGS="-u <dbuser> -p<password> -h <dbhost>" \
python scripts/audit_cases.py
```

Forty-nine of its assertions read the database directly, which is the point —
a response saying a row was written proves nothing on its own. That needs the
host control panel's **Remote MySQL** turned on for your address. Without it
the suite **refuses to run** rather than quietly executing two thirds of itself
and printing a smaller total as though it were the whole thing.

It reseeds at the start and restores at the end, so run it **before** the
database is final.

**15. Run the multi-device suite against production.**

```bash
PAWS_API=https://<domain>/api python scripts/multi_device.py
```

73 checks, independent sessions. This one needs only the API.

**16. The physical three-device test.** See `docs/lan-testing.md` §5.2 for what
only hardware can show: the ten-second refetch changing a screen nobody is
touching, three real cookies rather than three tabs sharing one, and the phone
layout. Do the sequence by hand at least once.

**17. Export the final backup.** phpMyAdmin → Export → structure **and** data.
Keep the `.sql` on two machines. Download `api/uploads/` if anything was
uploaded during testing.

**18. Freeze it.** Tag the commit that was deployed:

```bash
git tag -a presentation -m "The build deployed to <domain>"
```

After this, nothing goes to the host that has not been through steps 11–15
again.

---


## 4. Presentation-day runbook

**The night before**
* Export the database from phpMyAdmin (structure **and** data) and keep the
  `.sql` file on two machines.
* Download `api/uploads/` if any demonstration photographs were uploaded to it.
* Confirm the certificate is valid and not expiring.
* Open the URL on all three devices and sign in on each.
* Screenshot the working system, as proof it worked if the venue's network
  does not.

**Resetting to a known state**
Re-import `database/seed.sql` through phpMyAdmin. It clears and reinserts in
dependency order, including `audit_logs`, `login_attempts` and
`privacy_consents`, so the system comes back to exactly 32 reports, 10
accounts, an empty audit log and no lock counters. There is deliberately **no
web endpoint that does this** — a public reset button is a public delete
button.

**If the site is down on the day**
1. XAMPP on a laptop, with the other two devices joined to a phone hotspot and
   pointed at that laptop's LAN address. Requires `ALLOWED_ORIGINS` to have
   been widened beforehand, and the cookie `Secure` flag resolves to false over
   plain HTTP, so it still works.
2. Failing that, the screenshots and a local walkthrough.

Decide which of us owns the hotspot before the day, not during it.

---

## 5. What is likely to go wrong, and what it looks like

`npm run verify:deploy https://<domain>` catches every row in this table
except the last one. The table is here for reading the symptom backwards when
something turns up that it does not cover.

| Symptom | Cause |
| --- | --- |
| Blank page, 404s on `/assets/…` | `VITE_BASE` and `RewriteBase` disagree. |
| Homepage loads, every API call 404s | `api/` not uploaded, or the API's own `.htaccess` missing, or `mod_rewrite` off. |
| API returns HTML, not JSON | PHP error being displayed — §2.5 was skipped. |
| "The server could not complete that request" | Database credentials wrong in `config.local.php`. The real reason is in the host's error log. |
| Signed in, then signed out on reload | Cookie not coming back: mixed HTTP/HTTPS, or `Secure` set while serving over HTTP. |
| Photographs upload but do not display | `api/uploads/` not writable, or its `.htaccess` blocked the file type. |
| Everything works alone, breaks on a second device | Two databases, or two deployments. There must be exactly one of each. |
| `curl` gets HTML from `/api/…` but the browser is fine | The host is answering non-browser requests with a challenge page. `fetch` and both test suites are broken; the browser hides it. Change host. |
| The suite refuses to start: "Cannot reach the database" | Remote MySQL is not enabled for your address, or `PAWS_MYSQL_ARGS` is wrong. It refuses on purpose rather than running two thirds of itself. |

---

## 6. Who does what

| Task | Owner |
| --- | --- |
| Choose and buy the hosting | Kyle (PM) |
| Database creation, import, credentials | Dominic (Database/API) |
| API upload and `config.local.php` | Heinz (Backend) |
| Frontend build and upload | Calvin (Frontend) |
| HTTPS, then the eight multi-device tests | Francezka (QA/Security) |

Deploy **at least a week** before the presentation. The first deployment always
finds something, and finding it the night before is how a working system fails
in front of an examiner.

---

## 7. Open questions

1. **Which host, and who pays?** Needs deciding first; everything else waits on
   the credentials. Nothing else in this document is blocked — the code is
   host-agnostic, the runbook is written, and the three verification commands
   (`verify:deploy`, `audit`, `multi-device`) all take the URL as an argument.
2. **Domain name.** A free subdomain from the host is fine and free. A `.com`
   is roughly ₱600/year and looks better on the title slide. Not a technical
   decision.
3. **Does the demonstration data go live?** Recommended yes — the system is
   unconvincing with an empty database, and every person and pet in it is
   fictional. The seeded accounts share one weak password, so the live site
   must not be shared beyond the class while they exist.
