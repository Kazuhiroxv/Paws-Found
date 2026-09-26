# Paws&Found — defending the database, table by table

**ITS122P–AM5 · Group 3** · checked against the live database on 25 September 2026

Every fact here was read out of `information_schema` on the running MariaDB,
not out of `schema.sql`. If the two ever disagree, the database is right and
this document is wrong.

**The database has 15 tables. Fourteen are on the ERD.**

The fifteenth is `schema_migrations`, which records which files in
`database/migrations/` have been applied. It is infrastructure: no domain data,
no foreign keys, and a filing cabinet does not belong on a family tree. Say
both numbers rather than one of them — anybody who runs `SHOW TABLES` gets 15,
and a diagram that says 14 without explaining the difference looks like an
omission instead of a decision.

Counted from `information_schema`, 25 September 2026:

| | |
| --- | --- |
| Tables | **15** (14 on the ERD + `schema_migrations`) |
| Foreign keys | **23** — all of them on the 14; `schema_migrations` has none |
| Primary keys | 15, one per table |
| Unique constraints | 7, over 11 columns |
| CHECK constraints | 2 |
| Engine | InnoDB throughout — MyISAM ignores foreign keys silently |

Read this before the presentation. Any member may be asked about any table.

---

## How to answer the three questions she will repeat

**"What is a primary key?"** The column that identifies one row and no other.
Every table here has one, every one is an `INT UNSIGNED AUTO_INCREMENT`, and
none of them carries meaning — a `report_id` is not the pet's name or the date,
because both of those can change and an identifier must not.

**"What is a foreign key?"** A column that must contain a value that exists in
another table's primary key. The database refuses the row otherwise, so a
report cannot point at a user who does not exist. It is enforced by MySQL, not
by PHP — that is the point of having it.

**"Why is this one-to-many?"** Because one row on the parent side can be
referenced by many rows on the child side, and each child points at exactly
one parent. One user files many reports; each report was filed by one user.

---

## 1. `users` — 10 rows

The people. Everything in the system is eventually somebody's.

| | |
| --- | --- |
| **Primary key** | `user_id` |
| **Foreign keys** | none — this is a parent everywhere it appears |
| **Unique** | `email`, so one address is one account |
| **Referenced by** | `pet_reports` (twice), `notifications`, `status_logs`, `match_claims` (twice), `moderation_cases` (twice), `login_attempts`, `privacy_consents`, `audit_logs` |

**Why it exists.** Reporting requires an account so a report can be traced back
to somebody and followed up.

**Worth saying out loud.** The column is `password_hash`, never `password`. It
holds a bcrypt hash, so an administrator looking straight at the table cannot
read anybody's password — which is the correct answer to "can an admin see my
password?" and the reason `SELECT password_hash FROM users` is a safe thing to
show on screen.

`role` is `ENUM('user','staff','admin')` and `account_status` is
`ENUM('active','suspended','locked')`. Both are constrained **by the database**,
so a crafted request cannot invent a fourth role even if it gets past PHP.

**If it were removed.** Nothing works. It is the only table with no foreign keys
of its own, which is what makes it the root.

---

## 2. `pet_categories` — 5 rows

Dog, Cat, Bird, Rabbit, Other. The species list an administrator manages.

| | |
| --- | --- |
| **Primary key** | `category_id` |
| **Unique** | `category_code` |
| **Referenced by** | `pet_breeds`, `pet_reports` — both `ON DELETE RESTRICT` |

**Why a table rather than an ENUM on the report.** Because administrators add
and retire species at runtime; an ENUM would need a schema change to add
"Hamster". `is_active` retires one without deleting it, so reports already
filed against it keep working.

**Why RESTRICT.** Deleting a category that reports point at would orphan them.
The database refuses, which is exactly what the admin interface tells the user:
a category in use can be deactivated, not deleted.

---

## 3. `pet_breeds` — 14 rows

Breeds belonging to a category. A genuine two-level hierarchy.

| | |
| --- | --- |
| **Primary key** | `breed_id` |
| **Foreign key** | `category_id` → `pet_categories` (RESTRICT) |
| **Unique** | (`category_id`, `breed_name`) together |
| **Referenced by** | `pet_reports.breed_id` (SET NULL) |

