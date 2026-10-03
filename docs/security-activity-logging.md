# Sessions, IP addresses and the activity trail (Correction 5)

What the instructor wrote at the defense:

> "session tables ip address should be shown in logs to determine/identify
> malicious activities"
>
> "log that detects a user or account where they went like every page, what
> they did, what time, when they log in, when they signout"
>
> "does not say you are signed out"

This document is the design of the answer: five logs with five jobs, how a
session is recorded from sign-in to its end, what is and is never logged, the
administrator's Logs page, and the sign-out race that was fixed alongside.

## Five logs, five questions

| Table | The question it answers | Written by | Size |
| --- | --- | --- | --- |
| `user_sessions` (011) | **Which signed-in session was this?** Account, IP, browser, start, last seen, end, why it ended | sign-in, and whatever ends a session | one row per sign-in |
| `user_activity_logs` (011) | **Where did a signed-in person go, and what did they do?** | the page a browser opened; every meaningful action, by the endpoint that did it | large |
| `audit_logs` (002–010) | **What security or administrative event happened?** Sign-ins, failed sign-ins, locks, unlocks, resets, role and account changes, reviews | unchanged | small |
| `status_logs` | **How did a pet case's status change?** | unchanged | per case |
| `publication_logs` (010) | **How did a report's review state change?** | unchanged | per report |

Why not one table: they differ in who writes them, how large they grow, who
may read them, and what a row means. A page view is not a security event; a
failed sign-in has no session; a case history belongs to the report, not to an
account. One table would need a column for every one of those meanings, most of
them empty on most rows. `audit_logs` stays the short, readable trail of
things that matter for security; `user_activity_logs` is the long record of
use; `user_sessions` ties both to a sign-in and an address.

A sign-in appears in all three account logs on purpose: `audit_logs` (the
security event), `user_sessions` (the session it started), `user_activity_logs`
(the first line of what that session did).

## Before this correction (traced in `31e87b3`)

| Event | What happened | What was recorded |
| --- | --- | --- |
| Successful sign-in | `session_regenerate_id(true)`, `issued_at`/`last_activity` in the PHP session; a privileged role bumped `users.session_version` (newest sign-in wins) | `audit_logs` `login`, with `REMOTE_ADDR` |
| Failed sign-in | counter in `login_attempts` (per address typed) | `audit_logs` `login_failed`, actor NULL |
| Third failure | `users.account_status = 'locked'`; every open session refused on its next request | `audit_logs` `account_locked` |
| Customer on several devices | allowed; one PHP session each | nothing per device |
| Coordinator/admin signs in again | earlier session refused next request (`session_version`) | the new `login` only |
| Manual sign-out | session destroyed, cookie cleared | `audit_logs` `logout` |
| Sign-out in another tab | the other tab learned at its next `/auth/me` | — |
| Idle (1 h) / absolute (8 h) | `current_user()` destroyed the session and answered "nobody" | nothing; the browser was not told why |
| Password reset | `session_version + 1`: every session refused | `audit_logs` `password_reset` |
| Suspension | sessions refused while suspended — **and came back to life if reinstated** | `audit_logs` `account_suspended` |
| Promotion to coordinator/admin | `session_version + 1` | `audit_logs` `role_changed` |
| Demotion | sessions continue as a customer | `audit_logs` `role_changed` |
| Re-check | `/auth/me` on load, focus, visibility, route change, every 10 s | — |

