/**
 * Shared domain constants.
 *
 * Every list here is intentionally data-driven so that new values (extra
 * statuses, extra species) can be added without hunting through JSX.
 * See CLAUDE.md §6.7 — the status workflow must stay extensible.
 */

/** Application roles. A user has exactly one. */
export const ROLES = {
  USER: 'user',
  STAFF: 'staff',
  ADMIN: 'admin',
}

export const ROLE_LABELS = {
  [ROLES.USER]: 'Customer/User',
  [ROLES.STAFF]: 'Staff / Pet Coordinator',
  [ROLES.ADMIN]: 'Administrator',
}

/**
 * Administrator levels (Correction 6). A refinement of the Administrator role,
 * not a role of its own: users.admin_level, set only when role is 'admin'.
 * The values are the API's (ADMIN_LEVELS in api/helpers.php), exactly.
 */
export const ADMIN_LEVELS = {
  MODERATOR: 'moderator',
  MANAGER: 'manager',
  SUPER_ADMIN: 'super_admin',
}

export const ADMIN_LEVEL_LABELS = {
  [ADMIN_LEVELS.MODERATOR]: 'Administrator — Moderator',
  [ADMIN_LEVELS.MANAGER]: 'Administrator — Manager',
  [ADMIN_LEVELS.SUPER_ADMIN]: 'Super Administrator',
}

/**
 * What an administrator may do. The server derives these from the level and
 * sends them with the account (/auth/me); the interface only asks `can()`
 * (src/utils/permissions.js). Every endpoint checks again for itself.
 */
export const CAPABILITIES = {
  MODERATE_REPORTS: 'moderate_reports',
  MANAGE_ACCOUNTS: 'manage_accounts',
  MANAGE_REFERENCE_DATA: 'manage_reference_data',
  MANAGE_ADMINS: 'manage_admins',
  VIEW_SECURITY_LOGS: 'view_security_logs',
}

/** How an account's role reads, with the administrator level when there is one. */
export function roleLabel(user) {
  if (user?.role === ROLES.ADMIN && ADMIN_LEVEL_LABELS[user.adminLevel]) {
    return ADMIN_LEVEL_LABELS[user.adminLevel]
  }
  return ROLE_LABELS[user?.role] ?? user?.role ?? ''
}

/** The two kinds of report a community member can file. */
export const REPORT_TYPES = {
  LOST: 'lost',
  FOUND: 'found',
}

export const REPORT_TYPE_LABELS = {
  [REPORT_TYPES.LOST]: 'Lost',
  [REPORT_TYPES.FOUND]: 'Found',
}

/**
 * Report statuses. More may be required once the instructor finalises the
 * backend — add them here rather than hard-coding new strings at call sites.
 */
export const REPORT_STATUSES = {
  ACTIVE: 'active',
  POSSIBLE_MATCH: 'possible_match',
  RETURNED: 'returned',
  CLOSED: 'closed',
}

export const REPORT_STATUS_LABELS = {
  [REPORT_STATUSES.ACTIVE]: 'Active',
  [REPORT_STATUSES.POSSIBLE_MATCH]: 'Possible Match',
  [REPORT_STATUSES.RETURNED]: 'Returned',
  [REPORT_STATUSES.CLOSED]: 'Closed',
}

/**
 * Bar fill for each status, used by the breakdowns on the staff and
 * administrator dashboards. Here rather than in either page, so the two cannot
 * end up colouring the same status differently.
 */
export const REPORT_STATUS_BARS = {
  [REPORT_STATUSES.ACTIVE]: 'bg-status-active',
  [REPORT_STATUSES.POSSIBLE_MATCH]: 'bg-status-match',
  [REPORT_STATUSES.RETURNED]: 'bg-status-returned',
  [REPORT_STATUSES.CLOSED]: 'bg-status-closed',
}

/** Order used by queues and filter chips. */
export const REPORT_STATUS_ORDER = [
  REPORT_STATUSES.ACTIVE,
  REPORT_STATUSES.POSSIBLE_MATCH,
  REPORT_STATUSES.RETURNED,
  REPORT_STATUSES.CLOSED,
]

