# Design System

**Official Paws&Found colour direction: Teal + Amber.** Approved by the team at
the Phase 2 design checkpoint; it replaces the neutral placeholder palette from
Phase 0.

_Last updated: Explore refinement pass — 2026-08-18_

## Intent

Paws&Found should feel trustworthy, reassuring, community-oriented and
approachable — built for someone who is stressed because their pet is missing.

**Teal is the brand:** reliability, safety, organisation.
**Amber is the accent:** warmth, urgency and emphasis, without alarm.

The interface stays light and restrained on an off-white canvas. Pet photographs
are meant to supply most of the visual richness once they exist.

It should not read as: a veterinary hospital, a pet store, a childish pet site,
an emergency-alert page, or a generic corporate SaaS dashboard.

## The one rule

**Never write raw Tailwind colours (`bg-teal-600`, `text-orange-400`,
`border-gray-200`) in a component.** Use the semantic tokens. Every colour is
defined once in `src/index.css`, which is what allows the whole application to
be recoloured from a single file.

If you need a colour that has no token, add the token — do not inline the hex.

## Palette

### Brand — teal

| Token | Hex | Use |
| --- | --- | --- |
| `brand` | `#157A78` | Primary buttons, links, navigation emphasis, focus ring |
| `brand-hover` | `#0E5D5B` | Hover and active states, strong teal text |
| `brand-soft` | `#E2F1EF` | Selected nav backgrounds, soft info panels, section bands |

### Accent — amber

| Token | Hex | Use |
| --- | --- | --- |
| `accent` | `#F4A340` | Lost-report action, secondary emphasis, attention that is not an error |
| `accent-hover` | `#D98A26` | Amber hover and active |
| `accent-soft` | `#FFF1D6` | Soft highlight backgrounds, possible-match emphasis |

Amber is **not** an error colour. Errors use `danger`.

### Neutrals

| Token | Hex | Use |
| --- | --- | --- |
| `surface` | `#FBF9F6` | Page canvas — warm off-white so cards lift off it |
| `surface-alt` | `#F2F8F6` | Full-bleed section band — pale teal |
| `warm-band` | `#FDF7EC` | Full-bleed section band — warm cream |
| `sunken` | `#F2F7F5` | A well the canvas dips into, behind a group of cards |
| `surface-muted` | `#EEF3F2` | Hover fills, disabled inputs |
| `surface-warm` | `#FCF8F0` | The footer — a warmer neutral than the body, so the page ends deliberately |
| `panel` | `#FFFFFF` | Cards, modals, forms, the nav bar |
| `layer` | `#F7FBFA` | The quieter panel: filter rails, summary panels, the wizard's progress rail |
| `border` | `#DDE6E4` | Card outlines, dividers |
| `border-strong` | `#C7D5D2` | Form controls |
| `fg` | `#21302F` | Headings and body |
| `fg-muted` | `#5E6C6A` | Metadata, descriptions, placeholders (5.1:1 on the teal band, 5.5:1 on white) |
| `fg-subtle` | `#899694` | **Decorative only** — see accessibility below |
| `fg-inverted` | `#FFFFFF` | Text on brand/danger fills |

### Report type — Lost = amber, Found = teal

| Token | Hex | Use |
| --- | --- | --- |
| `lost` | `#9A620F` | LOST badge text |
| `lost-soft` | `#FFF1D6` | LOST badge background |
| `found` | `#0E5D5B` | FOUND badge text |
| `found-soft` | `#E2F1EF` | FOUND badge background |

These two are the **ink** used on soft backgrounds, so both are darker than the
brand values they derive from. The full-strength `accent` (`#F4A340`) and
`brand` (`#157A78`) remain the correct identity colours for fills and for map
markers in Phase 8.

### Report status

Type and status are separate concepts and must never share a visual treatment.
`ReportTypeBadge` is a filled badge; `StatusBadge` is a small dot plus text, so
the two can sit side by side without competing.

| Token | Hex | Status |
| --- | --- | --- |
| `status-active` | `#157A78` | Active — teal, not blue: blue carries no other meaning in this palette |
| `status-match` | `#D98A26` | Possible Match |
| `status-returned` | `#338A55` | Returned |
| `status-closed` | `#737B7A` | Closed |

