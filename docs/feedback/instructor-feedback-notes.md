# Instructor feedback — what the recordings actually say

Interpretation of `maem-maylyn-raw.txt` (21:31) and
`maem-maylyn2-raw.txt` (4:35). **The raw transcripts are the
evidence; this file is a reading of them.** Quotes below are copied from the
raw files exactly, misheard words included, with their timestamps, so any
reading can be checked against the audio.

Transcribed 2 October 2026 with faster-whisper `medium` (int8), Tagalog
detected. The speech is Taglish, recorded on a laptop in a room with several
speakers, so many lines are garbled. Confidence is marked for every reading.

---

## Read this first: what the recordings do not cover

The two recordings are about 26 minutes of a longer session. **Six of the
items in Kyle's written notes do not appear in them at all**, so there is no
exact wording to recover for these:

| Item in the written notes | In the recordings? |
| --- | --- |
| API should connect to the database | **No** |
| Password: Confirm appears only when requirements pass; no paste | **No** |
| IP address / session in logs; log every page, action, time, sign-in, sign-out | **No** |
| Different admin levels of privileges | **No** |
| Reset button | **No** |
| Saved draft | **No** |
| Doesn't say you are signed out | No |
| Disclaimer | No |
| Pet name accepts 1 character | No |
| Time AM/PM | No |
| Map focused on the Philippines | No |

The ambiguous questions this transcription was meant to settle — how many admin
levels, what "Reset" resets, whether Filipino covers Staff and Admin — **are not
answered by these recordings.** They have to be settled from Kyle's notes, from
whoever was present, or by asking Ma'am. Nothing below should be used to
resolve them.

---

## What the recordings do say

### Pet Coordinator approval before a report is posted — clear, high confidence

This is the longest and clearest thread in the session.

> [03:48] Ang tanong, kailangan
> [03:50] paano mo mababalidate na
> [03:55] ang legit na report dito?
> [04:22] Kung kapita mo doon, i-accept muna.
> [04:24] I-accept mo yung report.
> [04:26] Kasi hindi lahat ng report ay legit.
> [04:30] So pwede mo siyang i-reject naman.

> [06:33] Sir Pins, immediately nag-post agad siya.
> [06:45] Kaya ngayon yun niantay ko sa inyo eh. Dapat may nag-a-accept mo na doon eh.
> [07:04] Hindi mo na na-control.
> [07:06] wherein kung nandan muna yun sa dashboard ng o-coordinator
> [07:10] siya ang magsasabi kung this is legit or hindi

> [07:18] Actually ang actions mo lang gag, it's either
> [07:20] you cancel it, you reject it, or you accept it.
> [07:24] Pag-accept na, saka pa rin siya bumunta.
> [07:26] Mag-reject, hindi siya mabubunta.
> [07:28] Diyan, hindi map-post.

**Reading.** A new report goes to the Pet Coordinator's dashboard first and is
not public until accepted. Her objection is that a report "immediately posted"
and, once many people have seen it, "hindi mo na na-control" — you can no longer
control it.

**She names three actions: cancel, reject, accept.** Accept publishes it;
reject means it is never posted. *This differs from the plan drafted after the
session*, which proposed accept / reject / **request revision**. "Request
revision" is not in the recording; "cancel" is. What she means by *cancel* as
distinct from *reject* is not clear from the audio — possibly the reporter
withdrawing it. Worth confirming before the workflow is built.

### Removed or reported posts should disappear — clear intent, medium confidence on detail

> [18:58] Bakit namabas pa rin ito?
> [19:04] Pero dapat hindi na siya.
> [19:15] Di ba, nireport ko na to?
> [19:17] Or napanggal na to pero napanggal na siya.
> [19:19] So dapat wala na siya.

> [11:46] Hindi-dismiss ko namin yung folder kasi yung coordinator na yun.
> [11:49] Hindi, dapat mawala na yung post ng pari niya.
> [11:52] Bago, mag-alagay ko siya ng decision mo.

**Reading.** At 18:58–19:19: a report that was flagged or removed was still
visible ("bakit nababasa pa rin ito?"), and it should not be. That supports
separating removal from ordinary closure.

At 11:49–11:52 there may be a *stronger* requirement: that a reported post
should disappear **before** a decision is made on it. The audio is too garbled
to be sure. If that is what she meant, it is a design decision with real
consequences — anyone could hide any report by flagging it — and should be
confirmed, not assumed.

### Controlled colours (and other free-text fields) — clear, high confidence