/** Lifecycle of a single match suggestion. */
export const MATCH_STATUSES = {
  SUGGESTED: 'suggested',
  VERIFICATION_REQUESTED: 'verification_requested',
  UNDER_REVIEW: 'under_review',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  DISMISSED: 'dismissed',
}

export const MATCH_STATUS_LABELS = {
  [MATCH_STATUSES.SUGGESTED]: 'Possible Match',
  [MATCH_STATUSES.VERIFICATION_REQUESTED]: 'Verification Requested',
  [MATCH_STATUSES.UNDER_REVIEW]: 'Under Staff Review',
  [MATCH_STATUSES.CONFIRMED]: 'Confirmed Match',
  [MATCH_STATUSES.REJECTED]: 'Rejected',
  [MATCH_STATUSES.DISMISSED]: 'Dismissed by User',
}

/** Match states that are sitting on a Pet Coordinator's desk. */
export const MATCH_STATUSES_AWAITING_STAFF = [
  MATCH_STATUSES.VERIFICATION_REQUESTED,
  MATCH_STATUSES.UNDER_REVIEW,
]

/** Pet categories. Administrators manage these in Phase 11. */
export const SPECIES = {
  DOG: 'dog',
  CAT: 'cat',
  BIRD: 'bird',
  RABBIT: 'rabbit',
  OTHER: 'other',
}

export const SPECIES_LABELS = {
  [SPECIES.DOG]: 'Dog',
  [SPECIES.CAT]: 'Cat',
  [SPECIES.BIRD]: 'Bird',
  [SPECIES.RABBIT]: 'Rabbit',
  [SPECIES.OTHER]: 'Other',
}

/**
 * Display name for a species value.
 *
 * Falls back to the stored value when an administrator has added a category
 * beyond the seeded five, so a new category renders sensibly everywhere instead
 * of showing "undefined". The full list lives in `categoryService`.
 *
 * @param {string} value
 */
export function speciesLabel(value) {
  if (SPECIES_LABELS[value]) return SPECIES_LABELS[value]
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ')
}

/**
 * What the first place list is called (Correction 3A). It offers PSA's 82
 * provinces plus Metro Manila (NCR, a region with no provinces) and BARMM's
 * Special Geographic Area, so it is not "Province": Metro Manila is not one.
 */
export const AREA_LABEL = 'Province or Metro Manila'
export const AREA_HINT =
  'Metro Manila has no provinces, so it is listed as one area; so is BARMM’s Special Geographic Area.'

/** 'xl' added after the defense (Correction 3): a very large dog had no size. */
export const PET_SIZES = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  XL: 'xl',
}

export const PET_SIZE_LABELS = {
  [PET_SIZES.SMALL]: 'Small',
  [PET_SIZES.MEDIUM]: 'Medium',
  [PET_SIZES.LARGE]: 'Large',
  [PET_SIZES.XL]: 'Extra Large (XL)',
}

export const PET_SEXES = {
  MALE: 'male',
  FEMALE: 'female',
  UNKNOWN: 'unknown',
}

export const PET_SEX_LABELS = {
  [PET_SEXES.MALE]: 'Male',
  [PET_SEXES.FEMALE]: 'Female',
  [PET_SEXES.UNKNOWN]: 'Unknown',
}

/** Reasons a report can be flagged for moderation (Phase 11). */
export const MODERATION_REASONS = {
  FALSE_REPORT: 'false_report',
  SPAM: 'spam',
  SCAM: 'scam',
  HARASSMENT: 'harassment',
  INAPPROPRIATE: 'inappropriate',
  DUPLICATE: 'duplicate',
  OTHER: 'other',
}

export const MODERATION_REASON_LABELS = {
  [MODERATION_REASONS.FALSE_REPORT]: 'False report',
  [MODERATION_REASONS.SPAM]: 'Spam',
  [MODERATION_REASONS.SCAM]: 'Scam',
  [MODERATION_REASONS.HARASSMENT]: 'Harassment',
  [MODERATION_REASONS.INAPPROPRIATE]: 'Inappropriate content',
  [MODERATION_REASONS.DUPLICATE]: 'Duplicate report',
  [MODERATION_REASONS.OTHER]: 'Other',
}

