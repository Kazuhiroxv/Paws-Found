# Post-defense correction register

Every correction requested after the 2 October 2026 demonstration, **with where
it came from**. The source matters: if anybody asks "did Ma'am actually say
that?", this table answers it without guessing.

| Source | Meaning |
| --- | --- |
| **AUDIO** | Present in the recordings. Quote and timestamp in `instructor-feedback-notes.md`; raw text in `maem-maylyn-raw.txt` / `maem-maylyn2-raw.txt`. |
| **NOTES** | Kyle's written notes taken during the defense. The master list. Not in the recordings unless also marked AUDIO. |
| **TEAM** | Observed by a team member (Hayns) after the defense. **Not attributed to Ma'am** unless also marked AUDIO. |

States: **done** (committed on `post-defense/revisions`), **in progress**,
**open**, **exists** (already built; the finding is about something else).

---

## The register

| # | Correction | Source | State | Commit |
| --- | --- | --- | --- | --- |
| 1 | API should connect to the database | NOTES | **done** — every workflow was already API → MySQL; mock residue removed from the production bundle | `5da6aee` |
| 2 | Confirm Password appears only once the password meets every requirement | NOTES | **done (Correction 2)** — emptied and hidden again if the password stops qualifying | Correction 2 |
| 3 | Confirm Password cannot be pasted; it must be retyped | NOTES | **done (Correction 2)** — paste and drop refused with a stated reason; the password box itself still accepts a paste | Correction 2 |
| 4 | IP address and session in logs, to spot malicious activity | NOTES | open | |
| 5 | Log every page, action and time, and every sign-in and sign-out | NOTES | open | |
| 6 | Different levels of administrator privilege | NOTES | open | |
| 7 | The site does not say you have been signed out | NOTES | open | |
| 8 | Disclaimer: no money involved, not affiliated, not responsible for false information | NOTES | open | |
| 9 | Pet name accepts one character | NOTES | open | |
| 10 | Breed, colour, city, province: contained or suggested values | NOTES + AUDIO (colours, rec 1 14:27–15:09) | open — see the finding below | |
| 11 | Reset button | NOTES | open — meaning unconfirmed | |
| 12 | Saved draft | NOTES | open | |
| 13 | Time shown with AM/PM | NOTES | open | |
| 14 | Map focused on the Philippines | NOTES | open | |
| 15 | Description of at least 30 characters | NOTES + AUDIO (rec 1 02:01) | open | |
| 16 | Pet Coordinator approves a report before it is posted | NOTES + AUDIO (rec 1 03:48–07:31) | open — Ma'am names **accept / reject / cancel**; "cancel" unconfirmed | |
| 17 | Presentation order: scope and limitations by role, then the ERD, then the demo | NOTES | open | |
| 18 | Other languages, such as Filipino | NOTES + AUDIO (rec 1 16:57, "you can also consider") | open | |
| 19 | Removed reports must not appear as Closed | NOTES + AUDIO (rec 1 18:58–19:21) | open | |

### Raised in the recordings, not in the written notes

| # | Correction | Source | State |
| --- | --- | --- | --- |
| N1 | No contact number on a report — "How would you be able to contact me?" | AUDIO (rec 1 00:15–00:50) | open |
| N2 | No guidance on how many photos to add | AUDIO (rec 1 01:32–01:52) | open |
| N3 | No feedback after Submit | AUDIO (rec 1 03:28–03:29) | **done (Correction 2)** — corroborated by T1; see T1 |
| N4 | Date filter not found — "lalabas lahat… kahit 5 years apart" | AUDIO (rec 2 00:33–00:50) | **done (Correction 2)** — it existed but was the last group and closed, so one click deep on a laptop and two below 1024px. Now under Species and open: visible on arrival from 1024px, one click (Filters) below |
| N5 | Print or export the report list to PDF | AUDIO (rec 2 01:28–01:53) | open |
| N6 | No XL size for a very large dog | AUDIO (rec 1 18:29–18:32) | open |
| N7 | Presentation logistics: two laptops, everyone waits | AUDIO (rec 1 10:47–10:56) | open — belongs with 17 |

### Observed by the team after the defense

These are Hayns' observations. **They are not in the recordings** and are not
attributed to Ma'am, except where marked.

| # | Observation | Source | State |
| --- | --- | --- | --- |
| T1 | After Ma'am submitted a form, the page stayed near the bottom while the confirmation appeared above; she had to scroll up to find out whether it worked | TEAM — corroborates N3 (AUDIO) | **done (Correction 2)** — the answer to a submit is scrolled to and focused on every significant form; moderation and reopening a pairing, which gave no confirmation at all, now do |
| T2 | First Name and Last Name should be separate fields, not one Full Name | TEAM | **done (Correction 2)** — migration 008; `full_name` is generated from the two |
| T3 | If a person's name is "Ja", the password must not contain "ja" anywhere ("123ja…", "…ja…") | TEAM | **done (Correction 2)** — at registration and reset, case-insensitive, every piece of either name |
| T4 | Ma'am used a touchscreen / 2-in-1 laptop and the interface looked different from Kyle's | TEAM | **done (Correction 2)** — the cause is **width, not touch**: nothing in the code detects touch. 150–175% Windows scaling on a 1920px screen gives ~1100–1280 CSS px, where the navigation becomes a menu button |

---

## Findings recorded along the way

**Correction 10 — `breed_id_for()` inserts every spelling.** Found while doing
Correction 1. `api/reports.php:1258` inserts any new breed text into
`pet_breeds`, so "Golden Retriever", "golden retriever" and "Golden Retriver"
become three rows, and no endpoint lists the table, so the form cannot suggest
from it. Needs one design across the API, the form, the matching rules and the
ERD.

**An intermittent sign-out race — already in production.** Checks SO-I/SO-J
fail under heavy CPU load and pass otherwise; reproduced on `2947a43`. Likely
cause: `refresh()` in `src/hooks/useSession.js` drops a re-check while one is
in flight. Not part of any correction above; recorded so it is not lost.

---

**Found during Correction 2 — changing your email from the profile would have
crashed.** The split-name change left a stale variable in the email-change
branch of `api/users.php`; the request died with a server error. Ordinary
profile saves were unaffected, which is why the main audit passed. Caught by
`auth_lifecycle.py` (G1) before commit.

**A cost of the name rule, accepted.** A two-letter name refuses every
password containing those two letters: "Li" refuses "harbour lights at six".
The checklist shows the rule live as the password is typed.

## Ambiguities to confirm before building

The recordings do not cover these, so they rest on the written notes alone:

- **Admin levels (6)** — how many, and what each may do.
- **Reset (11)** — reset what: the report form, a filter, a password?
- **Filipino (18)** — the whole site, or the community pages only?
- **Cancel (16)** — Ma'am's three actions are accept, reject and cancel. What
  does cancel do that reject does not?
- **Flagged posts (19)** — rec 1 11:49–11:52 may mean a flagged report should
  disappear *before* a decision. If so, anyone could hide any report by flagging
  it; confirm before building.
