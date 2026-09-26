-- =============================================================================
-- 001 — account lock state and the failed-attempt counter
--
-- Three failed sign-in attempts lock an account until an administrator
-- unlocks it. Two things are needed for that, and they are deliberately kept
-- apart:
--
--   * the COUNTER lives in `login_attempts`, keyed by the email address that
--     was typed — not by the account. An address that belongs to no account is
--     counted exactly the same way, which is what lets the system say "one
--     attempt left" to everybody without that sentence revealing which
--     addresses are registered.
--
--   * the STATE lives on the account, as a third value of `account_status`. It
--     is a property of the account, the administrator sees it in the Users
--     table beside Active and Suspended, and `current_user()` already refuses
--     anything that is not active.
--
-- Run against an existing database:
--   mysql -u root -h 127.0.0.1 -P 3307 pawsandfound < 001_login_lockout.sql
-- =============================================================================

USE pawsandfound;

-- Which migrations this database has had. Infrastructure, not a domain table:
-- it is not on the ERD.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(20) NOT NULL,
  applied_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- A third account state.
--
-- 'locked' is not 'suspended'. Suspended is a decision an administrator made
-- about a person; locked is something that happened to an account because
-- somebody failed to sign in to it three times. They are unlocked the same way
-- — an administrator sets the account back to active — but the reason matters,
-- and the Users table says which one it is.
-- -----------------------------------------------------------------------------
ALTER TABLE users
  MODIFY COLUMN account_status ENUM('active','suspended','locked')
    NOT NULL DEFAULT 'active';


-- -----------------------------------------------------------------------------
-- The counter.
--
-- Keyed by the address typed, so an unknown address is counted like a real one.
-- `user_id` is filled in when the address does belong to an account, which is
-- what lets an administrator unlock by account rather than by string.
--
-- The column collation is case-insensitive (utf8mb4_unicode_ci, inherited from
-- the table), so MARIA@example.com and maria@example.com are one row and not
-- two — otherwise changing the capitalisation would reset the counter.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email          VARCHAR(190) NOT NULL,
  user_id        INT UNSIGNED     NULL,   -- NULL when no account uses that address
  failed_count   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  first_failed_at TIMESTAMP       NULL,
  last_failed_at TIMESTAMP        NULL,
  locked_at      TIMESTAMP        NULL,   -- when the third failure happened

  PRIMARY KEY (attempt_id),
  UNIQUE KEY uq_attempts_email (email),

  -- Deleting an account takes its counter with it; the row is meaningless
  -- without the address it belongs to.
  CONSTRAINT fk_attempts_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  KEY idx_attempts_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


INSERT INTO schema_migrations (version) VALUES ('001')
  ON DUPLICATE KEY UPDATE version = version;