**The composite unique key is worth explaining.** "Terrier" may exist once under
Dog and once under Cat without clashing, because uniqueness is on the pair, not
on the name alone. That is a normalisation point she may well ask for.

**Why the report's breed is nullable.** A finder usually cannot identify a
breed. Requiring one would mean either losing the report or collecting a guess
dressed as a fact.

---

## 4. `locations` — 32 rows

Where an incident happened, at barangay level.

| | |
| --- | --- |
| **Primary key** | `location_id` |
| **Referenced by** | `pet_reports.location_id` (RESTRICT) |

**Why it is its own table.** It has its own attributes — label, city, province,
latitude, longitude and a `precision` flag — and separating them keeps
`pet_reports` about the animal rather than about geography.

**The privacy point.** `precision` is `ENUM('approximate','exact')` and every
seeded row says `approximate`. The detail page draws a 400 m circle rather than
a pin, so the imprecision is visible rather than implied. An exact home address
is never asked for and never stored.

---

## 5. `pet_reports` — 32 rows

The centre of the system. Everything else hangs off it.

| | |
| --- | --- |
| **Primary key** | `report_id` |
| **Foreign keys** | `user_id` → users (RESTRICT) · `category_id` → pet_categories (RESTRICT) · `breed_id` → pet_breeds (SET NULL) · `location_id` → locations (RESTRICT) · `assigned_staff_id` → users (SET NULL) |
| **Referenced by** | `report_images`, `status_logs`, `notifications`, `moderation_cases`, `match_claims` (twice) |

**Two foreign keys to the same table.** `user_id` is who filed it;
`assigned_staff_id` is the coordinator handling it. They point at `users` for
different reasons and have different delete rules, which is why they are two
columns and not one.

**Why the delete rules differ.** `user_id` is RESTRICT — a reporter cannot be
deleted while their reports exist, which is why accounts are *suspended*
instead. `assigned_staff_id` is SET NULL — a coordinator leaving should not
delete the case, it should leave it unassigned.

**Two deliberate differences from the proposal ERD.** `category_id` sits
directly on the report and is NOT NULL: in the draft, species was only
reachable through the breed, so a report with an unknown breed could not record
its species — and species is a mandatory gate in matching. `breed_id` is
nullable for the same reason.

---

## 6. `report_images` — 33 rows

| | |
| --- | --- |
| **Primary key** | `image_id` |
| **Foreign key** | `report_id` → pet_reports (**CASCADE**) |

**Why CASCADE here and RESTRICT elsewhere.** A photograph has no meaning
without its report — delete the report and the row should go. A reporter does
have meaning without a given report, so that relationship restricts instead.
Being able to say why two foreign keys in the same schema behave differently is
the answer she is listening for.

**Only the path is stored**, not the file. Images live in `api/uploads/`;
putting them in the database bloats it and makes backups painful.

---

## 7. `status_logs` — 47 rows

The case history. Appended to, never overwritten.

| | |
| --- | --- |
| **Primary key** | `log_id` |
| **Foreign keys** | `report_id` → pet_reports (CASCADE) · `updated_by_user_id` → users (SET NULL) |

**Why not just a `status` column on the report?** There is one — this is the
history of it. The column says where a case is; this says how it got there, who
moved it and when. Overwriting the previous value would destroy the only record
that a case was ever anything else.

`updated_by_user_id` is nullable because the system itself changes a status
when matching raises a possible match, and no person did that.

---

## 8. `match_claims` — 4 rows

One possible pairing of one lost report and one found report. **This is the
junction table**, and it is the one to have ready.

| | |
| --- | --- |
| **Primary key** | `match_id` |
| **Foreign keys** | `lost_report_id` → pet_reports (CASCADE) · `found_report_id` → pet_reports (CASCADE) · `submitted_by_user_id` → users (SET NULL) · `reviewed_by_user_id` → users (SET NULL) |
| **Unique** | (`lost_report_id`, `found_report_id`) — the same pair never twice |
| **Check** | `lost_report_id <> found_report_id` · `match_score BETWEEN 0 AND 100` |

