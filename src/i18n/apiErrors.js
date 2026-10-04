import { t } from './index.js'

/**
 * The API's own sentences, in the language showing (Correction 7).
 *
 * The PHP API answers every refusal with a sentence written in English for a
 * person (`{ error: "…" }`), and its security and business rules never look
 * at that sentence. Rewriting the API to send codes only for translation
 * would touch every endpoint for no change in behaviour, so it is not done.
 * Instead the sentences people actually meet in the workflow are listed
 * here, each with its dictionary key; anything not listed is shown exactly
 * as the server sent it, in English. docs/localization.md says which.
 *
 * Exact text, never a pattern: a reworded server sentence simply falls back
 * to English, which is honest, rather than to a wrong translation.
 */
const KNOWN = {
  'You need to be signed in to do that.': 'api.signIn',
  'Your account does not have access to that.': 'api.noAccess',
  'Your administrator level does not include that.': 'api.levelLacks',
  'Your administrator level does not include managing accounts.': 'api.levelAccounts',
  'Enter your email address and password.': 'api.emailPassword',
  'This account has been suspended by an administrator.': 'api.suspended',
  'Check your email and follow the verification link before signing in.': 'api.verify',
  'This account is locked after 3 failed sign-in attempts. An administrator has to unlock it before you can sign in again.':
    'api.locked',
  'Please check the highlighted fields.': 'api.checkFields',
  'An account already uses that email address.': 'api.emailTaken',
  'That link is no longer valid. Ask for a new one.': 'api.linkInvalid',
  'Too many attempts. Please try again later.': 'api.tooMany',
  'That request could not be verified. Please try again.': 'api.csrf',
  'That verification could not be confirmed. Please try again.': 'api.captcha',
  'The server could not complete that request.': 'api.server',
  'That report does not exist.': 'api.reportMissing',
  'That match does not exist.': 'api.matchMissing',
  'That draft does not exist.': 'api.draftMissing',
  'That account does not exist.': 'api.accountMissing',
  'One of these reports changed while this page was open.': 'api.reportsChanged',
  'This report changed while the page was open.': 'api.reportChanged',
  'That pairing has already been decided.': 'api.pairingDecided',
  'That pairing was decided by somebody else while this page was open.': 'api.pairingDecidedElsewhere',
  'You cannot review a report you filed yourself. Another Pet Coordinator has to.': 'api.ownReview',
  'Only a Pet Coordinator can approve or reject a report before it is published. Administrators moderate published reports.':
    'api.coordinatorOnly',
  'Only a Pet Coordinator can review a report.': 'api.coordinatorReview',
  'Only an administrator can remove a published report.': 'api.adminRemove',
  'You cannot change your own role, administrator level or account status.': 'api.ownAccount',
  'This is the last active Super Administrator. Make another account a Super Administrator first.':
    'api.lastSuperAdmin',
  'Nothing to change.': 'api.nothingToChange',
  'If an unverified account uses that email address, a new verification link has been sent.': 'api.resent',
  'If an account uses that email address, password reset instructions have been sent.': 'api.resetSent',
  // Raised by the browser side of the API client.
  'The server sent a response that could not be read.': 'api.unreadable',
  'The request failed.': 'api.failed',
  'Failed to fetch': 'api.offline',
}

/** The words for a failed request: translated when known, the server's own otherwise. */
export function errorText(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const key = KNOWN[message]
  return key ? t(key) : message
}