Each also has a `-soft` variant for tinted backgrounds.

### Feedback

| Token | Hex | Use |
| --- | --- | --- |
| `danger` / `danger-hover` / `danger-soft` | `#C24141` / `#A63535` / `#FBEAEA` | Destructive actions, suspension, deletion, validation errors |
| `success` / `success-soft` | `#338A55` / `#E4F2EA` | Successful recovery, positive confirmations |

Do not overuse danger red.

## Surface levels

The page itself is part of the design. Every surface belongs to one of these
levels, and nothing sits on a level that does not describe it:

| Level | How it is built | What belongs on it |
| --- | --- | --- |
| 0 Canvas | `bg-surface` + `page-ground` + one `canvas-*` | The ground the whole application sits on |
| 1 Band | `bg-surface-alt` / `bg-warm-band`, full-bleed | A chapter of a long page, sometimes entered through a `SectionCurve` |
| 1.5 Well | `bg-sunken/60` | The canvas dipping behind a *group* of cards — a report grid, a queue, an analytics set. Depth before any shadow is spent |
| 2 Static surface | `bg-panel` or `bg-layer`, `shadow-card` | One card. `layer` is the quieter tinted one: filter rails, summary panels, the wizard's progress rail |
| 3 Interactive surface | `card-interactive` | A card that can be clicked: it rises 2px and deepens its shadow. Static cards never move, and that difference is the signal |
| 4 Overlay | `shadow-raised` | Dialogs, dropdowns, the lightbox, the homepage search panel, the report photograph, the map |

A white rectangle is not automatically a card. Static information can live on
the canvas with a heading and space around it, or in a well with its siblings;
keep containers for content that genuinely groups or genuinely lifts, or
nothing on the page stands out.

## The canvas system

Four environments share one recipe — grain, two far-off brand glows, and the
warm base — and differ only in which colour leads. `RootLayout` picks one from
the route, so nothing else has to think about it:

| Utility | Where | Character |
| --- | --- | --- |
| `canvas-public` | Everything public | Amber and teal in balance, the strongest of the four |
| `canvas-customer` | `/dashboard` | Warm: amber leads, teal answers |
| `canvas-staff` | `/staff` | Cooler and operational: teal leads |
| `canvas-admin` | `/admin` | Quietest: neutral with a restrained teal |

The glows are large enough to run off the viewport, so no circular edge is ever
visible, and `canvas-fade` masks the layer out downwards so its bottom edge is
never a line — the atmosphere belongs to the top of a page, not to the whole
scroll. The customer canvas is the tall one (58rem rather than 46rem): the
greeting, the quick actions and the first heading all sit inside it.

**Decoration.** Three pieces, all `aria-hidden`, all behind the content:

- `PatternVeil` — IMG-014, the route pattern: wandering routes, contour arcs,
  radar sweeps, pins, paw marks and two hearts, drawn at 4–7% and tiled large
  (`far`, the ambient setting) or closer in (`near`, for a band that is about
  the journey). It is a separate layer because it is faded with a mask, and a
  mask fades everything inside the element it sits on.
- `WovenVeil` — IMG-016, the woven microtexture, at 2% (it was 3%, where the
  diamonds read as a repeating grid before they read as texture). Footer and a
  couple of warm public sections only.
- `RadarOrnament` / `RouteOrnament` — oversized single motifs that enter from a
  page edge and are clipped by it. Their container needs `overflow-hidden`, or
  they widen the page; they are hidden below `sm`, where there is no spare edge
  to run off.

**Grain.** `grain` (and every `canvas-*`, which includes it) lays a 140px
monochrome noise tile at 3.5% over the background. Generated in CSS from
`feTurbulence` — about 300 bytes, no download — and invisible to look at
directly. It only stops a large flat field reading as nothing.

**Section boundaries.** `SectionCurve` replaces a hard edge with about 30–48px
of curve across the whole viewport, filled with the colour of the section
*below*. Used sparingly: a page where every boundary curves reads as a
template.

## Shape and elevation

