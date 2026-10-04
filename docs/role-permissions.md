# Who is allowed to do what

**ITS122P–AM5 · Group 3** · read out of `api/` on 25 September 2026; the public
table, the edit rule, §3a and §5 re-read on 30 September 2026; the administrator
levels (§0, §0a, §3) added on 3 October 2026 (Correction 6)

Three roles — Customer, Pet Coordinator, Administrator — and, inside
Administrator, three levels. The question this document answers is not "what
does the interface show" — it is **"what does the server allow"**, which is the
only version that matters, because a request built by hand is not limited to
what the interface offers.

---

## 0. Six kinds of account, at a glance

```
ROLE (users.role)
├── user    Customer
├── staff   Pet Coordinator
└── admin   Administrator
      ├── moderator     (users.admin_level)
      ├── manager
      └── super_admin
```

The three levels are **one role**. A Moderator, a Manager and a Super
Administrator are all Administrators; the level says how much of
Administration they get. A Pet Coordinator is not in the hierarchy at all.

**Where the levels came from.** Ma'am asked for *"different admin levels of
privileges"* (written defense notes). She did not say how many, what they are
called, or what each may do. **The three levels and the matrix below are the
team's design**, chosen as the smallest hierarchy that still separates three
real jobs: deciding about content, looking after accounts, and looking after
the administrators and the security record.

| | Guest | Customer | Pet Coordinator | Admin — Moderator | Admin — Manager | Super Administrator |
| --- | --- | --- | --- | --- | --- | --- |
| Browse, search, map (public summary) | yes | yes | yes | report pages only¹ | report pages only¹ | report pages only¹ |
| Read a full report | — | yes | yes | yes | yes | yes |
| File a report; drafts | — | own | own | — ¹ | — ¹ | — ¹ |
| Review new reports (approve / not approved) | — | — | **yes**, never their own | **—** (may inspect) | **—** (may inspect) | **—** (may inspect) |
| Decide pairings, verification | — | own pairings: claim / "not my pet" | yes | — ³ | — ³ | — ³ |
| Moderation queue; remove a published report | — | flag only | — | **yes** | **yes** | **yes** |
| Suspend / reinstate / unlock customers and coordinators | — | — | — | — | **yes** | **yes** |
| See account contact details in Administration | — | own | for a handover | — | **yes** | **yes** |
| Pet categories (add, rename, retire, delete) | — | — | — | — (read) | **yes** | **yes** |
| Change roles; set administrator levels | — | — | — | — | — | **yes** |
| Manage another administrator's account | — | — | — | — | — | **yes** |
| Logs: sessions, IPs, activity, security events | — | — | — | — | — | **yes** |
| Change their own role, level or status | — | — | — | — | — | — |

¹ The administrator stays in Administration: the community pages send them to
`/admin`; a report's own page stays open (it is linked from Administration).
² Correction 6A. **Only Pet Coordinators may make the pre-publication decision. Administrator levels govern system administration and post-publication moderation, not the Pet Coordinator review workflow.** An administrator may open
and read a pending report; the server refuses them the decision (403) and the
page offers them no button. ³ The
server accepts an administrator for these (§3a); the Administration workspace
does not offer them.

**Why the logs are the Super Administrator's alone.** Correction 5 made them
hold IP addresses, browsers, session history and every page each person
opened. A content moderator needs none of that to decide about a flagged
report, and an account manager needs none of it to unlock an account. The
most sensitive data in the system goes to the fewest people.

## 0a. Limitations and scope, by role

What each kind of account **cannot** do — the part a panel asks about.

**Guest.** Cannot read a report's description, markings, exact place or
time (a summary and a snapped map point only); cannot file, flag, claim or
draft anything; is not tracked.

**Customer.** Cannot approve, reject or publish any report, their own
included; cannot see another person's unpublished report, draft or contact
details; cannot decide a pairing (only claim it or say "not my pet"); cannot
moderate, manage accounts or categories, or open any log; cannot change their
own role or status.

**Pet Coordinator.** CAN inspect pending reports and approve or reject them —
the pre-publication decision is theirs alone. Cannot review their own report; cannot moderate flags,
manage accounts, roles or categories; cannot open any log; cannot edit a
reporter's words (only move a case's status); is not an administrator of any
level.

