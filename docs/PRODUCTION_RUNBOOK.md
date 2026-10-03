# Production runbook

**https://paws-found-production.up.railway.app**

What to do when something needs doing, and what not to do when something goes
wrong. Written 27 September 2026.

---

## 1. Presentation day

The whole procedure:

1. Have internet.
2. Open the URL.
3. Sign in.
4. Present.

That is the entire list. **None of this is needed:**

- XAMPP, or Apache, or MySQL on anybody's machine
- `npm`, Node, `npm run dev`, `npm run build`
- PHP locally
- Docker
- a terminal, PowerShell, or the Railway console
- Kyle's laptop

The site runs on Railway. If the projector has a browser and the room has
internet, the demonstration works.

Do the smoke test in [TESTING.md](TESTING.md) §4 the evening before and again
an hour before. It takes two minutes and catches the only thing that plausibly
changes overnight, which is nothing — but knowing that is the point.

**If the venue's network is hostile**, the site is a normal HTTPS site on a
normal port. There is no special port, no LAN requirement, no local server. A
phone on mobile data is a working fallback and proves the same thing.

---

## 2. Deploying a change

The order matters. Do not skip to the push.

```bash
npm run lint
```

```bash
npm run build
```

```bash
npm run test:contract
```

Then the suites that need a running API — see [TESTING.md](TESTING.md) §2 for
what each needs and what each mutates.

When everything is green:

1. Commit, with a message that says *why*.
2. Push `team/current` to the remote **Railway deploys from**. That is
   `portfolio` (`Kazuhiroxv/Paws-Found`), not `origin` — `origin`'s push URL is
   deliberately disabled. Confirm in Railway's service settings if unsure.
3. Watch the deploy log until the service is **Online**.
4. Run the live preflight:

```bash
npm run verify:deploy https://paws-found-production.up.railway.app
```

Target **25/25 passed, 3 skipped**. The skipped three are the upload checks,
which write to production and run only with `--upload` (see TESTING.md). Add
`--upload` only when the change touched uploads or the storage volume.

5. Open the site and click through the smoke test.

### What a healthy deploy log looks like

Six `[paws]` lines from the entrypoint, then Apache:

```
[paws] persistent root : /var/lib/pawsandfound
[paws] upload path     : /var/www/html/api/uploads -> /var/lib/pawsandfound/uploads
[paws] session path    : /var/lib/pawsandfound/sessions
[paws] apache port     : <the port Railway injected>
[paws] apache mpm      : mpm_prefork_module (shared)
[paws] apache config   : Syntax OK
```

**`apache mpm` must name exactly one module.** Two loaded MPMs is what a
previous 502 turned out to be, and the Dockerfile now fails the build rather
than shipping it.

### Database changes

If the change touches the schema, read
[live-database-change-playbook.md](live-database-change-playbook.md) first.
Short version: a numbered additive migration, mirrored into `schema.sql`, never
a `DROP` of something with data in it, and check it on **MySQL 9.4** and not
only on XAMPP's MariaDB — they disagree, and migration `007` exists because of
it.

---

## 3. Rolling back

Find the last commit that was known good:

```bash
git log --oneline -15
```

The deployed commit is the tip of `team/current` on
`Kazuhiroxv/Paws-Found`. Railway also lists previous deployments in its own
UI, each tied to a commit.

**The safest rollback is Railway's own.** Open the service's deployment
history, find the last one that was Online and healthy, and redeploy it. No git
operation, no force push, nothing rewritten, and it is reversible by
redeploying the newer one.

If a code rollback is genuinely needed, **revert forward**:

```bash
git revert <bad-commit>
```

That creates a new commit undoing the change, which is safe to push and leaves
the history readable.

**Do not force push.** Do not `reset --hard` a branch other people have pulled.
Both of those turn a bad afternoon into a bad week, and this repository is
shared with four other students.

### A rollback does not undo a database migration

Migrations are additive by design. Redeploying older code against a newer
schema is usually fine — extra columns are ignored. Redeploying **newer code
against an older schema is not**: `api/auth.php` selects `email_verified_at`
and `session_version` on the sign-in path, and against a database without them
every sign-in returns 500.

---

## 4. The database

### What is safe

- Reading anything.
- Taking a backup before any change.
- Adding a numbered additive migration, mirrored into `schema.sql`.

### What is not

- **Do not reseed production.** `seed.sql` begins by deleting every row in
  every table. On a laptop that is convenient. On production it destroys real
  reports and uploaded photographs.
- **Do not detach, delete or remount the volumes** — either the application's
  `/var/lib/pawsandfound` or the MySQL service's own. Uploaded photographs
  exist nowhere else; they are not in the repository and not in the seed.
- **Do not pipe SQL files through PowerShell.** It re-encodes, and the seed
  contains em-dashes and curly apostrophes. It imports with zero errors and
  corrupts the data. Mount the file into the container instead — the command is
  in [HANDOFF.md](HANDOFF.md) §4 and [deployment-plan.md](deployment-plan.md) §0.5.
- **Do not run migrations `005`–`007` against the Railway database.**
  `schema.sql` already contains them and records all seven as applied.

### Taking a backup

Enable the MySQL service's public TCP proxy, then:

```powershell
docker run --rm -v "${PWD}:/out" mysql:9.4 sh -c "mysqldump -h HOST -P PORT -u USER -pPASSWORD --default-character-set=utf8mb4 --single-transaction railway > /out/backup.sql"
```

Disable the proxy again afterwards.

### Is it the database or the frontend?

```bash
curl.exe -s https://paws-found-production.up.railway.app/api/health
```

