# Presentation defence

**ITS122P–AM5 · Group 3** · written 25 September 2026

Ma'am asks any member about any part. This is the page everyone reads,
whatever they built.

The other five are deeper on one subject each:

| | |
| --- | --- |
| `erd-defense.md` | The database, table by table |
| `database-defense-cheatsheet.md` | The one page to have in your head |
| `role-permissions.md` | What the server allows, per role |
| `matching-explanation.md` | How the score works |
| `live-database-change-playbook.md` | Adding a column while being watched |

---

## 1. The system in four sentences

> Paws&Found is a lost-and-found pet platform for a community. Somebody files a
> structured lost report; somebody else files a found report; the system
> compares them on species, location, breed, colour, size, date and
> distinguishing features, and raises a **possible match** with the reasons
> shown. A Pet Coordinator verifies ownership before contact details are
> exchanged, and confirming the match closes both reports as returned.
> It is React on the front, a PHP REST API of our own in the middle, and MySQL
> underneath.

If you can say that, you can find your way into any follow-up question.

---

## 2. The request, end to end

Be able to trace one request out loud. This is the single most likely "explain
your architecture" question, and a specific answer beats a diagram.

**Signing in:**

1. `LoginPage.jsx` submits to `userService.signIn()`.
2. `src/services/api.js` sends `POST /api/auth/login` with
   `credentials: 'include'` (which is what carries the cookie) and the CSRF
   token in a header.
3. `.htaccess` rewrites the URL and hands it to `api/index.php` — **every**
   request reaches that one file.
4. `index.php` verifies the CSRF token **once, before the router**, so an
   endpoint added later is protected by existing rather than by somebody
   remembering.
5. It dispatches on the first path segment: `auth` → `api/auth.php`.
6. `auth_login()` reads the account with a prepared statement, checks the lock
   **before** `password_verify`, and on success writes `$_SESSION['user_id']`
   and rotates the CSRF token.
7. The response is JSON. React stores nothing but the user object in memory;
   the session lives in the cookie.

**The two sentences inside that worth knowing:**

* *"The session holds one thing: the user id. The role is read from the
  database on every single request."* — that is why a role change reaches three
  devices without anybody signing in again.
* *"The lock is checked before the password is verified."* — otherwise a locked
  account would still tell an attacker when they had guessed right.

---

## 3. The eleven questions, with answers

**"Is this validation client-side or server-side?"**
Both, and they do different jobs. The browser gives an immediate, polite answer
— required fields, the shape of an email, a date that is not in the future. The
server re-checks **every one of them**, because the browser's version can be
turned off, edited, or bypassed entirely by a request that never touched a
browser. Category A of our test suite is 19 cases that do exactly that. The
honest sentence: *"client-side validation is a convenience for the user;
server-side validation is the only one that is security."*

**"Why is this field required?"**
Every required field on a report is something a stranger could check on the
spot. Species, colour, size, area, date. A found report never requires a pet
name — the finder is not expected to know it.

**"Where are the passwords?"**
There are none. `users.password_hash` holds a bcrypt hash from PHP's
`password_hash()`. Nobody, including us, can read one back.

**"How do you stop SQL injection?"**
PDO prepared statements everywhere, with `ATTR_EMULATE_PREPARES => false`
(`api/db.php:45`), so values go to the server separately from the SQL text.
Thirteen payloads in category B; after every one, the schema still has 15
tables and `pet_reports` still has 32 rows.

**"What happens on the third wrong password?"**
First and second: refused, with the number of attempts left. Third: the account
is **locked** and only an administrator can lift it. The counter is a row in
`login_attempts`, keyed on the **email typed** — so an address that belongs to
nobody counts down identically, and the message never becomes a way of asking
which addresses are registered. Proven by `npm run multi-device` step F: after
three wrong attempts on one device, the **correct** password on another device
is still refused.

**"Can a Customer reach the admin page?"**
No — and the important half is the second half. The route refuses it in the
browser, *and* calling the API directly returns 403. Hiding a button is not
security. See `role-permissions.md` §6.

**"Is this AI?"**
No. Seven comparisons, fixed weights, added up. No image recognition, no model,
no training data. `matching-explanation.md` §7 has a worked example that adds
to 85 — do the addition out loud.

**"How do you know who changed this?"**
`audit_logs`, append-only, thirteen actions: sign-in, failed sign-in, lock,
unlock, role change, suspend, reinstate, register, sign-out, report status
change, match decision, moderation decision, category change. Each row names
the actor, the target, the outcome and a readable detail.

