---
paths:
  - "src/**"
  - "public/**"
  - "index.html"
---

# Browser verification (Playwright MCP)

This project has a pinned, project-local Playwright MCP server (`.mcp.json`, isolated
browser). Use it to check the rendered app yourself, without being asked, when:

- you changed UI: components, markup, layout or styles;
- you changed a user-visible flow: navigation, forms, dialogs, client-side state or validation;
- a problem only shows in the browser: rendering, console errors, responsive layout;
- the user asks you to verify how something looks or behaves.

Skip it for copy-only or docs edits, comments, backend-only, test-only or config changes,
and say that rendered behavior was not checked.

When you use it: open only the local dev server (`http://localhost:5173`, which needs
Apache and MariaDB for `/api`), never production; sign in only with the seeded local
accounts and never print the password (whatever you type is recorded in the session
transcript, so never use a real credential); avoid changing data you don't need to
(reseed afterwards if you did). Check the changed screen at desktop width and at 390px; exercise
what changed; read console errors; close the browser when done. Report what you saw in
the browser separately from what you assume.
