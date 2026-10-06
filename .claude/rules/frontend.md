---
paths:
  - "src/**"
---

# Frontend rules (src/)

## Components and code
- Before creating a reusable component, check `docs/ui-inventory.md` for an equivalent,
  and keep that file current. Don't end up with several cards that are the same component.
- Keep pages split into small components rather than one giant file, keep business logic
  in one place, and add no dependency the current feature doesn't need (CLAUDE.md §6).
- Data comes only through `src/services/` (see CLAUDE.md §5).

## Visual design
- The team guides the visual identity. The approved direction is in
  `docs/design-system.md`; follow it rather than independently establishing a new design
  language.
- Use clean structure, consistent spacing, readable typography, neutral component
  styling. Avoid excessive glassmorphism, generic SaaS gradients, glow effects, excessive
  animation, oversized border radii, invented colour systems, decorative dashboards, and
  designs lifted from unrelated apps.

## Responsive and accessible
- Support desktop, laptop, tablet, and mobile; design mobile-aware from the start. Watch
  navigation, filters, forms, map controls, dashboards, modals, image upload, cards, and
  status controls. Test at 1920, 1366, 768, and 390 px wide.
- Semantic HTML, keyboard use, visible focus, proper labels, useful error messages,
  descriptive button text, image alt text, adequate contrast, correct heading order, and
  status indicators that don't rely on colour alone.

## States and forms
- Account for loading, empty results, no matches, no notifications, no reports, invalid
  form, map unavailable, image unavailable, unauthorized, 404, and network error. Don't
  build only the happy path.
- Forms: clear labels, required-field indicators, useful validation and messages, a review
  step where appropriate, success confirmation, cancel behaviour, mobile layout.
- Reporting flow: **Pet Details → Location & Date → Photos → Review → Submit**.
