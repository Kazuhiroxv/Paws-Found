/**
 * User and session data access.
 *
 * Authentication is real. `signIn()` and `register()` post to the PHP API,
 * which verifies or hashes the password with bcrypt and answers with a session
 * cookie; `getCurrentUser()` then asks the server who that cookie belongs to.
 * Nothing here decides access on its own — every protected endpoint checks the
 * session again for itself (see `api/helpers.php`).
 */

import { ROLES } from '@/constants'
import { NotFoundError } from './errors'
import { apiFetch, queryString } from './api'

/** An API account in the shape the interface already reads. */
function userFromApi(row) {
  return {
    id: row.user_id,
    // The two parts are what is edited; full_name is generated from them by
    // the database (migration 008) and is what every screen shows.
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    fullName: row.full_name,
    email: row.email ?? '',
    phone: row.contact_number ?? '',
    role: row.role,
    accountStatus: row.account_status,
    preferredLocation: row.preferred_location ?? '',
    createdAt: row.created_at,
    // Only present for somebody entitled to see the account's contact details
    // — their own, or a coordinator arranging a handover.
    emailVerified: row.email_verified ?? true,
    pendingEmail: row.pending_email ?? null,
  }
}


/**
 * Every seeded demonstration account shares this password (see
 * `database/seed.sql`). It exists so the development role selector can sign in
 * for real rather than pretending.
 *
 * It is only ever read inside an `import.meta.env.DEV` branch. Vite replaces
 * that with `false` when building, so the branch becomes dead code and this
 * string is dropped from the production bundle — which is the point. Shipping
 * a working password beside a one-click "sign in as Administrator" control
 * would hand the deployed site to anyone who opened the file.
 */
const DEMO_PASSWORD = 'demo1234'

/** `query` accepts: role, accountStatus, search (name or email). */
export async function getUsers(query = {}) {
  const payload = await apiFetch(
    `/users${queryString({ role: query.role, status: query.accountStatus, q: query.search })}`,
  )

  return payload.data.map(userFromApi)
}

export async function getUserById(id) {
  try {
    const payload = await apiFetch(`/users/${id}`)
    return userFromApi(payload.data)
  } catch (error) {
    throw new NotFoundError(error.message)
  }
}

export async function getCurrentUser() {
  return (await checkSession()).user
}

/**
 * Who is signed in, and — when the server ended this browser's session — why.
 *
 * `endedReason` is the server's own code (Correction 5): 'idle_timeout',
 * 'absolute_timeout', 'new_privileged_login', 'password_reset',
 * 'role_promoted', 'account_locked', 'account_suspended', or null. The page
 * says the reason out loud rather than guessing it.
 */
export async function checkSession() {
  // The session is a server-side PHP session; the browser only carries the
  // cookie. Asking the API is the only way to know who is signed in.
  const payload = await apiFetch('/auth/me')
  const row = payload.user

  return {
    endedReason: row ? null : (payload.session_ended ?? null),
    user: row && {
      id: row.user_id,
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      fullName: row.full_name,
      email: row.email,
      phone: row.contact_number ?? '',
      role: row.role,
      accountStatus: 'active',
      preferredLocation: row.preferred_location ?? '',
      // A new address asked for and not yet confirmed. /auth/me has always
      // sent it; without this line the Profile page could never say so.
      pendingEmail: row.pending_email ?? null,
      notificationPreferences: {
        possibleMatches: row.notify_matches ?? true,
        statusUpdates: row.notify_status ?? true,
        staffMessages: row.notify_staff ?? true,
      },
    },
  }
}

/**
 * Sign in with an email address and password.
 *
 * The API replies with a session cookie. The account itself is read back from
 * /auth/me so that `getCurrentUser()` stays the single place that shapes a user
 * for the interface.
 */
export async function signIn(email, password) {
  const payload = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  // A coordinator or an administrator keeps one session: signing in here ends
  // any earlier one, and the workspace says so once.
  const user = await getCurrentUser()
  return user && { ...user, previousSessionsEnded: payload.previous_sessions_ended === true }
}

/** End the session. Returns null so callers can assign the result directly. */
export async function signOut() {
  await apiFetch('/auth/logout', { method: 'POST' })
  return null
}

/**
 * Create an account.
 *
 * Does NOT sign in, and there is nothing to sign into yet: the address has not
 * been proved, so the API refuses a session until the link in the email is
 * followed. What comes back says so, and the form sends the person to the
 * "check your email" screen rather than to a dashboard they cannot use.
 *
 * The role is deliberately not sent: the API always creates an ordinary user,
 * so a crafted request cannot register an administrator.
 */
