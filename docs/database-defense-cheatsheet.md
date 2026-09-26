# Database cheat sheet

**ITS122P–AM5 · Group 3** · counted from `information_schema`, 25 September 2026

One page. The long version is `docs/erd-defense.md`; this is what to have in
your head walking in.

---

## The numbers

| | |
| --- | --- |
| Tables | **15** — the **14** on the ERD, plus `schema_migrations` |
| Foreign keys | **23**, all on the 14 |
| Primary keys | 15, one per table |
| Unique constraints | 7, over 11 columns |
| CHECK constraints | 2 |
| Engine | InnoDB throughout |
| Server | MariaDB 10.4.32 via XAMPP — **port 3307** on the development laptop |

**Say both table numbers.** `SHOW TABLES` gives 15; the ERD draws 14. The
fifteenth is `schema_migrations`, which records which files in
`database/migrations/` have been applied. It holds no domain data and has no
foreign keys — a filing cabinet does not belong on a family tree. Saying "14"
and leaving it there makes a decision look like an omission.

---

## The 14, one line each

| Table | What it holds |
| --- | --- |
| `users` | Accounts: name, email, password **hash**, role, account status |
| `pet_categories` | The species list an administrator manages |
| `pet_breeds` | Breeds under a category |
| `locations` | A city, a province, a barangay and approximate coordinates |
| `pet_reports` | The report itself — type, pet details, status |
| `report_images` | Photographs, one row per file |
| `status_logs` | Every status change, appended, never overwritten |
| `match_claims` | A lost/found pairing, its score and its decision |
| `match_signals` | The seven reasons behind one pairing's score |
| `notifications` | What each person still needs to be told |
| `moderation_cases` | A flagged report and how it was resolved |
| `login_attempts` | Failed sign-ins per **email address** |
| `audit_logs` | Who did what, append-only |
| `privacy_consents` | Who agreed to which version of the privacy notice |

---

## Delete rules, and why they differ

This is the question that separates "we drew an ERD" from "we decided an ERD".

| Rule | Where | Why |
| --- | --- | --- |
| **RESTRICT** | `pet_reports.user_id` → `users` | A report without a reporter is a report nobody can be asked about. The database refuses to orphan it |
| | `pet_reports.category_id` → `pet_categories` | Deleting "Dog" must not silently strip the species off every dog report |
| | `pet_reports.location_id` → `locations` | Same reasoning |
| **CASCADE** | `report_images.report_id` | A photograph of a deleted report is a file nobody can reach |
| | `match_signals.match_id` | A reason for a pairing that no longer exists means nothing |
| | `privacy_consents.user_id` | An orphaned "somebody agreed to something" protects nobody and is one more piece of personal data kept for no reason |
| **SET NULL** | `audit_logs.actor_user_id` | **Deleting an account must not delete the record of what it did.** `actor_email` survives, so the row still means something |
| | `status_logs.updated_by_user_id` | The history of a case outlives the account that made the change |
| | `match_claims.reviewed_by_user_id` | Same |

**The contrast to have ready:** `audit_logs` is SET NULL and
`privacy_consents` is CASCADE, and they hang off the same column of the same
table. That pair is the cleanest proof in the schema that a delete rule is a
decision rather than a default.

---

## Two constraints that are easy to ask about

```sql
chk_match_distinct   lost_report_id <> found_report_id
chk_match_score      match_score BETWEEN 0 AND 100
```

A report cannot be paired with itself, and a score cannot be 150. Both enforced
by the database, not by PHP — so a bad row cannot get in through phpMyAdmin
either.

---

## `login_attempts` — the one worth explaining

```
email        VARCHAR(190)  UNIQUE     <- the key
user_id      INT UNSIGNED  NULL       <- FK to users, ON DELETE CASCADE
failed_count TINYINT
```

The unique key is the **email typed**, not the account. An address that belongs
to nobody still gets a row and still counts down. That is deliberate: the
three-attempt message must read identically whether or not the account exists,
or "2 attempts remain" becomes a way of asking which addresses are registered.

`user_id` is a nullable convenience — NULL when the email matches no account —
and CASCADE so deleting an account takes its counter with it.

---

## Run these if you are asked to prove it

```sql
-- 15 tables, 23 foreign keys
SELECT COUNT(*) FROM information_schema.tables
 WHERE table_schema = 'pawsandfound';

SELECT COUNT(*) FROM information_schema.table_constraints
 WHERE table_schema = 'pawsandfound' AND constraint_type = 'FOREIGN KEY';
```

Three refusals. **All three were run live on 25 September and all three
failed as intended** — which is the point:

```sql
-- 1. The CHECK: a report cannot be paired with itself
INSERT INTO match_claims (lost_report_id, found_report_id, match_score)
VALUES (1, 1, 90);
-- ERROR 4025: CONSTRAINT `chk_match_distinct` failed

-- 2. The foreign key: a report cannot belong to an account that is not there
UPDATE pet_reports SET user_id = 9999 WHERE report_id = 1;
-- ERROR 1452: Cannot add or update a child row ... fk_reports_user

-- 3. RESTRICT: a reporter with reports cannot be deleted
DELETE FROM users WHERE user_id = 1;
-- ERROR 1451: Cannot delete or update a parent row ... fk_reports_user
```

Note that (3) is the **database** refusing, not the application. There is no
PHP in that transaction at all.

---

## Three sentences to have ready

> **"Is it normalised?"**
> Third normal form. Species and breed are their own tables rather than text on
> the report, location is its own table because several reports can share an
> area, and no non-key column depends on another non-key column. The one
> deliberate exception is `audit_logs.actor_email`, which duplicates the user's
> email on purpose — so the row still says who did it after the account is
> gone.

> **"Where are the passwords?"**
> There are none. `users.password_hash` holds a bcrypt hash via PHP's
> `password_hash()` with `PASSWORD_DEFAULT`. Nobody — including us — can read a
> password back, and the demonstration accounts are no exception.

> **"How do you stop SQL injection?"**
> PDO prepared statements everywhere, with `ATTR_EMULATE_PREPARES => false`, so
> the values are sent to the server separately from the statement and are never
> part of the SQL text. Tested with 13 payloads in category B of
> `npm run audit`; after every one, `SELECT COUNT(*) FROM pet_reports` still
> returns 32 and the schema still has 15 tables.
