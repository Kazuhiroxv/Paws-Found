# Final pre-freeze audit — database and architecture

**6 October 2026, at `d7f7435` (Correction 7), branch `post-defense/revisions`.**
Read-only: nothing in the schema, the data or the code was changed to write it.
This is the source of truth for the schema freeze and the final ERD.

**How it was produced.** The tables, columns, keys, constraints and ENUM values
in §2–§6 were **generated** from `information_schema` (not typed), on two
databases:

- a **fresh MySQL 9.4** (the production engine), built from
  `database/railway/schema.sql` and `seed.sql` — the authority for this
  document;
- the **local MariaDB 10.4.32** (XAMPP), which reached the same schema by
  applying migrations 001→012 in turn.

The lifecycles and the role hierarchy (§8–§10) are read from the PHP that
enforces them. **Production's database was not read** (this audit has no
production database access); per `CURRENT_STATE.md`, it is at migration 007
and gets 008→012 at deployment. Production's API answered
`{"status":"ok","database":"ok"}` and still serves the `2947a43` bundle.

---

## 1. Findings

**The schema is consistent and ready to freeze, subject to the decisions in
§1.2.**

### 1.1 What was verified

| Check | Result |
| --- | --- |
| Tables / columns | **24 / 208** on both engines |
| Primary keys | 24 — every table has one; all single-column |
| Foreign keys | **35** on both engines; ON DELETE: 16 CASCADE, 13 SET NULL, 6 RESTRICT |
| CHECK constraints | **3** on both engines (`chk_match_distinct`, `chk_match_score`, `chk_users_admin_level`) |
| UNIQUE keys (besides primary keys) | 12, identical |
| Secondary indexes | 50, identical |
| Triggers / views / stored routines | 0 / 0 / 0 — all rules live in PHP or in the constraints above |
| Storage engine | InnoDB everywhere |
| Migrations recorded | `001`…`012` on the migrated MariaDB; the fresh install records the same twelve |
| MySQL 9.4 vs migrated MariaDB | **Structurally identical.** Two representational differences only: MariaDB writes `on update current_timestamp()` where MySQL writes `current_timestamp` (4 columns), and the two `match_claims` foreign keys report ON UPDATE `RESTRICT` on MariaDB and `NO ACTION` on MySQL — the same behaviour in InnoDB (migration 007 exists because of this pair) |

The automated parity check, `npm run test:migrations` (29/29 on 4 October),
proves the same thing by a different route: a 2947a43-era database migrated to
012 equals a fresh install on both engines.

### 1.2 Decisions to make before the freeze

**Status, 6 October 2026:** Cancel **DEFERRED PENDING INSTRUCTOR
CLARIFICATION**; `staff_notes` **KEEP**; `assigned_staff_id` **CANDIDATE FOR
REMOVAL**, blocked on a read-only production query (no migration 013 yet).
Reset (**AWAITING CLARIFICATION**) and the contact number (**IMPLEMENTED,
AWAITING INSTRUCTOR-INTENT CONFIRMATION**) do not block the freeze. Reasons:
`docs/DECISIONS.md`, "Schema freeze notes".