**The many-to-many answer.** One lost report may be compared against many found
reports, and one found report against many lost ones. A relational database
cannot store many-to-many directly, so it becomes a table — and because a
pairing has attributes of its own (a score, a status, who decided it, their
notes) this is not a bare link table but an entity in its own right.

**Two CHECK constraints, enforced by the database.** A report cannot be paired
with itself, and a score outside 0–100 is refused. Worth demonstrating: an
`INSERT` that breaks either is rejected by MySQL with PHP nowhere in sight.

---

## 9. `match_signals` — 28 rows

Why a pairing scored what it did. One row per compared characteristic.

| | |
| --- | --- |
| **Primary key** | `signal_id` |
| **Foreign key** | `match_id` → match_claims (CASCADE) |
| **Unique** | (`match_id`, `signal_key`) — one verdict per characteristic per pairing |

**Why it exists.** It is what makes matching explainable rather than a black
box. The comparison screen renders these directly — "6 of 7 characteristics
align", with a tick or a cross and a sentence for each. 4 pairings × 7 signals
= 28 rows, which is the arithmetic if she counts.

**Why store them rather than recompute.** A coordinator then sees the same
reasoning the reporter saw, even if the weights are tuned afterwards.

---

## 10. `notifications` — 11 rows

| | |
| --- | --- |
| **Primary key** | `notification_id` |
| **Foreign keys** | `user_id` → users (CASCADE) · `report_id` → pet_reports (CASCADE, nullable) · `match_id` → match_claims (CASCADE, nullable) |

**Why two nullable foreign keys.** A notification always belongs to exactly one
person, but what it is *about* varies: some point at a report, some at a
pairing, some at neither. Nullable is the honest way to say "may or may not
relate to one of these".

**In-app only.** The system sends no email or SMS. Saying so plainly is better
than being caught claiming otherwise.

---

## 11. `moderation_cases` — 2 rows

A flag raised by the community, and what an administrator did about it.

| | |
| --- | --- |
| **Primary key** | `case_id` |
| **Foreign keys** | `report_id` → pet_reports (CASCADE) · `reported_by_user_id` → users (SET NULL) · `resolved_by_admin_id` → users (SET NULL) |

**Two user foreign keys again**, for the same reason as `pet_reports`: one is
who complained, one is who decided. Both SET NULL — the record of a decision
should outlive the account that made it.

"Remove" closes the report rather than deleting the row, so what happened
survives the decision.

---

## 12. `login_attempts` — 0 rows at rest

The three-attempt lock. **Added in the hardening pass.**

| | |
| --- | --- |
| **Primary key** | `attempt_id` |
| **Foreign key** | `user_id` → users (CASCADE, **nullable**) |
| **Unique** | `email` |

**Why it is keyed on the email typed, not on the account.** So an address
belonging to nobody is counted exactly like one that does. That is what lets
the system say "2 attempts remain" to everybody without that sentence becoming
a way of asking which addresses are registered. Verified: the three responses
for a real account and for an invented one are identical, word for word.

**Hence the nullable `user_id`** — there may be no account to point at.

**Why not a column on `users`.** A column on `users` could only count attempts
against accounts that exist, which would reintroduce the leak above.

**Where the lock itself lives.** Not here — in `users.account_status`, which
gains the value `locked`. The counter is the mechanism; the state is a property
of the account, and `current_user()` refuses anything that is not `active`, so
locking also ends every session that account has open.

---

## 13. `privacy_consents` — 10 rows

Who agreed to the privacy notice, and to which version. **Added in the
hardening pass.**

| | |
| --- | --- |
| **Primary key** | `consent_id` |
| **Foreign key** | `user_id` → users (CASCADE) |
| **Unique** | (`user_id`, `notice_version`) — agreeing twice to one wording is not two facts |

**Why a table and not a column on `users`.** Because the notice has a version.
If the wording changes in a way that matters we need to know who agreed to
*which* version and *when* — a boolean column would be overwritten by the
second agreement and the first would be gone, which is the opposite of what a
consent record is for.

