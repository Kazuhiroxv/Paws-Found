# Reference data: Philippine provinces and cities

`ph-provinces.csv` and `ph-cities.csv` are the place lists the report form and
Explore choose from (Correction 3). Migration `009` and `schema.sql` load them;
`scripts/psgc_reference.py` made them and keeps the two SQL copies in step.

## Source

| | |
| --- | --- |
| Publisher | Philippine Statistics Authority (PSA) |
| Dataset | Philippine Standard Geographic Code (PSGC), *Publication Datafile* (Excel) |
| Publication date | **31 July 2025** (the file's own Metadata sheet) |
| File used | `Publication-Datafile.xlsx`, SHA-256 `47864f8be595fdeae44f81fa481403b785488861ba2fe81e91ac8d15b3e6f30e` |
| Obtained from | a copy in the public GitHub repository `jeffreybernadas/psgc-api`, `src/data/july-2025/` (committed 1 October 2025) |
| Retrieved | 2 October 2026 |

### Why a copy, and what was checked

**PSA's own download page could not be reached by a script.** `psa.gov.ph` sits
behind a Cloudflare "verify you are human" check, which returns 403 to a
program and a challenge page to a browser. It was **not** bypassed. So the file
was taken from a public copy, and its integrity was checked in the ways that
did not need PSA's site:

- **It is PSA's file, not a re-export.** It has PSA's six sheets (Metadata,
  National Summary, Prov Sum, PSGC, Notes, Coding Structure), PSA's metadata
  ("Originator: Philippine Statistics Authority (PSA)", "Publication date: 31
  July 2025") and PSA's notes.
- **It agrees with itself.** Its National Summary states 82 provinces, 149
  cities, 1,493 municipalities and 42,011 barangays; counting the PSGC sheet
  row by row gives exactly those numbers.
- **It agrees with a second, independent derivation.** The npm package
  `@jobuntux/psgc` (2025-2Q data, built by another person from PSA's file)
  gives the same 82 / 149 / 1,493 / 42,011.

### What is NOT verified — for Kyle

1. **The file has not been compared with PSA's own download.** Download the
   July 2025 Publication Datafile from psa.gov.ph by hand (a person passes the
   check), then compare its SHA-256 with the one above. If it differs, run
   `python scripts/psgc_reference.py extract <file>` and `... sql`, then
   `npm run check:psgc`, and review the diff.
2. **It may not be the latest publication.** PSA updates the PSGC every
   quarter; publications after July 2025 could not be reached. Any province,
   city or municipality created, renamed or converted since then is **not** in
   these lists. Updating is the same two commands with the newer file, shipped
   as a new migration (never by editing `009`).

## What was done to PSA's rows

Recorded in full at the top of `scripts/psgc_reference.py`; in short:

- Kept: rows at Geographic Level `Prov`, `City`, `Mun`. Left out: regions,
  42,011 barangays (a barangay is not asked for; the reporter's own words
  describe the spot), and Manila's 14 sub-municipalities (Binondo, Tondo, …),
  which PSA's note 1 says are districts of the City of Manila, not
  municipalities.
- Names: PSA's, with surrounding and repeated spaces removed. Nothing else is
  changed — "City of Cebu", "City of Cagayan De Oro" and "Pasay City" are
  written as PSA writes them.
- Codes: PSA's 10-digit PSGC, unchanged. They are the stable identifiers.
- Each city or municipality is filed under one province (the `rule` column):

| Rule | Rows | Meaning |
| --- | ---: | --- |
| `code` | 1,599 | its own code names its province |
| `correspondence` | 17 | a highly urbanized city, which PSA codes as independent of any province; filed under the province it is in, read from PSA's Correspondence Code (the pre-2023 9-digit code, whose first four digits name that province). "City of Cebu" 072217000 → Cebu |
| `ncr` | 17 | the 16 cities and Pateros of the National Capital Region, a region with no provinces; filed under one entry, **Metro Manila**, with PSA's NCR code `1300000000` |
| `sga` | 8 | the municipalities of the Special Geographic Area of BARMM, under one entry with PSA's own code for it, `1999900000` |
| `psa-note-isabela` | 1 | the City of Isabela, under Basilan, per PSA's note 2 ("geographically located within the island province of Basilan") |

That makes 84 entries in the province list (82 provinces, Metro Manila, and the
Special Geographic Area) and 1,642 cities and municipalities.

The `#` first line of each CSV repeats the publication date and SHA-256, so
the provenance travels with the data.
