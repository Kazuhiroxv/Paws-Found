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
**open**, **exists** (already built; the finding is about something else),
**deferred** (recorded on purpose, not built in the correction that met it),
**AWAITING CLARIFICATION** (cannot be built until its meaning is confirmed).

**Where things stand after Correction 7 (4 October 2026):**

| Item | State |
| --- | --- |
| Disclaimer (8) | **DONE** |
| Filipino (18) | **DONE** |
| Print / PDF of the report list (N5) | **DONE** |
| Privacy Notice acknowledgement (team item) | **DONE** |
| Reset (11) | **AWAITING CLARIFICATION** |
| Cancel (16) | **AWAITING CLARIFICATION** |
| Contact number (N1) | **AWAITING INSTRUCTOR-INTENT CONFIRMATION** |
| Final ERD | **PENDING FINAL SCHEMA PASS** |
| Final presentation (17, N7) | **PENDING** |

No further features are added unless one of the clarifications arrives. Then:
the final schema freeze, the final ERD, the role scope and limitations, a
deployment rehearsal, and the final presentation and live demonstration.

---

## The register

| # | Correction | Source | State | Commit |
| --- | --- | --- | --- | --- |
| 1 | API should connect to the database | NOTES | **done** — every workflow was already API → MySQL; mock residue removed from the production bundle | `5da6aee` |
| 2 | Confirm Password appears only once the password meets every requirement | NOTES | **done (Correction 2)** — emptied and hidden again if the password stops qualifying | Correction 2 |
| 3 | Confirm Password cannot be pasted; it must be retyped | NOTES | **done (Correction 2)** — paste and drop refused with a stated reason; the password box itself still accepts a paste | Correction 2 |
| 4 | IP address and session in logs, to spot malicious activity | NOTES | **done (Correction 5)** — every sign-in is a `user_sessions` row: account, IP, browser user agent, start, last seen, end and why; known by a random reference, never the PHP session id. The IP is the visitor's even behind Railway's proxy (Railway's `X-Real-IP`, used only when the deployment is Railway — Correction 5A), and a forged header is ignored everywhere else. Shown to administrators on Logs → Sessions | Correction 5 |
| 5 | Log every page, action and time, and every sign-in and sign-out | NOTES | **done (Correction 5)** — `user_activity_logs`: each page a signed-in person opens (the path only), every meaningful action written by the endpoint that did it, sign-in and sign-out, each with time, IP and session. Logs → Activity, filtered and paged | Correction 5 |
| 6 | Different levels of administrator privilege | NOTES | **done (Correction 6)** — Ma'am asked for *different admin levels*; she did not specify how many or which. **Team design:** three levels of the one Administrator role (`users.admin_level`): Moderator (moderation), Manager (+ accounts, categories), Super Administrator (+ roles, levels, administrators, Logs). Enforced on the server by capability; matrix and each role's limits in `docs/role-permissions.md` | Correction 6 |
| 7 | The site does not say you have been signed out | NOTES | **done (Correction 5)** — the server says why a session ended (`session_ended`) and the page says it in words: signed out, inactivity, time limit, signed in on another device, password changed, access changed, locked, suspended | Correction 5 |
| 8 | Disclaimer: no money involved, not affiliated, not responsible for false information | NOTES | **DONE (Correction 7)** — a full `/disclaimer` page (academic and non-commercial; "Paws&Found does not process payments or financial transactions."; no affiliation with shelters, clinics, LGUs or authorities; information comes from users and may be inaccurate; no guarantee of recovery or of a match; meeting and handover safety), in measured words — no claim of immunity. Short notices where they matter: every page's footer, the report form's review step (informational; no checkbox), and a confirmed match's handover. Rewards: the interface has no reward or fee field and the disclaimer says no payment is handled; text a reporter types is theirs. **Privacy Notice acknowledgement (team item, same correction): DONE** — accounts that agreed to an older notice version see a non-blocking "Review Privacy Notice / Acknowledge" message; the acknowledgement is a `privacy_consents` row (no migration) | Correction 7 |
| 9 | Pet name accepts one character | NOTES | **done (Correction 3)** — a lost pet's name needs 2 letters or digits ("Bo", "CJ", "R2"); letters, digits, spaces, `'` `.` `-` only; same rule in the form and the API | Correction 3 |
| 10 | Breed, colour, city, province: contained or suggested values | NOTES + AUDIO (colours, rec 1 14:27–15:09) | **done (Correction 3, 3A)** — breed: the species' listed breeds (typed ones kept, never suggested); colour: a list of 17; place: PSA's PSGC as of 30 June 2026 — a list of 84 *areas* (PSA's 82 provinces, Metro Manila, BARMM's Special Geographic Area; never "84 provinces") then the city or municipality, depending on it. All from MySQL through `/api/reference` | Correction 3, 3A |
| 11 | Reset button | NOTES | **AWAITING CLARIFICATION — exact Reset behavior not established.** Not built: reset the report form, a filter, or a password? | |
| 12 | Saved draft | NOTES | **done (Correction 4)** — Save draft on every step of the report form; drafts kept in MySQL (`report_drafts`), private to their author, continued from My reports on any device; never public, never matched. Manual save; no auto-save. Text and structured report data are saved; photos must be added again when the draft is resumed | Correction 4 |
| 13 | Time shown with AM/PM | NOTES | **done (Correction 3)** — Hour / Minutes / AM or PM on the form, "1:05 PM" on the review and the report page; the API and the TIME column stay 24-hour | Correction 3 |
| 14 | Map focused on the Philippines | NOTES | **done (Correction 3)** — opens on the whole country, cannot be dragged far off it, refuses a pin outside it (in the browser and the API); a pin never changes the province or city | Correction 3 |
| 15 | Description of at least 30 characters | NOTES + AUDIO (rec 1 02:01) | **done (Correction 3)** — counted after trimming, runs of spaces counted once; a live "18 / 30 minimum" | Correction 3 |
| 16 | Pet Coordinator approves a report before it is posted | NOTES + AUDIO (rec 1 03:48–07:31) | **done (Correction 4) — except Cancel.** A filed report waits for review (`publication_status = pending_review`), is not public and not matched; a Pet Coordinator approves (published, then matched) or marks it not approved with a reason (the reporter edits and resubmits). Since Correction 6A **only a Pet Coordinator** makes this decision: every administrator level gets 403 and no button. **Cancel: AWAITING CLARIFICATION** — see below | Correction 4 |
| 17 | Presentation order: scope and limitations by role, then the ERD, then the demo | NOTES | **PENDING** — final presentation not started (after the final schema pass and the final ERD, which is **PENDING FINAL SCHEMA PASS**) | |
| 18 | Other languages, such as Filipino | NOTES + AUDIO (rec 1 16:57, "you can also consider") | **DONE (Correction 7)** — English and Filipino across the whole interface, public, customer, Pet Coordinator and Administration (the scope is the team's decision, not Ma'am's words); a labelled language control in the header, the phone menu and the workspace rail; kept in this browser (`localStorage`), English by default, no database change; `<html lang>` `en`/`fil`. What people typed, notifications and match reasons (server-written), emails and stored values are not translated — see `docs/localization.md` | Correction 7 |
| 19 | Removed reports must not appear as Closed | NOTES + AUDIO (rec 1 18:58–19:21) | **done (Correction 4)** — removal is its own publication state (`removed`), never `status = closed`; no Closed entry is written; legacy removals (seeded report 9) converted by migration 010 on evidence | Correction 4 |

### Raised in the recordings, not in the written notes

| # | Correction | Source | State |
| --- | --- | --- | --- |
| N1 | No contact number on a report — "How would you be able to contact me?" | AUDIO (rec 1 00:15–00:50) | **IMPLEMENTED, AWAITING INSTRUCTOR-INTENT CONFIRMATION.** *Current implementation ≠ confirmed final requirement.* Built (Correction 3): a phone number is never shown on a report — the form no longer offers it, the API ignores a crafted `show_phone=true` and does not read the number for a report; the account keeps its number and Pet Coordinators still see it. Email unchanged (opt-in, signed-in members only). The recording ("Pansin ko dito wala siyang contact number… How would you be able to contact me?… wala naman kayong pinigay na number?") could mean any of: **A** a contact number must be collected; **B** it must be required; **C** it must be shown publicly; **D** there must simply be a clear way to reach the reporter. Nothing here attributes one of those to Ma'am. The team's preferred eventual design is D (controlled contact, not publishing everybody's number) — a preference, not her requirement. The privacy notice is not changed again for this item until it is confirmed. |
| N2 | No guidance on how many photos to add | AUDIO (rec 1 01:32–01:52) | **done (Correction 3)** — optional, up to 5, JPEG/PNG/WebP, 5 MB, first is the main photo: stated before choosing; "2 of 5 photos added" |
| N3 | No feedback after Submit | AUDIO (rec 1 03:28–03:29) | **done (Correction 2)** — corroborated by T1; see T1 |
| N4 | Date filter not found — "lalabas lahat… kahit 5 years apart" | AUDIO (rec 2 00:33–00:50) | **done (Correction 2)** — it existed but was the last group and closed, so one click deep on a laptop and two below 1024px. Now under Species and open: visible on arrival from 1024px, one click (Filters) below |
| N5 | Print or export the report list to PDF | AUDIO (rec 2 01:28–01:53) | **DONE (Correction 7)** — "Print / Save as PDF" on Explore (Ma'am's example), the Pet Coordinator's Report queue and Administration's Reports: the browser's own print dialog, so "Save as PDF" needs no library. Prints every report the current filters select (not only the page showing), the filters themselves, and only public report fields (no contact details, IPs or security data); headings follow the language showing |
| N6 | No XL size for a very large dog | AUDIO (rec 1 18:29–18:32) | **done (Correction 3)** — `xl`, "Extra Large (XL)", in the form, Explore, cards and matching; size weight unchanged |
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

**Correction 10 — `breed_id_for()` inserts every spelling. Resolved by
Correction 3.** Found while doing Correction 1: any new breed text became a
`pet_breeds` row, and no endpoint listed the table. Now `pet_breeds.is_listed`
marks the curated list, `/api/reference/breeds` serves only that, and a typed
breed is stored unlisted, so it is never suggested to anybody. A spelling in
another case ("shih tzu") uses the listed row.

## Defects found during the corrections

Not instructor items, and not attributed to Ma'am. Tracked here so they are
fixed deliberately rather than remembered.

| # | Defect | Found | State |
| --- | --- | --- | --- |
| D1 | **Sign-out race, already in production.** Checks SO-I/SO-J fail intermittently under heavy CPU load and pass otherwise; reproduced on `2947a43`. Cause: `refresh()` in `src/hooks/useSession.js` dropped a re-check while one was in flight, so a sign-out in another tab could go unnoticed until the next one. | Testing Correction 2 | **fixed (Correction 5)** — a check asked for during another is queued; a check that began before a sign-in/out in the tab is discarded; any 401 re-checks. Reproduced deterministically by `test:session-ui` RACE-1…4 (stale answer held at the network): the old hook fails RACE-1, 3 and 4 every time; the fix passes all. Production keeps the defect until Correction 5 is deployed |
| D2 | `verify:deploy --upload` picks the demo account's newest report from `/reports/activity`; on freshly seeded data that is report 1, which is Possible Match, and photos may only be added to an Active report, so 5.1–5.2 fail with 409. The upload path itself works (audit UP-01, report UI PHOTO-6). | Correction 3 gate | **open** — the verifier should choose an Active report |
| D3 | Running a migration through XAMPP's `mysql` client without `--default-character-set=utf8mb4` stores mojibake ("Las PiÃ±as"). `009` now says `SET NAMES utf8mb4` itself; `001`–`008` have no non-ASCII text. | Correction 3 | **fixed in 009**; the flag stays in every documented command |
| D4 | **"84 provinces."** Correction 3 called its 84-entry place list provinces — the table (`ph_provinces`), the API (`/reference/provinces`), the form label and the report. PSA has **82** provinces; NCR has none. The 84 were 82 provinces plus two groupings the application added (Metro Manila, the Special Geographic Area). It also used PSA's July 2025 file, a year behind. | Kyle's review of Correction 3 | **fixed (Correction 3A)** — `ph_areas` with `area_type` (82 province / 1 ncr / 1 special_area), `/reference/areas`, label "Province or Metro Manila"; data from PSA's own 30 June 2026 file (4 municipality names changed). 009 revised before any deploy |
| D5 | **The visitor's IP was Railway's.** `client_ip()` read `REMOTE_ADDR` only; behind Railway's edge that is the proxy, the same for every visitor, so the audit log recorded one address for everybody and the registration and reset rate limits counted all visitors as one. | Correction 5 audit | **fixed (Correction 5, hardened in 5A)** — Correction 5 believed `X-Forwarded-For` from 100.0.0.0/8, a range Railway does not guarantee; 5A uses Railway's documented `X-Real-IP` only when the deployment is Railway (`BEHIND_RAILWAY_EDGE`), `REMOTE_ADDR` elsewhere, no address range trusted. Confirm on production after deploy (`docs/security-activity-logging.md`) |
| D6 | **A suspended or locked account's session came back on reinstatement.** `current_user()` refused it but kept it. | Correction 5 audit | **fixed (Correction 5)** — the session ends; the person signs in again |
| D7 | **Suspend on the Users page always failed.** The dialog never sent a reason, and the server has required one for a suspension since the hardening pass; the page showed the 422. | Correction 6 audit | **fixed (Correction 6)** — the dialog asks for the reason and waits for one (admin-levels UI MAN-UI-5/6) |
| D8 | **An administrator could publish a report without a Pet Coordinator.** Correction 4's server rule accepted a coordinator *or* an administrator for approve and reject, and Correction 6 kept it, so any administrator level could approve a pending report from its page — bypassing Ma'am's coordinator review. | Kyle's review of Correction 6 | **fixed (Correction 6A)** — `role = 'staff'` only; administrators 403 and no button; REV-ROLE-01…12, REV-UI-1…6 |
| D9 | **A session idle through a suspension revived on reinstatement.** Correction 5 ended the session records, but not the session generation. | Correction 6A audit | **fixed (Correction 6A)** — suspension and lock bump `session_version` (admin-levels MAN-05b) |
| D10 | **The Report review page showed the stored size code** (`xl`, `medium`) instead of its label, and the colour as stored. | Correction 7 translation pass | **fixed (Correction 7)** — the same labels as everywhere else, in either language |
| D11 | **An administrator could not open the Privacy Notice** (`AdminStaysInWorkspace` sent `/privacy` to `/admin`), so the new notice-update message would have linked nowhere. | Correction 7 | **fixed (Correction 7)** — `/privacy` and `/disclaimer` stay open to administrators; the rest of the public site still sends them to `/admin` (UI ADMIN-SITE-1) |

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

- **Admin levels (6)** — built (Correction 6) as the team's design: three
  levels. If Ma'am meant something different, the levels are one table
  (`ADMIN_CAPABILITIES`) and one ENUM to change.
- **Reset (11)** — AWAITING CLARIFICATION — exact Reset behavior not
  established. Reset what: the report form, a filter, a password?
- **Contact number (N1)** — AWAITING INSTRUCTOR-INTENT CONFIRMATION. Which of
  these did she mean: A collected, B required, C shown publicly, or D a clear
  way to reach the reporter? Built for now: never published, coordinators see
  it.
- **Filipino (18)** — built (Correction 7) for the whole interface, the team's
  choice for a coherent feature; Ma'am's words were only "you can also
  consider".
- **Cancel (16)** — AWAITING INSTRUCTOR-INTENT CLARIFICATION. Ma'am's three
  actions are accept, reject and cancel; accept and reject are built
  (Correction 4). Cancel could mean: A closing the decision dialog with no
  action; B the coordinator returning the report to its reporter; C the
  reporter withdrawing their submission; D an administrative cancellation; E
  something else. None is built or assumed. The recordings give no more than
  "you cancel it, you reject it, or you accept it".
- **Flagged posts (19)** — rec 1 11:49–11:52 may mean a flagged report should
  disappear *before* a decision. If so, anyone could hide any report by flagging
  it; confirm before building.