export async function register({
  firstName,
  lastName,
  email,
  password,
  phone = '',
  privacyConsent = false,
  captchaToken = null,
}) {
  const payload = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email,
      password,
      contact_number: phone,
      // Sent as a real boolean: the API compares with `=== true`, so a
      // request that leaves it out, or sends the string "false", is refused.
      privacy_consent: privacyConsent === true,
      captcha_token: captchaToken,
    }),
  })

  return {
    verificationRequired: payload.verification_required === true,
    // Whether the message actually left. False is not a failed registration —
    // the account exists — but the screen has to offer a resend rather than
    // claim an email is on its way that is not.
    emailSent: payload.email_sent !== false,
    email: payload.email ?? '',
  }
}

/** Follow the link from a verification or email-change message. */
export async function verifyEmail(token) {
  const payload = await apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })

  return { verified: payload.verified === true, email: payload.email ?? '' }
}

/**
 * Ask for another verification message.
 *
 * The answer is the same whatever the address is, so there is nothing here to
 * branch on — and nothing the interface could reveal even if it tried.
 */
export async function resendVerification(email) {
  const payload = await apiFetch('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

  return payload.message ?? ''
}

/** Begin a password reset. Same answer for every address, by design. */
export async function forgotPassword(email) {
  const payload = await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

  return payload.message ?? ''
}

/** Finish a password reset. Every other session for the account ends. */
export async function resetPassword(token, password) {
  await apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })

  return true
}

/**
 * What this server will accept, asked at run time rather than built in.
 *
 * The Turnstile site key belongs in the page — that is what a site key is for
 * — but baking it into the bundle would mean rebuilding to change it, and the
 * same image has to run with or without a Turnstile site in front of it.
 */
export async function getPublicConfig() {
  const payload = await apiFetch('/config')
  return {
    turnstileEnabled: payload.data?.turnstile_enabled === true,
    turnstileSiteKey: payload.data?.turnstile_site_key ?? null,
  }
}

/**
 * DEVELOPMENT ONLY — sign in as a seeded account without its password.
 *
 * Guarded rather than merely left uncalled: the guard is what lets the bundler
 * remove this function, and DEMO_PASSWORD with it, from a production build. In
 * a build the call does nothing and returns null.
 */
export async function signInAsDemoAccount(email) {
  if (!import.meta.env.DEV) return null

  await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  })

  return getCurrentUser()
}

/**
 * The accounts the development-only role selector offers.
 *
 * Development only, and enforced here rather than by the callers. The mock
 * users are loaded with a dynamic import inside an `import.meta.env.DEV`
 * branch, which Vite replaces with `false` in a production build — so the
 * branch, and the mock dataset with it, is removed from the bundle entirely.
 * A production sign-in page therefore never reads, or even ships, mock users.
 */
export async function getDemoAccounts() {
  if (import.meta.env.DEV) {
    const { users } = await import('@/mock')
    const pick = (role) => users.find((u) => u.role === role && u.accountStatus === 'active')

    return {
      [ROLES.USER]: pick(ROLES.USER),
      [ROLES.STAFF]: pick(ROLES.STAFF),
      [ROLES.ADMIN]: pick(ROLES.ADMIN),
    }
  }

  return {}
}

/**
 * Patch a user's own profile fields. Role and account status are left out —
 * changing those is an administrator action, below.
 */
/**
 * Save the signed-in account's own details.
 *
 * The `id` argument is ignored on purpose: the server takes the account from
 * the session, so this can only ever edit your own profile. Passing somebody
 * else's id would change nothing.
 */
export async function updateUser(id, changes) {
  const payload = await apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify({
      first_name: changes.firstName,
      last_name: changes.lastName,
      email: changes.email,
      contact_number: changes.phone ?? '',
      preferred_location: changes.preferredLocation ?? '',
      notify_matches: changes.notificationPreferences?.possibleMatches,
      notify_status: changes.notificationPreferences?.statusUpdates,
      notify_staff: changes.notificationPreferences?.staffMessages,
    }),
  })

  // A new address is not applied: it waits in pendingEmail until the link
  // sent to it is followed. The page needs to know whether that link went out
  // (null when no change of address was asked for).
  return { ...userFromApi(payload.data), emailChangeSent: payload.email_change_sent ?? null }
}

/**
 * Administrator action: unlock an account that locked itself after three
 * failed sign-in attempts.
 *
 * The same request as reinstating a suspended account — the account goes back
 * to active — but it is a different act with a different reason, so it has its
 * own name here and its own entry in the audit log. The server clears the
 * failed-attempt counter as part of it; without that the next wrong password
 * would lock the account straight back up.
 */
export async function unlockAccount(id) {
  const payload = await apiFetch(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ account_status: 'active' }),
  })

  return userFromApi(payload.data)
}

/** Administrator action: suspend or reinstate an account. */
export async function setAccountStatus(id, accountStatus) {
  const payload = await apiFetch(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ account_status: accountStatus }),
  })

  return userFromApi(payload.data)
}

export async function setUserRole(id, role) {
  const payload = await apiFetch(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })

  return userFromApi(payload.data)
}

