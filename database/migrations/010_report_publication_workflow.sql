-- =============================================================================
-- 010 — reviewed publication, report drafts, and Removed apart from Closed
--
-- Instructor correction after the 2 October defense (Correction 4): "pet
-- coordinator muna sa reports bago mapost" — a Pet Coordinator reviews a
-- report before it is published. Also: a report can be saved as a draft, and
-- a report removed by moderation must not appear as Closed.
--
-- TWO DIMENSIONS, KEPT APART
--
--   publication_status   may the public see it?   pending_review -> published
--                                                  pending_review -> rejected
--                                                  rejected -> pending_review (resubmitted)
--                                                  published -> removed
--   status               where is the case?        active -> possible_match ->
--                        (unchanged)               returned / closed
--
-- So a report can be published AND possible_match, or removed AND active.
-- "Closed" keeps its one meaning: the case ended normally.
--
-- END STATE
--
--   pet_reports.publication_status  ENUM, NOT NULL. Every report that exists
--                     before this migration is 'published' (they were all
--                     public) — except one removed by moderation, which
--                     becomes 'removed' (below). New reports default to
--                     'pending_review', so nothing can be published by
--                     leaving the column out.
--   publication_logs  who changed a report's publication state, when, why.
--                     The publication counterpart of status_logs.
--   report_drafts     unfinished reports. Their own table, because a draft
--                     may lack what pet_reports requires (species, place,
--                     date) and those columns stay NOT NULL.
--   notifications     + report_submitted, report_published, report_rejected,
--                     report_removed
--   audit_logs        + report_reviewed, report_removed
--
-- LEGACY REPORTS. No review is invented for them: they are 'published' with no
-- publication_logs row, which reads as "published before review existed".
--
-- LEGACY REMOVALS. Before this migration, moderation "removed" a report by
-- closing it, and wrote a status_logs row saying 'closed'. Such a report is
-- found by evidence, not guessed: it is Closed, it has an actioned moderation
-- case, and its latest 'closed' status_logs row was written by the
-- administrator who resolved that case. For each one:
--   * publication_status becomes 'removed', and status goes back to what it
--     was before the fake closure (that row's previous_status; Active if it
--     was Possible Match, because the removal dismissed its pairings);
--   * the removal moves from status_logs to publication_logs — same actor,
--     same note, same time — because it never was a case closure.
-- A report closed by its reporter is untouched, and stays Closed.
--
-- PREVIEW, read only, before running:
--
--   SELECT r.report_id, r.status, s.log_id, s.previous_status, s.note
--     FROM pet_reports r
--     JOIN moderation_cases c ON c.report_id = r.report_id AND c.case_status = 'actioned'
--     JOIN status_logs s ON s.report_id = r.report_id AND s.new_status = 'closed'
--                       AND s.updated_by_user_id = c.resolved_by_admin_id
--    WHERE r.status = 'closed';
--
-- Those rows become Removed; every other report becomes Published.
--
-- DEPLOYMENT: after 008 and 009, with the code, in the same sitting. New code
-- reads publication_status; old code would publish everything it files.
--
-- Safe to run twice. Run with the character-set flag:
--   mysql -u root -h 127.0.0.1 -P 3307 --default-character-set=utf8mb4 pawsandfound < 010_report_publication_workflow.sql
-- =============================================================================

-- No USE statement: this runs on whichever database the client selected (the
-- database named on the command line above), so the same file serves the
-- local `pawsandfound` and the hosted `railway` unchanged.
SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- pet_reports.publication_status — every existing report starts 'published'.
-- Added with that default so existing rows take it, then the default becomes
-- 'pending_review' for everything filed from now on.
-- -----------------------------------------------------------------------------
SET @missing := (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pet_reports'
                    AND COLUMN_NAME = 'publication_status');
SET @sql := IF(@missing,
  'ALTER TABLE pet_reports ADD COLUMN publication_status ENUM(''pending_review'',''published'',''rejected'',''removed'') NOT NULL DEFAULT ''published'' AFTER status',
  'DO 0');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

ALTER TABLE pet_reports
  MODIFY publication_status ENUM('pending_review','published','rejected','removed')
         NOT NULL DEFAULT 'pending_review';

SET @missing := (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pet_reports'
                    AND INDEX_NAME = 'idx_reports_publication');
SET @sql := IF(@missing,
  'ALTER TABLE pet_reports ADD KEY idx_reports_publication (publication_status, report_type, status)',
  'DO 0');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

