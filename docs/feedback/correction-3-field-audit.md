# Correction 3 — every report field, before and after

Traced page → wizard (`src/components/report-form/`) → `petService` →
`api/reports.php` → MySQL, on 2 October 2026, before anything was changed;
then again after. "Matching" is `api/matching.php`; "Explore" is the filter
panel; "Public" is what a signed-out visitor's list row carries (the detail
page needs a session).

## BEFORE (as committed in `ad3f622`)

| Field | Control | Browser rule | Server rule (`report_validated`) | API name | Column | Matching | Explore | Public |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pet name | text, max 40 | lost: not blank | lost: not blank — **"A" accepted** | `pet_name` | `pet_reports.pet_name` | — | free-text search | yes |
| Species | select (categories API) | required | active category code | `species` | `category_id` FK | gate, 25 | select | yes |
| Breed | **free text**, max 60 | breed or feature | breed or feature; "other" names the animal | `breed` | `breed_id` FK → `pet_breeds` — **every new spelling inserted** (Correction 10) | equality, 15 | search only | yes |
| Size | select small/medium/large | required | ENUM list | `size` | `pet_size` ENUM | equality, 10 | select | yes |
| Sex | select | required | male/female/unknown | `sex` | `pet_sex` | — | — | yes |
| Main colour | **free text**, max 30 | not blank | not blank | `primary_color` | VARCHAR(40) | equality (case-insensitive), 15 | **text, substring** | yes |
| Other colour | **free text**, max 30 | — | length only | `secondary_color` | VARCHAR(40) | must agree if both given | substring | yes |
| Distinctive features | textarea, 300 | breed or feature | same | `distinct_features` | TEXT | shared words, 5 | search (signed in) | no |
| Description | textarea, 1000 | **not blank** | **not blank** | `description` | TEXT | — | search (signed in) | no |
| Date | date | required, not future | valid, not future (Manila) | `incident_date` | DATE | ±14 days, 10 | from/to | yes |
| Time | **`<input type=time>`** (AM/PM only if the browser's locale shows it) | — | `HH:MM(:SS)` | `incident_time` | TIME | — | — | no |
| Where | text, 120 | required | required | `location_label` | `locations.label` | — | search (signed in) | no |
| City | **free text**, 60 | required | **not blank — anything** | `city` | `locations.city` | name rule when no pin | **text, substring** | yes |
| Province | **free text**, 60 | required | **not blank — anything** | `province` | `locations.province` | name rule | — | yes |
| Map pin | Leaflet, centre 12.88/121.77 zoom 5, **no bounds** | — | **±90 / ±180 only** | `lat`, `lng` | DECIMAL(9,6) | distance ≤ 15 km, 20 | map | snapped to 0.004° grid |
| Collar / condition | select / text (found) | collar required | same | `has_collar`, `condition` | ENUM / VARCHAR | — | — | no |
| Photos | file, up to 5, JPEG/PNG/WebP, 5 MB, first = main | per file | `PHOTO_MAX_PER_REPORT` 5, `PHOTO_MAX_BYTES`, MIME by content | multipart | `report_images` | — | card thumbnail | primary only |
| Contact | 3 checkboxes; **"Show my phone number on the report"** | one of three | one of three; phone only with a number | `allow_platform_contact`, `show_phone`, `show_email` | BOOLEANs | — | — | **phone shown on the detail page to any signed-in member when ticked** |

Seeded data at the time: 32 reports, 15 places (Metro Manila ×5 cities, Cebu,
Davao del Sur, Iloilo, Negros Occidental, Benguet, Misamis Oriental, Palawan,
Pampanga, Rizal, Zamboanga del Sur), colours Black/Brown/Cream/Golden/Green/
Grey/Orange/Tan/White plus **both "Tricolor" and "Tricolour"**, and secondary
Peach/Yellow; sizes small 14, medium 13, large 5; every report had a time;
descriptions 84–204 characters; no lost pet name under 3 characters.

## AFTER (Correction 3)

| Field | Control | Rule (browser = server, shared cases) | API name | Column | Matching | Explore | Public |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pet name | text, 40 | lost: ≥ 2 letters/digits; letters, digits, spaces, `'` `’` `.` `-` only; spaces tidied | `pet_name` | unchanged | — | search | yes |
| Breed | **select** of the species' listed breeds ("Not sure", …, "Mixed breed", "Not in the list — type it") | optional; a typed breed is kept but **not listed** | `breed` | `breed_id` → `pet_breeds` (+ `is_listed`) | equality; "Mixed breed" never counts | search | yes |
| Size | select + **Extra Large (XL)** | ENUM incl. `xl` | `size` | ENUM + `'xl'` | equality | select incl. XL | yes |
| Main / other colour | **selects** from `pet_colours` (17, "Other" last) | main required, other optional, both listed; code or name in, listed name stored | `primary_color`, `secondary_color` | unchanged VARCHAR, listed names | equality; "Other" never counts | **select, exact** | yes |
| Description | textarea + live "18 / 30 minimum" | ≥ 30 characters, runs of spaces counted once | `description` | unchanged | — | search | no |
| Time | **Hour / Minutes / AM or PM** selects | all three or none; converted to 24-hour | `incident_time` (24-hour) | TIME, unchanged | — | — | no |
| Province or Metro Manila | **select** of 84 areas: PSA's 82 provinces (`province`), Metro Manila (`ncr`), the Special Geographic Area (`special_area`) — 3A | required, must exist | `area_code` | name written to `locations.province` (old column name) | — | **select** | name + code |
| City | **select** dependent on the area, emptied when it changes | required, must be in the area | `city_code` | `locations.city_code` FK → `ph_cities`; name written to `locations.city` | **code equality when both have one**, else the old name rule | **select** | name + code |
| Where | text, 120 | required | `location_label` | unchanged | — | search | no |
| Map pin | opens on the whole country; can't be dragged far off it; a click outside places nothing | inside the Philippines box minus Sabah and Miangas | `lat`, `lng` | unchanged | unchanged | unchanged | unchanged |
| Photos | unchanged storage; rules stated before choosing, "N of 5 photos added", "Main photo" in words | unchanged (no minimum) | — | — | — | — | — |
| Contact | **2 checkboxes** (coordinator, email) | one of two | `allow_platform_contact`, `show_email`; `show_phone` **ignored** | `show_phone` kept, always written 0 | — | — | **phone never** (not read by the detail query) |