**Why CASCADE**, unlike `audit_logs` below: a consent record only means
something attached to the person who gave it. An orphaned "somebody agreed to
something" protects nobody and is one more piece of personal data kept for no
reason.

---

## 14. `audit_logs` — 0 rows at rest

Who did what, and when. **Added in the hardening pass.**

| | |
| --- | --- |
| **Primary key** | `audit_id` |
| **Foreign key** | `actor_user_id` → users (**SET NULL**, nullable) |

**Why SET NULL and not CASCADE — the contrast with `privacy_consents`.**
Deleting an account must not delete the record of what that account did.
`actor_email` survives beside it, so the row still means something afterwards.
This pair of tables is the cleanest illustration in the whole schema that a
delete rule is a design decision rather than a default.

**Why the actor is nullable.** A failed sign-in records which account was being
aimed at — that is the *target* — but not who was doing the aiming. Writing the
account holder in as the actor would put "Kenneth Villanueva failed to sign in"
in the log when it may well have been somebody else entirely.

**What it never stores.** No passwords, no tokens, no session ids. `detail` is
a short sentence meant to be read by a person: `user -> admin`, `3 failed
sign-in attempts`.

---

## Every relationship, in one list

    users            1 ── N  pet_reports         (user_id, RESTRICT)
    users            1 ── N  pet_reports         (assigned_staff_id, SET NULL)
    users            1 ── N  notifications       (CASCADE)
    users            1 ── N  status_logs         (SET NULL)
    users            1 ── N  match_claims        (submitted_by, SET NULL)
    users            1 ── N  match_claims        (reviewed_by, SET NULL)
    users            1 ── N  moderation_cases    (reported_by, SET NULL)
    users            1 ── N  moderation_cases    (resolved_by, SET NULL)
    users            1 ── N  login_attempts      (CASCADE)
    users            1 ── N  privacy_consents    (CASCADE)
    users            1 ── N  audit_logs          (SET NULL)
    pet_categories   1 ── N  pet_breeds          (RESTRICT)
    pet_categories   1 ── N  pet_reports         (RESTRICT)
    pet_breeds     0..1 ── N pet_reports         (SET NULL — breed is optional)
    locations        1 ── N  pet_reports         (RESTRICT)
    pet_reports      1 ── N  report_images       (CASCADE)
    pet_reports      1 ── N  status_logs         (CASCADE)
    pet_reports      1 ── N  notifications       (CASCADE)
    pet_reports      1 ── N  moderation_cases    (CASCADE)
    pet_reports      1 ── N  match_claims        (lost side, CASCADE)
    pet_reports      1 ── N  match_claims        (found side, CASCADE)
    match_claims     1 ── N  match_signals       (CASCADE)
    match_claims     1 ── N  notifications       (CASCADE)

23 foreign keys. Counted from `information_schema`, not from memory.

---

## Five questions worth rehearsing

**"Show me that the foreign key actually does something."**

```sql
INSERT INTO pet_reports (user_id, category_id, location_id, report_type, incident_date)
VALUES (9999, 1, 1, 'lost', '2026-09-01');
```

MySQL refuses: there is no user 9999. No PHP involved.

**"What happens if I delete a user?"** With reports, you cannot — RESTRICT
refuses. That is deliberate: accounts are suspended, never deleted, so reports
and case histories stay readable.

**"Why is `match_claims` not just two columns on `pet_reports`?"** Because a
report can be in several possible pairings at once, and each pairing has its
own score, status and decision. Columns on the report could hold one pairing
and nowhere to put its attributes.

**"How many tables, and why that many?"** 14. The guide asks for at least 8.
The extra six each carry something the application genuinely needs and has
nowhere else to put: explainable matching, notifications, moderation, the
three-attempt lock, consent, and the audit trail.

**"Is this normalised?"** To third normal form. Species and breed are looked up
rather than repeated as text; location is its own entity; a pairing's
attributes live on the pairing. The three notification-preference booleans on
`users` are a deliberate exception — there are exactly three, every account has
all three, and a join table would add work without adding meaning.
