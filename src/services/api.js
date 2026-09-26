/**
 * The HTTP client every service uses to reach the PHP API.
 *
 * One place that knows about `fetch`, credentials and error handling, so no
 * component ever calls the network directly and the services stay the only
 * boundary (CLAUDE.md §9).
 */

/**
 * Vite bundles the seeded photographs with hashed filenames, but the database
 * stores the plain name ('pet-012-dog.jpg'). This maps one to the other.
 *
 * `eager: true` means the map is built at compile time, so a lookup is just an
 * object read. Photos uploaded through the form later will be served by Apache
 * and will not need this — the map only covers the demonstration set.
 */
const bundledPhotos = import.meta.glob('@/assets/pet-*.{jpg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const photoByFilename = Object.fromEntries(
  Object.entries(bundledPhotos).map(([path, url]) => [path.split('/').pop(), url]),
)

/**
 * Where the API lives, relative to wherever the site itself is served from.
 *
 * Vite sets BASE_URL to '/' in development and '/pawsandfound/' in a build, so
 * the same code reaches the proxy during development and Apache in production
 * without either being hard-coded here.
 */
const API_BASE = `${import.meta.env.BASE_URL}api`

/**
 * This session's CSRF token.
 *
 * The API hands it out in the body of `/auth/me`, `/auth/login`,
 * `/auth/register` and `/auth/logout`, and requires it back in a header on
 * every request that changes something. Kept in a module variable rather than
 * in storage on purpose: it belongs to the session the server is holding, so
 * one that outlived the page would be stale anyway.
 */
let csrfToken = null

/** Ask for the token when there is none yet, or when the one we had was refused. */
async function primeCsrf() {
  const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
  const payload = await response.json().catch(() => null)

  csrfToken = payload?.csrf_token ?? null
  return csrfToken
}

/** Resolve a stored image filename to something an `<img src>` can load. */
export function assetUrl(filename) {
  if (!filename) return null
  return photoByFilename[filename] ?? `${API_BASE}/uploads/${filename}`
}

/**
 * Call the API and return the decoded JSON.
 *
 * `credentials: 'include'` is what carries the PHP session cookie. Without it
 * every request would look anonymous and the workspaces would 401.
 */
export async function apiFetch(path, options = {}) {
  const method = (options.method ?? 'GET').toUpperCase()
  const changesSomething = !['GET', 'HEAD', 'OPTIONS'].includes(method)

  // The first action of a freshly loaded page could be a submission, so the
  // token is fetched here if the app has not already picked one up.
  if (changesSomething && !csrfToken) await primeCsrf()

  let response = await send(path, options, method, changesSomething)

  // A token can go stale — the session was rotated, or the tab sat open while
  // somebody signed in and out elsewhere. That is a nuisance rather than an
  // attack, so it is worth exactly one retry with a fresh token. The server
  // marks this case with `csrf: true`; any other 403 is a real refusal and is
  // left alone.
  if (response.status === 403 && changesSomething) {
    const peek = await response.clone().json().catch(() => null)

    if (peek?.csrf) {
      await primeCsrf()
      response = await send(path, options, method, changesSomething)
    }
  }

  // A 204 has no body to parse.
  if (response.status === 204) return null

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The server sent a response that could not be read.')
  }

  // Any response may carry a new token — signing in and out both rotate it.
  if (payload?.csrf_token) csrfToken = payload.csrf_token

  if (!response.ok) {
    // The API always answers errors as { error: "..." }, written for a person.
    const error = new Error(payload?.error ?? 'The request failed.')

    // A 422 also names the fields that failed, so a form can mark them
    // individually. Attached to the error rather than wrapped in an error class
    // of its own (CLAUDE.md §15).
    if (payload?.fields) error.fields = payload.fields

    // The status, so a caller can tell "there is no such thing" from "the
    // server is broken". Without it every failure looks the same.
    error.status = response.status

    // The rest of what the server said, for the few refusals that carry more
    // than a sentence — a failed sign-in reports how many attempts remain and
    // whether the account is now locked, and the form draws that.
    error.payload = payload

    throw error
  }

  return payload
}

/** One attempt at the request, with the headers this call needs. */
function send(path, options, method, changesSomething) {
  // A FormData body must set its own Content-Type: the browser adds the
  // multipart boundary, and naming the type here would strip it and leave the
  // server unable to parse the upload.
  const isUpload = options.body instanceof FormData

  const headers = { ...options.headers }
  if (options.body && !isUpload) headers['Content-Type'] = 'application/json'

  // A header, not a form field. An HTML form on somebody else's site can post
  // to this API and the browser will send the session cookie with it, but it
  // cannot add a header — which is what makes this worth doing.
  if (changesSomething && csrfToken) headers['X-CSRF-Token'] = csrfToken

  return fetch(`${API_BASE}${path}`, { credentials: 'include', ...options, method, headers })
}

/** Build a query string, leaving out anything empty. */
export function queryString(params) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }

  const text = search.toString()
  return text ? `?${text}` : ''
}