1. **Cancel (register 16) — the only open item that could change the schema.**
   If Ma'am's "cancel" is a third review decision with its own state, it needs a
   migration on **three** ENUM columns that share the publication values
   (`pet_reports.publication_status`, `publication_logs.previous_state`,
   `publication_logs.new_state`), a row in `PUBLICATION_ACTIONS`
   (`api/reports.php`), labels in both dictionaries (`test:i18n` I18N-16 fails
   until they match the schema) and a `notifications.notification_type` value
   if the reporter is told. (The comment above `PUBLICATION_ACTIONS` says "one
   value in the publication ENUM"; it is three columns.) If Cancel only means
   closing the dialog, nothing changes. **Decided: DEFERRED PENDING
   INSTRUCTOR CLARIFICATION.** No Cancel publication state is implemented,
   because its intended semantics were not established; the states remain
   `pending_review`, `published`, `rejected`, `removed`.
2. **`pet_reports.assigned_staff_id` is unused.** It has a foreign key to
   `users` (SET NULL), but no PHP, no interface code and no seed row sets or
   reads it; every report has it NULL. It dates from the proposal ERD
   ("assigned coordinator"). Either keep it and say on the ERD that it is
   reserved and unused, or drop it in a final migration before the freeze. A
   column that appears on the ERD but does nothing is a likely panel question.
   **Status: CANDIDATE FOR REMOVAL.** Local evidence: no API, interface, test
   or seed use; 0 of 32 local reports set. The final decision waits on a
   read-only production query; if production also has zero assigned rows,
   migration 013 drops it before the final ERD. Not created yet.
3. **`match_claims.staff_notes` is written, never read back** (known since
   HANDOFF §12): coordinators' notes are stored when they decide, but no page
   shows them. Keep (it is an audit trail of the decision) or show it; no
   schema change either way.
   **Status: KEEP** — application-written internal coordinator data (the
   latest decision note replaces the previous one), not surfaced in the
   interface: a known presentation limitation, not dead schema.
4. **`match_signals.signal_key` says `color`**, while everything since
   Correction 3 says `colour` (`pet_colours`, `colour_name`). Cosmetic and
   stored in 28 seed rows and every production pairing — **leave it**, and be
   ready to say why.
5. **The two operational tables stay off the ERD** (`schema_migrations`,
   `auth_rate_limits`), as on every diagram so far; the final ERD says so in a
   note.

None of these is a defect in what the system does.

### 1.3 The defense ERD is out of date (expected)

The current figure (`docs/diagrams/erd.mmd` / `erd-a3.*`, generated by
`scripts/erd.py` before Correction 3) has **15 tables and 24 relationships**.
Against the frozen schema it lacks:

- **7 tables:** `pet_colours`, `ph_areas`, `ph_cities` (009),
  `publication_logs`, `report_drafts` (010), `user_sessions`,
  `user_activity_logs` (011) — plus the two operational tables, omitted on
  purpose;
- **6 columns:** `users.first_name`, `users.last_name` (008; `full_name` is now
  generated from them), `users.admin_level` (012), `pet_reports.publication_status`
  (010), `locations.city_code`, `pet_breeds.is_listed` (009);
- **11 foreign keys:** `ph_cities→ph_areas`, `locations→ph_cities`,
  `report_drafts→users/pet_categories/ph_areas/ph_cities`,
  `publication_logs→pet_reports/users`, `user_sessions→users`,
  `user_activity_logs→users/user_sessions`.

`scripts/erd.py` refuses to draw unless the database has 17 tables and 24
foreign keys, so the final ERD pass updates its expected counts (24 / 35, 22
drawn) and gives the seven new tables a place on the page. Nothing about the
schema is typed into it; the layout is.


## 2. The 24 tables

| # | Table | Group | Created by | Columns | Primary key | FKs out | Seed rows | On the defense ERD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `users` | Domain — people | base schema | 18 | `user_id` | 0 | 10 | yes |
| 2 | `locations` | Domain — reports | base schema | 8 | `location_id` | 1 | 32 | yes |
| 3 | `pet_reports` | Domain — reports | base schema | 25 | `report_id` | 5 | 32 | yes |
| 4 | `report_drafts` | Domain — reports | migration 010 | 25 | `draft_id` | 4 | 0 | **no** |
| 5 | `report_images` | Domain — reports | base schema | 6 | `image_id` | 1 | 33 | yes |
| 6 | `match_claims` | Domain — matching | base schema | 11 | `match_id` | 4 | 4 | yes |
| 7 | `match_signals` | Domain — matching | base schema | 6 | `signal_id` | 1 | 28 | yes |
| 8 | `publication_logs` | Domain — history | migration 010 | 7 | `log_id` | 2 | 1 | **no** |
| 9 | `status_logs` | Domain — history | base schema | 7 | `log_id` | 2 | 46 | yes |
| 10 | `notifications` | Domain — communication | base schema | 9 | `notification_id` | 3 | 11 | yes |
| 11 | `moderation_cases` | Domain — moderation | base schema | 10 | `case_id` | 3 | 2 | yes |
| 12 | `pet_breeds` | Reference | base schema | 4 | `breed_id` | 1 | 32 | yes |
| 13 | `pet_categories` | Reference | base schema | 4 | `category_id` | 0 | 5 | yes |
| 14 | `pet_colours` | Reference | migration 009 | 3 | `colour_code` | 0 | 17 | **no** |
| 15 | `ph_areas` | Reference | migration 009 | 3 | `area_code` | 0 | 84 | **no** |
| 16 | `ph_cities` | Reference | migration 009 | 4 | `city_code` | 1 | 1642 | **no** |
| 17 | `audit_logs` | Security | migration 002 | 10 | `audit_id` | 1 | 0 | yes |
| 18 | `auth_tokens` | Security | migration 005 | 8 | `token_id` | 1 | 0 | yes |
| 19 | `login_attempts` | Security | migration 001 | 7 | `attempt_id` | 1 | 0 | yes |
| 20 | `privacy_consents` | Security | migration 003 | 5 | `consent_id` | 1 | 10 | yes |
| 21 | `user_activity_logs` | Security | migration 011 | 10 | `activity_id` | 2 | 0 | **no** |
| 22 | `user_sessions` | Security | migration 011 | 10 | `session_record_id` | 1 | 0 | **no** |
| 23 | `auth_rate_limits` | Infrastructure | migration 005 | 6 | `rate_limit_id` | 0 | 0 | **no** |
| 24 | `schema_migrations` | Infrastructure | migration 001 | 2 | `version` | 0 | 12 | **no** |

Totals: **24 tables, 208 columns, 35 foreign keys, 3 CHECK constraints, 12 UNIQUE keys besides the primary keys, 50 secondary indexes**; 0 triggers, 0 views, 0 stored routines. Every table is InnoDB.

## 3. Foreign keys (35)

| # | Child table.column | → Parent | ON DELETE | ON UPDATE | Constraint |
| --- | --- | --- | --- | --- | --- |
| 1 | `pet_reports.location_id` | `locations.location_id` | RESTRICT | CASCADE | `fk_reports_location` |
| 2 | `match_signals.match_id` | `match_claims.match_id` | CASCADE | CASCADE | `fk_signals_match` |
| 3 | `notifications.match_id` | `match_claims.match_id` | CASCADE | CASCADE | `fk_notifications_match` |
| 4 | `pet_reports.breed_id` | `pet_breeds.breed_id` | SET NULL | CASCADE | `fk_reports_breed` |
| 5 | `pet_breeds.category_id` | `pet_categories.category_id` | RESTRICT | CASCADE | `fk_breeds_category` |
| 6 | `pet_reports.category_id` | `pet_categories.category_id` | RESTRICT | CASCADE | `fk_reports_category` |
| 7 | `report_drafts.category_id` | `pet_categories.category_id` | SET NULL | CASCADE | `fk_report_drafts_category` |
| 8 | `match_claims.found_report_id` | `pet_reports.report_id` | CASCADE | NO ACTION | `fk_match_found` |
| 9 | `match_claims.lost_report_id` | `pet_reports.report_id` | CASCADE | NO ACTION | `fk_match_lost` |
| 10 | `moderation_cases.report_id` | `pet_reports.report_id` | CASCADE | CASCADE | `fk_moderation_report` |
| 11 | `notifications.report_id` | `pet_reports.report_id` | CASCADE | CASCADE | `fk_notifications_report` |
| 12 | `publication_logs.report_id` | `pet_reports.report_id` | CASCADE | CASCADE | `fk_publication_logs_report` |
| 13 | `report_images.report_id` | `pet_reports.report_id` | CASCADE | CASCADE | `fk_images_report` |
| 14 | `status_logs.report_id` | `pet_reports.report_id` | CASCADE | CASCADE | `fk_logs_report` |
| 15 | `ph_cities.area_code` | `ph_areas.area_code` | RESTRICT | CASCADE | `fk_ph_cities_area` |
| 16 | `report_drafts.area_code` | `ph_areas.area_code` | SET NULL | CASCADE | `fk_report_drafts_area` |
| 17 | `locations.city_code` | `ph_cities.city_code` | RESTRICT | CASCADE | `fk_locations_city` |
| 18 | `report_drafts.city_code` | `ph_cities.city_code` | SET NULL | CASCADE | `fk_report_drafts_city` |
| 19 | `user_activity_logs.session_record_id` | `user_sessions.session_record_id` | SET NULL | CASCADE | `fk_activity_session` |
| 20 | `audit_logs.actor_user_id` | `users.user_id` | SET NULL | CASCADE | `fk_audit_actor` |
| 21 | `auth_tokens.user_id` | `users.user_id` | CASCADE | CASCADE | `fk_auth_tokens_user` |
| 22 | `login_attempts.user_id` | `users.user_id` | CASCADE | CASCADE | `fk_attempts_user` |
| 23 | `match_claims.reviewed_by_user_id` | `users.user_id` | SET NULL | CASCADE | `fk_match_reviewed_by` |
| 24 | `match_claims.submitted_by_user_id` | `users.user_id` | SET NULL | CASCADE | `fk_match_submitted_by` |
| 25 | `moderation_cases.reported_by_user_id` | `users.user_id` | SET NULL | CASCADE | `fk_moderation_reporter` |
| 26 | `moderation_cases.resolved_by_admin_id` | `users.user_id` | SET NULL | CASCADE | `fk_moderation_admin` |
| 27 | `notifications.user_id` | `users.user_id` | CASCADE | CASCADE | `fk_notifications_user` |
| 28 | `pet_reports.assigned_staff_id` | `users.user_id` | SET NULL | CASCADE | `fk_reports_staff` |
| 29 | `pet_reports.user_id` | `users.user_id` | RESTRICT | CASCADE | `fk_reports_user` |
| 30 | `privacy_consents.user_id` | `users.user_id` | CASCADE | CASCADE | `fk_consent_user` |
| 31 | `publication_logs.actor_user_id` | `users.user_id` | SET NULL | CASCADE | `fk_publication_logs_actor` |
| 32 | `report_drafts.user_id` | `users.user_id` | CASCADE | CASCADE | `fk_report_drafts_user` |
| 33 | `status_logs.updated_by_user_id` | `users.user_id` | SET NULL | CASCADE | `fk_logs_user` |
| 34 | `user_activity_logs.user_id` | `users.user_id` | CASCADE | CASCADE | `fk_activity_user` |
| 35 | `user_sessions.user_id` | `users.user_id` | CASCADE | CASCADE | `fk_user_sessions_user` |

ON DELETE, counted: CASCADE 16, RESTRICT 6, SET NULL 13.

## 4. CHECK and UNIQUE constraints

| Table | CHECK | Clause (as MySQL 9.4 stores it) |
| --- | --- | --- |
| `match_claims` | `chk_match_distinct` | `` (`lost_report_id` <> `found_report_id`) `` |
| `match_claims` | `chk_match_score` | `` (`match_score` between 0 and 100) `` |
| `users` | `chk_users_admin_level` | `` (((`role` = 'admin') and (`admin_level` is not null)) or ((`role` <> 'admin') and (`admin_level` is null))) `` |

| Table | UNIQUE key | Columns |
| --- | --- | --- |
| `auth_rate_limits` | `uq_auth_rate_limits` | `action,subject_hash` |
| `auth_tokens` | `uq_auth_tokens_hash` | `token_hash` |
| `login_attempts` | `uq_attempts_email` | `email` |
| `match_claims` | `uq_match_pair` | `lost_report_id,found_report_id` |
| `match_signals` | `uq_signal_per_match` | `match_id,signal_key` |
| `pet_breeds` | `uq_breed_per_category` | `category_id,breed_name` |
| `pet_categories` | `uq_categories_code` | `category_code` |
| `pet_colours` | `uq_pet_colours_name` | `colour_name` |
| `ph_areas` | `uq_ph_areas_name` | `area_name` |
| `privacy_consents` | `uq_consent_user_version` | `user_id,notice_version` |
| `user_sessions` | `uq_user_sessions_reference` | `session_reference` |
| `users` | `uq_users_email` | `email` |

## 5. Every ENUM, with its values

These are the stored values. The interface shows translated labels; the database, the API and every request use exactly these.

| Table.column | Values | NULL? |
| --- | --- | --- |
| `audit_logs.action` | `login`, `login_failed`, `account_locked`, `account_unlocked`, `logout`, `register`, `role_changed`, `account_suspended`, `account_reinstated`, `report_status_changed`, `match_decided`, `moderation_resolved`, `category_changed`, `email_verified`, `email_change_completed`, `password_reset`, `report_reviewed`, `report_removed`, `admin_level_changed` | no |
| `audit_logs.target_type` | `user`, `report`, `match`, `category`, `moderation_case` | yes |
| `audit_logs.outcome` | `success`, `failure` | no |
| `auth_tokens.purpose` | `email_verification`, `password_reset`, `email_change` | no |
| `locations.precision` | `approximate`, `exact` | no |
| `match_claims.match_status` | `suggested`, `verification_requested`, `under_review`, `confirmed`, `rejected`, `dismissed` | no |
| `match_signals.signal_key` | `species`, `location`, `breed`, `color`, `size`, `date`, `characteristics` | no |
| `moderation_cases.reason` | `false_report`, `spam`, `scam`, `harassment`, `inappropriate`, `duplicate`, `other` | no |
| `moderation_cases.case_status` | `open`, `actioned`, `dismissed` | no |
| `notifications.notification_type` | `match_suggested`, `verification_requested`, `staff_reviewed`, `match_confirmed`, `match_rejected`, `report_updated`, `status_changed`, `pet_returned`, `report_flagged`, `report_submitted`, `report_published`, `report_rejected`, `report_removed` | no |
| `pet_reports.report_type` | `lost`, `found` | no |
| `pet_reports.status` | `active`, `possible_match`, `returned`, `closed` | no |
| `pet_reports.publication_status` | `pending_review`, `published`, `rejected`, `removed` | no |
| `pet_reports.pet_size` | `small`, `medium`, `large`, `xl` | yes |
| `pet_reports.pet_sex` | `male`, `female`, `unknown` | no |
| `pet_reports.has_collar` | `yes`, `no`, `unknown` | no |
| `ph_areas.area_type` | `province`, `ncr`, `special_area` | no |
| `publication_logs.previous_state` | `pending_review`, `published`, `rejected`, `removed` | yes |
| `publication_logs.new_state` | `pending_review`, `published`, `rejected`, `removed` | no |
| `report_drafts.report_type` | `lost`, `found` | no |
| `report_drafts.pet_size` | `small`, `medium`, `large`, `xl` | yes |
| `report_drafts.pet_sex` | `male`, `female`, `unknown` | yes |
| `report_drafts.has_collar` | `yes`, `no`, `unknown` | yes |
| `status_logs.previous_status` | `active`, `possible_match`, `returned`, `closed` | yes |
| `status_logs.new_status` | `active`, `possible_match`, `returned`, `closed` | no |
| `user_activity_logs.target_type` | `user`, `report`, `draft`, `match`, `moderation_case`, `notification`, `category` | yes |
| `user_sessions.end_reason` | `logout`, `idle_timeout`, `absolute_timeout`, `password_reset`, `new_privileged_login`, `role_promoted`, `account_locked`, `account_suspended`, `privilege_changed` | yes |
| `users.role` | `user`, `staff`, `admin` | no |
| `users.admin_level` | `moderator`, `manager`, `super_admin` | yes |
| `users.account_status` | `active`, `suspended`, `locked` | no |

## 6. Columns, table by table

Generated from `information_schema.COLUMNS` on the fresh MySQL 9.4 install. Key: PRI primary, UNI unique, MUL indexed (usually a foreign key).

### `users` (Domain — people)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `user_id` | `int unsigned` | no | PRI | auto_increment |
| `first_name` | `varchar(60)` | no |  |  |
| `last_name` | `varchar(60)` | no |  |  |
| `full_name` | `varchar(121)` | yes |  | generated: `` concat_ws(' ',nullif(`first_name`,''),nullif(`last_name`,'')) `` |
| `email` | `varchar(190)` | no | UNI |  |
| `email_verified_at` | `timestamp` | yes |  |  |
| `pending_email` | `varchar(190)` | yes |  |  |
| `password_hash` | `varchar(255)` | no |  |  |
| `contact_number` | `varchar(30)` | yes |  |  |
| `role` | `enum('user','staff','admin')` | no | MUL |  |
| `admin_level` | `enum('moderator','manager','super_admin')` | yes |  |  |
| `account_status` | `enum('active','suspended','locked')` | no |  |  |
| `session_version` | `int unsigned` | no |  |  |
| `preferred_location` | `varchar(120)` | yes |  |  |
| `notify_matches` | `tinyint(1)` | no |  |  |
| `notify_status` | `tinyint(1)` | no |  |  |
| `notify_staff` | `tinyint(1)` | no |  |  |
| `created_at` | `timestamp` | no |  |  |

### `locations` (Domain — reports)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `location_id` | `int unsigned` | no | PRI | auto_increment |
| `label` | `varchar(160)` | yes |  |  |
| `city` | `varchar(80)` | no | MUL |  |
| `province` | `varchar(80)` | no |  |  |
| `city_code` | `char(10)` | yes | MUL | FK → `ph_cities.city_code` |
| `latitude` | `decimal(9,6)` | yes |  |  |
| `longitude` | `decimal(9,6)` | yes |  |  |
| `precision` | `enum('approximate','exact')` | no |  |  |

### `pet_reports` (Domain — reports)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `report_id` | `int unsigned` | no | PRI | auto_increment |
| `user_id` | `int unsigned` | no | MUL | FK → `users.user_id` |
| `category_id` | `int unsigned` | no | MUL | FK → `pet_categories.category_id` |
| `breed_id` | `int unsigned` | yes | MUL | FK → `pet_breeds.breed_id` |
| `location_id` | `int unsigned` | no | MUL | FK → `locations.location_id` |
| `assigned_staff_id` | `int unsigned` | yes | MUL | FK → `users.user_id` |
| `report_type` | `enum('lost','found')` | no | MUL |  |
| `status` | `enum('active','possible_match','returned','closed')` | no |  |  |
| `publication_status` | `enum('pending_review','published','rejected','removed')` | no | MUL |  |
| `pet_name` | `varchar(80)` | yes |  |  |
| `pet_size` | `enum('small','medium','large','xl')` | yes |  |  |
| `pet_sex` | `enum('male','female','unknown')` | no |  |  |
| `primary_color` | `varchar(40)` | yes |  |  |
| `secondary_color` | `varchar(40)` | yes |  |  |
| `distinct_features` | `text` | yes |  |  |
| `description` | `text` | yes |  |  |
| `has_collar` | `enum('yes','no','unknown')` | no |  |  |
| `pet_condition` | `varchar(160)` | yes |  |  |
| `incident_date` | `date` | no | MUL |  |
| `incident_time` | `time` | yes |  |  |
| `allow_platform_contact` | `tinyint(1)` | no |  |  |
| `show_phone` | `tinyint(1)` | no |  |  |
| `show_email` | `tinyint(1)` | no |  |  |
| `created_at` | `timestamp` | no | MUL |  |
| `updated_at` | `timestamp` | no |  | on update current_timestamp |

### `report_drafts` (Domain — reports)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `draft_id` | `int unsigned` | no | PRI | auto_increment |
| `user_id` | `int unsigned` | no | MUL | FK → `users.user_id` |
| `report_type` | `enum('lost','found')` | no |  |  |
| `category_id` | `int unsigned` | yes | MUL | FK → `pet_categories.category_id` |
| `pet_name` | `varchar(80)` | yes |  |  |
| `breed` | `varchar(80)` | yes |  |  |
| `pet_size` | `enum('small','medium','large','xl')` | yes |  |  |
| `pet_sex` | `enum('male','female','unknown')` | yes |  |  |
| `primary_color` | `varchar(40)` | yes |  |  |
| `secondary_color` | `varchar(40)` | yes |  |  |
| `distinct_features` | `text` | yes |  |  |
| `description` | `text` | yes |  |  |
| `has_collar` | `enum('yes','no','unknown')` | yes |  |  |
| `pet_condition` | `varchar(160)` | yes |  |  |
| `incident_date` | `date` | yes |  |  |
| `incident_time` | `time` | yes |  |  |
| `location_label` | `varchar(160)` | yes |  |  |
| `area_code` | `char(10)` | yes | MUL | FK → `ph_areas.area_code` |
| `city_code` | `char(10)` | yes | MUL | FK → `ph_cities.city_code` |
| `latitude` | `decimal(9,6)` | yes |  |  |
| `longitude` | `decimal(9,6)` | yes |  |  |
| `allow_platform_contact` | `tinyint(1)` | no |  |  |
| `show_email` | `tinyint(1)` | no |  |  |
| `created_at` | `timestamp` | no |  |  |
| `updated_at` | `timestamp` | no |  | on update current_timestamp |

### `report_images` (Domain — reports)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `image_id` | `int unsigned` | no | PRI | auto_increment |
| `report_id` | `int unsigned` | no | MUL | FK → `pet_reports.report_id` |
| `image_path` | `varchar(255)` | no |  |  |
| `alt_text` | `varchar(180)` | yes |  |  |
| `is_primary_photo` | `tinyint(1)` | no |  |  |
| `uploaded_at` | `timestamp` | no |  |  |

### `match_claims` (Domain — matching)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `match_id` | `int unsigned` | no | PRI | auto_increment |
| `lost_report_id` | `int unsigned` | no | MUL | FK → `pet_reports.report_id` |
| `found_report_id` | `int unsigned` | no | MUL | FK → `pet_reports.report_id` |
| `submitted_by_user_id` | `int unsigned` | yes | MUL | FK → `users.user_id` |
| `reviewed_by_user_id` | `int unsigned` | yes | MUL | FK → `users.user_id` |
| `match_score` | `tinyint unsigned` | no |  |  |
| `match_status` | `enum('suggested','verification_requested','under_review',…` | no | MUL |  |
| `proof_notes` | `text` | yes |  |  |
| `staff_notes` | `text` | yes |  |  |
| `created_at` | `timestamp` | no |  |  |
| `updated_at` | `timestamp` | no |  | on update current_timestamp |

### `match_signals` (Domain — matching)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `signal_id` | `int unsigned` | no | PRI | auto_increment |
| `match_id` | `int unsigned` | no | MUL | FK → `match_claims.match_id` |
| `signal_key` | `enum('species','location','breed','color','size','date','…` | no |  |  |
| `is_matched` | `tinyint(1)` | no |  |  |
| `weight` | `tinyint unsigned` | no |  |  |
| `detail` | `varchar(255)` | yes |  |  |

### `publication_logs` (Domain — history)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `log_id` | `int unsigned` | no | PRI | auto_increment |
| `report_id` | `int unsigned` | no | MUL | FK → `pet_reports.report_id` |
| `actor_user_id` | `int unsigned` | yes | MUL | FK → `users.user_id` |
| `previous_state` | `enum('pending_review','published','rejected','removed')` | yes |  |  |
| `new_state` | `enum('pending_review','published','rejected','removed')` | no |  |  |
| `note` | `varchar(255)` | yes |  |  |
| `created_at` | `timestamp` | no |  |  |

### `status_logs` (Domain — history)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `log_id` | `int unsigned` | no | PRI | auto_increment |
| `report_id` | `int unsigned` | no | MUL | FK → `pet_reports.report_id` |
| `updated_by_user_id` | `int unsigned` | yes | MUL | FK → `users.user_id` |
| `previous_status` | `enum('active','possible_match','returned','closed')` | yes |  |  |
| `new_status` | `enum('active','possible_match','returned','closed')` | no |  |  |
| `note` | `varchar(255)` | yes |  |  |
| `created_at` | `timestamp` | no |  |  |

### `notifications` (Domain — communication)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `notification_id` | `int unsigned` | no | PRI | auto_increment |
| `user_id` | `int unsigned` | no | MUL | FK → `users.user_id` |
| `notification_type` | `enum('match_suggested','verification_requested','staff_re…` | no |  |  |
| `title` | `varchar(160)` | no |  |  |
| `body` | `varchar(255)` | yes |  |  |
| `report_id` | `int unsigned` | yes | MUL | FK → `pet_reports.report_id` |
| `match_id` | `int unsigned` | yes | MUL | FK → `match_claims.match_id` |
| `is_read` | `tinyint(1)` | no |  |  |
| `created_at` | `timestamp` | no |  |  |

### `moderation_cases` (Domain — moderation)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `case_id` | `int unsigned` | no | PRI | auto_increment |
| `report_id` | `int unsigned` | no | MUL | FK → `pet_reports.report_id` |
| `reported_by_user_id` | `int unsigned` | yes | MUL | FK → `users.user_id` |
| `reason` | `enum('false_report','spam','scam','harassment','inappropr…` | no |  |  |
| `details` | `text` | yes |  |  |
| `case_status` | `enum('open','actioned','dismissed')` | no | MUL |  |
| `resolved_by_admin_id` | `int unsigned` | yes | MUL | FK → `users.user_id` |
| `resolution_note` | `varchar(255)` | yes |  |  |
| `created_at` | `timestamp` | no |  |  |
| `resolved_at` | `timestamp` | yes |  |  |

### `pet_breeds` (Reference)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `breed_id` | `int unsigned` | no | PRI | auto_increment |
| `category_id` | `int unsigned` | no | MUL | FK → `pet_categories.category_id` |
| `breed_name` | `varchar(80)` | no |  |  |
| `is_listed` | `tinyint(1)` | no |  |  |

### `pet_categories` (Reference)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `category_id` | `int unsigned` | no | PRI | auto_increment |
| `category_code` | `varchar(30)` | no | UNI |  |
| `category_name` | `varchar(60)` | no |  |  |
| `is_active` | `tinyint(1)` | no |  |  |

### `pet_colours` (Reference)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `colour_code` | `varchar(20)` | no | PRI |  |
| `colour_name` | `varchar(30)` | no | UNI |  |
| `sort_order` | `smallint unsigned` | no |  |  |

### `ph_areas` (Reference)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `area_code` | `char(10)` | no | PRI |  |
| `area_name` | `varchar(80)` | no | UNI |  |
| `area_type` | `enum('province','ncr','special_area')` | no |  |  |

### `ph_cities` (Reference)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `city_code` | `char(10)` | no | PRI |  |
| `area_code` | `char(10)` | no | MUL | FK → `ph_areas.area_code` |
| `city_name` | `varchar(80)` | no |  |  |
| `is_city` | `tinyint(1)` | no |  |  |

### `audit_logs` (Security)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `audit_id` | `int unsigned` | no | PRI | auto_increment |
| `actor_user_id` | `int unsigned` | yes | MUL | FK → `users.user_id` |
| `actor_email` | `varchar(190)` | yes |  |  |
| `action` | `enum('login','login_failed','account_locked','account_unl…` | no | MUL |  |
| `target_type` | `enum('user','report','match','category','moderation_case')` | yes | MUL |  |
| `target_id` | `int unsigned` | yes |  |  |
| `outcome` | `enum('success','failure')` | no |  |  |
| `detail` | `varchar(255)` | yes |  |  |
| `ip_address` | `varchar(45)` | yes |  |  |
| `created_at` | `timestamp` | no | MUL |  |

### `auth_tokens` (Security)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `token_id` | `int unsigned` | no | PRI | auto_increment |
| `user_id` | `int unsigned` | no | MUL | FK → `users.user_id` |
| `purpose` | `enum('email_verification','password_reset','email_change')` | no |  |  |
| `token_hash` | `char(64)` | no | UNI |  |
| `target_email` | `varchar(190)` | yes |  |  |
| `expires_at` | `timestamp` | no | MUL |  |
| `used_at` | `timestamp` | yes |  |  |
| `created_at` | `timestamp` | no |  |  |

### `login_attempts` (Security)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `attempt_id` | `int unsigned` | no | PRI | auto_increment |
| `email` | `varchar(190)` | no | UNI |  |
| `user_id` | `int unsigned` | yes | MUL | FK → `users.user_id` |
| `failed_count` | `tinyint unsigned` | no |  |  |
| `first_failed_at` | `timestamp` | yes |  |  |
| `last_failed_at` | `timestamp` | yes |  |  |
| `locked_at` | `timestamp` | yes |  |  |

### `privacy_consents` (Security)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `consent_id` | `int unsigned` | no | PRI | auto_increment |
| `user_id` | `int unsigned` | no | MUL | FK → `users.user_id` |
| `notice_version` | `varchar(20)` | no |  |  |
| `consented_at` | `timestamp` | no |  |  |
| `ip_address` | `varchar(45)` | yes |  |  |

### `user_activity_logs` (Security)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `activity_id` | `int unsigned` | no | PRI | auto_increment |
| `user_id` | `int unsigned` | no | MUL | FK → `users.user_id` |
| `session_record_id` | `int unsigned` | yes | MUL | FK → `user_sessions.session_record_id` |
| `action` | `varchar(40)` | no | MUL |  |
| `route` | `varchar(200)` | yes |  |  |
| `target_type` | `enum('user','report','draft','match','moderation_case','n…` | yes |  |  |
| `target_id` | `int unsigned` | yes |  |  |
| `detail` | `varchar(120)` | yes |  |  |
| `ip_address` | `varchar(45)` | yes | MUL |  |
| `created_at` | `timestamp` | no | MUL |  |

### `user_sessions` (Security)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `session_record_id` | `int unsigned` | no | PRI | auto_increment |
| `session_reference` | `char(32)` | no | UNI |  |
| `user_id` | `int unsigned` | no | MUL | FK → `users.user_id` |
| `session_version` | `int unsigned` | no |  |  |
| `ip_address` | `varchar(45)` | yes | MUL |  |
| `user_agent` | `varchar(255)` | yes |  |  |
| `started_at` | `timestamp` | no | MUL |  |
| `last_seen_at` | `timestamp` | no |  |  |
| `ended_at` | `timestamp` | yes |  |  |
| `end_reason` | `enum('logout','idle_timeout','absolute_timeout','password…` | yes |  |  |

### `auth_rate_limits` (Infrastructure)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `rate_limit_id` | `int unsigned` | no | PRI | auto_increment |
| `action` | `varchar(40)` | no | MUL |  |
| `subject_hash` | `char(64)` | no |  |  |
| `window_started_at` | `timestamp` | no | MUL |  |
| `attempt_count` | `smallint unsigned` | no |  |  |
| `updated_at` | `timestamp` | no |  | on update current_timestamp |

### `schema_migrations` (Infrastructure)

| Column | Type | NULL | Key | Notes |
| --- | --- | --- | --- | --- |
| `version` | `varchar(20)` | no | PRI |  |
| `applied_at` | `timestamp` | no |  |  |


## 7. Which migration made what

The **base schema** (the proposal-era design, before any migration) is the 11
core tables: `users`, `pet_categories`, `pet_breeds`, `pet_reports`,
`locations`, `report_images`, `match_claims`, `match_signals`, `status_logs`,
`notifications`, `moderation_cases`. Every later change is a numbered,
additive migration, mirrored into `schema.sql`.

| Migration | Creates | Changes |
| --- | --- | --- |
| `001_login_lockout` | `login_attempts`, `schema_migrations` | `users.account_status` gains `locked` |
| `002_audit_logs` | `audit_logs` | |
| `003_privacy_consent` | `privacy_consents` | |
| `004_audit_actions` | | `audit_logs.action` values |
| `005_account_lifecycle` | `auth_tokens`, `auth_rate_limits` | `users.email_verified_at`, `pending_email`, `session_version`; `audit_logs.action` values |
| `006_token_expiry_explicit` | | `auth_tokens.expires_at` given an explicit definition, so an UPDATE no longer silently resets it to now |
| `007_match_fk_mysql8` | | `match_claims` foreign keys `fk_match_lost` / `fk_match_found` re-created without ON UPDATE CASCADE, so `chk_match_distinct` is allowed beside them on MySQL 8+ |
| `008_split_user_names` | | `users.first_name`, `last_name`; `full_name` becomes a generated column |
| `009_report_reference_data` | `pet_colours`, `ph_areas`, `ph_cities` | `locations.city_code` (FK), `pet_breeds.is_listed`, `pet_reports.pet_size` gains `xl` |
| `010_report_publication_workflow` | `publication_logs`, `report_drafts` | `pet_reports.publication_status`; `notifications.notification_type` and `audit_logs.action` values; legacy removals converted to `removed` |
| `011_session_activity_logging` | `user_sessions`, `user_activity_logs` | |
| `012_admin_privilege_levels` | | `users.admin_level` + `chk_users_admin_level`; `user_sessions.end_reason` gains `privilege_changed`; `audit_logs.action` gains `admin_level_changed`; existing administrators become `super_admin` |

**Correction 7 added no migration.** Production has 001→007 (per `CURRENT_STATE.md`; not re-read here); deployment runs
008→012, in order, after a backup (`CURRENT_STATE.md` §4a,
`PRODUCTION_RUNBOOK.md` §2).

## 8. Role hierarchy (as enforced)

```text
guest ── browse published reports (public summary), register, sign in
  │
user (Customer) ── file reports (they wait for review), drafts, own reports,
  │                own pairings: "this could be mine" / "not my pet", flag a listing
  │
staff (Pet Coordinator) ── approve / not approve a pending report (the only role that may),
  │                         confirm / reject / reopen / question a pairing, case queues
  │
admin, by users.admin_level:
    moderator   ── moderate_reports
    manager     ── + manage_accounts, manage_reference_data
    super_admin ── + manage_admins, view_security_logs
```

- `users.role` ENUM `user`, `staff`, `admin`; `users.admin_level` ENUM
  `moderator`, `manager`, `super_admin`, **non-NULL exactly when the role is
  `admin`** — enforced by the database (`chk_users_admin_level`), not only the
  code.
- Capabilities are one table, `ADMIN_CAPABILITIES` (`api/helpers.php`);
  endpoints call `require_capability()`; `/auth/me` sends the list to the
  interface, which only decides what to show.
- Staff is **outside** the administrator hierarchy: no administrator level
  reviews reports before publication (Correction 6A), and staff have no
  administrator capability.
- One session at a time for `staff` and `admin` (`PRIVILEGED_ROLES`).
- Full matrix: `docs/role-permissions.md`.

## 9. Publication lifecycle (`pet_reports.publication_status`)

```text
            file report
                │
                ▼
         pending_review ──approve (staff)──▶ published ──remove (admin, reason)──▶ removed
            ▲      │                            │
 resubmit   │      └──reject (staff, reason)──▶ rejected
 (owner)    └───────────────────────────────────┘
```

| Action | From | To | Who | Reason required |
| --- | --- | --- | --- | --- |
| `approve` | `pending_review` | `published` | staff only | no |
| `reject` | `pending_review` | `rejected` | staff only | yes |
| `resubmit` | `rejected` | `pending_review` | the report's owner | no |
| `remove` | `published` | `removed` | administrator (moderation) | yes |

Source: `PUBLICATION_ACTIONS` in `api/reports.php`. Every move is a
`publication_logs` row (from, to, actor, note). Only `published` reports are
public, listed, searchable, flaggable or matched; matching runs at
publication. `removed` is never `closed`. **Cancel is not here** (§1.2).

## 10. Case lifecycle (`pet_reports.status`) and pairings (`match_claims.match_status`)

```text
active ──a possible match is suggested (matching)──▶ possible_match
  ▲                                                    │
  └──no open pairing left (dismissed / rejected)───────┘
active / possible_match ──owner or coordinator──▶ returned ──▶ closed
active / possible_match ─────────────────────────────────────▶ closed   (terminal)
a confirmed pairing ──▶ both reports returned, in one transaction
```

- Allowed manual moves: `REPORT_TRANSITIONS` (`api/reports.php`) —
  `active`/`possible_match` → `returned` or `closed`; `returned` → `closed`;
  `closed` → nothing. `possible_match` is set and cleared only by the server.
- Every change is a `status_logs` row; history is appended, never overwritten.
- Pairings: `suggested` → `verification_requested` (a reporter: "this could
  be mine") → `under_review` (a coordinator asks for information) →
  `confirmed` or `rejected` (coordinator); `dismissed` by a reporter ("not my
  pet") or automatically when one of its reports is returned or closed
  (withdrawal). A coordinator may **reopen** a confirmed, rejected or
  reporter-dismissed pairing (back to `under_review`, reason required), never a
  withdrawal, and not if re-scoring gives different signals. Source:
  `MATCH_ACTIONS`, `match_decide()`, `match_reopen()` in `api/matches.php`.
- A pairing's score and seven reasons (`match_signals`) are written once, when
  it is made, and never recalculated.

## 11. What the final ERD must show

All **22 business tables** (§2 minus `schema_migrations` and
`auth_rate_limits`), their primary keys, every column, and the **35
relationships** in §3 with the cardinalities `scripts/erd.py` derives from
nullability. Group them as §2 does — domain, reference, security — so the
security tables (sessions, activity, audit, consents, tokens, attempts) read as
the accountability layer rather than as clutter. Note on the page: the two
operational tables omitted; `full_name` generated; `admin_level` tied to
`role` by a CHECK; and the decision taken on `assigned_staff_id` (§1.2).

## 12. Reproducing this audit

```bash
# MySQL 9.4, fresh (Docker)
docker run -d --name pfa-db -e MYSQL_ROOT_PASSWORD=localonly -e MYSQL_DATABASE=railway mysql:9.4
docker exec -i pfa-db mysql -uroot -plocalonly --default-character-set=utf8mb4 railway < database/railway/schema.sql
docker exec -i pfa-db mysql -uroot -plocalonly --default-character-set=utf8mb4 railway < database/railway/seed.sql
# then query information_schema (TABLES, COLUMNS, KEY_COLUMN_USAGE,
# REFERENTIAL_CONSTRAINTS, TABLE_CONSTRAINTS, CHECK_CONSTRAINTS, STATISTICS)
```

On the local MariaDB 10.4, query those views **one at a time**: a join of
`KEY_COLUMN_USAGE` with `REFERENTIAL_CONSTRAINTS` (or of `TABLE_CONSTRAINTS`
with `CHECK_CONSTRAINTS`) crashed `mysqld` once during this audit (an assertion,
exception 0x80000003; no data affected — every table counted afterwards, and
the same views queried separately work).
