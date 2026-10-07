-- =============================================================================
-- 013 — remove pet_reports.assigned_staff_id, which nothing uses
--
-- Schema reconciliation before the final freeze (6 October 2026), from the
-- pre-freeze audit (docs/final-schema-audit.md §1.2). The column came from the
-- proposal design ("the coordinator handling the case"), with a foreign key to
-- users. The system that was built never assigns a coordinator to a report:
--
--   production   0 of 48 reports set it (read-only query, 6 October 2026)
--   local        0 of 32 reports
--   api/, src/   no reference
--   tests, seed  no reference
--
-- So the column and its foreign key go, and the ERD shows what was built.
--
-- REMOVED
--   pet_reports.fk_reports_staff   FOREIGN KEY (assigned_staff_id) -> users
--   pet_reports.assigned_staff_id  INT UNSIGNED NULL
--   (and the index InnoDB made for that key, named fk_reports_staff, which
--   goes with the column)
--
-- 24 tables, 34 foreign keys, 3 CHECK constraints after this migration
-- (35 foreign keys before).
--
-- IT REFUSES TO DISCARD DATA. If any report has assigned_staff_id set, the
-- migration stops with an error before changing anything:
--
--   ERROR 1054 (42S22): Unknown column '013 REFUSED: pet_reports.assigned_staff_id
--   is set on some reports - nothing was changed' in 'field list'
--
-- (MySQL does not allow SIGNAL in a prepared statement, so the refusal is a
-- deliberately unknown column whose name says why.) Find out what those rows
-- mean before going further; do not clear them to make the migration pass.
--
-- PREVIEW, read-only, before running it:
--
--   SELECT COUNT(*) AS total_reports,
--          SUM(assigned_staff_id IS NOT NULL) AS assigned_reports
--     FROM pet_reports;
--
--   SELECT report_id, assigned_staff_id
--     FROM pet_reports
--    WHERE assigned_staff_id IS NOT NULL
--    ORDER BY report_id;
--
-- assigned_reports must be 0 and the second query must return no rows.
--
-- DEPLOYMENT: after 012. No code reads or writes the column, so the code does
-- not care whether 013 has run; it ships with the rest for the ERD's sake.
--
-- Safe to run twice. Run with the character-set flag:
--   mysql -u root -h 127.0.0.1 -P 3307 --default-character-set=utf8mb4 pawsandfound < 013_remove_unused_staff_assignment.sql
-- =============================================================================

USE pawsandfound;
SET NAMES utf8mb4;

-- Is the column still there? (On a second run it is not, and there is nothing
-- to count.)
SET @has_column := (SELECT COUNT(*) FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pet_reports'
                       AND COLUMN_NAME = 'assigned_staff_id');
SET @assigned := 0;
SET @sql := IF(@has_column,
  'SELECT COUNT(*) INTO @assigned FROM pet_reports WHERE assigned_staff_id IS NOT NULL',
  'DO 0');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

-- Refuse, before anything changes, if any report has an assignment.
SET @sql := IF(@assigned > 0,
  'SELECT `013 REFUSED: pet_reports.assigned_staff_id is set on some reports - nothing was changed`',
  'DO 0');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

-- The foreign key first: a column a foreign key uses cannot be dropped.
SET @has_key := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'pet_reports'
                    AND CONSTRAINT_NAME = 'fk_reports_staff' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@has_key, 'ALTER TABLE pet_reports DROP FOREIGN KEY fk_reports_staff', 'DO 0');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

-- Then the column; the index InnoDB made for the key goes with it.
SET @sql := IF(@has_column, 'ALTER TABLE pet_reports DROP COLUMN assigned_staff_id', 'DO 0');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

INSERT INTO schema_migrations (version) VALUES ('013')
  ON DUPLICATE KEY UPDATE version = version;
