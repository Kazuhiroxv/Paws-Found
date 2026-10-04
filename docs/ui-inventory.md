# UI Inventory

**Check this file before creating any reusable component.** It exists to prevent
the classic drift into `PetCard` + `PetListingCard` + `AnimalCard` +
`ReportCard` + `LostPetCard` that are all the same thing (CLAUDE.md §17).

If what you need is close to something below, extend that component with a prop
rather than forking it. If you add a component, add its row here in the same
commit.

_Last updated: pagination — 2026-09-06_

Colours, shape tokens and the accessibility rules live in
[design-system.md](design-system.md). Components must use semantic tokens, never
raw Tailwind colours.

## Built

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `components/ui/Button.jsx` | Variants `primary` (teal) `secondary` `ghost` `accent` (amber) `danger`; sizes `sm` `md` `lg`; `isLoading`, `fullWidth`. `as={Link}` renders a button-shaped link. Defaults to `type="button"`. |
| `PetCard` | `components/PetCard.jsx` | **The** card for a report, everywhere one appears. The photo leads, with the type badge and date overlaid on it — `formatCardDate`: "19 days ago" under 30 days, then "Jul 11", one rule for every card. Name, species/breed, city and status below; `statusVariant="pill"` gives the dashboard's filled status. Whole card clickable via a stretched link. Falls back to a paw placeholder. |
| `ReportTypeBadge` | `components/ReportTypeBadge.jsx` | LOST (amber) / FOUND (teal), each with its own icon and the word. |
| `StatusBadge` | `components/StatusBadge.jsx` | Dot + label for the four statuses. Deliberately quieter than the type badge so the two can sit together. `variant="pill"` is a restrained filled pill (teal / amber / green / grey, label always present) used on the customer dashboard. |
| `Input` | `components/ui/Input.jsx` | Text input with label, hint, error. Any `<input>` type. |
| `Textarea` | `components/ui/Textarea.jsx` | Same contract as `Input`, plus `rows`. |
| `Checkbox` | `components/ui/Checkbox.jsx` | Label beside the box, optional hint. Does not use `Field` — that one stacks label above control. |
| `Select` | `components/ui/Select.jsx` | Native select with a drawn chevron — `appearance-none` strips the native arrow, so it has to be replaced or the control looks like a text input. Build options with `optionsFromLabels()` from `@/utils/options`. Takes `hideLabel` for use inside a table row. Has no `size` prop — anything unrecognised lands on the native `<select>`, where `size` means something else entirely. |
| `Field` | `components/ui/Field.jsx` | Label + hint + error wrapper used by the three controls above. Use directly only when wrapping a control that does not exist here yet. `hideLabel` keeps the label for screen readers but hides it — for a control in a table cell, where the column header already says what it is. The hint renders **below** the control, not above: with it above, a hinted field pushed its own input box down and two fields side by side in a grid row stopped lining up. |
| `controlClasses`, `describedBy` | `components/ui/formControl.js` | Shared control styling and the `aria-describedby` builder, used by Input/Textarea/Select. They sit in their own file because a component file must export components only — otherwise Fast Refresh breaks and the lint fails. |
| `Card` + `CardHeader` `CardBody` `CardFooter` | `components/ui/Card.jsx` | Generic surface. Compose it — do not create new card components for each context. Header titles wrap rather than truncate, and the action drops below the title when there is no room beside it. |
| `Modal` | `components/ui/Modal.jsx` | `placement="sheet"` docks it to the bottom of the screen at full width, for something long on a phone (Explore's filters). Native `<dialog>`: focus trap, Escape, inert background. Parent owns `isOpen`. Carries `m-auto` deliberately — the browser centres a dialog with `margin: auto` and Tailwind's reset zeroes it, which pins the dialog to the top-left. Do not remove it. **Present in the page only while open** (like `PhotoLightbox`), and focus returns to whatever opened it. A descendant marked `data-autofocus` gets the focus when it opens — `ConfirmDialog` puts it on Cancel. |
| `PhotoLightbox` | `components/PhotoLightbox.jsx` | A report photograph at full size, on the native `<dialog>`. **Only in the page while open** — nothing can be left showing when it is closed — and focus returns to whatever opened it. Used by the report page's gallery and both sides of the owner's match comparison. |
| `Container` | `components/ui/Container.jsx` | Page width + gutters. Widths `page` (1280) `wizard` (800) `form` (672) `prose` (720). |
| `EmptyState` | `components/ui/EmptyState.jsx` | Icon + title + description + action, for any list with nothing in it. |
| `LoadingSkeleton` | `components/ui/LoadingSkeleton.jsx` | Pulsing placeholder bars. Pass `lines` and a sizing `className`. |
| `NavDropdown` + `NavDropdownItem` | `components/NavDropdown.jsx` | The header's disclosure menus — "Report" and the account control. Opens on click (never hover, which is unusable on touch), closes on Escape, on an outside click, and after a link inside is followed. `children` is a function receiving `close`. Also used on My Reports for "New report" and each card's "•••" More menu; `showChevron={false}` drops the chevron for an icon-only trigger. |
| `Navbar` | `components/Navbar.jsx` | Sticky top navigation, 72px, in four groups: brand · public links · the role's workspace · account and demo controls. `Report Lost` and `Report Found` share one `Report` menu. The workspace is a bordered control rather than a sixth link, and the demo selector sits behind a divider under a muted "Demo:" so it cannot be mistaken for an account control. Collapses behind a menu button below `xl` — check the fit against the *staff* view, which carries the most. |
| `Sidebar` | `components/Sidebar.jsx` | Workspace navigation, one look for all three workspaces (the `panel` variant is gone — administration used the last of it): links on the page ground with a hairline divider and optional count badges, and below `lg` one compact section menu. Counts come from `WorkspaceLayout`'s `loadCounts`. |
| `Footer` | `components/Footer.jsx` | Four link columns grouped by intent — two by two on phones, four across from `sm` — plus the demo-data disclaimer. |
| `SectionHeading` | `components/SectionHeading.jsx` | The `h2` that opens a section on a public page, with optional description and an action opposite. Was local to the homepage until About and Help needed the same thing. |
| `PageHeader` | `components/PageHeader.jsx` | Breadcrumb, `h1`, description, actions — **and the document title**. Optional `icon` and `eyebrow` put an icon medallion and a role line beside the heading; the staff and admin workspaces use both, public pages use neither because they lead with an image instead. `compact` gives a slightly smaller heading for the dashboard greeting. Every page should render one. The report detail page is the one exception: it composes `Breadcrumb` + `h1` + `<title>` itself so the type and status badges can sit directly under the name. |
| `Breadcrumb` | `components/Breadcrumb.jsx` | Takes `{ label, to }[]`; the last item is the current page. |
| `RequireAccess` | `components/RequireAccess.jsx` | Route guard: signed out → `/login`, wrong role → `/unauthorized`. UI coherence only, not security. |
| `FilterPanel` | `components/FilterPanel.jsx` | Explore's filter controls. Stateless — the page owns the values, so the desktop sidebar and the mobile dialog cannot drift apart. "Date of incident" sits under Species and starts open (`defaultOpen` on `FilterGroup`); the group toggles are 44px tall touch targets. |
| `PasswordField` + `PasswordChecklist` + `PasswordStrength` | `components/PasswordField.jsx` | A password box with a real Show/Hide button; the live requirements list (names the first/last-name rule when the form knows the person); the Weak/Fair/Strong guidance label. Rules from `utils/passwordRules.js`. |
| `ConfirmPasswordField` | `components/PasswordField.jsx` | The second password box. Renders nothing until `ready` (every requirement met); refuses paste and drop with a stated reason. The page empties its value whenever the password stops qualifying. Used by Register and Reset. |
| `reveal`, `revealFirstInvalid`, `useRevealWhen` | `utils/reveal.js` | Scroll a result into view and focus it after a submit — a success card, an error, the first invalid field. Smooth only without reduced motion. The target needs `tabIndex={-1}` if it is not a control, and `scroll-mt-24` for the sticky navbar. |
| `BreedField`, `PlaceFields`, `TimeOfDayField`, `DescriptionField` | `components/report-form/PetDetailsStep.jsx`, `LocationDateStep.jsx` | Correction 3, local to the report wizard (not exported): the species' breed list with "Not sure" / "type it"; province then dependent city from PSGC; Hour / Minutes / AM or PM handing back 24-hour time; the description with its live "N / 30 minimum". All lists come from `referenceService`, never from JSX. |
| `referenceService` | `services/referenceService.js` | Colours, breeds per species, the 84 areas (PSA's 82 provinces, Metro Manila, the Special Geographic Area — each with its type), cities per area, from `/api/reference`; each fetched once per page load. Used by the report form and Explore. |
| `PublicationBadge` | `components/StatusBadge.jsx` | Correction 4: Pending review / Not approved / Removed, dashed, beside the case status; nothing for a published report. |
| `PublicationPanel` | `components/PublicationPanel.jsx` | On the report page, for its reporter, coordinators and administrators: the publication state, the reason for a rejection or removal, the review history, and the one move each may make (Approve and publish, Not approved…, Submit for review again, Remove from public view…). Reasons are required in its dialogs. |
| `NewReportForm` | `components/report-form/ReportForm.jsx` | The wizard for a new report; opens a saved draft from `?draft=`. `ReportForm` gained Save draft. |
| `DraftCard` | `pages/dashboard/MyReportsPage.jsx` | A draft in My reports: Continue editing, Delete draft. |
| `StaffReviewPage` | `pages/staff/StaffReviewPage.jsx` | The Pet Coordinator's review queue, oldest first. |
| `AdminLogsPage` | `pages/admin/AdminLogsPage.jsx` | Correction 5: the administrators' Logs — Activity, Sessions and Security events tabs, a filter form (applied on submit, kept in the address), one server page at a time with `Pagination`, and every name, IP and session in the table a link that narrows to it. A plain table in an `overflow-x-auto` box, so a phone scrolls the table, not the page. Its table helpers (`Person`, `Ip`, `Reference`, `Target`) are local to it. |
| `SessionNotice` | `components/SessionNotice.jsx` | (Changed in Correction 5.) Says why the session ended, from the server's reason — signed out, inactivity, time limit, another device, password changed, access changed, locked or suspended (with the administrator's contact) — or that the role changed. `role="alert"`, dismissed by a labelled button. |
| `RequireCapability` | `components/RequireAccess.jsx` | Correction 6: an Administration section this administrator's level does not include says "You don't have permission to access this page." in place, and renders nothing of the page. |
| `can()` | `utils/permissions.js` | Correction 6: whether the account's server-sent capabilities include one. The one place the interface asks; never a level label. |
| `useWorkspaceUser()` | `hooks/useWorkspaceUser.js` | Correction 6: the signed-in account inside a workspace page, from the router's outlet context. |
| `logService` | `services/logService.js` | Correction 5: `logPageView(pathname)` (best effort, never throws) and the three log lists for `AdminLogsPage`. |
| `ActiveFilters` | `components/ActiveFilters.jsx` | Removable chips for every applied filter. |
| `FlagReportDialog` | `components/FlagReportDialog.jsx` | "Report this listing" — creates a moderation case. Requires sign-in. |
| `DemoRoleSelector` | `components/DemoRoleSelector.jsx` | **Development only.** Delete when real authentication lands. |
| `ReportForm` | `components/report-form/ReportForm.jsx` | The lost/found wizard. One component for both types **and** for editing — pass `reportType` to create, or `report` to edit. Steps, validation and the value↔service mapping live in `reportFormModel.js`. |
| `Avatar` | `components/Avatar.jsx` | A person drawn from their initials, on one of five tints picked from the name so the same person is the same colour everywhere. Decoration only — `aria-hidden`, and the name is always beside it. Used where the staff and admin workspaces list people. There are no profile photographs and none are planned. |
| `StatTile` | `components/StatTile.jsx` | One number plus its label on a dashboard. The tile itself stays plain — no sparkline or trend arrow inside it; charts are separate components below. **Staff and admin only** — the customer dashboard shows cases, not counts. Pass `emphasis` for the one or two numbers that mean someone has to act; if every tile is emphasised, none is. |
| `BreakdownBars` | `components/BreakdownBars.jsx` | A labelled list of proportion bars — "where reports stand", "most reported animals". Takes `rows` of `{key, label, value, barClassName}` and an optional `total`. The bar is `aria-hidden`; the number beside it is the real value. Used by both the staff and administrator dashboards, which is why the status colours live in `REPORT_STATUS_BARS` in constants rather than in either page. |
| `MonthlyReportsChart` | `components/MonthlyReportsChart.jsx` | Reports filed per month, lost beside found, over six months. Plain elements, no charting library (CLAUDE.md §15). Bars are measured against the tallest single value so the two series stay comparable. Carries an `sr-only` table of the same figures — the drawing alone is not readable. Every bar also prints its own value, the month total sits under each label, and the legend names each bar's **position** as well as its colour, so nothing in it depends on telling amber from teal. |
| `PatternVeil` + `WovenVeil` | `components/PatternVeil.jsx` | IMG-014 (routes, pins, radar sweeps, paws) and IMG-016 (the woven microtexture) as decorative layers behind a section's content. Each has to be its own element — the pattern is faded with a mask, and a mask applies to everything inside the element it sits on, so putting it on the section fades the section's own text. The parent must be `relative isolate`. `scale="near"` brings the routes close enough to read as a journey. `aria-hidden`, no pointer events. |
| `RadarOrnament` + `RouteOrnament` | `components/Ornament.jsx` | Oversized decoration that enters from a page edge and is clipped by it — a search sweep, or a route with a pin. Drawn inline (a handful of circles, no asset). **The container needs `overflow-hidden`**, or the ornament widens the page. Hidden below `sm`. |
| `AuthShell` | `components/AuthShell.jsx` | The frame around signing in and registering: the form at a comfortable reading width on the left, IMG-017 beside it from `lg`. Below `lg` the photograph is dropped rather than stacked — on a phone it would push the form below the fold. No text is ever placed over it. |
| `SectionCurve` | `components/SectionCurve.jsx` | A very shallow curve between two full-bleed sections, filled with the colour of the section below so the next chapter appears to rise into this one. About 30–48px of travel across a desktop viewport. Used sparingly. |
| `ConfirmDialog` | `components/ConfirmDialog.jsx` | The one confirmation pattern for anything hard to take back: suspending or reinstating an account, changing someone's role, deactivating or deleting a category, removing a flagged report, removing and suspending. Names the person, report or category in the title, says what the action does in the body, labels the button with the action itself (never "OK"), and opens with focus on Cancel (`data-autofocus`, honoured by `Modal`) so a stray Enter commits nothing. Red only for destructive ones. |
| `Pagination` | `components/Pagination.jsx` | Numbered page links for a paged list — previous, page numbers, next. Renders nothing when everything fits on one page. Shows every page up to seven, then windows to first/last/current±1 with an ellipsis. `nav` with its own label, `aria-current` on the current page, and Previous/Next keep their words for screen readers when the viewport hides them. |
| `MatchCard` + `MatchActions` | `components/MatchCard.jsx` | The evidence comparison: two large photographs side by side with the score between them, then every signal ticked or crossed — matched **and** unmatched. Used by the customer dashboard, My Matches, the report detail page, the staff match queue and verification, so all five show a coordinator and a reporter the same thing. Never claims two reports are the same animal. |
| `ReportMap` + `KeepMapSized` + `WheelZoomWhenChosen` | `components/ReportMap.jsx` | Leaflet map of one or many reports, with popups. `showApproximateArea` draws the privacy circle. Always include `KeepMapSized` in a new map, or tiles go missing after a resize, and `WheelZoomWhenChosen`, so the scroll wheel zooms only after the map is clicked or focused instead of trapping page scroll. |
| `LocationPicker` | `components/LocationPicker.jsx` | Click-to-drop pin for the report form. Optional by design. |
| `mapSetup` | `components/mapSetup.js` | Marker icons, tile layer and OSM attribution. Not components — icons are built here so the palette stays in one place. |
| `LazyMaps` | `components/LazyMaps.jsx` | **Import maps from here.** Wraps the map components in `lazy` + `Suspense` so Leaflet stays out of the initial bundle. |
| `Timeline` | `components/Timeline.jsx` | A report's `statusHistory`, oldest first, with actor names. |
| `MatchPairCard` + `MatchStatusBadge` + `PairingName` + `StatusStrip` | `components/MatchComparison.jsx` | The pairing card used by Possible Matches, the staff Match queue and Verification: a pairing title with a stage badge, 320px photos that open full size, the compatibility score with "n of 7 characteristics align", and one evidence list with both values side by side. The page puts its own panel inside (a reporter's next step, a coordinator's decision). `MatchStatusBadge` names every match status in one place, so all three pages say the same thing. |
| `AccountStatusBadge` + `ModerationStatusBadge` + `CategoryStatusBadge` | `pages/admin/AdminBadges.jsx` | Every state in the Administration workspace — account Active/Suspended, flag Awaiting review/Actioned/Dismissed, category Available/Deactivated — as the same pill `StatusBadge` uses for a report, so one page's states read like another's. The word is always present; colour and the dot only reinforce it. |
| `DecisionPanel` | in `pages/staff/StaffVerificationPage.jsx` | Coordinator decision: staff-only contact details, the case note, Confirm / Request more information, and Not the same pet set apart. Confirm and rule-out ask first. Local to that page — it is the only place a pairing is decided. |
| `LanguageSwitcher` | `components/LanguageSwitcher.jsx` | Correction 7: the English/Filipino control — a labelled native select ("Language (Wika)" / "Wika (Language)"), each language in its own name. `compact` shows EN/FIL over the same select for the desktop header; also in the phone menu and the workspace rail. |
| `t()`, `tList()`, `useLanguage()`, `Rich`, `errorText()` | `i18n/index.js`, `i18n/useLanguage.js`, `i18n/Rich.jsx`, `i18n/apiErrors.js` | Correction 7: **every word on screen comes from here.** `Rich` renders a translated sentence with `<link>`, `<b>`, `<i>` inside it; `errorText()` maps the API's known sentences. Never copy a label into a module-level constant — read it when rendering. See `docs/localization.md`. |
| `PrivacyUpdateNotice` | `components/PrivacyUpdateNotice.jsx` | Correction 7: "Privacy Notice updated" above a signed-in page, for an account on an older notice version — Review Privacy Notice / Acknowledge. Blocks nothing; hidden in print. |
| `PrintReportList` | `components/PrintReportList.jsx` | Correction 7: the printable report list. Rendered into `document.body` only while printing, calls `window.print()`, cleans up on `afterprint`. Public fields only; the publication column for coordinators and administrators. |
| `HandoverNotice` | `components/HandoverNotice.jsx` | Correction 7: the short safety notice on a confirmed match, linking to the Disclaimer's safety section. |
| `FooterNotice` | in `components/Footer.jsx` | Correction 7: the one-line disclaimer and link at the foot of every public and customer page. |
| `ProseSection` + `ProseList` | `components/ProseSection.jsx` | Correction 7: a titled section of paragraphs and a bulleted list, for the Disclaimer and Privacy Notice, rendered from the dictionaries. |
| `describeFilters()` | `utils/filterDescriptions.js` | Correction 7: an applied filter in words, shared by `ActiveFilters` and the printout's heading. |
| ~~`PhaseNotice`~~ | *deleted* | Every route is now built, so the placeholder component is gone. |

## Planned

Do not build these ahead of the phase that needs them.

| Component | Phase | Purpose |
| --- | --- | --- |
| `Toast` | when something needs it | Not built in Phase 3: the report wizard confirms with a full success screen, so there was nothing for a toast to say. |

## Conventions

- Components in `components/ui/` are presentational: no service calls, no
  routing, no business rules. Components that know what a *pet report* is go in
  `components/` alongside them, not in `ui/`.
- Every component accepts `className` and applies it **last**, so a caller can
  override spacing without a wrapper div.
- Use the semantic colour tokens (`text-fg-muted`, `border-border`) rather than
  raw Tailwind colours, so the design checkpoints can repaint the app from
  `src/index.css` alone.
- Anything conveyed by colour must also be conveyed by text or shape.
- A component file must export **only components**. Constants and helper
  functions belong in a sibling `.js` module (see `formControl.js`), otherwise
  Fast Refresh stops working and `react-refresh/only-export-components` fails
  the lint.
