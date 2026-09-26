# Image Requirements

Every visual asset the interface needs.

**The rule (CLAUDE.md §18):** do not generate, download, or permanently select
imagery without explicit approval. When implementation needs an image that does
not exist, add a row here, render a neutral placeholder, and carry on — never
change a layout just because an asset is missing.

**Status values:** `Needed` · `Approved` (brief agreed) · `In progress` ·
`Delivered` (file in `src/assets/` and wired up)

_Last updated: second report batch and workspace design pass — 2026-08-30_

## Delivered

Assets in `src/assets/` and wired up.

| ID | File | Used by | Status |
| --- | --- | --- | --- |
| IMG-001 | ~~`pawsfound-hero-aspin-tilapia.png`~~ | Superseded by IMG-006; file deleted | Retired |
| IMG-002 | `pawsfound-logo-mark.png` | Navbar brand; copied to `public/favicon.png` | Delivered |
| IMG-003 | `empty-no-reports.png` | `EmptyState` illustration, homepage and Explore | Delivered |
| IMG-004 | `pet-photo-placeholder.png` | `PetCard`, when a report has no photo | Delivered |
| IMG-005 | `pet-0NN-*.jpg` (24 files) | Every seeded report | Delivered |
| IMG-011 | `pet-025-chico.png` … `pet-032-dog.png` (8 files) | The second batch of seeded reports | Delivered |
| IMG-012 | `img-012-help-header-illustration.png` | Help — the header band, built like IMG-008 | Delivered |
| IMG-014 | `img-014-community-route-pattern.svg` | The signature background pattern — wandering routes, contour arcs, radar sweeps, pins, paw marks and two hearts, hand-built as SVG at 4–7% opacity, placed by `PatternVeil` | Delivered |
| IMG-016 | `img-016-woven-microtexture.svg` | Woven microtexture — offset diamonds at 3%, abstract rather than a cultural motif. Footer and warm public sections, via `WovenVeil` | Delivered |
| IMG-015 | `img-015-reunion-home.jpg` | Homepage Reunited — a dog back home at a doorway, face offscreen. 1400×1050, 185 KB, lazy | Delivered |
| IMG-017 | `img-017-auth-community.jpg` | Sign in / Register — a cat at an open door, beside the form from `lg` up. 1200×900, 139 KB, lazy | Delivered |
| IMG-006 | `img-006-homepage-hero.jpg` | Homepage hero | Delivered |
| IMG-007 | `img-007-about-intro.jpg` | About — "Why Paws&Found exists" | Delivered |
| IMG-008 | `img-008-explore-header-illustration.jpg` | Explore — the whole header band | Delivered |

IMG-006 was replaced with a second version in the homepage refinement pass. The
first had its subjects hard right of frame, which only worked when text shared
the photograph; the layout puts the image in its own column, so that left third
was wasted. The replacement centres the dog and cat, is 1586x992 (ratio 1.599,
so the `aspect-16/10` frame crops nothing), and uses the default centre object
position. The filename is unchanged — there is one canonical hero asset.

The logo is a transparent PNG. IMG-001 was the original homepage hero; IMG-006
replaced it in the redesign and the file has been deleted.

## Still needed

| ID | File | Used by | Priority | Status |
| --- | --- | --- | --- | --- |
| IMG-013 | `pet-009-rex.jpg` | Report 009 (Rex) — the only seeded report still without a photograph | Medium | Needed |
| IMG-018 | `img-018-hero-environment.webp` | Homepage hero — the illustrated ground the whole page stands on | **High** | **Delivered** |
| IMG-019 | `img-019-footer-horizon.webp` | The footer band on every public page | **High** | **Delivered**, trimmed 2000×667 → 2000×517 |
| IMG-020 | `img-020-companions.webp` | Dog and cat pair, cut out — dashboard greeting, auth, header bands | **High** | **Delivered**, not yet placed |
| IMG-021 | `img-021-landscape-strip.webp` | Reusable header band: report wizard, customer dashboard, workspace headers | Medium | **Delivered** at 1908x824, not yet placed |
| IMG-022 | `img-022-workspace-foot.png` | The illustration at the bottom of the staff and admin rails | Medium | Needed |
| IMG-023 | `pawsfound-logo-mark-v2.webp`, `-horizontal`, `-on-dark` | Logo refresh — mark in the navbar, footer and workspace rails; the other two not yet placed | Medium | **Delivered** |
| IMG-024 | `empty-no-matches.webp` | `EmptyState` — no possible matches yet | Low | **Delivered**, text cropped off |
| IMG-025 | `empty-no-notifications.webp` | `EmptyState` — nothing unread | Low | **Delivered**, text cropped off |
| IMG-026 | `empty-queue-clear.webp` | `EmptyState` — nothing awaiting a coordinator | Low | **Delivered**, text cropped off |
| IMG-027 | `img-027-homepage-reunion.webp` | The homepage hero photograph | **High** | **Delivered** at 1448×1086, placed |
| IMG-028 | `img-028-help-safety.webp` | The Help & community safety hero band | **High** | **Delivered** at 1896×829, placed |
| IMG-029 | `img-029-about-community-hero.webp` | The About page hero band | **High** | **Delivered** at 2000×434, placed |

