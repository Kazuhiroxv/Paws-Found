# Migrations

`database/schema.sql` is the **baseline**. It creates every table from nothing
and is kept up to date, so a fresh installation imports `schema.sql` then
`seed.sql` and needs no migrations at all.

The files in this folder are the changes made **after** a database has already
been built — on the hosted database, or on a laptop with demonstration data on
screen that nobody wants to lose. Each one is additive: it adds a table or a
column, and it never drops the data that is already there.

    001_login_lockout.sql   account lock state and the failed-attempt counter
    002_audit_logs.sql      who did what, and when
    003_privacy_consent.sql who agreed to which version of the privacy notice
    004_audit_actions.sql   the case events join the audit vocabulary
    005_account_lifecycle.sql  proving an address, resetting a password, and
                            revoking sessions without hunting for session files
    006_token_expiry_explicit.sql  stop auth_tokens.expires_at rewriting itself
    007_match_fk_mysql8.sql   let match_claims import on MySQL 8, not only MariaDB
    008_split_user_names.sql  first and last name; full_name becomes generated.
                            Ships WITH the code that uses it — see the file.
    009_report_reference_data.sql  areas and cities (PSA PSGC, as of 30 June
                            2026), the colour list, listed breeds,
                            locations.city_code, size XL.
                            AFTER 008, WITH the code — see the file.

**009 was revised once before it was ever deployed (Correction 3A).** The
version in commit `31bbcab` used PSA's July 2025 file and a `ph_provinces`
table that wrongly held Metro Manila. It was never pushed and never run on
Railway; only this laptop's database and throwaway test containers had it.
Revising it, rather than adding a 010, keeps the production deploy to one
migration with current data. A database that ran the superseded version must
be rebuilt — drop `ph_cities`, `ph_provinces` and `pet_colours`, restore the
pre-009 backup, run 009 — because the new file cannot be laid over the old.

    010_report_publication_workflow.sql  pet_reports.publication_status,
                            publication_logs, report_drafts; new notification
                            and audit words; earlier moderation removals
                            converted from Closed to Removed, on evidence.
                            AFTER 009, WITH the code — see the file.

`npm run test:migrations` builds the production path (2947a43 schema and seed
→ 008 → 009 → 010 → 010) and a fresh install on MySQL 9.4 and MariaDB, and
requires them to be identical.

Deploying 008 and 009 (Correction 3), in one sitting: back up, preview 008
(query in the file), run 008, preview 009 (queries in the file), run 009, push
the code, check `/api/health`, run `npm run verify:deploy`. Both were tested
from the `2947a43` schema on MySQL 9.4 (strict) and on MariaDB, run twice, and
the result compared with a fresh `schema.sql` + `seed.sql`: identical structure,
identical reference data.

## Applying one

    mysql -u root -h 127.0.0.1 -P 3307 --default-character-set=utf8mb4 pawsandfound < database/migrations/001_login_lockout.sql

The character-set flag matters from 009 on, whose place names contain ñ:
without it the Windows client reads the file in the console code page and
stores "Las PiÃ±as". (009 also says `SET NAMES utf8mb4` itself.)

(Use `-P 3306` on an installation that runs MySQL on the default port.)

Each migration records itself in `schema_migrations`, so this answers "what has
this database already had done to it":

    SELECT version, applied_at FROM schema_migrations ORDER BY version;

`schema_migrations` is infrastructure, not part of the domain — it is
deliberately **not** on the ERD, for the same reason a filing cabinet is not on
a family tree. `auth_rate_limits`, added by 005, is left off for the same kind
of reason: it counts requests against an address that usually has no account,
so it has no foreign key and no domain relationship to draw.

## Writing one

1. Number it next in sequence, and name it after what it does.
2. Make it additive. `ADD COLUMN`, `CREATE TABLE`, `MODIFY` an ENUM to add a
   value — never `DROP` something with data in it.
3. Use `IF NOT EXISTS` where MariaDB allows it, so running it twice is not a
   disaster.
4. Give every `TIMESTAMP` column an explicit `DEFAULT`. The first bare
   `TIMESTAMP NOT NULL` in a table is silently given
   `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`, so the column
   quietly rewrites itself on every write to the row. That is what 006 had to
   undo.
5. Check it on **MySQL 8**, not only on XAMPP's MariaDB. They are not the same
   engine and they disagree about things a migration can easily walk into —
   007 exists because MySQL 8 refuses a CHECK over a column a foreign key's
   referential action can rewrite, and MariaDB does not. The cheapest way:
   `docker run -d -e MYSQL_ROOT_PASSWORD=x -e MYSQL_DATABASE=railway -p 3399:3306 mysql:8.0`
   then import `database/railway/schema.sql` into it.
6. End it with its own `INSERT` into `schema_migrations`.
7. Make the same change in `schema.sql`, so a fresh import and a migrated
   database end up identical. A migration that is not mirrored in the baseline
   is how the two quietly drift apart.
8. Update `docs/diagrams/fig2-erd.svg` and `docs/erd-defense.md` if the change
   touches a table or a relationship.
