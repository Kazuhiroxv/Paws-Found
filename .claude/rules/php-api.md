---
paths:
  - "api/**"
---

# PHP API rules (api/)

Course-mandatory security (see `docs/final-project-guide-requirements.md`):
- Prepared statements for every query; no SQL built from request input.
- Password hashing, server-side input validation, basic XSS protection, session management.
- Authorization on the server for every endpoint: check capabilities through
  `ADMIN_CAPABILITIES` / `admin_capabilities()` in `api/helpers.php`. Hiding UI is not access
  control.
- Search, filter, and sort endpoints support pagination.

Privacy at the API boundary: never return exact home locations, private email or phone
numbers, or verification information in public responses.

Never print or copy the contents of `api/config.local.php` (real credentials; it is
gitignored). `api/config.example.php` is the tracked template.
