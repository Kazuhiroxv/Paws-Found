---
paths:
  - "database/**"
  - "scripts/gen-seed.mjs"
---

# Database rules (database/)

- Course requirement: MySQL with properly related tables (minimum 8), PK/FK constraints,
  normalisation, CRUD, and SQL queries.
- The ERD has 15 tables; the built schema has 24 as of migration 012. Count tables from
  `information_schema` on the running database, not from the file.
- Local MariaDB 10.4 (XAMPP) runs on **port 3307**, not 3306; a separate MySQL 8.0 Windows
  service holds 3306.
- Changes to an existing database go in `database/migrations/` as numbered, additive files,
  mirrored back into `schema.sql` so a fresh import and a migrated database stay identical
  (`npm run test:migrations` checks parity). See `database/migrations/README.md`.
- Seeding and reseeding are local only. The production database is read-only (CLAUDE.md §1).