| Token | Value | Use |
| --- | --- | --- |
| `rounded-card` | 16px | Cards, modals, panels |
| `rounded-control` | 10px | Buttons, inputs, small badges |
| `rounded-pill` | full | Chips and status pills |
| `shadow-card` | soft, 8px | A card at rest (level 3) |
| `shadow-hover` | soft, 16px | A card under the pointer — paired with a 2px lift by `card-interactive` |
| `shadow-raised` | soft, 24px | Level 4: dialogs, dropdowns, elements floating over an image |
| `shadow-header` | soft, 16px | The sticky header, once the page has scrolled under it |

**Glass.** `surface-glass` is translucent white over a blur, with a solid
fallback where `backdrop-filter` is unavailable. Exactly two places use it —
the homepage search panel and nothing else yet — because glass over a flat
surface is just a lighter card.

## Motion

Restrained, and never decorative: 150–180ms, no bounce, no spring, no parallax,
nothing that moves a large region of the page.

| What | How |
| --- | --- |
| Interactive card | Rises 2px, shadow deepens (`card-interactive`, 180ms) |
| Button | Background transition, 150ms, and a 1px press |
| Report photograph | The image dims very slightly and the expand control firms up, 200ms |
| Dialog | Fades in with a 2% rise, 160ms, `motion-safe` only |
| Filter sheet | Rises 2rem from the bottom edge, 200ms, `motion-safe` only |
| Header | Border and shadow change once the page scrolls under it, 200ms |

Every one of these is switched off by the `prefers-reduced-motion` rule in the
base layer.

Shadows are neutral and restrained — a card lifts off the canvas, it does not
float. **Only interactive cards move**: `card-interactive` raises them 2px and
deepens the shadow over 180ms, and that difference is how the page says what can
be clicked. Static cards keep `shadow-card` and stay still. No coloured or
glowing shadows. Avoid glassmorphism, neon, large gradients and excessive
animation; nothing bounces and nothing flies.

## Type scale

Refined 2026-09-20: the steps were too close together. A page title at 36px
above a section at 30px above a card at 18px reads as three sizes of the same
thing, so the top two steps were pulled apart.

| Step | Size | Where |
| --- | --- | --- |
| Hero headline | 44px → 62px | The homepage only |
| Public page title | 36px → 44px | Explore, About, Help, a report |
| Workspace title | 36px → 44px, greeting 32px → 38px | `PageHeader`, `compact` for the dashboard greeting |
| Section title | 28px → 32px | `SectionHeading` |
| Card title | 18px | `CardHeader` |
| Body | 16px, lead 17px | |


Body copy is **`text-base` (16px)**. `text-sm` is for metadata only — it was
overused early on and made the whole interface read as annotations.

| Role | Class | Size |
| --- | --- | --- |
| Hero headline | `text-4xl` → `sm:text-5xl` | 36 → 48px |
| Page title (`PageHeader`) | `text-3xl` | 30px |
| Section heading | `text-2xl` → `sm:text-3xl` | 24 → 30px |
| Card heading | `text-lg` | 18px |
| Body | `text-base` | 16px |
| Metadata | `text-sm` | 14px |

## Control sizes

| Size | Height | Use |
| --- | --- | --- |
| `sm` | 36px | Dense rows, table actions |
| `md` | 44px | Default. Matches input height. |
| `lg` | 52px | Primary calls to action |

WCAG 2.2 AA only requires a 24x24 target; 44px is the comfortable size on a
phone and stops the interface reading as a dense admin tool. Inputs, selects and
textareas share `min-h-11` so a control and a button line up side by side.

## Page composition

Public pages alternate between `surface` and full-bleed `surface-alt` bands so a
long page reads as distinct chapters rather than one scroll of white cards.
A page that runs its own full-bleed sections cancels `RootLayout`'s padding
with `-my-8` — the homepage, About and Help do this. A section that can be
jumped to from an in-page link needs `scroll-mt-24`, or the sticky 72px navbar
covers its heading on arrival.

**The desktop navigation collapses below `xl`, not `lg`.** A signed-in
coordinator carries seven links plus a name plus the demo selector; at 1024 that
needs about 1080px of a 1009px container. The breakpoint has moved twice for
this reason — check it against the *staff* view, never the signed-out one.

