---
paths:
  - "src/assets/**"
  - "public/**"
  - "src/mock/**"
  - "database/seed.sql"
  - "scripts/gen-seed.mjs"
  - "docs/image-requirements.md"
---

# Images and demo data

## Image assets
- Do not generate, download, or permanently select stock imagery without explicit approval.
- When a visual asset is needed and doesn't exist, add an entry to
  `docs/image-requirements.md`: asset ID, page/component, description, purpose, subject(s),
  orientation, dimensions or aspect ratio, whether a transparent background is preferred,
  priority, status. Example row:

  | ID | Page | Description | Orientation | Size | Priority | Status |
  | --- | --- | --- | --- | --- | --- | --- |
  | IMG-001 | Homepage | Dog + cat hero visual | Landscape | 1600×1200 | High | Needed |

- Use neutral placeholders meanwhile. Don't change a page layout just because an image is
  missing.
- The dataset should cover multiple dogs and cats, a few birds/other pets, varied breeds,
  sizes, colours, and Philippine locations, both report types, and several returned/closed
  cases. Some lost and found images should look similar so the match demo convinces. No
  photos of identifiable private individuals.

## Demo data
- No "Test User", "Pet 1", "Lorem ipsum", or "Sample Dog". Use realistic pet names,
  believable Philippine cities and areas, realistic descriptions, plausible dates, and
  varied statuses.
- Data must be clearly fictional and must not impersonate real people.
- `src/mock/` is the fictional dataset seed data is generated from; shipped code never
  imports it.
