# Paws&Found — deployment plan

**Written:** 25 September 2026 · ITS122P–AM5 · Group 3
**Why now:** the final presentation has to run from a real URL, on three
devices at once, against one database. That is a different problem from
`npm run dev`, and it has a few decisions in it that are painful to change
late.

Nothing here is deployed yet. This is the plan and the list of code changes it
needs.

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

> Verify: **15 tables**, **23 foreign keys**.
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

**14. Run the 151-case suite against production.**

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

40 checks, three independent sessions. This one needs only the API.

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