**"What about privacy?"**
A public report shows the reporter's **name** — an anonymous lost-pet report is
hard to trust. It does **not** show their phone or email unless they published
them on that report, and the server leaves those fields out of the JSON
entirely rather than hiding them in the page. Locations are barangay-level and
drawn as a circle, so the imprecision is visible rather than implied. The
Privacy Notice is at `/privacy` and agreement is recorded per version in
`privacy_consents`.

**"What if I ask you to add a database field right now?"**
See `live-database-change-playbook.md` §5. Back up, write a numbered additive
migration, apply, `DESCRIBE`, show `COUNT(*)` unchanged, mirror into
`schema.sql`.

**"How many tables?"**
**15.** Fourteen on the ERD; the fifteenth is `schema_migrations`, which is
infrastructure. Say both numbers — `SHOW TABLES` gives 15, and a diagram
showing 14 without that sentence looks like an omission.

---

## 4. How we tested — the answer that is better than "we tested it"

Three things, and each one found something reading the code did not.

**1. Endpoint-level testing found a router fault.** `npm run audit` — 151 cases
in eight categories, run against the live system, restoring the data
afterwards. Every handler in `api/` was correct **on its own**. But
`api/index.php` passed only the first two path segments to most of them, so a
third was silently dropped and the request answered as though it had never been
typed:

    GET /api/matches/1/claims   ->  200, the match
    GET /api/users/1/password   ->  200, the user

Unit-level reasoning could not have found that, because no unit was wrong. Only
asking the running API for endpoints it does not have did. Cases EH-07 to
EH-10.

**2. Automated accessibility testing could not see the contrast problem.**
`npm run a11y` runs axe-core over all 26 pages in every role: zero violations.
But axe cannot judge text over a photograph — it sees a transparent background,
declines to guess what is behind the words, and reports nothing. So we hid the
text, photographed the page, and compared each text colour against **every
pixel inside its own box**, at 390, 768, 1366 and 1920. That found three
paragraphs under AA, the worst at **1.17:1**, on pages axe had already called
clean. The readings are in `docs/design-system.md`.

**3. Multi-device testing proved the database is the authority.**
`npm run multi-device` — 40 checks across three independent sessions. A role
change on one device takes effect on the other two on their very next request.
Three wrong passwords on one device refuse the correct password on another.

The sentence to say: *"Automated tools tell you about the things they can see.
Both of the real faults we found were in the gap between what a tool checks and
what a person actually does."*

---

## 5. What is honestly not there

Say these plainly if asked. A clean "no, and here is why" is worth more than a
hedge.

* **No email verification.** Registering does not send an email. Nothing in the
  system depends on an address being reachable.
* **No messaging between users.** Contact happens through the details a
  reporter chose to publish, or through a coordinator. The interface never
  offers a message box it cannot deliver.
* **No location heatmap.** There is a map with markers and an approximate-area
  circle; there is no density layer.
* **No rate limit on registration.** The three-attempt lock covers sign-in
  only.
* **No self-service account deletion.** Accounts are suspended rather than
  deleted, so case histories stay readable. The Privacy Notice says so in those
  words rather than implying otherwise.
* **The seeded accounts share one weak password.** Fine for a demonstration,
  and the reason the live site must not be shared beyond the class while they
  exist.

---

## 6. Who owns what

| Member | Part | Should be strongest on |
| --- | --- | --- |
| Kyle Austria | Project Manager / Analyst | The whole story end to end; this page; the privacy notice |
| Calvin Velasco | Frontend | The request trace §2; validation client vs server; responsive behaviour |
| Heinz Zaulda | Backend | Sessions, the lock, CSRF, the role checks |
| Dominic Citra | Database / API | `erd-defense.md`; the migration playbook |
| Francezka Espiritu | QA / Security | §4 — the three testing methods and what each found |

**Everyone** should be able to answer §3's first, fifth, sixth, seventh and
last questions. Those are the ones most likely to be asked of whoever happens
to be standing closest.

---

## 7. On the day

* Open the URL on all three devices **before** the session starts and sign in
  on each.
* Have phpMyAdmin already open on the `pawsandfound` database.
* Have `npm run audit` and `npm run multi-device` ready to run in a terminal —
  each finishes in well under a minute and prints a table.
* Have the database exported to a `.sql` file, on two machines.
* Know how to reset: re-import `database/seed.sql`. Back to 32 reports, 10
  accounts, an empty audit log, no lock counters.

And if something does break in front of her: say what broke, say what you would
check first, and reset. A group that can diagnose its own system reads better
than one that has never seen it fail.
