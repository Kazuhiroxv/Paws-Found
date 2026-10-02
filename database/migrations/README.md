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

## Applying one

    mysql -u root -h 127.0.0.1 -P 3307 pawsandfound < database/migrations/001_login_lockout.sql

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
