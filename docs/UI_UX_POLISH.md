# UI and UX polish — the current phase

Written 27 September 2026.

---

## The boundary

**The backend, authentication, database and deployment are stable and finished.**

Do not change them during this phase. Not to make a component simpler, not to
add a field that would look nice, not to avoid a slightly awkward API response.
If you believe one of them has a defect, **demonstrate it** — a failing test, a
reproducible request, a log line — and then fix that specific thing. A hunch is
not a demonstration.

Everything in this phase is the interface: what it looks like, how it reads,
how it behaves on a phone, and whether somebody can use it with a keyboard.

### What must not change

- API request and response shapes
- Route paths
- Authentication state and how it is obtained
- Role permissions
- Form payloads — field names, types, and the values an ENUM accepts
- Server-side validation
- The database schema

`npm run test:contract` exists precisely to catch a UI change that quietly
alters a payload. Run it.

---

## The design system

`docs/design-system.md` is the full reference and is current. What follows is
the shape of it, so you know what you are working inside.

### Palette

**Teal and amber**, approved by the group. Teal leads; amber is the accent and
is used sparingly. Tokens live in `src/index.css` as CSS custom properties —
`--color-brand`, `--color-accent`, `--color-fg`, `--color-surface` and their
`-soft`, `-hover`, `-muted` variants. There are also semantic tokens that carry
meaning rather than appearance: `--color-lost`, `--color-found`, and a
`--color-status-*` pair for each of the four report statuses.

**Use the tokens.** A hard-coded hex in a component is how a palette stops
being a palette.

### The canvas system

Four atmospheres share one recipe — grain, two far-off brand glows, a warm base
— and differ in which colour leads. `RootLayout` picks one from the route:

| Utility | Where | Character |
| --- | --- | --- |
| `canvas-public` | Everything public | Amber and teal in balance; the strongest |
| `canvas-customer` | `/dashboard` | Warm — amber leads, teal answers |
| `canvas-staff` | `/staff` | Cooler, operational — teal leads |
| `canvas-admin` | `/admin` | Quietest — neutral with restrained teal |

That warm / cool / quiet progression is deliberate: a customer is being
welcomed, a coordinator is working, an administrator is supervising.

`canvas-fade` masks the layer out downwards so its bottom edge is never a
visible line — the atmosphere belongs to the top of a page, not the whole
scroll.

### Surfaces, bands and wells

Public pages alternate `surface` and full-bleed `surface-alt` **bands**, so a
long page reads as distinct chapters rather than one scroll of white cards. A
page running its own full-bleed sections cancels `RootLayout`'s padding with
`-my-8`; the homepage, About and Help all do this. A section that can be jumped
to from an in-page link needs `scroll-mt-24`, or the sticky 72px navbar covers
its heading on arrival.

A **well** is a recessed area (`--color-sunken`) for content that is being
displayed rather than acted on.

### Decoration

Three pieces, all `aria-hidden`, all behind the content:

- **`PatternVeil`** — the route pattern: wandering routes, contour arcs, radar
  sweeps, pins, paw marks. Drawn at 4–7%, tiled large (`far`) or closer (`near`).
- **`WovenVeil`** — a woven microtexture at 2%. Footer and a couple of warm
  public sections only.
- **`RadarOrnament` / `RouteOrnament`** — oversized single motifs entering from
  a page edge and clipped by it. Their container needs `overflow-hidden` or
  they widen the page; hidden below `sm`, where there is no spare edge.

**Grain** lays a 140px monochrome noise tile at 3.5% over every canvas.
Generated in CSS, about 300 bytes. Invisible to look at directly; it stops a
large flat field reading as nothing.

**`SectionCurve`** replaces a hard section edge with 30–48px of curve, filled
with the colour of the section *below*. Used sparingly — a page where every
boundary curves reads as a template.

### Motion

Restrained, and it respects `prefers-reduced-motion`. Nothing important is
communicated by movement alone.

---

## Pages, and what each is for

| Page | Its job |
| --- | --- |
| **Home** | Explain the service in one screen and offer the three actions: report lost, report found, browse. |
| **Explore** | The working surface. Filters, sort, pagination, map/list. It should feel genuinely useful, not a bare text input. |
| **Report detail** | Everything a stranger needs to recognise the pet, with the contact and location restraint the privacy notice promises. |
| **Report wizard** | Pet Details → Location & Date → Photos → Review → Submit. Per-step validation; a review step before anything is written. |
| **Customer dashboard** | This person's own cases: their reports, their possible matches, what needs their attention. Useful case information over decorative analytics. |
| **Staff workspace** | A queue. Pending reports, matches to review, verification requests, active cases. Comparison is the central act. |
| **Admin workspace** | Oversight. Accounts and roles, categories, moderation, activity. Not everyday case processing. |

Full inventory: `docs/page-inventory.md`. Components: `docs/ui-inventory.md` —
**check it before creating a new component**, and maintain it.

---

## Recommended order

1. **Homepage** — the first thing anyone sees, including the instructor
2. **Explore** — the most-used screen, and the one that carries the "smart" claim
3. **Report detail** — where a match is judged
4. **Report wizard** — the longest interaction, and the easiest to make tiring
5. **Customer dashboard**
6. **Staff workspace**
7. **Admin workspace**

Front to back, in the order the demonstration itself follows.

---

## What to prioritise

- **Visual hierarchy** — what should be read first, actually is
- **Spacing** — consistent rhythm; the same gap meaning the same thing
- **Mobile** — 390px is a target, not an afterthought. Test at 390 / 768 / 1366 / 1920
- **Navigation** — the desktop nav collapses below `xl`, not `lg`
- **Filtering usability** — active filter indicators, a clear-all, obvious result counts
- **Empty states** — no reports, no matches, no notifications, no search results
- **Loading states** — skeletons over spinners where the shape is known
- **Errors** — what went wrong and what to do, not a status code
- **Confirmation dialogs** — for anything irreversible, saying what will happen
- **Accessibility** — labels, focus order, `aria-describedby` on errors, headings that do not skip
- **Keyboard and focus** — visible focus everywhere; nothing reachable only by mouse
- **Contrast** — WCAG AA minimum. axe cannot judge text over a photograph; measure that by sampling
- **Presentation quality** — it will be shown on a projector, at a distance, to somebody deciding a grade

---

## Out of scope

Not "later". Rejected, with reasons in `docs/DECISIONS.md`.

- WebSocket rewrite
- AI or image-recognition matching
- Schema redesign
- New major features
- A new authentication architecture
- New dependencies, unless a feature being built **now** genuinely needs one
- Draft reports
- Password strength meters (a guidance-only Weak / Fair / Strong label was added on 30 September; see `DECISIONS.md`)
- Forced-scroll consent
- Exposing exact home addresses
- Social login / OAuth, SMS verification, PWA

If a polish idea requires any of these, it is not polish.

---

## Before you commit a UI change

```bash
npm run lint
```

```bash
npm run build
```

```bash
npm run test:contract
```

Then `npm run a11y` if you touched structure, labels, headings or colour — 29
pages, zero violations is the standard.

If you touched anything a form sends, run `npm run audit` too. If you touched
authentication screens, run `python scripts/auth_lifecycle.py`.

And look at it. On a phone, and at 1920. Screenshots in a browser at a real
viewport catch what a test suite cannot.
