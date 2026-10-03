# Reference data: Philippine places

`ph-areas.csv` and `ph-cities.csv` are the place lists the report form and
Explore choose from. Migration `009` and `schema.sql` load them;
`scripts/psgc_reference.py` made them from PSA's file and keeps the two SQL
copies in step (`npm run check:psgc`).

## Source

| | |
| --- | --- |
| Publisher | Philippine Statistics Authority (PSA) |
| Dataset | Philippine Standard Geographic Code (PSGC), *Publication Datafile* (Excel) |
| Edition | **as of 30 June 2026** — the Second Quarter 2026 release, published 13 July 2026 |
| File | `PSGC-2Q-2026-Publication-Datafile.xlsx`, SHA-256 `31892bc2bdde3ea0682562d9412b5bab4d45a0be5e5a5b4f6c9d7714b94bca5d` |
| Obtained | downloaded from psa.gov.ph by Kyle in a browser, 2 October 2026 |

PSA's site puts automated requests behind a human check, which was not
bypassed; the file was downloaded by a person. It is PSA's own workbook: its
Metadata sheet names PSA as originator and "30 June 2026" as the publication
date, and it was last saved by PSA on 13 July 2026.

To check that these CSVs are exactly what that file gives:

    python scripts/psgc_reference.py check <path to PSGC-2Q-2026-Publication-Datafile.xlsx>

*(Correction 3 first used the July 2025 file, from a public GitHub copy. It was
replaced by this one in Correction 3A, before anything was deployed.)*

## Official PSA facts — as of 30 June 2026

From the file's National Summary, and matched row by row against its PSGC
sheet:

| | |
| --- | ---: |
| Regions | 18 |
| **Provinces** | **82** |
| Cities | 149 |
| Municipalities | 1,493 |
| Cities + municipalities | 1,642 |
| Barangays | 42,010 |
| National Capital Region | **0 provinces**, 16 cities, 1 municipality (Pateros) |

These rows keep every one of those facts: the 82 provinces, 149 cities and
1,493 municipalities are PSA's, with PSA's codes and names.

### What changed since the July 2025 file (relevant to the form)

Four municipality names; no code, province, city or class changed:

| PSGC code | July 2025 | 30 June 2026 |
| --- | --- | --- |
| `1102324000` | San Isidro (Davao del Norte) | **Sawata** — renamed |
| `1004217000` | Don Victoriano Chiongbian | Don Victoriano — corrected |
| `0201522000` | Sanchez-Mira | Sanchez Mira — corrected |
| `1903638000` | Tagoloan Ii | Tagoloan II — corrected |

The other changes in the period were to barangays (one merged in Calaca,
Batangas; several names corrected). Barangays are not stored.

## Application-specific grouping — not a PSA fact

The form's first list needs something to put every city and municipality
under. 25 of them have no province: NCR's 16 cities and Pateros, and the 8
municipalities of BARMM's Special Geographic Area. So the first list is of
**areas**, and each says what it is:

| `area_type` | Rows | What it is |
| --- | ---: | --- |
| `province` | 82 | PSA's provinces, as PSA names and codes them |
| `ncr` | 1 | **Metro Manila** — the National Capital Region, a *region*, under PSA's region code `1300000000` |
| `special_area` | 1 | **Special Geographic Area (BARMM)**, under PSA's code `1999900000` |

**84 areas — never "84 provinces."** The table is `ph_areas`, the API is
`/api/reference/areas`, and the form calls the list "Province or Metro Manila"
and explains the Special Geographic Area beside it.

Two placements are the application's, documented in
`scripts/psgc_reference.py`:

- a **highly urbanized city** (Cebu City, Davao City, Baguio, …), which PSA codes
  as independent of any province, is listed under the province it is inside,
  read from PSA's Correspondence Code ("City of Cebu" 072217000 → Cebu);
- the **City of Isabela** is listed under Basilan, per PSA's note 2.

## What was done to PSA's rows

- Kept: Geographic Level `Prov`, `City`, `Mun`. Left out: regions, barangays,
  and Manila's 14 sub-municipalities (districts of the City of Manila, PSA's
  note 1).
- Names: PSA's, with surrounding and repeated spaces removed. Nothing else.
- Codes: PSA's 10-digit PSGC, unchanged.
- `ph-cities.csv` has a `rule` column naming how each place got its area
  (`code` 1,599 · `correspondence` 17 · `ncr` 17 · `sga` 8 · `psa-note-isabela` 1).

The `#` first line of each CSV repeats the edition and SHA-256, so the
provenance travels with the data.
