/**
 * What the signed-in account may do, for deciding what to SHOW.
 *
 * Reads the capabilities the server sent with the account (/auth/me), which
 * it derives from the administrator level (ADMIN_CAPABILITIES in
 * api/helpers.php). The interface never works them out from a label, so the
 * rules exist once. This is not security: every endpoint checks for itself,
 * and hiding a button only keeps the page honest about what will work.
 *
 * @param {Object|null|undefined} user  The account, as useSession holds it.
 * @param {string} capability           One of CAPABILITIES in src/constants.
 */
export function can(user, capability) {
  return Boolean(user?.capabilities?.includes(capability))
}