-- -----------------------------------------------------------------------------
-- publication_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publication_logs (
  log_id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id       INT UNSIGNED NOT NULL,
  actor_user_id   INT UNSIGNED     NULL,   -- the reporter who submitted, the coordinator who
                                           -- decided, the administrator who removed
  previous_state  ENUM('pending_review','published','rejected','removed') NULL,  -- NULL: first submission
  new_state       ENUM('pending_review','published','rejected','removed') NOT NULL,
  note            VARCHAR(255)     NULL,   -- required for a rejection or a removal
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (log_id),
  KEY idx_publication_logs_report (report_id, created_at),
  CONSTRAINT fk_publication_logs_report
    FOREIGN KEY (report_id) REFERENCES pet_reports (report_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_publication_logs_actor
    FOREIGN KEY (actor_user_id) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- report_drafts — an unfinished report. Every column but the owner and the
-- report type may be empty; the types and lengths are the same as a report's.
-- Submitting a draft files a pet_reports row and deletes the draft.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_drafts (
  draft_id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED NOT NULL,
  report_type       ENUM('lost','found') NOT NULL,
  category_id       INT UNSIGNED     NULL,
  pet_name          VARCHAR(80)      NULL,
  breed             VARCHAR(80)      NULL,   -- as typed; becomes breed_id on submission
  pet_size          ENUM('small','medium','large','xl') NULL,
  pet_sex           ENUM('male','female','unknown') NULL,
  primary_color     VARCHAR(40)      NULL,
  secondary_color   VARCHAR(40)      NULL,
  distinct_features TEXT             NULL,
  description       TEXT             NULL,
  has_collar        ENUM('yes','no','unknown') NULL,
  pet_condition     VARCHAR(160)     NULL,
  incident_date     DATE             NULL,
  incident_time     TIME             NULL,
  location_label    VARCHAR(160)     NULL,
  area_code         CHAR(10)         NULL,
  city_code         CHAR(10)         NULL,
  latitude          DECIMAL(9,6)     NULL,
  longitude         DECIMAL(9,6)     NULL,
  allow_platform_contact BOOLEAN NOT NULL DEFAULT TRUE,
  show_email             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (draft_id),
  KEY idx_report_drafts_user (user_id, updated_at),
  CONSTRAINT fk_report_drafts_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_report_drafts_category
    FOREIGN KEY (category_id) REFERENCES pet_categories (category_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_report_drafts_area
    FOREIGN KEY (area_code) REFERENCES ph_areas (area_code)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_report_drafts_city
    FOREIGN KEY (city_code) REFERENCES ph_cities (city_code)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- New notification and audit words — appended, so existing rows keep theirs
-- (an ENUM is stored as the position of the word).
-- -----------------------------------------------------------------------------
ALTER TABLE notifications
  MODIFY notification_type ENUM('match_suggested','verification_requested','staff_reviewed',
                                'match_confirmed','match_rejected','report_updated',
                                'status_changed','pet_returned','report_flagged',
                                'report_submitted','report_published','report_rejected',
                                'report_removed') NOT NULL;

ALTER TABLE audit_logs
  MODIFY action ENUM('login','login_failed','account_locked','account_unlocked',
                     'logout','register','role_changed','account_suspended',
                     'account_reinstated',
                     'report_status_changed','match_decided',
                     'moderation_resolved','category_changed',
                     'email_verified','email_change_completed',
                     'password_reset',
                     'report_reviewed','report_removed') NOT NULL;

-- -----------------------------------------------------------------------------
-- Legacy removals: a closure that was really a moderation removal.
-- Only rows still Closed are touched, so a second run finds nothing to do.
-- -----------------------------------------------------------------------------
CREATE TEMPORARY TABLE legacy_removals AS
SELECT r.report_id, s.log_id, s.previous_status, s.updated_by_user_id, s.note, s.created_at
  FROM pet_reports r
  JOIN moderation_cases c ON c.report_id = r.report_id AND c.case_status = 'actioned'
  JOIN status_logs s ON s.report_id = r.report_id AND s.new_status = 'closed'
                    AND s.updated_by_user_id = c.resolved_by_admin_id
 WHERE r.status = 'closed'
   AND s.log_id = (SELECT MAX(s2.log_id) FROM status_logs s2
                    WHERE s2.report_id = r.report_id AND s2.new_status = 'closed');

INSERT INTO publication_logs (report_id, actor_user_id, previous_state, new_state, note, created_at)
SELECT report_id, updated_by_user_id, 'published', 'removed', note, created_at FROM legacy_removals;

UPDATE pet_reports r
  JOIN legacy_removals l ON l.report_id = r.report_id
   SET r.publication_status = 'removed',
       -- The removal also dismissed its open pairings, so a report that was
       -- Possible Match had none left: it is Active again.
       r.status = CASE WHEN l.previous_status IN ('returned', 'closed') THEN l.previous_status
                       ELSE 'active' END;

DELETE s FROM status_logs s JOIN legacy_removals l ON l.log_id = s.log_id;

DROP TEMPORARY TABLE legacy_removals;

INSERT INTO schema_migrations (version) VALUES ('010')
  ON DUPLICATE KEY UPDATE version = version;