Gaps: no record of sessions or devices; `REMOTE_ADDR` on Railway is Railway's
own proxy, the same for every visitor; no page or action history; a session
ending for any reason looked the same to the browser ("You have been signed
out … it may have been suspended, or locked"), and an expiry or a sign-out in
another tab said nothing at all.

## The cross-tab sign-out race (register D1)

**Cause.** `useSession.refresh()` began with `if (inFlight.current) return`.
A request made while a check was running was dropped, not deferred:

```
tab A  ── /auth/me ──────────────────(server: "signed in")──── held ───► applied: still signed in
tab B            ── sign out ──►
tab A                              focus → refresh() → DROPPED (one in flight)
```

The server answered before tab B signed out; the focus that should have
corrected it was thrown away; tab A showed the private report until the next
ten-second poll. Under CPU load the first check is slow enough for this to
happen by itself, which is why SO-I/SO-J failed only sometimes.

There was a second, same-tab form of it: Sign out while a check is in flight,
and the late "signed in" answer signed the tab back in for a moment (the
remount it caused re-checked and corrected it ~100 ms later).

**Fix** (`src/hooks/useSession.js`):

1. *Trailing check.* A request while one runs sets `again`; when the running
   check finishes, one more runs. Never lost, never more than one extra
   however many arrive (ten focus events → two checks).
2. *Generation.* Signing in or out in this tab bumps a counter; a check that
   started before the bump cannot apply its answer. A stale "signed in" can no
   longer overwrite a newer "signed out".
3. *Any 401 re-checks.* `api.js` announces `paws:session-check` when a request
   is refused as signed out; the hook re-checks at once rather than at the
   next poll.

No faster polling; the ten-second poll is unchanged.

**Proved deterministically** (`npm run test:session-ui`, RACE-1…4). The Chrome
DevTools Fetch domain pauses tab A's `/auth/me` *after the server has
answered* "signed in"; tab B signs out; tab A asks again; the stale answer is
released. The app's ten-second poll is switched off in those browsers, so only
the code under test can correct the tab. Against the old hook RACE-1, RACE-3
and RACE-4 fail every time; with the fix all pass (RACE-1 signs out in ~300 ms).
RACE-2 (a route change during the check) passes against both — another path
in the old code happens to recover it — so it guards the behaviour without
discriminating the bug.

## `user_sessions`

| Column | |
| --- | --- |
| `session_record_id` | PK |
| `session_reference` | `CHAR(32)`, unique: 16 random bytes in hex, made at sign-in. **Not** the PHP session id |
| `user_id` | FK → `users`, CASCADE |
| `session_version` | the `users.session_version` it was issued under |
| `ip_address` | `VARCHAR(45)` — IPv6 fits |
| `user_agent` | `VARCHAR(255)`, the browser's own description of itself, control characters removed, never parsed |
| `started_at`, `last_seen_at` | |
| `ended_at`, `end_reason` | NULL until the server ends it |

Indexes: `(user_id, started_at)`, `(started_at)`, `(ip_address, started_at)`,
unique `session_reference`.

### The session reference

The PHP session id is the thing that signs a browser in. It is never written to
MySQL, never shown, never logged. The reference is a separate random value,
stored in the PHP session and on the row, that only *names* the session in the
logs. Knowing it gives no access. The Logs page shows its first eight
characters (`8f31c2a4…`), and filtering accepts any prefix of four or more.

### Start, last seen, end

* **Start** — `auth_login()`, after every refusal (wrong password, locked,
  suspended, unverified create no row) and after `session_regenerate_id()`.
* **Last seen** — `current_user()` writes `last_seen_at` at most every
  `SESSION_LAST_SEEN_INTERVAL` (300 s), not per request. It is the last
  authenticated request, *including the ten-second background check*: it means
  "a page was open", not "the person was typing". (The same is true of the idle
  clock, unchanged by this correction: an open tab keeps a session alive.)
* **End** — written by whatever ends it. Only an open row is closed, so the
  first, true reason is the one kept.

| `end_reason` | Written by | When |
| --- | --- | --- |
| `logout` | `auth_logout()` | Sign out |
| `idle_timeout` | `current_user()` | the first request after 1 h idle; `ended_at` is when it expired, not when it was noticed |
| `absolute_timeout` | `current_user()` | the first request after 8 h; same dating |
| `password_reset` | `auth_reset_password()`, in its transaction | every open session of the account |
| `new_privileged_login` | `auth_login()` | a coordinator/admin signs in again: the earlier session(s) |
| `role_promoted` | `user_update()`, in its transaction | promotion into coordinator/admin |
| `account_locked` | `login_failed()` | the third failure |
| `account_suspended` | `user_update()`, `moderation_decide()` | suspension, from Users or from a moderation case |

No other reason exists, because no other code ends a session. Demotion ends
nothing (policy unchanged: the session carries on as a customer's).

**Suspension and lock now end the session for good.** Before, a suspended
account's session was refused but kept, and worked again if the account was
reinstated — which the record could not have described truthfully. Now the
request that discovers it ends the PHP session; after reinstatement or unlock
the person signs in again.

**A session nobody ended.** A closed laptop does not say goodbye, so some rows
never get an end. The viewer never calls them "open": past the idle window
(plus the last-seen interval) or the absolute lifetime they are shown as
**Expired — no sign-out recorded**. Nothing claims anybody is "online".

## IP address (`client_ip()`) — revised in Correction 5A

**The decision is made from the deployment, not from the request.**
`BEHIND_RAILWAY_EDGE` (`api/config.php`) is true only in production *and*
when `RAILWAY_ENVIRONMENT_ID` is set — a variable Railway sets on the
deployments it runs, which no visitor can influence. A local Docker run of
the production image has `APP_ENV=production` but no such variable; XAMPP is
development. `config.local.php` may define it to simulate Railway in a test.

| Where | Address used | Headers |
| --- | --- | --- |
| XAMPP, local Docker | `REMOTE_ADDR` | `X-Real-IP`, `X-Forwarded-For` and the rest are **ignored** — whoever connects could have written them |
| Railway | `X-Real-IP`, if it is exactly one valid IPv4 or IPv6 address | `X-Forwarded-For`, `CF-Connecting-IP`, `Fastly-Client-IP` never read |
| Railway, `X-Real-IP` missing or malformed | `REMOTE_ADDR` (the edge), and a line in the server log saying so — without the header's value | |

Why `X-Real-IP`: Railway's *Public Networking → Specs & Limits* page documents
it as identifying the client's remote IP, and Railway staff (May 2026) state
that the edge always sets it, always overwrites a client-supplied value, and
that an app behind the HTTP proxy cannot be reached directly; they recommend
it over parsing `X-Forwarded-For`.

**What is no longer assumed.** Correction 5 believed `X-Forwarded-For` when
`REMOTE_ADDR` was inside 100.0.0.0/8. Railway publishes no stable range for
its proxies; 100.x is what their edge happens to connect from today, an
observed implementation detail, not a contract. Nothing now depends on the
peer address: on Railway it can be anything, off Railway it is the answer.

One function for every use, so an `audit_logs` row, a `privacy_consents` row,
a session record, an activity row, Turnstile's `remoteip` and the
registration / resend / reset rate-limit buckets made by one request all
carry the same address (tested end to end: IP-09…12). The three-attempt
sign-in lock is keyed by email, not by address, and is unaffected. On Railway
the rate limits now count per visitor; before Correction 5 every visitor
shared the edge's address.

**Limitation, honestly.** This relies on Railway keeping its documented
`X-Real-IP` contract, which a laptop cannot prove. **After deploying:** sign in
from two networks (home Wi-Fi, then mobile data); Logs → Sessions must show
two different public addresses. If they are both an internal address, or the
server log shows "X-Real-IP missing" lines, the contract is not holding: stop
relying on the IP for per-client rate limiting (the email-keyed limits and the
lock still work) until it is resolved. Diagnose with a temporary log line of
`REMOTE_ADDR` and *whether* `X-Real-IP` / `X-Forwarded-For` are present —
never their values persisted anywhere.

## User agent

Stored as sent, trimmed to 255 characters, on the session row only (not on
every activity row). No fingerprinting: no screen size, canvas, fonts, device
serials or MAC addresses — none of which a browser should give out anyway.

## `user_activity_logs`

| Column | |
| --- | --- |
| `activity_id` | PK |
| `user_id` | FK → `users`, CASCADE |
| `session_record_id` | FK → `user_sessions`, SET NULL; NULL for a session from before 011 |
| `action` | `VARCHAR(40)`, from `ACTIVITY_ACTIONS` in `api/helpers.php` — anything else is refused |
| `route` | page views: the path, `/pet/43`; never a query string |
| `target_type`, `target_id` | what was acted on (report, draft, match, moderation case, notification, category, user) |
| `detail` | ≤ 120 characters the server wrote itself: `"active -> closed"`, `"approved"` |
| `ip_address` | per row: an address can change within a session |
| `created_at` | |

Indexes, one per way the viewer filters: `(created_at)`,
`(user_id, created_at)`, `(session_record_id)`, `(action, created_at)`,
`(ip_address, created_at)`.

### Page views

One place, `RootLayout`: when a signed-in person's path changes, the browser
posts the **pathname** to `POST /api/activity/page-view`. The key is account +
path, so a re-render, a refocus or the ten-second re-check (each of which hands
over a new `user` object) is not a second visit. Not sent for guests, nor for
the sign-in, registration and recovery pages. Best effort: a failure never
stops a page.

The server takes the path only, refuses (422) anything with `?`, `#`, `//`, a
control character, an outside URL or more than 200 characters, and adds who,
which session, the IP and the time itself. The same path twice within 3 s is
one visit; more than 60 in a minute from one session is refused (429) and not
stored. `/pet/43` and `/dashboard/reports/43/edit` are recorded as report 43
by the server, so "who opened report 43" can be asked.

### Actions (written by the endpoint, after it succeeded)

| Area | Actions |
| --- | --- |
| Account | `login`, `logout`, `profile_updated`, `email_change_requested` |
| Reports | `draft_saved`, `draft_updated`, `draft_deleted`, `report_submitted`, `report_edited`, `report_photos_added`, `report_photos_changed`, `report_status_changed` (close, returned) |
| Review | `report_approved`, `report_rejected`, `report_resubmitted`, `report_removed` |
| Matching | `match_request_verification`, `match_dismiss` (not my pet), `match_reject`, `match_request_information`, `match_provide_information`, `match_confirm`, `match_reopen` |
| Moderation | `report_flagged`, `moderation_decided` |
| Notifications | `notification_read`, `notifications_all_read` (only when something was unread) |
| Administration | `account_status_changed`, `role_changed`, `category_changed` |

The browser cannot name an action: there is no endpoint that takes one, and the
page-view endpoint ignores every field but `path` (ACT-19, ACT-20).

### Not logged, deliberately

* Reads: lists, details, counts, `/auth/me`, the ten-second check. "Where they
  went" is the page view; logging each API read behind a page would multiply
  every visit by its requests and say nothing more.
* Failed attempts at an action (a 403, 409 or 422): the action did not happen.
  Security failures that matter — failed sign-ins, locks — are in `audit_logs`.
* Guests. Paws&Found is not an analytics product; failed sign-ins are still in
  `audit_logs` with their IP and no account.

### Never stored (SENS-01…09 check with sentinel values)

Passwords, password hashes, reset and verification tokens, CSRF tokens, PHP
session ids, cookie headers, the Turnstile token, credentials, request bodies,
report descriptions or photographs, names and phone numbers. A profile update
records `profile_updated`, not what changed.

### Transactional or best effort

| Record | Behaviour |
| --- | --- |
| `status_logs`, `publication_logs` | in the transaction of the change (unchanged) |
| Session ends for reset, promotion, suspension | in the transaction of the change |
| Session start, last seen, other ends | best effort: a failure is written to the PHP error log and the sign-in still works |
| `audit_logs` | best effort, after the change (unchanged) |
| `user_activity_logs` | best effort, after the change commits; page views best effort in the browser too |

An action never fails because its log line could not be written.

## Session-end messages

The server says why: `/auth/me` answers `{"user": null, "session_ended":
"idle_timeout"}`, and any refused request carries the same `session_ended`
beside its 401. The reason is kept in the (now anonymous) PHP session until the
next sign-in, so whichever request finds out first, every later one can still
say why. It describes only this browser's own session — never another device,
its IP or the account's internals.

| Reason | What the page says |
| --- | --- |
| manual | You have been signed out. |
| `idle_timeout` | Your session expired due to inactivity. Please sign in again. |
| `absolute_timeout` | Your session has ended. Please sign in again. |
| `new_privileged_login` | Your session ended because this account was signed in on another device. |
| `password_reset` | Your session ended because the account password was changed. |
| `role_promoted` | Your session ended because this account's access level changed. Please sign in again. |
| `account_suspended` | Your account has been suspended. (+ the administrator's contact) |
| `account_locked` | Your account is locked. (+ the administrator's contact) |
| none given (another tab signed out) | You have been signed out. |

`SessionNotice` is `role="alert"`, so it is announced, and stays until
dismissed with a labelled button.

## The Logs page (`/admin/logs`)

Three tabs: **Activity** (time, person, what, page or item, IP, session),
**Sessions** (person, session, IP, browser, started, last seen, ended and why /
expired / open) and **Security events** (the existing `audit_logs`: time,
event, account, concerning, detail, IP). Filters: person (name or email), what
or event, outcome, state, IP, page, session, from and to (Philippine days).
Newest first, 25 a page, filtered and paged in SQL — ten thousand rows page in
well under a second (LOG-07). Filters live in the address, and every name, IP
and session in the table is a link that narrows the list to it.

**Who may read it, for now:** administrators. Pet Coordinators get 403,
customers 403, guests 401 (LOG-04…06). Correction 6 decides which
administrator level holds this permission; nothing here pretends to have
levels yet.

**IP addresses on screen.** The Logs page is the authorised operational view
and shows full addresses. A projector is not: when demonstrating, filter to the
demo accounts, or use the projector-safe DBeaver queries that leave the IP
column out. The page itself says so.

## Privacy Notice

Version **2026-10-03** (`PRIVACY_NOTICE_VERSION`, both copies). It now says
that sign-in sessions (start, last use, end and why, IP, user agent), the pages
opened while signed in and the important actions are recorded, with the time;
that the record holds names of pages and actions, never what was typed; that
guests are not tracked; why (security, misuse, answering what happened); that
administrators can read it and coordinators cannot; and that nothing deletes
it automatically yet.

**Re-consent: not forced.** Consent is recorded per version at registration
(`privacy_consents`). Nothing in the system asks an existing member to agree
again, and building that was not part of this correction. The notice used to
promise it would; that sentence now says plainly that it is not built, so the
record shows which version each person agreed to and nobody is recorded as
agreeing to wording they never saw. A "please review the updated notice"
step at sign-in is a team decision (DECISIONS.md).

## Retention

None automatic. `user_sessions`, `user_activity_logs` and `audit_logs` grow
until someone deletes rows by hand; the notice says so. A reasonable policy to
decide later: activity 90 days, sessions 1 year, audit indefinitely — not
enforced, not claimed.

## Known limitations

* The IP is only as good as Railway's `X-Real-IP` contract (above); verify after deploy.
* "Last seen" and the idle clock count the background check, so an open tab
  is a live session.
* Page views are reported by the browser: a person who edits the JavaScript
  can avoid sending them. Actions cannot be avoided — the server writes them.
* A session that predates 011 has no record; its activity rows have no session
  until it next signs in (at most 8 hours).
* No automatic retention; no re-consent step.
