# English and Filipino

Correction 7. Ma'am asked for "different language here, especially Tagalog".
**The scope below is the team's implementation decision, not a quote from
her:** for a coherent system-wide language feature, every screen a person
reads — public pages, the customer's account, the Pet Coordinator's workspace
and Administration — is available in English and Filipino.

---

## 1. How it works

```text
src/i18n/
  index.js        t(), tList(), hasKey(), setLanguage(), getLanguage(), LANGUAGES
  useLanguage.js  the React hook App subscribes with
  Rich.jsx        a translated sentence with a link or bold words inside it
  apiErrors.js    the API's own sentences, mapped to dictionary keys
  en/ fil/        one dictionary per language, split by area; index.js joins them
```

- **One function reads words:** `t('nav.home')`, `t('explore.found', { count })`.
  A component never asks which language is showing.
- **The same keys in both languages.** `npm run test:i18n` compares the
  normalised key paths both ways, the `{placeholders}`, the `<link>` markup and
  the plural forms (`{ one, other }`), and fails on a key the source asks for
  that does not exist.
- **The language is a browser setting**, not account data: `localStorage`
  (`paws:language`), English by default, no database column, no migration. It
  survives navigation and reloads; it does not follow a person to another
  device, which is the honest trade-off for not storing it.
- **Switching re-renders in place.** `App` subscribes (`useLanguage`), so the
  route, the session, a half-filled form and an open dialog all stay. Nothing
  is sent to the server (checked: `I18N-05`). Messages already showing beside
  a form's fields are re-checked in the new language.
- **`<html lang>`** is `en` or `fil` and changes with the switch. `fil` is the
  ISO 639-2/639-3 code for Filipino, the national language, and a registered
  BCP 47 subtag; `tl` is Tagalog, the language Filipino is based on. The
  interface is written in Filipino, so it says `fil`; axe-core accepts it
  (50 pages clean, nine of them in Filipino).
- **Dates** are formatted with `en-PH` or `fil-PH` ("October 4, 2026" /
  "Oktubre 4, 2026"); both use a 12-hour clock with AM and PM. Stored dates and
  the 24-hour `TIME` values are never touched.
- **The control:** a labelled native select, "Language (Wika)" / "Wika
  (Language)", in the header (as EN/FIL over the same select, where space is
  tight), in the phone menu and in the workspace rail. Each language is listed
  in its own name.

## 2. What is translated

Everything the interface itself writes: navigation, headings, buttons, form
labels, hints and validation messages, empty states, dialogs, statuses and
badges, the session-ended messages (one per reason), the permission-denied
page, the Privacy Notice, the Disclaimer, Help and About, the printed report
list, alt text written by the interface, and the screen-reader-only words.

Stored values have **translated labels only**: `pending_review` is "Pending
review" or "Hinihintay ang pagsusuri", but the database, the API and every
request still say `pending_review` (checked: `I18N-16`, which also compares the
interface's values with the ENUMs in `schema.sql`). The same holds for report
types, case statuses, match states, species, sizes, sexes, colours (the 17
listed ones), moderation reasons, log actions and session end reasons.

## 3. What is not translated, on purpose

| Not translated | Why |
| --- | --- |
| What people typed: pet names, descriptions, distinctive features, place descriptions, notes, reasons, flags, case notes | It is their words. Machine-translating it would change what they said. |
| Notification titles and bodies | Written by the server, in English, at the moment the event happened, and stored that way. Marked `lang="en"` so a screen reader reads them correctly on a Filipino page. |
| A pairing's seven "why" sentences | Written by the server when the pairing was scored, stored in `match_signals`; marked `lang="en"`. Their headings (Species, Breed…) are translated. |
| Breed names, city and province names, a category an administrator added | Reference data and proper names. The five seeded species and the 17 colours are translated by their code. |
| The API's sentences beyond those listed in `src/i18n/apiErrors.js` | See §5. |
| Emails | Sent by the server in English (`api/mail_messages.php`); out of scope for this correction. |
| Role and administrator-level names | See §4. |
| Notes the system stores ("Closed by the reporter.", a photo's default description) | They are saved into the database, and what is saved does not depend on who saved it. |
| The development role selector | Development scaffolding, removed from the production build. |

## 4. Terminology

One word per concept, everywhere (`npm run test:i18n` refuses known variants).

| English | Filipino | Note |
| --- | --- | --- |
| Lost / Found | Nawawala / Natagpuan | report type |
| Draft | Draft | the common word; "burador" reads as archaic |
| Pending review | Hinihintay ang pagsusuri | |
| Published | Nakalathala | |
| Not approved (rejected) | Hindi inaprubahan | |
| Removed | Inalis | |
| Active | Aktibo | |
| Possible Match | Posibleng Tugma | "tugma" throughout, never "katugma" |
| Returned | Naibalik na | |
| Closed | Sarado | |
| Report (noun) | report | kept, as Filipino interfaces commonly do |
| Pet Coordinator, Administrator — Moderator, Administrator — Manager, Super Administrator, Customer/User | unchanged | official role names; a translation would be less clear and could be read as a different role |
| Privacy Notice | Abiso sa Privacy | |
| Acknowledge | Nakita ko na | "I have seen it" — what the button records |
| Sign in / Sign out | Mag-sign in / Mag-sign out | |
| Explore | Maghanap | |
| About / Help | Tungkol / Tulong | |
| verification | beripikasyon | |
| handover | pag-aabot | |
| email, PDF, IP address, Logs, Admin, dashboard | unchanged | technical nouns Filipino users read as they are |

## 5. Messages from the API

The PHP API answers a refusal with an English sentence (`{ "error": "…" }`) and
its rules never look at that sentence, so it was not rewritten to send codes:
that would have touched every endpoint for no change in behaviour. Instead
`src/i18n/apiErrors.js` maps the sentences people meet in the normal workflow —
sign-in, locking, suspension, permissions, coordinator-only review, stale
pages, missing records, rate limits, the browser's own network errors — to
dictionary keys, by exact text. A failed sign-in uses the response's own
structure (attempts left, locked) rather than its sentence. Any other sentence
is shown exactly as the server wrote it, in English: a reworded server message
falls back to English rather than to a wrong translation. Field-level
validation messages from the server (after the browser's own checks have
passed) are among those shown in English.

## 6. The printed report list

Print / Save as PDF on Explore (the instructor's own example), the Pet
Coordinator's Report queue and Administration's Reports. Browser-native: a
print-only sheet outside the app's root, `window.print()`, and the browser's own
"Save as PDF" — no PDF library, works offline. Headings follow the language
showing; what people typed prints unchanged. See `docs/DECISIONS.md`
(Correction 7) for the fields and what is left out.

## 7. Known limits

- The language does not follow an account between devices (it is not stored).
- Notifications, match reasons, emails and unlisted API sentences stay English
  (§3, §5).
- The Filipino was written by the team with an AI assistant and reviewed for
  naturalness; a native-speaker review before the final presentation is
  recommended.
