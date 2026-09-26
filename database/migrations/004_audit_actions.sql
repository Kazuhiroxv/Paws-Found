-- =============================================================================
-- 004 — the rest of the audit vocabulary
--
-- 002 created `audit_logs` with the account events: signing in, failing to
-- sign in, locking, unlocking, suspending, reinstating, changing a role. That
-- covered "what happened to this account".
--
-- It does not answer "who changed this case", which is the question actually
-- asked about a report that closed, a match that was confirmed, a flag that
-- was resolved, or a species that disappeared from the dropdown. Each of those
-- already records a person on its own row — `status_logs.changed_by_user_id`,
-- `match_claims.reviewed_by_user_id`, `moderation_cases.resolved_by_admin_id`
-- — but those are four separate places, in four different shapes, and none of
-- them can be read in one line of time order.
--
-- So the four verbs below join the ENUM. `target_type` needs nothing: 002
-- already allowed 'report', 'match', 'category' and 'moderation_case', which
-- is what this migration finally uses.
--
-- Additive. No existing row changes, and no existing value is removed, so an
-- audit log written before this migration still reads exactly as it did.
--
-- Run against an existing database:
--   mysql -u root -h 127.0.0.1 -P 3307 pawsandfound < 004_audit_actions.sql
-- =============================================================================

USE pawsandfound;

ALTER TABLE audit_logs
  MODIFY COLUMN action ENUM(
    -- 002, unchanged and in the same order, so the stored integers behind the
    -- ENUM keep pointing at the same words. Reordering these would silently
    -- rewrite every row in the table.
    'login',
    'login_failed',
    'account_locked',
    'account_unlocked',
    'logout',
    'register',
    'role_changed',
    'account_suspended',
    'account_reinstated',

    -- New in 004. The specific action taken is written into `detail`, which is
    -- a sentence meant for a person to read: "confirm: possible_match ->
    -- confirmed". Four verbs rather than fourteen, so the list stays short
    -- enough to be read aloud during the defence.
    'report_status_changed',
    'match_decided',
    'moderation_resolved',
    'category_changed'
  ) NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('004')
  ON DUPLICATE KEY UPDATE version = version;
