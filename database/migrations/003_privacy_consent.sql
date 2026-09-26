-- =============================================================================
-- 003 — the record of privacy consent
--
-- The Data Privacy Act expects a person to be told, before their personal
-- information is processed, what is collected and why. Paws&Found asks for that
-- acknowledgement at registration, and this is where the answer is kept.
--
-- A TABLE rather than a column on `users`, for one reason: the notice has a
-- version. If its wording changes in a way that matters, we need to know who
-- agreed to WHICH version and WHEN. A column would be overwritten by the
-- second agreement and the first one would be gone — which is the opposite of
-- what a consent record is for.
--
-- Run against an existing database:
--   mysql -u root -h 127.0.0.1 -P 3307 pawsandfound < 003_privacy_consent.sql
-- =============================================================================

USE pawsandfound;

CREATE TABLE IF NOT EXISTS privacy_consents (
  consent_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,

  -- The date the notice last changed, as PRIVACY_NOTICE_VERSION in
  -- api/config.php. Stored as it was at the moment of agreeing, so the row
  -- keeps meaning what it meant even after the notice is rewritten.
  notice_version VARCHAR(20)  NOT NULL,

  consented_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address     VARCHAR(45)      NULL,

  PRIMARY KEY (consent_id),

  -- One agreement per person per version. Agreeing twice to the same wording
  -- is not two facts.
  UNIQUE KEY uq_consent_user_version (user_id, notice_version),

  -- CASCADE, unlike audit_logs: a consent record is only meaningful attached
  -- to the person who gave it. An orphaned "somebody agreed to something"
  -- protects nobody and is one more piece of personal data kept for no reason.
  CONSTRAINT fk_consent_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  KEY idx_consent_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- The ten demonstration accounts predate this table. They are recorded as
-- having agreed to the notice as it stood when they were seeded, so the
-- demonstration does not show ten accounts with no consent on file — which
-- would be a worse lie than the small fiction that they read it.
INSERT IGNORE INTO privacy_consents (user_id, notice_version, consented_at)
SELECT user_id, '2026-09-23', created_at FROM users;


INSERT INTO schema_migrations (version) VALUES ('003')
  ON DUPLICATE KEY UPDATE version = version;