**Detail pages** use a 70/30 grid — `lg:grid-cols-[minmax(0,1fr)_22rem]` — with
the supporting rail sticky (`lg:sticky lg:top-24 lg:self-start`). A sticky rail
must also cap its height (`lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto`);
without it, a rail taller than the viewport puts its last card permanently below
the fold with no way to reach it. Both collapse to one column below `lg`.

**A long list is one panel of divided rows, not a stack of panels.** Cards
separated by gaps make the eye stop at every item; a notification list, a
recent-activity feed and a case queue are all read straight down. Group headings
(Today / This week / Earlier) carry the structure instead of borders.

**Footer links carry a resting underline.** In a muted colour on a muted
ground they read as text, not links. They keep `fg-muted` with a hairline
`border-strong` underline and turn `brand` on hover, which is what makes them
look clickable before the cursor arrives.

**Type on a tinted band uses full-strength `fg`.** `fg-muted` on the Explore
header band measures 4.31:1, and no usable tint strength reaches AA — lightening
`brand-soft` to 30% still only gets to 4.47. Darken the ink instead of the
surface.

**Every page sits on a faintly warm ground.** The `page-ground` utility on the
app shell carries the same amber/teal atmosphere at about a third of the
homepage's strength, fixed so it does not scroll. Home layers `hero-ground` on
top for its stronger opening; the functional pages get only the hint, so they
stay calm and data-focused while still belonging to the same surface.

**The homepage hero sits on a tinted ground, not the flat canvas.** The
`hero-ground` utility layers two radial gradients — amber at 10% behind the
headline, teal at 7.5% behind the photograph — over the warm off-white. It is
applied to a wrapper around the hero and search only, so it cannot bleed into
the reports section, where the photographs need the plain canvas. Keep both
below about 12%: the page should read as warmer without anyone noticing a
gradient.

**Table wrappers use `overflow-x-auto`, never `overflow-hidden`.** Both round
the corners, but `overflow-hidden` silently clips a table that does not fit and
the clipped controls cannot be reached at all. The admin user table did exactly
that at 390px until the Status column was folded into the User cell.

**Staff and admin lists are tables, not stacks of cards.** A coordinator
scanning two dozen reports needs rows they can compare down a column. Secondary
columns drop out at narrow widths (`hidden md:table-cell` and friends) and the
ones that matter most fold into the always-visible column, so the table never
scrolls sideways. Public-facing lists keep using `PetCard` — that audience is
browsing, not processing.

**A match is evidence, not a listing.** Wherever two reports are compared, the
photographs get real size side by side with the score between them, and every
signal is listed with a tick or a cross — including the ones that disagree. This
is the screen that distinguishes Paws&Found from a bulletin board, so it is the
one place the interface spends vertical space deliberately.

**Destructive actions do not sit next to constructive ones.** "Not the same pet"
is pushed to the opposite end of the row from "Confirm match".

**No chart library.** A proportional bar is a `div` with a percentage width and
a status colour. Four numbers do not justify a dependency the team has to
defend.

**The customer dashboard has no counter row.** Counters belong to the staff and
admin workspaces, where someone is managing a queue they cannot see all of. An
owner with two open cases does not need to be told they have two — they need to
see the two. The customer dashboard leads with a greeting and the two report
actions, then shows the cases themselves.

**Short facts are chips, not definition rows.** A stack of label/value pairs
reads as a form and buries the one attribute a reader is looking for. Each chip
carries its label in an `sr-only` span so screen readers still get the pair.

Container widths: `page` 1280px · **`wizard` 800px** · `form` 672px ·
`prose` 720px. The report wizard uses `wizard`; `form` is for short single
-column forms such as sign-in.

## Using colour with restraint

Do not paint everything teal or amber.

- **Primary actions** are teal: *Search Pets*, *Submit Report*, *Continue*.
- **Amber** is used where it carries meaning: *Report a Lost Pet*, possible-match
  emphasis. `<Button variant="accent">`.
- **Cards** are white with a subtle border and restrained coloured accents.
  Do not build fully teal or fully amber content cards without a functional
  reason.

