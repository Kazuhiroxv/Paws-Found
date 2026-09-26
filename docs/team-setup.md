# Getting Paws&Found running on your machine

**ITS122P–AM5 · Group 3** · 26 September 2026

Everything below was run on the development laptop on the date above. If a
command here does not work, say so in the group chat rather than improvising —
a step that is wrong for everybody is worth ten minutes of one person's time.

---

## 0. The branch, and the one number to check

We are working from **`team/current`**, not `main`. `main` is 17 commits behind
and does not have any of the hardening, the redesign, the test suites or the
defence documents.

```bash
git log -1 --oneline
```

Everyone should see the same short SHA. If yours differs, you are not on the
same code and nothing else in this document will behave as described.

---

## 1. What you need installed

| | |
| --- | --- |
| Git | any recent version |
| Node.js | 20 or newer (`node -v`) |
| XAMPP | Apache **and** MySQL/MariaDB |

Python 3 as well, if you want to run the test suites. The application itself
does not need it.

---

## 2. If you have never cloned it

```bash
git clone https://github.com/Arkemic/paws-and-found.git
cd paws-and-found
git fetch --all --prune
git switch --track origin/team/current
npm ci
```

`npm ci` rather than `npm install`: it installs exactly what
`package-lock.json` says, so all five of us have identical dependencies.

## 3. If you already have a clone

```bash
git status
```

**If it says the working tree is clean:**

```bash
git fetch origin --prune
git switch team/current
git pull --ff-only origin team/current
npm ci
```

**If you have your own uncommitted work**, do not reset. Put it somewhere safe
first:

```bash
git stash push -u -m "before the 26 Sep sync"
git fetch origin --prune
git switch team/current
git pull --ff-only origin team/current
npm ci
```

Your work is still there. `git stash list` shows it, and you can get it back
later. Leave it alone tonight.

---

## 4. The database — and the thing that will catch you

**Git does not carry a database.** Pulling gets you the schema and the seed
file; it does not get you the rows. Everyone runs their own MySQL until we
deliberately point at one shared server.

### 4.1 Find your MySQL port first

XAMPP normally uses **3306**. The development laptop uses **3307**, because a
separate MySQL service already had 3306 on that machine.

**Your port is almost certainly 3306. Do not copy 3307 out of habit.** Open the
XAMPP Control Panel and read the port next to MySQL.

### 4.2 Create and import

Substitute your own port everywhere it says `3306`:

```bash
mysql -u root -P 3306 -h 127.0.0.1 --default-character-set=utf8mb4 \
  -e "CREATE DATABASE IF NOT EXISTS pawsandfound CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

mysql -u root -P 3306 -h 127.0.0.1 --default-character-set=utf8mb4 \
  pawsandfound < database/schema.sql

mysql -u root -P 3306 -h 127.0.0.1 --default-character-set=utf8mb4 \
  pawsandfound < database/seed.sql
```

Keep `--default-character-set=utf8mb4`. Without it, curly apostrophes in the
demonstration data turn into mojibake on Windows and nothing reports an error.

There are no migrations to apply to a fresh database — `database/migrations/`
001 to 004 are already folded into `schema.sql`.

