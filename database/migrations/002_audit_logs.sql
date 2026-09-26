-- =============================================================================
-- 002 — the audit log
--
-- `status_logs` already records what happened to a REPORT. Nothing recorded
-- what happened to an ACCOUNT: who signed in, who failed to, who was locked
-- out, who unlocked them, who changed somebody's role, who suspended whom.
--
-- One row per event, written at the moment the event succeeds. Never updated,
-- never deleted — an audit trail that can be edited is not one.
--
-- Run against an existing database:
--   mysql -u root -h 127.0.0.1 -P 3307 pawsandfound < 002_audit_logs.sql
-- =============================================================================

USE pawsandfound;

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Who did it. NULL for a failed sign-in, where there may be no account at
  -- all — which is exactly why `actor_email` exists beside it.
  actor_user_id INT UNSIGNED     NULL,
  actor_email   VARCHAR(190)     NULL,

  action        ENUM('login','login_failed','account_locked','account_unlocked',
                     'logout','register','role_changed','account_suspended',
                     'account_reinstated') NOT NULL,

  -- What it was done to. Only 'user' is written today; the column is an ENUM
  -- so that adding 'report' or 'match' later is a migration rather than a
  -- free-text free-for-all.
  target_type   ENUM('user','report','match','category','moderation_case') NULL,
  target_id     INT UNSIGNED     NULL,

  outcome       ENUM('success','failure') NOT NULL DEFAULT 'success',

  -- A short sentence in plain language: "user -> admin", "3 failed attempts".
  -- Never a password, never a token, never a session id.
  detail        VARCHAR(255)     NULL,

  -- 45 characters because an IPv6 address needs them.
  ip_address    VARCHAR(45)      NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (audit_id),

  -- SET NULL, not CASCADE: deleting an account must not delete the record of
  -- what that account did. The email stays, so the row still means something.
  CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  KEY idx_audit_created (created_at),
  KEY idx_audit_action (action, created_at),
  KEY idx_audit_target (target_type, target_id),
  KEY idx_audit_actor (actor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


INSERT INTO schema_migrations (version) VALUES ('002')
  ON DUPLICATE KEY UPDATE version = version;
