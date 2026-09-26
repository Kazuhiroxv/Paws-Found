# How matching works

**ITS122P–AM5 · Group 3** · read out of `api/matching.php` on 25 September 2026

Every member should be able to explain this without notes, because it is the
only part of the system that is not obviously a form or a list, and it is
therefore the part most likely to be asked about.

---

## 1. The sentence to open with

> It is arithmetic, not judgement. Seven things are compared, each is worth a
> fixed number of points, the points are added up, and the report shows which
> ones matched and which did not. There is no artificial intelligence in it and
> no photograph is analysed.

If you say nothing else, say that. It answers *"is this AI?"* — no — and
*"then how does it work?"* — addition — in one breath.

---

## 2. What is compared, and what each is worth

`MATCH_WEIGHTS`, `api/matching.php:30`:

| Signal | Points | Matched when |
| --- | --- | --- |
| Species | **25** | The species codes are equal |
| Location | **20** | Within **15 km**, or the same city when either report has no coordinates |
| Breed | **15** | The breed text is equal, once trimmed and lower-cased |
| Colour | **15** | Primary **and** secondary colour both agree |
| Size | **10** | The size codes are equal |
| Date | **10** | The found date is **0 to 14 days after** the lost date |
| Characteristics | **5** | The two free-text descriptions share meaningful words |
| | **100** | |

The score is the sum of the weights of the signals that matched. Nothing else
contributes, and nothing is weighted by anything the code decides at run time —
which is why the list of signals shown on screen always explains the number
beside it. **The score cannot disagree with its own reasons.**

---

## 3. When a pairing is actually raised

Three conditions, all of them (`matching_is_worth_suggesting`, `:285`):

1. **Species matched.** A dog is never suggested as a cat, whatever else lines
   up. This is the one non-negotiable.
2. **Location matched.** Within 15 km, or the same city.
3. **Score ≥ 65** (`MATCH_MIN_SCORE`, `:53`).

Species and location are gates rather than merely heavy, and the reason is
worth stating: 25 + 20 = 45, so without the gates a pairing could clear 65 on
breed, colour, size and date alone — a small brown Aspin lost in Cebu and a
small brown Aspin found in Davao would score 65 and be suggested. It would be
arithmetically correct and useless.

**Why 65 and not 70 or 60?** It is a team decision, not a derived constant, and
the honest answer is that it is set where a plausible pairing gets through and
a coincidental one does not on the data we have. It is one named constant in
one file and CLAUDE.md §6.5 says the formula stays configurable until the team
approves it. Changing it is one line.

---

## 4. Two comparisons worth explaining properly

**Location.** If both reports have coordinates, the distance is computed with
the haversine formula and compared against 15 km. If either side has none — a
report filed without dropping a pin — it falls back to comparing the city name.
The detail line says which happened: *"The two areas are about 1 km apart"* or
*"Both reports are in Makati City."* You can always tell from the page which
comparison was made.

**Date.** The gap is signed. A found date **before** the lost date is not
"close enough to count", it is impossible, and the signal says so in those
words: *"The pet was found 3 days before it was reported missing."* Matched is
`0 <= gap <= 14`. A negative gap never matches, no matter how small.

---

## 5. What the system does NOT do

Worth having ready, because these are the questions that come after "is it AI".

* **No image recognition.** The photographs are for people to look at. Nothing
  in `matching.php` opens one.
* **No machine learning, no training data, no model.** Seven comparisons and an
  addition.
* **Nothing is decided automatically.** A pairing is a suggestion. It does not
  change either report's owner, does not release anybody's contact details, and
  does not tell anyone the pet is theirs. A person opens it, a person claims
  it, a Pet Coordinator verifies it, and only a confirmation closes both
  reports as returned.
* **The wording never overstates.** "Possible match", "potential match", "match
  suggestion" — never "this is your pet" (CLAUDE.md §6.5).

---

## 6. The workflow a pairing sits inside

    Possible Match → User Review → Verification Request → Staff Review
                   → Coordination → Returned / Rejected

Who may do what is in `role-permissions.md` §3. The short version: the two
reporters may ask for verification or dismiss it; only a Pet Coordinator may
confirm, reject or ask for more information; a confirmation closes **both**
reports as returned, in one transaction, because a half-applied confirmation
would leave one pet reunited and the other still missing.

A decided pairing is final. Confirming twice is refused with **409** — without
that, the second confirmation would notify both reporters again and add a
meaningless "returned → returned" entry to each case history.

---

## 7. If you are asked to prove it

Open any pairing. The page lists every signal with its own sentence:

> Both reports say dog. **25**
> The two areas are about 1 km apart. **20**
> Both reports say Shih Tzu. **15**
> Primary colour matches (brown), but the secondary colour differs: white vs tan. **0 of 15**
> Both reports say small. **10**
> Found one day after the pet was reported lost. **10**
> Both mention a chest patch, an ear that does not stand up, and a red collar. **5**

Add the matched ones: 25 + 20 + 15 + 10 + 10 + 5 = **85**. That is the number
at the top of the page. Doing that addition out loud, in front of the examiner,
is the strongest possible answer to *"how does your smart feature work?"* —
because the page has already shown its working and you are only reading it
back.

The one that did **not** match is the one worth pointing at. A system that only
shows its reasons when they agree is not explaining itself.

---

## 8. Where the numbers live, if they need changing

| | |
| --- | --- |
| Weights | `MATCH_WEIGHTS`, `api/matching.php:30` |
| Distance limit | `MATCH_MAX_DISTANCE_KM = 15`, `:41` |
| Day limit | `MATCH_MAX_DAY_GAP = 14`, `:44` |
| Threshold | `MATCH_MIN_SCORE = 65`, `:53` |
| Which statuses can be paired | `MATCH_OPEN_STATUSES`, `:56` |

Five constants at the top of one file, in the order they are used. Nothing is
scattered, and nothing is in the database — which means the scoring can be
explained, and changed, without a migration.
