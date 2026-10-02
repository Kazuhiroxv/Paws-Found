-- =============================================================================
-- 008 — first name and last name, instead of one full name
--
-- Instructor correction after the 2 October defense: registration and the
-- profile ask for First Name and Last Name separately, and a password may not
-- contain either of them. Both need the parts stored as parts — a rule about
-- "the last name" cannot be checked against one string that only a person can
-- divide correctly.
--
-- END STATE
--
--   first_name   VARCHAR(60)  NOT NULL   authoritative, written by the API
--   last_name    VARCHAR(60)  NOT NULL   authoritative, written by the API
--   full_name    generated — CONCAT_WS of the two, STORED, never written
--
-- full_name is kept, as a generated column, on purpose. Some twenty queries and
-- every screen read it, and a generated column means none of them change. It
-- also cannot drift: its value is always computed from the two parts, so there
-- is no way to end up with three fields saying three different things.
--
-- What happens to a write that tries to set it depends on the SQL mode, and
-- the two environments differ. Production's MySQL 9.4 is strict by default and
-- REFUSES it (error 1906). XAMPP's MariaDB runs non-strict, and IGNORES the
-- value with only a warning. The stored name is right either way; but locally a
-- missed writer is silent, which is why the writers were found by search
-- (registration and the profile, nothing else) rather than trusted to fail.
--
-- BACKFILL
--
-- Existing rows have only full_name. They are split by these rules, in order:
--
--   1. One word ("Cher")             -> first "Cher", last ''.
--   2. Otherwise the last word is the last name ("Maria Santos").
--   3. A last name that starts with a particle keeps it: if the word before
--      the last is de, del, dela, delos, delas, san, santa, santo, sta., sto.,
--      van, von, da, di, du, le, la, los or las, and a first name is still
--      left over, the last name takes two words ("Jomar Dela Cruz" ->
--      "Jomar" / "Dela Cruz"; "Ana De Leon" -> "Ana" / "De Leon").
--   4. "de la", "de los", "de las" take three ("Juan de la Cruz" ->
--      "Juan" / "de la Cruz").
--
-- A one-word name keeps an empty last name rather than an invented one; the
-- generated full_name skips it, so the name reads as it did. New accounts
-- cannot be created that way — the API requires both.
--
-- The rules cannot be right for every name ever typed. Preview what they will
-- do to a database BEFORE running this migration on it:
--
--   SELECT user_id, full_name,
--          SUBSTRING_INDEX(full_name, ' ', -1) AS default_last
--     FROM users ORDER BY user_id;
--
-- and correct any row by hand afterwards with an UPDATE of first_name and
-- last_name (full_name follows by itself).
--
-- Run against an existing database:
--   mysql -u root -h 127.0.0.1 -P 3307 pawsandfound < 008_split_user_names.sql
-- =============================================================================

USE pawsandfound;

ALTER TABLE users
  ADD COLUMN first_name VARCHAR(60) NOT NULL DEFAULT '' AFTER user_id,
  ADD COLUMN last_name  VARCHAR(60) NOT NULL DEFAULT '' AFTER first_name;

-- 1 and 2: one word is a first name; otherwise the last word is the last name.
UPDATE users
   SET first_name = CASE WHEN full_name NOT LIKE '% %' THEN full_name
                         ELSE TRIM(LEFT(full_name, CHAR_LENGTH(full_name)
                                   - CHAR_LENGTH(SUBSTRING_INDEX(full_name, ' ', -1)))) END,
       last_name  = CASE WHEN full_name NOT LIKE '% %' THEN ''
                         ELSE SUBSTRING_INDEX(full_name, ' ', -1) END;

-- 3: a particle before the last word belongs to the last name.
UPDATE users
   SET last_name  = SUBSTRING_INDEX(full_name, ' ', -2),
       first_name = TRIM(LEFT(full_name, CHAR_LENGTH(full_name)
                         - CHAR_LENGTH(SUBSTRING_INDEX(full_name, ' ', -2))))
 WHERE first_name LIKE '% %'
   AND LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(full_name, ' ', -2), ' ', 1))
       IN ('de', 'del', 'dela', 'delos', 'delas', 'san', 'santa', 'santo', 'sta.',
           'sto.', 'van', 'von', 'da', 'di', 'du', 'le', 'la', 'los', 'las');

-- 4: "de la", "de los", "de las".
UPDATE users
   SET last_name  = SUBSTRING_INDEX(full_name, ' ', -3),
       first_name = TRIM(LEFT(full_name, CHAR_LENGTH(full_name)
                         - CHAR_LENGTH(SUBSTRING_INDEX(full_name, ' ', -3))))
 WHERE first_name LIKE '% %'
   AND LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(full_name, ' ', -3), ' ', 1)) = 'de'
   AND LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(full_name, ' ', -2), ' ', 1)) IN ('la', 'los', 'las');

-- The parts are now authoritative; the default existed only for the backfill.
ALTER TABLE users
  MODIFY first_name VARCHAR(60) NOT NULL,
  MODIFY last_name  VARCHAR(60) NOT NULL;

-- full_name becomes derived. Dropped and re-added rather than altered, because
-- a column cannot be turned into a generated one in place on every engine.
ALTER TABLE users DROP COLUMN full_name;
ALTER TABLE users
  ADD COLUMN full_name VARCHAR(121)
      AS (CONCAT_WS(' ', NULLIF(first_name, ''), NULLIF(last_name, ''))) STORED
      AFTER last_name;


INSERT INTO schema_migrations (version) VALUES ('008')
  ON DUPLICATE KEY UPDATE version = version;