| Answer | Meaning |
| --- | --- |
| `{"status":"ok","database":"ok"}` | The application is up and MySQL answers. A broken page is a frontend or API problem. |
| `{"status":"degraded","database":"unreachable"}` with **503** | The application is up, MySQL is not. Check the MySQL service and the `DB_*` variables. |
| HTML instead of JSON | The Dockerfile was not used, or routing is broken. |
| Nothing, or a Railway error page | The service is down. Check the deploy log. |

---

### If the last Super Administrator is locked out (Correction 6)

Only a Super Administrator can unlock another administrator, and nobody can
unlock themselves. Three wrong passwords lock any account, so if every Super
Administrator is locked or suspended, Administration cannot fix it from the
inside. The database owner can, after confirming who is asking:

```sql
UPDATE users SET account_status = 'active' WHERE email = '<their address>' AND role = 'admin';
DELETE FROM login_attempts WHERE email = '<their address>';
```

This is a write to production: Kyle does it, never Claude. Keeping two Super
Administrators is what makes it unnecessary.

## 5. Email

Registration answers with the truth, and it is the fastest diagnostic:

```json
{"verification_required": true, "email_sent": true, "email": "n*******@example.com"}
```

- `"email_sent": true` → Brevo accepted it. If nothing arrives, check spam,
  then Brevo's own dashboard for the message's delivery status.
- `"email_sent": false` → the send failed. The reason is in the Railway logs,
  never in the response.

### Reading the log

Search the Railway deploy logs for `pawsandfound`:

| Log line | Cause | Fix |
| --- | --- | --- |
| `Brevo refused the message, HTTP 401` | Bad or revoked API key | Reissue `BREVO_API_KEY` in Brevo, update the Railway variable |
| `Brevo refused the message, HTTP 400` | Usually an unverified sender, or a malformed payload | Verify `MAIL_FROM_ADDRESS` as a sender in Brevo |
| `Brevo refused the message, HTTP 429` | Rate or quota limit at Brevo | Wait, or check the plan's daily allowance |
| `could not reach the Brevo API: ...` | Outbound 443 failed | Rare. Check Railway status. |
| `unknown MAIL_TRANSPORT: <value>` | Typo in the variable | Set it to exactly `brevo_api` |
| `Mail is not configured on this server.` | `BREVO_API_KEY` or `MAIL_FROM_ADDRESS` empty | Set the missing variable |

### What must never appear in a log

`BREVO_API_KEY`, any verification or reset token, any password. The code does
not log them, and nothing added later should. If you are tempted to log a token
to debug a link, log the token's **hash prefix** instead — that is enough to
match a row in `auth_tokens` and useless to anybody who reads it.

### Do not set `MAIL_TRANSPORT=capture` in production

It writes messages to files instead of sending them, and those files contain
working verification links.

---

## 6. Turnstile

```bash
curl.exe -s https://paws-found-production.up.railway.app/api/config
```

`{"data":{"turnstile_enabled":true,"turnstile_site_key":"0x..."}}` — the site
key is public by design and is meant to be visible here. The **secret** is
never in this response and never in the bundle.

| Symptom | Cause |
| --- | --- |
| `turnstile_enabled: false` | `TURNSTILE_ENABLED` is not `true`, or a key is missing |
| Widget missing on the form | The config call failed, or the Cloudflare script was blocked. Registration still refuses without a token — it fails closed |
| `captcha_misconfigured`, service will not start | `TURNSTILE_ENABLED=true` with a key missing. Deliberate: a CAPTCHA that silently switches itself off is worse than none |
| `captcha_failed` for a real person | Usually a spent token — the widget redraws on a refused submission for exactly this reason. Check the hostname on the Cloudflare widget matches the production domain |
| `captcha_unreachable`, 503 | The server could not reach Cloudflare's siteverify |

To turn it off in a hurry, set `TURNSTILE_ENABLED=false`. Registration is still
rate-limited.

---

## 7. Troubleshooting by symptom

### A page 404s on refresh, but works when clicked to

SPA routing. Apache must rewrite unknown paths to `index.html`. Check
`.htaccess` survived the build and that `RewriteBase` is `/` in the container
(the Dockerfile rewrites it from the XAMPP subfolder path). `verify:deploy`
check 1.3 tests exactly this.

### The API returns HTML instead of JSON

The request never reached `api/index.php` — usually the Dockerfile was not used
for the build, or rewriting is broken. Check the deploy log for
`apache2-foreground` and the `[paws]` lines.

### Uploaded photographs vanish after a deploy

The volume is not mounted, or not at `/var/lib/pawsandfound`. The
`[paws] upload path` line in the deploy log shows where the symlink actually
points. Photographs uploaded while it was wrong are gone.

### Everybody is signed out after a deploy

Same cause: `[paws] session path` is not on the volume. Sessions on the
container filesystem do not survive a redeploy.

### One person cannot sign in

In order: is the account **locked** (three wrong passwords — an administrator
unlocks it), **suspended** (an administrator reinstates), or **unverified**
(the response says `code: verification_required` — resend the link)? These are
three different states with three different answers, and the API distinguishes
them.

### Everybody is suddenly signed out mid-session

`session_version` went up — a password reset or a suspension. That is the
feature working.

### A state change answers 409

`code: stale_state`. Somebody else moved that report or pairing first. Reload
and look at the current state; nothing was written.

---

## 8. Security housekeeping

- **Disable the MySQL public TCP proxy** when it is not actively needed. It
  exists for imports and for running the suites from a laptop; the application
  itself reaches the database over Railway's private network.
- **Never commit a credential.** `api/config.local.php` is gitignored and
  excluded from the Docker build context; `database/railway/` is gitignored.
- **Do not share the live URL widely** while the demonstration accounts exist —
  they share one weak password.
- Before any public link is shared, `verify:deploy` check 6.1 confirms no demo
  password reached the bundle.
