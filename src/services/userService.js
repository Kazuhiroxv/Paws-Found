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
import { NotFoundError, getTable } from './mockDb'
import { apiFetch, queryString } from './api'

/** An API account in the shape the interface already reads. */
function userFromApi(row) {
  return {
    id: row.user_id,
    fullName: row.full_name,
    email: row.email ?? '',
    phone: row.contact_number ?? '',
    role: row.role,
    accountStatus: row.account_status,
    preferredLocation: row.preferred_location ?? '',
    createdAt: row.created_at,
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
  // The session is a server-side PHP session; the browser only carries the
  // cookie. Asking the API is the only way to know who is signed in.
  const payload = await apiFetch('/auth/me')
  if (!payload.user) return null

  return {
    id: payload.user.user_id,
    fullName: payload.user.full_name,
    email: payload.user.email,
    phone: payload.user.contact_number ?? '',
    role: payload.user.role,
    accountStatus: 'active',
    preferredLocation: payload.user.preferred_location ?? '',
    notificationPreferences: {
      possibleMatches: payload.user.notify_matches ?? true,
      statusUpdates: payload.user.notify_status ?? true,
      staffMessages: payload.user.notify_staff ?? true,
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
  await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  return getCurrentUser()
}

/** End the session. Returns null so callers can assign the result directly. */
export async function signOut() {
  await apiFetch('/auth/logout', { method: 'POST' })
  return null
}

/**
 * Create an account and sign in as it.
 *
 * The role is deliberately not sent: the API always creates an ordinary user,
 * so a crafted request cannot register an administrator.
 */
export async function register({ fullName, email, password, phone = '', privacyConsent = false }) {
  await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      full_name: fullName,
      email,
      password,
      contact_number: phone,
      // Sent as a real boolean: the API compares with `=== true`, so a
      // request that leaves it out, or sends the string "false", is refused.
      privacy_consent: privacyConsent === true,
    }),
  })

  return getCurrentUser()
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

export async function getDemoAccounts() {
  const rows = getTable('users')
  const pick = (role) => rows.find((u) => u.role === role && u.accountStatus === 'active')

  return {
    [ROLES.USER]: pick(ROLES.USER),
    [ROLES.STAFF]: pick(ROLES.STAFF),
    [ROLES.ADMIN]: pick(ROLES.ADMIN),
  }
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
      full_name: changes.fullName,
      email: changes.email,
      contact_number: changes.phone ?? '',
      preferred_location: changes.preferredLocation ?? '',
      notify_matches: changes.notificationPreferences?.possibleMatches,
      notify_status: changes.notificationPreferences?.statusUpdates,
      notify_staff: changes.notificationPreferences?.staffMessages,
    }),
  })

  return userFromApi(payload.data)
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