### 4.3 Check it imported

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='pawsandfound';  -- 15
SELECT COUNT(*) FROM pet_reports;                                                  -- 32
SELECT COUNT(*) FROM users;                                                        -- 10
```

**15 tables, not 14.** Fourteen are on the ERD; the fifteenth is
`schema_migrations`, which records which migration files have run. It is
operational, has no foreign keys and no domain data, which is why it is
deliberately not drawn on a diagram of the domain. Know that sentence — it is
the first thing anyone counting the tables will ask.

### 4.4 **The step everyone will miss**

`api/config.php` defaults to **port 3307**, because that is what the
development laptop uses. On your machine that will simply fail to connect and
the site will show "the server could not complete that request".

Create `api/config.local.php`:

```php
<?php
define('DB_PORT', 3306);   // your port
```

That file is **gitignored on purpose** and must stay that way — it is where
real credentials go when we deploy. Copy `api/config.example.php` if you want
to see every setting you can override.

---

## 5. Apache, and where the files go

The API is served by Apache, not by Vite. Two ways to run it:

### 5.1 Development

```bash
npm run dev
```

Vite on `localhost:5173` for the frontend. The API still has to be reachable
through Apache, so `C:\xampp\htdocs\pawsandfound\api` must exist — either copy
`api/` there, or make it a link to the repository's `api/` folder so you are
not copying after every change.

### 5.2 The built version — **use this one tonight**

```bash
npm run build
```

Then copy the **contents** of `dist/` into `C:\xampp\htdocs\pawsandfound\`, and
`api/` into `C:\xampp\htdocs\pawsandfound\api\`. Open:

```
http://localhost/pawsandfound/
```

This is the version to learn, because it is the one that will be deployed:
one origin for the site and the API, no dev server, deep links working through
`.htaccess`.

`api/uploads/` must exist and must keep its `.htaccess` — that file is what
stops an uploaded file being executed. Check your copy did not skip it for
being a dotfile.

---

## 6. Signing in

Ten seeded accounts. The three that matter:

| Role | Email |
| --- | --- |
| Customer / User | `maria.santos@example.com` |
| Pet Coordinator | `patricia.lim@example.com` |
| Administrator | `grace.bautista@example.com` |

There is also **`rico.panganiban@example.com`**, which is seeded
**suspended** — useful for demonstrating what a suspended account cannot do.

All ten share one password. It is not written here; it is the `PW` constant at
the top of `scripts/audit.py`, and it is the same one the old README published.
Verified working for all three roles through the API on 26 September 2026.

**Before we host this publicly, that password must be changed**, precisely
because it has already been published in a public README. Until then, do not
share the URL outside the group.

**Try all three roles, not only your own.** Any of us can be asked about any
part of the system.

---

## 7. Running the checks

```bash
npm run audit          # 151 cases against the running API and database
npm run multi-device   # 40 checks across three independent sessions
npm run a11y           # axe-core over 26 pages in every role
npm run lint
npm run build
npm run verify:deploy http://localhost/pawsandfound
```

As of 26 September 2026, on the development laptop: **151/151, 40/40, axe
clean, lint clean, build green, 27/28 preflight** — the one preflight failure
is HTTPS, correctly, because `localhost` has no certificate.

`npm run audit` needs Python and a reachable database. It reseeds at the start
and restores at the end, so it is safe to run repeatedly — but it will wipe
anything you added by hand, so do not run it in the middle of a demonstration.

If your numbers differ from these, that is worth raising, not hiding.

---

## 8. The defence documents

In `docs/`. Everyone should read the first one; the rest are one subject each.

| | |
| --- | --- |
| `presentation-defense.md` | **Read this one.** The request traced end to end, eleven likely questions with answers, and what is honestly missing |
| `erd-defense.md` | The database, table by table, read from `information_schema` |
| `database-defense-cheatsheet.md` | One page: the counts, the delete rules, three constraint demonstrations to run live |
| `role-permissions.md` | What the **server** allows per role, with the guard for each |
| `matching-explanation.md` | The seven weights, the two gates, a worked example that adds to 85 |
| `live-database-change-playbook.md` | Adding a column during the demonstration without losing the data on screen |
| `deployment-plan.md` | The hosting decision and the eighteen steps |
| `lan-testing.md` | The multi-device rehearsal |
| `feature-status.md` | What is built, what is not, and how each was checked |

---

## 9. What not to commit

Already in `.gitignore`, and it must stay that way:

```
api/config.local.php      database credentials
api/uploads/*             photographs people uploaded
node_modules/
dist/
```

Never commit a real database password, and never put one in a tracked file —
that includes the README, the documentation, and any React source that ends up
in the bundle.

---

## 10. If it does not work

| Symptom | Cause |
| --- | --- |
| "The server could not complete that request" | The database. Nine times out of ten it is §4.4 — the port. |
| Blank page, 404s on `/assets/…` | You copied `dist/` the folder instead of its contents, or built with the wrong base. |
| The homepage loads, every API call 404s | `api/` is not under `htdocs/pawsandfound/`, or its `.htaccess` did not copy. |
| Signed in, then signed out on reload | Mixing `localhost:5173` and `localhost/pawsandfound` in one browser. Pick one. |
| Photographs upload but do not display | `api/uploads/` is missing or not writable. |
| Mojibake in the demonstration data | The import was run without `--default-character-set=utf8mb4`. Re-import. |

To get back to a known state at any time:

```bash
mysql -u root -P 3306 -h 127.0.0.1 --default-character-set=utf8mb4 \
  pawsandfound < database/seed.sql
```

32 reports, 10 accounts, an empty audit log, no lock counters.