### What the generated mockups need, in detail

A pass over all eleven reference screens, 25 September 2026. The three marked
High are the reason the built pages read as "same structure, thinner
atmosphere": the references are **illustrated environments**, and what we have
to build them from is a photograph plus line art at `stroke-opacity` 0.028 to
0.1. No amount of CSS closes that.

**IMG-018 — homepage hero environment.** Flat vector illustration: a soft sky
grading into rolling hills, small houses and trees along the horizon, a dashed
route wandering across it with two or three map pins. Teal and amber only, the
palette in `src/index.css`. **No animals** — the photograph sits on top of it.
The left third must stay pale and uncluttered or the headline loses contrast.
Landscape, **2400x1100**, transparent or pale-cream background. This is the one
that changes the homepage most.

**IMG-027 — homepage reunion.** Replaced IMG-006, which was a good photograph
of a person with two pets — ownership, not the moment this site exists for. The
new one is the reunion itself: a brown Aspin leaning into its owner's hands on a
Philippine residential street in late-afternoon light, the owner crouched with
their face outside the frame so the animal is what you look at. Placed on the
homepage at `object-[52%_42%]`, which centres the crop on the dog's head.

**IMG-028 — Help & safety.** A semi-flat illustration in the logo family:
shield and check, clipboard, map pin, phone, a handover handshake, a dog. Used
as the full-bleed ground of the Help hero rather than as an inset picture —
Explore's header is a rounded panel with its illustration on the right, and
Help had been copying that shape exactly. The left 45% of the artwork is clear
cream, which is where the heading sits. Below `lg` it is hidden and the band
keeps the cream on its own.

**Asked for as deep teal with cream text; delivered light.** The composition
carries the difference from Explore instead — full bleed, no card edge, and a
search field stepping off the lower edge. Keying the cream out to put the
artwork on teal was tried and abandoned: the route ribbon and the hills are
drawn in near-white and came away with the background, leaving a pale wedge
through the middle. A teal version would have to be generated as one.

**IMG-029 — About community hero.** A wide illustrated band: a neighbourhood,
a map pin, two people greeting a dog at a gate. Used as the ground of the About
hero. Its left 45% is open sky, which is where the eyebrow, heading and
paragraph sit; the scrim over it is what guarantees they stay readable, because
the bottom-left corner is a stand of dark leaves that the text reaches at 1366
and 1920. Below `lg` it is hidden and the band keeps the cream on its own.

The four public bands now read as four different things, which was the point of
generating them separately: **IMG-027** the reunion on the homepage, **IMG-008**
discovery on Explore, **IMG-028** guidance on Help, **IMG-029** the community
on About.

**IMG-019 — footer horizon.** Dark teal band: hills, trees, a dog and a cat in
silhouette, a warm low sun. The top edge should be a gentle wave rather than a
straight cut, so it meets the page like the reference does. Wide banner,
**2400x420**, transparent above the horizon so it can sit on our own dark
fill. Used on every public page, so it is worth getting right once.

**IMG-020 — companions, cut out.** The dog and cat pair as one illustrated
group, facing left, **transparent background**, no ground or scenery. Wanted
separately from IMG-018 so it can be reused at different sizes on the
dashboard greeting, the auth page and the header bands without dragging a
landscape along with it. **1400x1400 PNG.**

