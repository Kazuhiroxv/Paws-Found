# Changing the database while it is being watched

**ITS122P–AM5 · Group 3** · written 25 September 2026

The instructor may ask for a column, a table or a constraint to be added during
the demonstration. This is the procedure for doing that **without losing the
data on screen** and without anybody improvising.

Read it before the day. The whole point is that nobody is thinking about
process while being watched.

---

## 1. The rule that makes this survivable

**`database/schema.sql` is the baseline. It is never the thing you run on a
database that already has data in it** — it opens with `DROP TABLE` in reverse
dependency order, which is right for a fresh install and catastrophic
otherwise.

Anything that changes a database that already exists goes in
`database/migrations/` as a numbered, additive file, and is then mirrored back
into `schema.sql` so a fresh import and a migrated database stay identical.

Four exist already:

    001_login_lockout.sql     account lock state and the failed-attempt counter
    002_audit_logs.sql        who did what, and when
    003_privacy_consent.sql   who agreed to which version of the notice
    004_audit_actions.sql     the case events join the audit vocabulary

`schema_migrations` records which have run:

```sql
SELECT version, applied_at FROM schema_migrations ORDER BY version;
```

---

## 2. Doing it live, in order

**Owner: Dominic (Database/API). Nobody else touches phpMyAdmin during the
demonstration.**

### Step 0 — back up first, always

phpMyAdmin → Export → the `pawsandfound` database → **structure and data** →
Go. It takes about ten seconds and it is the difference between a mistake and a
disaster.

On the command line it is:

```bash
"C:\xampp\mysql\bin\mysqldump.exe" -u root -h 127.0.0.1 -P 3307 pawsandfound > backup-before-change.sql
```

### Step 1 — write the migration, do not type into phpMyAdmin

Create `database/migrations/005_<short_name>.sql`. Copy the shape of `004`:

```sql
-- =============================================================================
-- 005 — <what, in one line>
--
-- <Why. What breaks without it. Why this shape and not another.>
--
-- Additive. No existing row changes and no existing value is removed.
--
-- Run against an existing database:
--   mysql -u root -h 127.0.0.1 -P 3307 pawsandfound < 005_<short_name>.sql
-- =============================================================================

USE pawsandfound;

ALTER TABLE <table> ADD COLUMN <column> <type> NULL AFTER <existing>;

INSERT INTO schema_migrations (version) VALUES ('005')
  ON DUPLICATE KEY UPDATE version = version;
```

**`NULL` or with a `DEFAULT`, always.** A `NOT NULL` column with no default is
refused outright on a table that already has rows, and doing that in front of
an audience is not a good moment to learn it.

### Step 2 — apply it

```bash
"C:\xampp\mysql\bin\mysql.exe" -u root -h 127.0.0.1 -P 3307 pawsandfound < database/migrations/005_<short_name>.sql
```

Or paste the file into phpMyAdmin's SQL tab. Same statements either way.

### Step 3 — show it worked

```sql
DESCRIBE <table>;
SELECT version, applied_at FROM schema_migrations ORDER BY version;
SELECT COUNT(*) FROM pet_reports;   -- still 32. Nothing was lost.
```

That last line is the one to run. It is the proof the demonstration survived.

### Step 4 — mirror it into the baseline

Add the same column to the `CREATE TABLE` in `database/schema.sql`. This can
wait until after the presentation, but **it must not be forgotten** — the next
person to import `schema.sql` on a clean machine gets a database that does not
match this one.

### Step 5 — prove the two are still the same

```bash
"C:\xampp\mysql\bin\mysql.exe" -u root -h 127.0.0.1 -P 3307 -e "DROP DATABASE IF EXISTS pawsandfound_check; CREATE DATABASE pawsandfound_check;"
# edit a copy of schema.sql to say pawsandfound_check, import it, then:
SHOW CREATE TABLE <table>;   -- in both, and diff them
```

Done on 25 September for all 15 tables: **identical**.

---

## 3. Things that will go wrong, and what they look like

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ERROR 1060: Duplicate column name` | The migration has already been applied | Check `schema_migrations`. Adding it twice is not harmful, it is just already done |
| `ERROR 1067: Invalid default value` | `NOT NULL` with no default, on a table with rows | Make it `NULL`, or give it a `DEFAULT` |
| `ERROR 1005 / errno 150` | A foreign key whose types do not match exactly | Both sides must be the same type **and** signedness: `INT UNSIGNED` referencing `INT UNSIGNED` |
| `ERROR 1451` on a `DROP TABLE` | Something still references it | Drop in reverse dependency order, or do not drop it |
| The API starts 500ing after the change | PHP is selecting a column that no longer exists, or inserting into one that is now `NOT NULL` | The host's error log names the statement. Restore the backup if it is not obvious in thirty seconds |

---

## 4. If it goes badly wrong

```bash
"C:\xampp\mysql\bin\mysql.exe" -u root -h 127.0.0.1 -P 3307 pawsandfound < backup-before-change.sql
```

Or, to get back to the known demonstration state rather than to the backup:

```bash
"C:\xampp\mysql\bin\mysql.exe" -u root -h 127.0.0.1 -P 3307 pawsandfound < database/seed.sql
```

`seed.sql` clears and reinserts in dependency order — including `audit_logs`,
`login_attempts` and `privacy_consents` — so the system comes back to exactly
32 reports, 10 accounts, an empty audit log and no lock counters.

There is deliberately **no web endpoint that does this.** A public reset button
is a public delete button.

---

## 5. If you are asked the question rather than asked to do it

> **"What happens if I ask you to add a field right now?"**

The answer is a procedure, not a shrug:

1. Export the database first — ten seconds, and it makes everything after it
   reversible.
2. Write it as a numbered file in `database/migrations/`, additive, nullable.
3. Apply it, then `DESCRIBE` the table and show `COUNT(*)` is unchanged.
4. Mirror it into `schema.sql`, so a fresh import and this database stay the
   same thing.
5. `schema_migrations` records that it ran, so the next person can tell what
   this database has had done to it.

And the reason it works that way: *"`schema.sql` starts with `DROP TABLE`. If
we ran it against a live database to add one column, we would lose the data on
screen. That is why migrations exist and why they are additive."*
