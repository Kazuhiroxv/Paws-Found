# Database cheat sheet

**ITS122P–AM5 · Group 3** · counted from `information_schema`, 27 September 2026

One page. The long version is `docs/erd-defense.md`; this is what to have in
your head walking in.

---

## The numbers

| | |
| --- | --- |
| Tables | **17** — the **15** on the ERD, plus `schema_migrations` and `auth_rate_limits` |
| Foreign keys | **24**, all on the 15 |
| Primary keys | 17, one per table |
| Unique constraints | 9, over 14 columns |
| CHECK constraints | 2 |
| Engine | InnoDB throughout |
| Server | **Production: MySQL 9.4 on Railway** (what DBeaver connects to at the defense). Development: MariaDB 10.4.32 via XAMPP, port 3307. Same `schema.sql`, same counts on both |

**Say both table numbers.** `SHOW TABLES` gives 17; the ERD draws 15. The two
that are missing are `schema_migrations`, which records which files in
`database/migrations/` have been applied, and `auth_rate_limits`, which counts
how recently an address asked for something so the API can refuse the fourth
request. Neither holds domain data and neither has a foreign key — a filing
cabinet does not belong on a family tree. Saying "15" and leaving it there
makes a decision look like an omission. The diagram carries the explanation in
its own note, so the answer is on the page you are pointing at.

---

## The 15, one line each

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
| `audit_logs` | Who did what, append-only — security and administrative events |
| `user_sessions` | Each sign-in: account, IP, browser, start, last seen, end and why (011) |
| `user_activity_logs` | Where a signed-in person went and what they did (011) |
| `privacy_consents` | Who agreed to which version of the privacy notice |
| `auth_tokens` | One-time links — verify an address, reset a password. Stored **hashed** |

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
-- 24 tables, 35 foreign keys after migration 011 (17 and 24 when this sheet
-- was first written; 15 of the tables are on the ERD figure)
SELECT COUNT(*) FROM information_schema.tables
 WHERE table_schema = 'pawsandfound';

SELECT COUNT(*) FROM information_schema.table_constraints
 WHERE table_schema = 'pawsandfound' AND constraint_type = 'FOREIGN KEY';
```

Three refusals. **All three were run live on 27 September and all three
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

**Sessions and activity, safe for a projector** (Correction 5). The Logs page
in Administration is the authorised view and shows full IP addresses; a
projector in a classroom is not, so in DBeaver show the demo accounts and
leave the address out:

```sql
-- Each sign-in of the demo accounts: when, which browser, how it ended
SELECT u.email, LEFT(s.session_reference, 8) AS session, s.started_at,
       s.last_seen_at, s.ended_at, s.end_reason
  FROM user_sessions s JOIN users u ON u.user_id = s.user_id
 WHERE u.email LIKE '%@example.com'
 ORDER BY s.started_at DESC LIMIT 10;

-- What one session did, in order
SELECT a.created_at, a.action, a.route, a.target_type, a.target_id
  FROM user_activity_logs a
  JOIN user_sessions s ON s.session_record_id = a.session_record_id
 WHERE s.session_reference LIKE '8f31c2a4%'   -- the first 8 characters from above
 ORDER BY a.activity_id;
```

If the IP itself has to be shown, show the demo laptop's own sign-in, not a
classmate's.

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
> returns 32 and the schema still has 17 tables.