> [14:27] Kaya nga ibig sabihin dun sa pag-input ng user, especially puro mga texts ang nilalatay ngayon.
> [14:37] So, kailangan kong research mo even the colors, kong ano ang mga possible colors.
> [14:47] Or even dun sa choices, pwede kayong mag-doon sa color, kung hindi siya familiar, hindi sa kulan.
> [14:58] So, maglagay dito ng extra na space to own niyong kulay na to na peel.
> [15:04] O hindi kasi, kasi pwede ang i-report lang niya yung basic colors.
> [15:09] Alam ko lang parang brown eh, pero may iba pa palang klasi ng brown.

**Reading.** Inputs are all free text. Research the possible colours and offer
them as choices, **with an extra field for a colour that is not on the list**,
because a person may only know "brown" when there are several browns. This
confirms the "suggested values plus an escape hatch" design, in her words.
Recorded under Correction 10.

### Filipino language — clear, but stated as a suggestion

> [16:57] You can also consider
> [17:00] to include different language here,
> [17:03] especially Tagalog.

**Reading.** "You can also consider" — phrased as a suggestion, not a
requirement, in this recording. Nothing about which screens it covers.

### Scope and limitations — adoption is out of scope

> [20:43] Iyan, isa pa pala sa limitation siya ng boundary, so for adoption, it's not into them.
> [20:59] Reporting, matching, and then reporting yung count at siya.

**Reading.** State in the limitations that adoption is outside the system's
boundary; the system covers reporting and matching.

---

## Items in the recordings that are NOT in the written notes

These came up in the session and are missing from Kyle's list. Each needs a
decision on whether it is a required correction or a passing remark.

| # | What she raised | Where | Confidence |
| --- | --- | --- | --- |
| N1 | **No contact number.** "Pansin ko dito wala siyang contact number… How would you be able to contact me?" | rec 1, 00:15–00:50 | medium — she asks how a reporter can be contacted |
| N2 | **No guidance on photos.** "Ilan ba dapat? Wala nga nakalagay e… wala siyang instructions kung ilan ba." | rec 1, 01:32–01:52 | high — the form does not say how many photos |
| N3 | **No feedback after Submit.** "Wala rin feedback sa'ka. Pag-click ko na submit, ayun na." | rec 1, 03:28–03:29 | medium |
| N4 | **No date filter** — every lost report shows "kahit na 5 years apart". | rec 2, 00:33–00:50 | high |
| N5 | **Print / export the report list to PDF.** "Gusto kong iprint sa PDF. Wala… pwede siyang i-print sa PDF, waka yan ang di-print sa printer." | rec 2, 01:28–01:53 | high |
| N6 | **No XL size** for a very large dog. "Paano kung XL siya? Yung sobrang laking dog." | rec 1, 18:29–18:32 | medium |
| N7 | **Presentation flow.** Two laptops, one as admin, one as coordinator, "kaya naman naghihintayan tayo" — everyone waits. | rec 1, 10:47–10:56 | high — ties to item 17 |

Suggestions she made, worded as ideas rather than corrections:

- recognising frequent reporters with awards or small gifts, because reporting
  is "big effort" (rec 2, 02:37–02:55);
- linking with other sites or organisations (rec 1, 20:23);
- **adding AI**, including on the map pictures (rec 1, 20:03; rec 2, 03:57).
  The project deliberately has no AI (`docs/DECISIONS.md`); she frames it as
  how the system could go further, not as a correction.

**N4 already exists.** Explore has a from/to date filter
(`dateFrom`/`dateTo` in `src/components/FilterPanel.jsx`), enforced by the API
(`date_from`/`date_to`, `api/reports.php:1357`). So the finding is that she
could not find it during the demonstration — a discoverability problem in the
filter panel, not a missing feature. Fix the presentation, not the backend.

---

## Logistics she stated (rec 2, 03:01–03:53)

> [03:01] So I hope you already set all of the corrections
> [03:07] that I told you a while ago, and then you just wait na lang po, when it will be the next presentation, so most probably through Zoom na lang, and then you will submit the remaining documentations siguro before 11th week.
> [03:27] but all corrections should be finished

- **All corrections finished** before the next presentation.
- The next presentation is **most likely over Zoom**.
- Remaining documentation **before the 11th week**.
- She wants to see the changes, and the testing.

---

## How to use this

- The **raw transcripts** are untouched and are the record. If a quote here
  looks wrong, the raw file and the audio settle it.
- **Do not implement from a garbled line.** Where confidence is medium or the
  wording is unclear, confirm with someone who was in the room.
- The items the recordings do not cover still come from Kyle's written notes,
  which remain the master list.