## Maps

Built in Phase 8 with Leaflet and OpenStreetMap. Markers are `divIcon`s whose
colours come from the tokens above, so the map cannot drift from the palette —
see `src/components/mapSetup.js`.

| Marker | Colour |
| --- | --- |
| Lost report | `accent` (amber) |
| Found report | `brand` (teal) |
| Returned | `status-returned` (green) |

Colour is never the only signal: every popup names the report type in words,
and the map is always paired with a list view.

**Privacy:** a report's coordinates are barangay-level and marked
`precision: 'approximate'`. The detail page draws a 400 m circle around the pin
so the imprecision is visible rather than implied, and the report form tells
people to pin an area rather than their own front door.

## Accessibility

**Colour is never the only signal.** Every report type and status carries an
icon and/or explicit text, so a colour-blind reader — or a greyscale printout —
loses nothing.

Measured contrast against WCAG AA (4.5:1 for normal text). Re-measured in full
at the Phase 12 pass — every pair below is computed from the tokens in
`src/index.css`, not estimated.

| Combination | Ratio | |
| --- | --- | --- |
| `fg` on `panel` | 13.74 | pass |
| `fg` on `surface-muted` (table headers) | 12.26 | pass |
| `fg` on `accent-soft` | 12.30 | pass |
| `brand` fill + white text | 5.14 | pass |
| `accent` fill + `fg` text | 6.65 | pass |
| `fg-muted` on `panel` | 4.82 | pass |
| `fg-muted` on `surface` | 4.59 | pass |
| `fg-muted` on `surface-alt` | 4.53 | pass |
| `brand` link on `surface` | 4.89 | pass |
| `brand-hover` on `brand-soft` (score dial, active tab) | 6.60 | pass |
| `danger-hover` on `danger-soft` (suspended pill) | 5.68 | pass |
| `danger` on `panel` | 5.09 | pass |
| `success-ink` on `success-soft` (active pill) | 5.28 | pass |
| LOST badge (`lost` on `lost-soft`) | 4.56 | pass |
| FOUND badge (`found` on `found-soft`) | 6.60 | pass |
| `lost` on `accent-soft` (urgent attention row) | 4.56 | pass |

Non-text and decorative, against the 3:1 requirement for UI components:

| Combination | Ratio | |
| --- | --- | --- |
| `success` on `success-soft` (✓ icon) | 3.71 | pass |
| `danger` on `danger-soft` (✕ icon) | 4.38 | pass |
| `fg-subtle` on `panel` (icons, dividers) | 3.06 | pass |

**Five failures found and fixed at the Phase 12 pass**, all of which had shipped
in earlier phases:

- **Form hint text** used `fg-subtle` (3.06:1) — on every `Input`, `Select` and
  `Textarea` in the application. Now `fg-muted`.
- **Table header labels** were `fg-muted` on `surface-muted` (4.30:1). Now `fg`;
  the sorted column is marked by weight and the arrow rather than by colour.
- **The "Suspended" pill** was `danger` on `danger-soft` (4.38:1). Now
  `danger-hover`.
- **The "Active"/"Available" pills** were `status-returned` on its soft
  background (3.71:1). A new `success-ink` token (`#286F43`) was added for ink on
  a soft green ground, the same way `lost` and `found` work.
- **Two stray labels** — the map's "Approximate area only." and a coordinator
  timestamp — were on `fg-subtle`. Now `fg-muted`.

`surface-alt` was originally `#F2F7F5`; at that value `fg-muted` on the section
bands measured **4.45:1**, just under AA. It was lightened to `#F4F9F7` (4.53:1).
Any future change to a background colour must be re-measured against `fg-muted`,
which is the tightest pairing in the palette.

### Target size

The bar is WCAG 2.2 AA (2.5.8): a 24x24 CSS pixel target, or enough spacing that
24px circles centred on adjacent targets do not intersect.

Footer links, breadcrumb links and the notification row actions were 19-20px
tall and tightly stacked; they carry `py-1` now. Table row links and sortable
headers are also ~20px but are 48-69px apart, so they pass on the spacing
exception and were left compact deliberately — padding them would undo the
density the queues were rebuilt for.

