# Correction 4 — the report lifecycle, before and after

"Pet coordinator muna sa reports bago mapost" (Kyle's notes, item 16; the
recording, rec 1 03:48–07:31): a Pet Coordinator reviews a report before it is
published. Also: saved drafts (item 12), and removed reports must not appear
as Closed (item 19).

## BEFORE (traced in `42b802c`, before any change)

```
wizard ─► petService.createReport() ─► POST /reports
           report_create():  INSERT locations, INSERT pet_reports (status 'active'),
                             status_logs  NULL → active  "Report created."
                             COMMIT
                             generate_matches_for_report()        ◄── matching at once
           ─► public immediately: Explore, map, home page, /pet/{id} for any member
```

| Where | What it did |
| --- | --- |
| `generate_matches_for_report()` | Called from `report_create()` (`reports.php:240`) and `report_update()` (`:383`) — on filing and on every owner edit. Nothing else. |
| Explore, the map, the home page, search | `GET /reports` — every report, filtered only by case status. |
| `/pet/{id}` | Any member: the full report. A guest: 401. |
| My reports | Every report the member filed, grouped by case status. |
| Staff report queue | The same list; its own comment says a "Pending Review" tab was deliberately not built "because the data model does not have it". |
| Moderation "remove" / "suspend" | `moderation_close_report()`: `UPDATE pet_reports SET status = 'closed'`, a `status_logs` row *active → closed*, open pairings dismissed. **A removed report became Closed** — in My reports' Closed tab, in "closed" counts, everywhere. |
| Seeded report 9 | Removed by moderation, stored as Closed with that fake closure entry. |
| Drafts | None. A half-filled form was lost on leaving the page. |
| Dashboards | `GET /reports/stats` counted every row. |
| Notifications | No word for submitted / published / rejected / removed; a removal used `report_flagged`. |

## AFTER

Two dimensions, never mixed:

```
                   PUBLICATION  (pet_reports.publication_status)
   (draft) ─► pending_review ─► published ─► removed
                     │   ▲
                     ▼   │ resubmit, after editing
                  rejected

                CASE  (pet_reports.status — unchanged)
   active ─► possible_match ─► returned / closed
```

A published report can be possible_match; a removed one keeps the case status
it had. Closed means one thing again: the case ended normally.

| Move | Who | Needs | Side effects |
| --- | --- | --- | --- |
| file (→ pending_review) | the reporter | every final rule | publication_logs; "submitted" notice; **no matching** |
| approve (→ published) | a Pet Coordinator or administrator, not the reporter | — | publication_logs; status_logs "Published after review."; "published" notice; audit `report_reviewed`; **matching**, after the commit |
| reject (→ rejected) | a coordinator or administrator, not the reporter | a reason | publication_logs; notice with the reason; audit `report_reviewed` |
| resubmit (→ pending_review) | the reporter | — | publication_logs; "submitted again" notice |
| remove (→ removed) | an administrator, from the report or through moderation | a reason | publication_logs; open pairings dismissed; notice with the reason; audit `report_removed` |

Anything else — draft → published, rejected → published, removed → anything,
an unknown action such as "cancel" — is refused by the server (`PUBLICATION_ACTIONS`
in `api/reports.php`).

| What | After |
| --- | --- |
| Drafts | `report_drafts`, MySQL. Saved by Save draft (no auto-save). Private to the author — not coordinators, not administrators. Loose validation (types, lengths, real values); the final rules apply on Submit. Photos are not kept with a draft. Deleting one deletes it. |
| Matching | Only published reports, both as subject and candidate (`matching_generate()` refuses otherwise, whoever calls it). Runs on approval and on an edit to a published Active report. |
| Who sees an unpublished report | Its reporter, coordinators, administrators. Anybody else: 404, exactly as a missing report — by URL, in lists, in search, and when flagging. |
| Lists | `GET /reports` returns published reports unless `publication=` is asked for and allowed: a coordinator or administrator any state; a member their own (`reporter_id` = them). |
| My reports | Tabs: Drafts · In review (pending, not approved) · Open · Returned · Closed · Removed (only when there is one). |
| Staff | **Report review**: the queue, oldest first, counted in the sidebar; Review opens the full report with Approve and publish / Not approved…. |
| Admin | Records list every report with its publication; the overview counts reports waiting for review. A published report can be removed from its page. |
| Dashboards | Active, Lost, Found, monthly and species figures count **published** reports only; publication states are counted separately. |
| Editing | published + active: as before (frozen under an open pairing). pending_review: frozen (photos filed with it may still upload). rejected: editable, then resubmitted. removed: frozen. returned / closed: as before. |

## Legacy reports (migration 010)

Every existing report became `published`, with **no** review record: none is
invented. A report removed by moderation before 010 is found by evidence —
Closed, an actioned moderation case, and its latest closure written by the
administrator who resolved that case — and becomes `removed`, its status put
back to what it was (Active if it was Possible Match), the removal moved from
`status_logs` to `publication_logs` with the same actor, note and time. In the
seed that is report 9; reports 8 and 14, closed by their reporters, stay Closed.

## Still open

- **Cancel** — Ma'am said "you cancel it, you reject it, or you accept it". What
  cancel does that reject does not is unknown: close the dialog, return the
  report to its reporter, the reporter withdrawing, an administrative
  cancellation, or something else. Not built. Adding it is one row in
  `PUBLICATION_ACTIONS` and, if it needs its own state, one ENUM value.
- **Withdraw submission** (pending → draft) — not built. A filed report is a
  `pet_reports` row with photographs; turning it back into a draft would mean
  undoing a filing. Not needed for the required flow; not presented as Cancel.

## Demonstration sequence (for later — not yet in the presentation)

1. **Customer laptop** — Report a lost pet; fill part of it; *Save draft*.
   Close the tab. My reports → Drafts → *Continue editing*; finish; *Submit
   for review*. The confirmation: "A Pet Coordinator must approve it before it
   appears publicly."
2. **Explore (signed out)** — the report is not there; its link says it does
   not exist.
3. **Pet Coordinator laptop** — Report review (the sidebar shows *Waiting 1*)
   → *Review* → the whole report → *Approve and publish*.
4. **Explore** — the report appears. If it resembles a found report, the
   coordinator's Match queue has a new possible match.
5. **DBeaver** — `SELECT report_id, publication_status, status FROM pet_reports
   ORDER BY report_id DESC LIMIT 3;` and `SELECT * FROM publication_logs ORDER
   BY log_id DESC LIMIT 3;` — the review, by whom, when.
6. Optionally: *Not approved…* with a reason on a second report; the customer
   sees the reason, edits, *Submit for review again*.
