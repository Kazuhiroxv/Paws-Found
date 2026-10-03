-- =============================================================================
-- 012 — administrator privilege levels
--
-- Instructor correction after the 2 October defense (Correction 6): "Different
-- admin levels of privileges". She did not say how many levels or what each
-- may do. The three below are the TEAM's design, not her specification.
--
--   users.role         user | staff | admin          (unchanged)
--   users.admin_level  moderator | manager | super_admin, for role = admin
--                      only; NULL for everybody else
--
-- A level refines what an Administrator may do; it is not a fourth role. Pet
-- Coordinators stay role = staff, outside the hierarchy. What each level may
-- do is ADMIN_CAPABILITIES in api/helpers.php, and docs/role-permissions.md.
--
-- LEGACY ADMINISTRATORS. Every account that is an administrator before this
-- migration becomes 'super_admin': the previous system had one unrestricted
-- administrator role, and that keeps exactly the access they already had. No
-- history is invented; nothing records them as having been "promoted".
--
-- THE RULE, IN THE DATABASE. chk_users_admin_level: an administrator has a
-- level and nobody else does. A role change and its level are therefore one
-- UPDATE, and an inconsistent pair cannot be stored however it is written.
--
-- ALSO
--   user_sessions.end_reason  + privilege_changed (a level changed, or the
--                               administrator role was removed)
--   audit_logs.action         + admin_level_changed
--
-- No table and no foreign key is added: 24 tables, 35 foreign keys, as after 011.
--
-- DEPLOYMENT: after 011, WITH the code. Old code ignores admin_level, and the
-- CHECK would refuse its role changes to and from admin (it does not set a
-- level) — so the two ship together.
--
-- Safe to run twice. Run with the character-set flag:
--   mysql -u root -h 127.0.0.1 -P 3307 --default-character-set=utf8mb4 pawsandfound < 012_admin_privilege_levels.sql
-- =============================================================================

USE pawsandfound;
SET NAMES utf8mb4;

-- users.admin_level, beside the role it refines.
SET @missing := (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
                    AND COLUMN_NAME = 'admin_level');
SET @sql := IF(@missing,
  'ALTER TABLE users ADD COLUMN admin_level ENUM(''moderator'',''manager'',''super_admin'') NULL DEFAULT NULL AFTER role',
  'DO 0');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

-- Existing administrators keep everything they had.
UPDATE users SET admin_level = 'super_admin' WHERE role = 'admin' AND admin_level IS NULL;
UPDATE users SET admin_level = NULL WHERE role <> 'admin' AND admin_level IS NOT NULL;

-- An administrator has a level; nobody else has one.
SET @missing := (SELECT COUNT(*) = 0 FROM information_schema.TABLE_CONSTRAINTS
                  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
                    AND CONSTRAINT_NAME = 'chk_users_admin_level');
SET @sql := IF(@missing,
  'ALTER TABLE users ADD CONSTRAINT chk_users_admin_level CHECK ((role = ''admin'' AND admin_level IS NOT NULL) OR (role <> ''admin'' AND admin_level IS NULL))',
  'DO 0');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

ALTER TABLE user_sessions
  MODIFY end_reason ENUM('logout','idle_timeout','absolute_timeout','password_reset',
                         'new_privileged_login','role_promoted',
                         'account_locked','account_suspended',
                         'privilege_changed') NULL;

ALTER TABLE audit_logs
  MODIFY action ENUM('login','login_failed','account_locked','account_unlocked',
                     'logout','register','role_changed','account_suspended',
                     'account_reinstated',
                     'report_status_changed','match_decided',
                     'moderation_resolved','category_changed',
                     'email_verified','email_change_completed',
                     'password_reset',
                     'report_reviewed','report_removed',
                     'admin_level_changed') NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('012')
  ON DUPLICATE KEY UPDATE version = version;
