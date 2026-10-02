/**
 * Errors the services raise, so pages can tell a missing record apart from a
 * real failure without parsing messages.
 *
 * This used to live in the in-browser mock database, which meant that every
 * service importing it also pulled the whole mock dataset into the production
 * bundle. It lives on its own now so nothing that ships depends on mock data.
 */

/** Thrown when a record does not exist — the API answered 404. */
export class NotFoundError extends Error {
  constructor(message = 'That record was not found.') {
    super(message)
    this.name = 'NotFoundError'
    this.code = 'NOT_FOUND'
  }
}