**Administrator — Moderator.** Cannot approve or reject a report before it is
published (that is the Pet Coordinator's; Moderators moderate published ones).
Cannot suspend, reinstate or unlock any account
(a moderation case can remove the report but not suspend its author); cannot
see account contact details; cannot change categories, roles or levels;
cannot open the logs; cannot touch another administrator.

**Administrator — Manager.** Cannot approve or reject a report before it is
published. Cannot change anybody's role or anybody's level
(not even make a customer a coordinator); cannot suspend, reinstate or unlock
another administrator; cannot open the logs.

**Super Administrator.** The highest level, and still not a bypass. Cannot
change their own role, level or status; cannot leave the system with no active
Super Administrator; cannot approve or reject a report before it is
published — the highest administrative level is not a review privilege;
cannot edit a reporter's report as if it were theirs,
resubmit it for them, or answer a coordinator's question as one of the
reporters; cannot publish a report without the review step; cannot write,
edit or delete an audit, session or activity record — no endpoint does.

Business rules are separate from the hierarchy. Ownership, the review step,
the case transitions and the open-pairing freeze apply to every level the
same way; a level only decides which administrative sections someone has.

If the code and this page ever disagree, the code is right and this page is
wrong. Every claim below carries a `file:line`.

---

## 1. The sentence to say first

> Hiding a button is not security. Every protected endpoint checks the role
> again, on the server, on every request — and it reads that role out of the
> database rather than out of the session, so a change takes effect on the very
> next request without anybody signing in again.

That is the whole design in three clauses, and it is worth being able to say it
without notes.

---

## 2. Where the check actually lives

`$_SESSION` holds **one thing**: `user_id`. Not the role, not the name, not the
status.

```php
// api/helpers.php — current_user()
'SELECT user_id, full_name, email, role, account_status, ... FROM users WHERE user_id = :id'
```

Every request that needs to know who you are re-reads that row. Three
consequences, and all three are worth stating out loud:

1. **A step down propagates instantly**, to every device, without a sign-out:
   the session carries on as a customer's. Nothing has to be invalidated
   because nothing was cached. A **promotion** into staff or admin ends every
   session the account had open, because of the next rule.
2. **A suspension propagates instantly**, for the same reason.
3. **The status check is `!== 'active'`, not `=== 'suspended'`**
   (`api/helpers.php`). If someone adds a fourth value to the ENUM later —
   `pending`, say — it is refused by default rather than admitted by accident.
   A deny-list has to be updated to stay correct; an allow-list does not.

**One session at a time for a privileged account.** A coordinator or an
administrator signing in bumps the account's `session_version`, so a session
left open on another machine stops working on its next request. A customer may
be signed in on any number of devices. Only a successful sign-in does this: a
wrong password, or a locked, suspended or unverified account, ends nothing.
Signing out ends only the browser it is done in; a password reset ends every
session for every role (`api/auth.php`, `auth_login()`; `PRIVILEGED_ROLES` in
`api/config.php`).

The two guards everything else is built from:

| Helper | What it does | Fails with |
| --- | --- | --- |
| `require_login()` | Session must name a real, **active** account | `401` |
| `require_role('staff', 'admin')` | That, and the role must be in the list | `403` |
| `require_capability('manage_accounts')` | That, the role `admin`, and a level whose capabilities include it (Correction 6) | `403`, `code: admin_level` |

The capabilities are one table, `ADMIN_CAPABILITIES` in `api/helpers.php`:

| Capability | Moderator | Manager | Super Administrator |
| --- | --- | --- | --- |
| `moderate_reports` | yes | yes | yes |
| `manage_accounts` | — | yes | yes |
| `manage_reference_data` | — | yes | yes |
| `manage_admins` | — | — | yes |
| `view_security_logs` | — | — | yes |

Endpoints ask for a capability, never a level, so a level can change what it
includes without touching an endpoint. `/auth/me` sends an administrator their
`admin_level` and `capabilities`; the interface asks `can(user, …)`
(`src/utils/permissions.js`) and never works the rules out from a label.

`api/helpers.php:382`. `require_role()` calls `require_login()` first, so an
anonymous request to an administrator endpoint is a 401, not a 403 — it is not
that you are the wrong person, it is that you are nobody.

---

## 3. The matrix

`—` means the endpoint answers 401 or 403. Everything below is the server's
behaviour, not the interface's.

### Public — no account needed

| Endpoint | Note |
| --- | --- |
| `GET /reports` | The list, as a **public summary**: no description, no distinguishing features, no landmark, no time, and the map point snapped to a 0.004° grid (`reports.php`, `shape_for_viewer`) |
| `GET /categories` | The species list the report form and the filters need before anyone signs in |
| `POST /auth/login`, `POST /auth/register` | |

### Customer — `require_login()`

| Endpoint | Allowed to | Guard |
| --- | --- | --- |
| `GET /reports/{id}` | The full report. A guest gets **401** `auth_required` (a missing report is still 404). Contact details are **omitted from the response** unless the reporter published them on that report: absent from the JSON, not hidden in the page | `report_detail()` |
| `GET /matches`, `GET /matches/{id}` | Pairings, score and signals — **only those involving their own reports**. Asking for somebody else's is 403. Proof notes: see §4 | `matches_list()`, `match_detail()` |
| `POST /reports` | File a report | `reports.php:124` |
| `PATCH /reports/{id}` | Edit **their own** report only, and only while it is **Active**: under an open possible match the details and photos are frozen (**409** `match_open`), so nothing changes under the coordinator verifying it | `reports.php:253` — *"Only the person who filed a report can edit it."* |
| `POST /reports/{id}/photos` | Add photographs to **their own** report | `reports.php:581` |
| `PATCH /reports/{id}/status` | Move **their own** report, along an allowed transition | `reports.php:324` + `REPORT_TRANSITIONS` |
| `GET /reports/activity` | Their own reports' recent changes | `reports.php:413` |
| `PATCH /matches/{id}` | `request_verification` and `dismiss`, and only on a pairing they are part of | `matches.php:89` |
| `GET`/`PATCH /notifications` | Their own, by session id | `notifications.php:20` |
| `PATCH /users/me` | Their own profile | `users.php:122` |
| `POST /moderation` | Flag a listing — a **published** one; any other answers 404 | `moderation_create()` |
| `POST /reports` | Files it **for review** (Correction 4): `pending_review`, not public, not matched | `report_create()` |
| `GET /reports/{id}` (unpublished) | **Their own** report waiting for review, not approved, or removed — with its publication history. Anybody else's: 404 | `report_detail()` |
| `PATCH /reports/{id}/publication` `resubmit` | **Their own** report, only after a rejection | `PUBLICATION_ACTIONS` |
| `GET`/`POST`/`PUT`/`DELETE /drafts` | **Their own** drafts only; anybody else's is 404 — coordinators and administrators included | `draft_own_or_404()` |
| `POST /activity/page-view` | Report a page they opened — recorded against **their own** session; nothing in the body can name another account, an action or an address (Correction 5) | `activity_page_view()` |

**The one to be able to quote:** `profile_update()` takes the account id **from
the session, never from the request**, so it cannot be pointed at somebody
else. `role` and `account_status` are not read from the body at all — an
account cannot promote itself or lift its own suspension, and there is no
request shape that would let it try.

### Pet Coordinator — `staff`

Everything a customer can do, plus:

| Endpoint | Allowed to | Guard |
| --- | --- | --- |
| `PATCH /matches/{id}` | `confirm`, `reject`, `request_information` | `matches.php:85` — *"Only a Pet Coordinator can decide a pairing."* |
| `PATCH /matches/{id}` | `reopen` a pairing rejected, confirmed or dismissed ("Not my pet") by mistake, with a reason; never a withdrawn one | `reopen_preflight()`, `match_reopen()` |
| `PATCH /reports/{id}/status` | Move **any** report along an allowed transition | `reports.php:322` |
| `GET /users/{id}` | See contact details, to arrange a handover | `users.php:107` |
| `GET /reports/stats` | The dashboard figures | `reports.php:457` |
| `GET /matches/{id}` | Read the proof notes on a case they are handling | `matches.php:468` |
| `GET /reports?publication=pending_review` | The review queue (Correction 4) | `reports_list()` |
| `PATCH /reports/{id}/publication` `approve` / `reject` | Publish a report, or mark it not approved with a reason — **never their own**. **Pet Coordinators only** (`role = 'staff'`): every administrator level gets 403 (Correction 6A) | `report_publication()` |

**What staff deliberately cannot do**, and this is the boundary the project
brief asks for (CLAUDE.md §4.2 — *"must not have unrestricted administrator
privileges"*):

| | Refused by |
| --- | --- |
| List or manage accounts | `users_list()` `require_role('admin')`; `user_update()` |
| Change anybody's role | `user_update()` — `manage_admins` |
| Suspend, reinstate or unlock an account | `user_update()` — `manage_accounts` |
| Manage pet categories | `categories.php` — `manage_reference_data` |
| See or resolve the moderation queue | `moderation.php` — `moderate_reports` |
| Read the activity, session or security logs (Correction 5) | `logs.php` — `view_security_logs`, 403 |

### Administrator — `admin`, by level (Correction 6)

Every level: the coordinator endpoints above that the server lets an
administrator use (§3a), plus `GET /users` (names only below Manager) and
`GET /categories?all=1` (read only).

| Endpoint | Moderator | Manager | Super Administrator |
| --- | --- | --- | --- |
| `GET /moderation`, `PATCH /moderation/{id}` dismiss / warn / remove | yes | yes | yes |
| `PATCH /moderation/{id}` **suspend** (removes the report and suspends its author) | — | yes, never an administrator | yes, never an administrator (use Users) |
| `PATCH /reports/{id}/publication` `remove` | yes | yes | yes |
| `PATCH /users/{id}` status: suspend (reason required), reinstate, **unlock** — customers and coordinators | — | yes | yes |
| `PATCH /users/{id}` status of **another administrator** | — | — | yes |
| `PATCH /users/{id}` `role`, `admin_level` | — | — | yes |
| `POST`/`PATCH`/`DELETE /categories` | — | yes | yes |
| `GET /logs/activity`, `/logs/sessions`, `/logs/audit` | — | — | yes |

**The rules on roles and levels** (`user_update()` in `api/users.php`):

* Nobody changes their own role, level or status (422).
* Promoting to Administrator needs a level chosen on purpose
  (`moderator`, `manager` or `super_admin`); without one, 422 — nobody
  becomes a Super Administrator by default. Any other value (`god`, `root`,
  `""`) is 422. A level for somebody who is not an administrator is 422.
* Demoting an administrator clears the level in the same statement; the
  database's `chk_users_admin_level` refuses a role without its level or a
  level without the role, however the change is written.
* **There is always an active Super Administrator.** Only a Super
  Administrator can change an administrator, and nobody can change
  themselves, so one Super Administrator alone cannot be demoted, stripped of
  the role or suspended. The remaining danger — two Super Administrators
  demoting each other at the same moment — is closed by a transaction that
  locks every active Super Administrator's row (`SELECT … FOR UPDATE`, in
  user_id order) and re-reads the acting administrator before deciding: the
  second request waits, then finds its actor no longer a Super Administrator
  and is refused. Tested ten times in a row with two simultaneous requests
  (SA-08). A last-Super-Administrator count is checked as well (409
  `last_super_admin`) in case the self rule is ever relaxed.
* A level change, or removing the Administrator role, ends every session of
  that account (`privilege_changed`): a browser must not keep a screen built
  for powers it no longer has. Promotion into a privileged role ends them as
  before (`role_promoted`). The acting administrator's own session is
  untouched.

Every change among these writes an `audit_logs` row naming the administrator,
the target and what changed — `role_changed` (with the levels: `user ->
admin (manager)`), `admin_level_changed` (`moderator -> manager`),
`account_suspended`, `account_reinstated`, `account_unlocked`,
`category_changed`, `moderation_resolved` (with the actor's level) — and,
since Correction 5, a `user_activity_logs` row on the administrator's own
session. Reading the logs writes nothing. The audit log is the record of
privilege changes; there is no separate history table.

---

## 3a. Where the server allows more than the interface offers

The matrix above is the server. The interface is narrower in six places, all
deliberate. Each is marked † on the printed roles sheet
(`docs/diagrams/roles-workflow-a4.pdf`).

| Action | Server allows | Interface offers it to |
| --- | --- | --- |
| Confirm / reject / reopen a pairing, ask a question | Staff **and** Admin (`matches.php`, `$isStaff` includes admin) | Pet Coordinators only — the Verification page is in the staff workspace, which an administrator cannot open |
| Mark any report Returned / Closed | Staff and Admin, any report | The report's owner only (`PetDetailPage.jsx`, `isOwner`) |
| "This could be mine" / "Not my pet" | The two reporters, and staff or admin acting for one | The two reporters |
| List every pairing | Staff and Admin | Staff (Match Queue) |
| Edit a report | Its owner, whatever the role | The owner, from the customer dashboard |
| Browse, search and file reports | Any role (browsing is public; filing needs any sign-in) | Everyone but the administrator: Home, Explore, About, Help, Privacy and Report a pet send them to `/admin` (`AdminStaysInWorkspace`). A report's own page stays open to them |

The accurate sentence: *the interface assigns match verification to Pet
Coordinators; the backend also recognises an Administrator as privileged for
that endpoint, although the Administration workspace does not expose it.*

---

## 4. Three places the rule is finer than "the role"

**Ownership beats role, for editing.** Staff can move any report's *status*,
because coordinating a case is their job. They cannot **edit** somebody's
report — the description, the photographs, the location. Those are the
reporter's words. `report_update()` checks ownership, not role.

**A finished report refuses edits.** `REPORT_TRANSITIONS` in `reports.php`:
Active and Possible Match may go to Returned or Closed; Returned may go to
Closed; Closed is terminal. A request for any other move gets **409**, naming
where the report actually is. The interface only offers legal moves — this is
here because a hand-built request is not limited to the interface.

**Proof notes are not public.** `may_read_proof()` (`matches.php:468`) lets
through the two reporters in the pairing and any coordinator. Everybody else
gets the pairing without them. This is the one piece of data where being
signed in is not enough; you have to be *in the case*.

---

## 5. How this was tested, and what the tests found

**Administrator levels (Correction 6, 6A).** `npm run test:admin-levels` — 93
direct API calls, including REV-ROLE-01…12: customers, Moderators, Managers and
Super Administrators all refused the pre-publication decision (403), the Pet
Coordinator allowed, never on their own report, and recorded as the reviewer;
and each level asking for each thing it may and may not do,
coordinators, customers and guests asking for all of it, invalid levels and
inconsistent role/level pairs, the self rule, ten rounds of two simultaneous
Super Administrator demotions, sessions ending on a level change, and the
audit trail. `npm run test:admin-levels-ui` — 33 checks in a browser, starting
with the demonstration sequence (every administrator level opens a pending
report and finds no way to publish it; the Pet Coordinator approves it): the
navigation each level sees, the permission-denied page for a typed address,
no hidden link left for the keyboard, a Manager suspending with a reason, a
Super Administrator promoting only once a level is chosen, and the person on
the other end told why their session ended.

`npm run audit` — **382 cases**, of which **31 are category D, Authorization**.
Each one is a request made by the wrong person to a real endpoint, with the
expected status code asserted.

`npm run multi-device` — **73 checks** across independent sessions. The
ones that matter here:

* an administrator downgrades a coordinator; the coordinator's device is a
  customer **on its very next request**, without refreshing, and a promotion
  back ends every session the account had open;
* a coordinator or an administrator signing in on a second device ends the
  first; a customer keeps both;
* suspension drops all three of a customer's devices to signed-out and a
  protected call from each returns 401;
* a customer asking for `/users`, `/moderation`, `/categories` and somebody
  else's report gets 403 four times, and nothing is created.

**What endpoint-level testing found that reading the code did not.** Every
handler was correct on its own. `api/index.php` passed only the first two path
segments to most of them, so a third was silently dropped and the request was
answered as though it had never been typed:

    GET /api/matches/1/claims   ->  200, the match
    GET /api/users/1/password   ->  200, the user

Nothing leaked that was not already public, so this is a correctness fault
rather than a privacy one — but an API that answers URLs it does not have is
not one you want somebody typing at. Fixed; cases **EH-07 to EH-10**.

That is the honest answer to *"how did you test authorization?"*: not by
reading the guards, which were all right, but by asking the running system for
things it should refuse.

---

## 6. If you are asked one question about this

> **"Show me that a Customer cannot reach the admin page."**

Sign in as a customer. Type `/admin` — the route refuses it in the browser.
Then, because that only proves the interface is polite, open the address bar
and call the API directly:

```
http://<host>/pawsandfound/api/users
```

`403`, *"Your account does not have access to that."* The button being hidden
and the endpoint being closed are two different facts, and only the second one
is security.