/** Kinds of notification the system can raise (Phase 9). */
export const NOTIFICATION_TYPES = {
  MATCH_SUGGESTED: 'match_suggested',
  VERIFICATION_REQUESTED: 'verification_requested',
  STAFF_REVIEWED: 'staff_reviewed',
  MATCH_CONFIRMED: 'match_confirmed',
  MATCH_REJECTED: 'match_rejected',
  REPORT_UPDATED: 'report_updated',
  STATUS_CHANGED: 'status_changed',
  PET_RETURNED: 'pet_returned',
  REPORT_FLAGGED: 'report_flagged',
  // Correction 4: a report's review.
  REPORT_SUBMITTED: 'report_submitted',
  REPORT_PUBLISHED: 'report_published',
  REPORT_REJECTED: 'report_rejected',
  REPORT_REMOVED: 'report_removed',
}

/**
 * Whether the public may see a report (Correction 4) — a different question
 * from its case status above. Filed reports wait for a Pet Coordinator; a
 * published one can later be removed by an administrator. Removed is not
 * Closed: `status` still says where the case is.
 *
 * A draft is not one of these: an unfinished report lives in its own table
 * until it is submitted (see docs/DECISIONS.md, "Drafts").
 */
export const PUBLICATION_STATUSES = {
  PENDING_REVIEW: 'pending_review',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  REMOVED: 'removed',
}

export const PUBLICATION_STATUS_LABELS = {
  [PUBLICATION_STATUSES.PENDING_REVIEW]: 'Pending review',
  [PUBLICATION_STATUSES.PUBLISHED]: 'Published',
  [PUBLICATION_STATUSES.REJECTED]: 'Not approved',
  [PUBLICATION_STATUSES.REMOVED]: 'Removed',
}

/**
 * How precisely a report's coordinates may be shown publicly.
 * CLAUDE.md §14 — never expose an exact home address by default.
 */
export const LOCATION_PRECISION = {
  APPROXIMATE: 'approximate',
  EXACT: 'exact',
}

/**
 * The one published way to reach the people running Paws&Found: the project's
 * own inbox. Used wherever a person is told to contact the team — the Privacy
 * Notice, and a suspended or locked account — so there is exactly one address
 * to change. Never a seeded demo account: those are fictional. Not the address
 * mail is sent from either; that is MAIL_FROM_ADDRESS on the server.
 */
export const PROJECT_CONTACT_EMAIL = 'pawsandfound.ph@gmail.com'

/**
 * The Administrator a suspended or locked person is told about. The seeded
 * Administrator account's own sign-in address is demo data (example.com) and
 * reaches nobody, so the name is shown with PROJECT_CONTACT_EMAIL instead.
 */
export const PROJECT_ADMINISTRATOR_NAME = 'Grace Bautista'

/**
 * Whether a dismissed pairing was withdrawn rather than turned down.
 *
 * Finishing a report (Returned or Closed) withdraws its open pairings, and the
 * database stores those as dismissed, the same as a reporter's "Not my pet".
 * A finished report on either side tells them apart: a reporter's dismissal
 * leaves both reports open. (If a reporter dismissed it and then finished the
 * report too, "withdrawn" is still true of it.)
 */
/**
 * A pairing ruled out, by a coordinator or a reporter (withdrawals included).
 *
 * Its score and seven reasons were recorded when it was made, and once it is
 * ruled out both reports are open to editing again, so the reasons can
 * describe a report that has since changed. A confirmed pairing cannot drift
 * that way: confirming marks both reports Returned, and a finished report
 * refuses edits.
 */
export function isRuledOut(status) {
  return status === MATCH_STATUSES.REJECTED || status === MATCH_STATUSES.DISMISSED
}

export function wasWithdrawn(status, lost, found) {
  const finished = [REPORT_STATUSES.RETURNED, REPORT_STATUSES.CLOSED]
  return status === MATCH_STATUSES.DISMISSED && [lost, found].some((report) => finished.includes(report?.status))
}
