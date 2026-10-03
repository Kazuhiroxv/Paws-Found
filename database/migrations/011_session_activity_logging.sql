-- =============================================================================
-- 011 — session records and the activity trail
--
-- Instructor correction after the 2 October defense (Correction 5): "session
-- tables ip address should be shown in logs to determine/identify malicious
-- activities", and "log that detects a user or account where they went like
-- every page, what they did, what time, when they log in, when they signout".
--
-- FIVE LOGS, FIVE QUESTIONS
--
--   user_sessions        which signed-in session was this: account, IP,
--                        browser, when it started, was last seen, ended, why
--   user_activity_logs   where did a signed-in person go, and what did they do
--   audit_logs           what security or administrative event happened
--                        (unchanged: sign-ins, failures, locks, role changes)
--   status_logs          how did a pet case's status change (unchanged)
--   publication_logs     how did a report's review state change (unchanged)
--
-- NEVER STORED. Not the PHP session id: user_sessions.session_reference is a
-- separate random value, safe to show an administrator and useless for signing
-- in. No password, hash, token, cookie, CSRF token or request body anywhere.
-- A page view stores the path only, never a query string.
--
-- NOTHING INVENTED. Both tables start empty: no session or activity is made up
-- for anything that happened before this migration. audit_logs is untouched.
--
-- DEPLOYMENT: after 008, 009 and 010, with the code. Old code ignores these
-- tables; new code without them signs in but records nothing (both writers
-- catch their own failure, like audit_log()).
--
-- Safe to run twice. Run with the character-set flag:
--   mysql -u root -h 127.0.0.1 -P 3307 --default-character-set=utf8mb4 pawsandfound < 011_session_activity_logging.sql
-- =============================================================================

USE pawsandfound;
SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- user_sessions — one row per successful sign-in
--
-- Written at sign-in (api/auth.php), touched at most every five minutes while
-- the session is used (last_seen_at), and closed with a reason when the server
-- ends it. A session whose browser simply never came back has no end written:
-- it is shown as "expired" once the session lifetime has passed, never as open.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
  session_record_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_reference CHAR(32)     NOT NULL,   -- random; NOT the PHP session id
  user_id           INT UNSIGNED NOT NULL,
  session_version   INT UNSIGNED NOT NULL,   -- users.session_version it was issued under
  ip_address        VARCHAR(45)      NULL,   -- 45 characters, because IPv6
  user_agent        VARCHAR(255)     NULL,   -- the browser's own description of itself
  started_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at          TIMESTAMP        NULL,
  end_reason        ENUM('logout','idle_timeout','absolute_timeout','password_reset',
                         'new_privileged_login','role_promoted',
                         'account_locked','account_suspended') NULL,

  PRIMARY KEY (session_record_id),
  UNIQUE KEY uq_user_sessions_reference (session_reference),
  KEY idx_user_sessions_user (user_id, started_at),
  KEY idx_user_sessions_started (started_at),
  KEY idx_user_sessions_ip (ip_address, started_at),
  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- user_activity_logs — where a signed-in person went and what they did
--
-- 'page_view' rows come from the browser (the path only; the server adds who,
-- which session, the IP and the time). Every other action is written by the
-- PHP endpoint that did it, from a fixed list (ACTIVITY_ACTIONS in
-- api/helpers.php) — the browser cannot name an action.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_activity_logs (
  activity_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED NOT NULL,
  session_record_id INT UNSIGNED     NULL,   -- NULL for a session from before 011
  action            VARCHAR(40)  NOT NULL,   -- 'page_view', 'report_submitted', ...
  route             VARCHAR(200)     NULL,   -- page views: '/pet/43', never a query string
  target_type       ENUM('user','report','draft','match','moderation_case',
                         'notification','category') NULL,
  target_id         INT UNSIGNED     NULL,
  detail            VARCHAR(120)     NULL,   -- a short server-written note, e.g. 'approved'
  ip_address        VARCHAR(45)      NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (activity_id),
  KEY idx_activity_created (created_at),
  KEY idx_activity_user (user_id, created_at),
  KEY idx_activity_session (session_record_id),
  KEY idx_activity_action (action, created_at),
  KEY idx_activity_ip (ip_address, created_at),
  CONSTRAINT fk_activity_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_activity_session
    FOREIGN KEY (session_record_id) REFERENCES user_sessions (session_record_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('011')
  ON DUPLICATE KEY UPDATE version = version;
