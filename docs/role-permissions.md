# Who is allowed to do what

**ITS122P–AM5 · Group 3** · read out of `api/` on 25 September 2026

Three roles. The question this document answers is not "what does the interface
show" — it is **"what does the server allow"**, which is the only version that
matters, because a request built by hand is not limited to what the interface
offers.

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

1. **A role change propagates instantly**, to every device, without a sign-out.
   Nothing has to be invalidated because nothing was cached.
2. **A suspension propagates instantly**, for the same reason.
3. **The status check is `!== 'active'`, not `=== 'suspended'`**
   (`api/helpers.php`). If someone adds a fourth value to the ENUM later —
   `pending`, say — it is refused by default rather than admitted by accident.
   A deny-list has to be updated to stay correct; an allow-list does not.

The two guards everything else is built from:

| Helper | What it does | Fails with |
| --- | --- | --- |
| `require_login()` | Session must name a real, **active** account | `401` |
| `require_role('staff', 'admin')` | That, and the role must be in the list | `403` |

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
| `GET /reports`, `GET /reports/{id}` | Contact details are **omitted from the response** unless the reporter published them on that report. Not hidden in the page: absent from the JSON |
| `GET /matches`, `GET /matches/{id}` | Score and signals. Proof notes are excluded — see §4 |
| `GET /categories` | The species list the report form and the filters need before anyone signs in |
| `POST /auth/login`, `POST /auth/register` | |

### Customer — `require_login()`

| Endpoint | Allowed to | Guard |
| --- | --- | --- |
| `POST /reports` | File a report | `reports.php:124` |
| `PATCH /reports/{id}` | Edit **their own** report only | `reports.php:253` — *"Only the person who filed a report can edit it."* |
| `POST /reports/{id}/photos` | Add photographs to **their own** report | `reports.php:581` |
| `PATCH /reports/{id}/status` | Move **their own** report, along an allowed transition | `reports.php:324` + `REPORT_TRANSITIONS` |
| `GET /reports/activity` | Their own reports' recent changes | `reports.php:413` |
| `PATCH /matches/{id}` | `request_verification` and `dismiss`, and only on a pairing they are part of | `matches.php:89` |
| `GET`/`PATCH /notifications` | Their own, by session id | `notifications.php:20` |
| `PATCH /users/me` | Their own profile | `users.php:122` |
| `POST /moderation` | Flag a listing | `moderation.php:142` |

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
| `PATCH /reports/{id}/status` | Move **any** report along an allowed transition | `reports.php:322` |
| `GET /users/{id}` | See contact details, to arrange a handover | `users.php:107` |
| `GET /reports/stats` | The dashboard figures | `reports.php:457` |
| `GET /matches/{id}` | Read the proof notes on a case they are handling | `matches.php:468` |

**What staff deliberately cannot do**, and this is the boundary the project
brief asks for (CLAUDE.md §4.2 — *"must not have unrestricted administrator
privileges"*):

| | Refused by |
| --- | --- |
| List or manage accounts | `users.php:44` `require_role('admin')` |
| Change anybody's role | `users.php:199` |
| Suspend, reinstate or unlock an account | `users.php:199` |
| Manage pet categories | `categories.php:122, 179, 229` |
| See or resolve the moderation queue | `moderation.php:58, 186` |

### Administrator — `admin`

Everything above, plus:

| Endpoint | Allowed to |
| --- | --- |
| `GET /users` | List and filter accounts |
| `PATCH /users/{id}` | Change a role; suspend, reinstate, **unlock** |
| `POST`/`PATCH`/`DELETE /categories` | Manage the species list |
| `GET /moderation`, `PATCH /moderation/{id}` | Review a flag: dismiss, warn, remove, suspend |

Every one of these writes an `audit_logs` row naming the administrator, the
target and what changed. `role_changed`, `account_suspended`,
`account_reinstated`, `account_unlocked`, `category_changed`,
`moderation_resolved`.

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

`npm run audit` — **151 cases**, of which **31 are category D, Authorization**.
Each one is a request made by the wrong person to a real endpoint, with the
expected status code asserted.

`npm run multi-device` — **40 checks** across three independent sessions. The
ones that matter here:

* an administrator downgrades a role while three devices are signed in; all
  three are customers **on their very next request**, without refreshing;
* suspension drops all three to signed-out and a protected call from each
  returns 401;
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