**IMG-021 — landscape strip.** A shallower cousin of IMG-018 for page headers:
horizon, a few houses and trees, the dashed route. No animals, nothing in the
left third. **2400x520.** One asset serving the wizard, the dashboard and the
workspace headers — the references show slightly different scenes per page,
but one strip tinted differently per area is more consistent and far less to
maintain.

**IMG-022 — workspace rail foot.** A small scene for the bottom of the staff
and administration sidebars, where the references put one: low hills, a house
or two, a dog and cat silhouette. **Transparent PNG, 480x360**, quiet enough
to sit under navigation without competing with it.

**IMG-023 — logo.** Three files: the mark alone, a horizontal lockup with the
wordmark, and a **light-on-dark variant** — the current mark is dark ink and
disappears against the new footer and any dark rail. The reference mark is a
paw whose pads carry both brand colours with a location pin worked into it,
which is close to what we already have, so this is a refresh rather than a
redesign.

**IMG-024 to IMG-026 — empty states.** CLAUDE.md §20 asks for a designed empty
state everywhere, and we have exactly one (`empty-no-reports.png`). The three
most often seen are no possible matches, no unread notifications and an empty
coordinator queue. Same illustration family as IMG-003. **900x700**,
transparent. Low priority — the copy already carries these; the pictures make
them feel finished.

### Deliberately NOT images

Four things in the references look like assets and should not be:

**The handwritten lines** — "Different paths, same home", "A kinder community
for happier endings", "Help bring Luna home", "Real pets. Real people." These
appear on nearly every reference screen. They are a **font**, not artwork:
Caveat or Kalam from Google Fonts, both already permitted by our stylesheet
rules. Generating them as images would mean a separate file per phrase, text a
screen reader cannot read, and no way to change a word without regenerating
the picture.

**The polaroid photographs** on the homepage — the existing seeded pet photos
in rotated, shadowed frames. CSS.

**The map pins** — already custom `divIcon`s built from HTML in
`src/components/mapSetup.js`, not Leaflet's default PNGs. Nothing to generate.

**The section waves** — `SectionCurve` already draws these as SVG. If they
want to be more pronounced that is a number to change, not a file to make.

### Two recommendations against

**Photographic user avatars.** The references show faces in the account rows;
we show initials. Keep the initials. Generating faces for ten fictional people
means putting invented likenesses in a submitted academic project, and §18 of
CLAUDE.md already rules out photographs of identifiable individuals. The
initials are honest and cost nothing.

**Extra social icons.** The references show Facebook, Instagram, X and
YouTube; we carry two. Rather than generating the missing two, the better
question is why a student project links to social accounts that do not exist.
Removing all four would be more honest than completing the set.

### IMG-011 — the second batch of pet photographs  *(delivered)*

Eight reports were added on 2026-08-30 so the demonstration does not open on a
page where the newest case is a fortnight old. They currently render the neutral
placeholder (IMG-004), which is correct behaviour but leaves eight paw prints in
a row on Explore.

Same treatment as IMG-005: **800x600 JPEG, quality 82**, and the rule from §18
still applies — these should look like a phone photograph of a Philippine street
or house, not a studio portrait. No identifiable people.

| File | Report | Subject |
| --- | --- | --- |
| `pet-025-chico.jpg` | 025 lost | Medium brown-and-white aspin, **white blaze down the muzzle, white front socks, kink at the tail tip** |
| `pet-026-dog.jpg` | 026 found | **The same dog as 025**, different setting and angle — this pair is the fresh matching demo, so the markings must read as the same animal without being the same photograph |
| `pet-027-pilo.jpg` | 027 lost | Small orange tabby, white chest and chin, notch in the right ear |
| `pet-028-cat.jpg` | 028 found | Small long-haired grey-and-white cat, bushy tail, thin blue collar with no tag |
| `pet-029-sabel.jpg` | 029 lost | Medium tricolour beagle, white tail tip, red collar with a small brass bell |
| `pet-030-rabbit.jpg` | 030 found | Small white lop-eared rabbit, grey ears, grey patch over one eye, in a cage |
| `pet-031-tuna.jpg` | 031 lost | Medium cream Persian, flat face, one watering eye, coat shaved along the back |
| `pet-032-dog.jpg` | 032 found | Small white-and-grey shih tzu, badly matted coat, visibly been outdoors a while |

