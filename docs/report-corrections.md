# Corrections to paste into the Phase 4 report

**ITS122P–AM5 · Group 3** · 25 September 2026 · test numbers (§2) updated 30 September 2026

The written report lives outside this repository, so these cannot be applied
from here. Each item below gives the stale text and the replacement, checked
against the running system on the date above.

`docs/feature-status.md` is the repository's own status document and is already
correct — if the two ever disagree, that file is the one that was checked.

---

## 1. "Known Limitations" — two items must come out

### 1.1 Photo upload

**Remove:** *"Uploaded photos are previewed but not yet persisted on the
server."*

That was true before the backend existed. It has not been true since the API
was built, and it was re-proved end to end rather than assumed:

* a photograph posted to `POST /api/reports/{id}/photos` creates a row in
  `report_images`;
* the file lands on disk under a generated name in `api/uploads/`;
* a **signed-out** visitor gets it back on the report;
* fetching its URL over HTTP returns `200 image/png`.

**Replace with** (if the section needs a positive statement):

> Photographs are validated by what the file *is* (`getimagesize`), not by its
> name or the type the browser claims, stored under a generated name in a
> directory configured never to execute anything, and recorded in
> `report_images`. They survive a refresh, a sign-out, and access from another
> device.

### 1.2 Pet category management

**Remove:** *"Administrator pet-category changes are not saved after reload."*

Also untrue since the API was built. Verified by creating, renaming, retiring
and deleting a category as an administrator and reading `pet_categories` back
at each step, then confirming a fresh visitor's `GET /api/categories` returns
the new name.

**Replace with:**

> Categories are full CRUD against MySQL, administrator only. Report counts
> come from SQL; deleting is refused while any report still uses the category
> — with a 409 that says how many are in the way — and retiring it is offered
> instead. Every change writes a `category_changed` row to `audit_logs`.

---

## 2. Testing numbers

| Stale | Correct |
| --- | --- |
| 117 test cases | **382** |
| C. Authentication: 13 | **41** |
| G. Functional: 24 | **44** |
| H. Error handling: 6 | **10** |
| axe-core over 25 pages | **31 pages** |

An earlier version of this list said 170 cases and 29 pages. That was the
suite on 25 September, before sections I to S were added; do not paste it.

Current table:

| Category | Cases | Passing |
| --- | --- | --- |
| A. Input validation | 19 | 19 |
| B. SQL injection | 14 | 14 |
| C. Authentication | 41 | 41 |
| D. Authorization | 31 | 31 |
| E. Cross-site scripting | 4 | 4 |
| F. File upload | 7 | 7 |
| G. Functional | 44 | 44 |
| H. Error handling | 10 | 10 |
| I. Location privacy | 8 | 8 |
| J. Report access | 27 | 27 |
| K. Information requests | 17 | 17 |
| L. Report editing | 31 | 31 |
| M. Report QA rules | 8 | 8 |
| N. Final integrity | 38 | 38 |
| O. Match rejection | 24 | 24 |
| P. Repeat matching | 11 | 11 |
| Q. Calendar dates | 3 | 3 |
| R. City names | 2 | 2 |
| S. Editing and matching | 18 | 18 |
| T. Reopening a decision | 25 | 25 |
| SQL-14 (inside B) asserts the ERD's 24 foreign keys | | |
| **Total** | **382** | **382** |

Authentication grew with the three-attempt lockout and CSRF. Error handling
grew when endpoint-level testing found a routing fault (§4). Functional grew
again in the final hardening pass, with the contact-preference and
collar-answer cases. Sections I to S were added in the final week: location
privacy, who may open what, a coordinator's questions, editing, the final
integrity rules, match rejection, repeat matching, calendar dates, city names,
and editing under an open pairing.

There is also a second suite the report does not mention yet:

> `npm run multi-device` — 73 checks across independent sessions, proving
> that a report change, a read-state change, a role downgrade, a suspension, a
> three-attempt lock, an administrator unlock and a server-side session expiry
> are all decided by the shared database rather than by any one device, and
> that a coordinator or administrator keeps one session at a time.

> `python scripts/auth_lifecycle.py` — 106 checks over registration,
> verification, the password reset, session revocation, the safe email change
> and rate limiting. It reads every link out of captured mail, because there is
> no endpoint that hands out a token.

---

## 3. Database counts

| Stale | Correct |
| --- | --- |
| 11 tables | **17** |
| 20 foreign keys | **24** |

The sentence to use, because the two numbers need explaining together:

> The database has **17 tables**. Fifteen are on the ERD. The other two are
> `schema_migrations`, which records which files in `database/migrations/` have
> been applied, and `auth_rate_limits`, which counts how recently an address
> asked for something — neither holds domain data and neither has a foreign
> key, so neither is drawn on a diagram of the domain.

Also: 17 primary keys (one per table), 9 unique constraints over 14 columns,
2 CHECK constraints, InnoDB throughout. (On the 15 ERD tables alone: 15
primary keys, 8 unique constraints over 12 columns.) Recounted 30 September;
an earlier version of this line said 15 and 7, counted before migrations 005
and 006. All counted from `information_schema` on the
running database, not read off `schema.sql`.

---

## 4. Two findings worth adding to the testing section

Both are stronger answers than "we tested the website", and both are true.

**Endpoint-level testing found a fault that unit-level reasoning could not.**
Every handler in `api/` was correct on its own. `api/index.php` passed only the
first two path segments to most of them, so a third was silently dropped and
the request answered as though it had never been typed — `GET
/api/matches/1/claims` returned the match, `GET /api/users/1/password` returned
the user. No unit was wrong, so only asking the running API for endpoints it
does not have could find it. Fixed; cases EH-07 to EH-10.

**Automated accessibility testing could not see the contrast problem.**
axe-core reported zero violations across all 31 pages, but it cannot judge text
over a photograph: it sees a transparent background, declines to guess what is
behind the words, and reports nothing. Measuring the actual rendered pixels —
hiding the text, photographing the page, comparing each text colour against
every pixel in its own box, at four widths — found three paragraphs under AA,
the worst at 1.17:1, on pages axe had already called clean.

---

## 5. If the report has a "Documentation" list

These were written after Phase 4 and are worth listing:

    docs/erd-defense.md                    the database, table by table
    docs/database-defense-cheatsheet.md    the one page to have in your head
    docs/role-permissions.md               what the server allows, per role
    docs/matching-explanation.md           how the score works
    docs/live-database-change-playbook.md  adding a column while being watched
    docs/presentation-defense.md           the page everyone reads
    docs/deployment-plan.md                hosting decision and the steps
    docs/lan-testing.md                    the multi-device rehearsal
    docs/hardening-audit.md                the security gaps, and which are closed