`PetCard`'s heading link measures 21px, but the card uses a stretched link
(`after:absolute after:inset-0`), so the real target is the whole 442x487 card.
Measure the hit area, not the text box.

**Two deliberate deviations from the approved palette**, both to reach AA:

- The LOST badge ink was darkened from `#D98A26` to `#9A620F`. At the specified
  value it measured **2.47:1** — the most important label on a card was also the
  least readable.
- The FOUND badge ink uses Dark Teal `#0E5D5B` rather than Primary Teal
  `#157A78`, which measured 4.42:1 on the soft teal background.

Both keep the amber/teal identity. The undarkened values are still used for
fills, where they pass.

**Never put white text on `accent`** — amber with white measures 2.07:1. Amber
fills take `fg` (dark) text.

**`fg-subtle` (3.06:1) is decorative only**: icons, dividers, ornament. Anything
a person needs to read uses `fg-muted` or darker.

## Not decided yet

- **Dark mode** — deliberately skipped. It doubles the palette to maintain
  without improving the lost-pet workflow. Tokens are centralised, so it stays
  addable later.
- **Typography** beyond the system stack and Tailwind's default scale.
- **Logo / brand mark** (IMG-002) — should be generated from this palette so the
  imagery and the interface read as one project.

## Text over a photograph

axe cannot judge this. It sees a transparent background behind the words,
declines to guess what is under them, and reports nothing — so every reading
below was taken by hiding the text, photographing the page, and comparing each
text colour against every pixel inside its own box. `scripts/.local/` holds the
two files that do it; they are not part of the suite because they answer a
question about three specific bands rather than about the site.

Three public heroes put text on artwork: the homepage over IMG-018, Help over
IMG-028, About over IMG-029. All three carry the same device — **a directional
scrim**, cream, strongest at the left edge and gone by roughly 72% of the
width. Not a filter over the whole picture: the landscape stays visible, and
the text sits on a field whose lightness does not depend on where the crop
happens to land at a given width.

Measured at 390, 768, 1366 and 1920, worst pixel in each text box:

| | 390 | 768 | 1366 | 1920 | needs |
| --- | --- | --- | --- | --- | --- |
| Home — headline, dark words | 11.72 | 6.25 | 10.90 | 11.13 | 3.0 |
| Home — headline, teal words | 4.38 | 3.44 | 4.35 | 4.16 | 3.0 |
| Home — paragraph | 11.78 | 11.88 | 11.17 | 11.43 | 4.5 |
| Home — announcement strip | 12.90 | 12.43 | 12.73 | 12.84 | 4.5 |
| Home — announcement link | 4.84 | 4.84 | 4.76 | 4.80 | 4.5 |
| Help — heading | 12.88 | 12.88 | 13.09 | 13.09 | 3.0 |
| Help — description | 5.14 | 5.14 | 4.94 | 4.93 | 4.5 |
| About — eyebrow | 4.82 | 4.82 | 4.68 | 4.77 | 4.5 |
| About — heading | 12.88 | 12.88 | 8.56 | 10.02 | 3.0 |
| About — paragraph | 5.09 | 5.09 | 7.57 | 10.36 | 4.5 |

Four things this found that looking would not have:

* The homepage paragraph read **4.46** in muted ink at 1366 — under AA by four
  hundredths. Now `text-fg`.
* The About paragraph read **1.17** at 1366: its right end reaches the stand of
  leaves at the left of IMG-029, which the scrim lightens but does not erase.
  Now `text-fg`.
* The Help description read **2.53** at 1366, sitting on the amber route ribbon
  in IMG-028 — while the heading directly above it read 12.43. A heading that
  passes says nothing about the line under it.
* The announcement strip is `rounded-card` until `sm` and a pill only once it
  fits on one line. A pill radius on a block that has wrapped to three lines is
  half its height, and at 390px the corner it cut away reached 18px into the
  "Report a lost pet" link, which was therefore sitting on the page rather than
  on its own background.

**The rule this leaves:** where text sits on artwork, the readable surface has
to be something the page draws, not something the picture happens to provide.
Opacity, brightness and a text-shadow all depend on the crop; a scrim does not.