When the files land in `src/assets/`, add the `photos` entries to reports 025-032
in `src/mock/petReports.js`, re-run `node scripts/gen-seed.mjs`, and re-import
`database/seed.sql`.

### IMG-012 — a Help header band  *(delivered)*

Optional. The Help page currently leads with the logo mark as artwork, which
works but makes it the only public page without a photograph or an
illustration of its own. If it is ever produced it should be the same 3:1 flat
vector band as IMG-008, with the left half kept light for type — see the notes
below, which apply unchanged.

## IMG-008 — the one illustrated asset

Every other asset is a photograph; IMG-008 is flat vector-style artwork, and it
is **the entire band**, not a cut-out pasted onto a coloured panel. The
cream-to-teal wave, the leaves, the hearts and the two animals are one 3:1
image (2172x724) with the left half deliberately left clear for type.

Three things follow, and any replacement has to respect them:

- **The left half must stay light.** Measured against `fg-muted`, the artwork is
  AA-safe out to 60% of the width on the title row and 50% on the description
  row. Past that it darkens into the teal wave. The text block is capped at half
  the band for this reason, and the band's description uses full-strength `fg`
  rather than `fg-muted`, because the mobile fallback tint cannot reach AA at
  any usable strength.
- **It only composes wide.** `object-cover` in a band narrower than three times
  its height crops horizontally, and the cat is the first thing lost. The image
  is therefore shown from `md` up; below that the band keeps its tint and the
  type has it to itself.
- **Vertical crop is fine.** At 1216x272 the band shows source rows 119-605,
  which keeps both animals, the hearts and the leaves whole.

Introducing it makes Explore the only illustrated page in a photograph-led
system. About and Help will eventually look unfinished beside it unless they
get the same treatment — a decision for the team, not a defect.

## Placeholder behaviour

Seeded reports carry `photos[].url === null` and real `alt` text. `PetCard`
falls back to IMG-004 and announces it as "No photo was provided for this
report" — the report's own alt text is not reused for a generic placeholder,
because it would describe a pet the image does not show.

Reports created through the form carry a `blob:` object URL instead, and do
render the reporter's own photo and description.

## Note on file size

IMG-006 was supplied as a 2.1 MB PNG and converted the same way: 1600px wide
JPEG, **214 KB**. Its frame is `aspect-16/10`, matching the source ratio exactly
so nothing is cropped — the cat sits near the right edge and a 4:3 frame was
taking 8% off each side.

The 24 pet photographs were supplied as 1448x1086 PNGs totalling **58 MB** —
enough to make the Explore page, which shows all 24 at once, unusable on a
phone. They were resized to 800x600 and converted to progressive JPEG at
quality 82: **58 MB down to 2.2 MB**, no visible loss at the sizes they are
displayed. IMG-007 arrived as a 2.3 MB 1254x1254 PNG and was converted the same way:
800x800 JPEG, **117 KB**. It is displayed at 384px, so the source is a 2.1x
retina target — and it is capped at that width, because between `sm` and `lg`
an uncapped `w-full` stretched it to 903px and upscaled it past its own source.

The 24 original PNGs have since been moved out of `src/assets/`, along with the
unused `img-006-homepage-hero.png` original (2.1 MB) and the retired IMG-001
hero (1.7 MB). `src/assets/` is now **3.2 MB**. The originals have been deleted at the team's request; the files in `src/assets/` are now the only copies.

Three brand PNGs remain unoptimised: `pawsfound-logo-mark.png` (564 KB),
`pet-photo-placeholder.png` (800 KB) and `empty-no-reports.png` (1.3 MB). The
logo needs transparency so it has to stay PNG, but resizing would cut most of
the weight. Not done without approval, since it alters supplied files.

### IMG-013 — a photograph for report 009 (Rex)

The only seeded report still showing the paw placeholder. Reports 001–008 and
010–032 all have one.

| Field | Value |
| --- | --- |
| Subject | A lost dog. The report describes Rex without naming a breed. |
| Orientation | Landscape, roughly 4:3 — the card crops to that aspect |
| Size | About 1400×1050, in line with the delivered set |
| Transparent background | No |
| Notes | An ordinary Philippine street or yard setting, matching the rest. No identifiable people. |
