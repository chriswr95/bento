# Test plan

Bento must preserve Markdown and make the meeting → todo workflow work across Windows and macOS. Tests use disposable workspaces and fictional data.

## Automated checks

| Command | Scope |
| --- | --- |
| `pnpm lint` | ESLint correctness checks for JavaScript/CommonJS and Markdownlint for docs, examples and templates. Generated files are excluded. |
| `pnpm test` | Example workspace relationships, calendar rollover, checkbox persistence and safe creation; walkthrough progress/replay and blocked storage; quick-open ranking, fuzzy/metadata search, command filtering and result limits; navigation history and cross-platform shortcut/chord tests; semantic-color identity/contrast and Markdown persistence tests; theme palette/validation/storage tests and unit tests for capture/reconciliation, typed schemas, document creation, profiles, settings-file migration/conflict/recovery, typed property values/atomic updates, save coordination, directory tree/state, rich Markdown round trips/source preservation, session-file validation/fallback, and project review date/relationship grouping; repository tests against actual temporary Markdown files. No GUI required. |
| `pnpm test:desktop` | Real Electron app: example creation/cancel, three-step walkthrough, real checkbox creation/completion, progress across restart, finish/replay/skip and responsive example layout; quick-open command execution, page opening and project-context meeting creation; first-time welcome, empty workspace, personal profile/appearance in settings.md across restart, automatic workspace/page restoration without a chooser, nested directory navigation, keyboard folder disclosure, retained collapse-all state, active-page reveal, single file explorer without decorative dots, standalone placement and absent subpage controls, long-title truncation, scrollable large workspaces and narrow layouts, create/open project Markdown, cancel creation, linked meeting, project review with related-note/todo navigation, project status/tags and meeting date/relations across restart, typed checkbox, todo notes/status, restart, completion propagation, sandbox bridge, external conflict, and retained draft. Only the directory chooser is stubbed. |
| `pnpm test:browser` | Makena Wong nickname eligibility/rarity, literal names and stable reloads; time-of-day greeting transitions, hourly stability, local-day/birthday rollover and preserved editor identity/caret during refresh; quick-open focus/caret restoration, file/command shortcut dispatch, editable-prefix mode switching and query preservation, keyboard selection, empty results, retained edits and responsive dialog; keyboard navigation/caret/scroll restoration, forward-branch behavior, searchable shortcuts and chord dispatch; eight-color pickers, global tag overrides/reset, cross-theme rendered chip contrast, and native color persistence; paired themes, import/rejection/export/removal, system mode, restart and unchanged workspace data; inline-property cancellation, validation, zero/false values, blur saves, tag chips, relation search/apply/cancel and read-only behavior; shared editor interactions, formatted contenteditable typing, cross-block replacement, undo/redo, Markdown shortcuts and rich paste, checkbox shortcuts, title edits, copies, exports, reload, safe HTML, responsive widths, profiles, unavailable storage, and legacy snapshot migration. The runner starts its own loopback sample server. |
| `pnpm package` | Build an unsigned bundle for the current platform. |

Install prerequisites with `pnpm install --frozen-lockfile` and `pnpm setup:desktop`. Browser checks also need `pnpm exec playwright install chromium`, or `BENTO_CHROME_PATH` pointing to an installed Chrome. Node.js 22.13+ is required.

Desktop tests keep the real Electron window hidden with offscreen rendering by default, disable background timer throttling, and avoid macOS activation/Dock presence. Playwright still drives the renderer and native backend; this is not a replacement with a browser-only mock. Set `BENTO_TEST_SHOW_WINDOW=1` when launching `pnpm test:desktop` to opt into visible debugging. The same setting works with `BENTO_PACKAGED_EXECUTABLE`. Normal app launches remain visible. Browser tests already use headless Chromium. Hidden tests do not validate OS window presentation, native focus, or actual folder-picker appearance; keep those checks manual.

CI runs unit/repository and native workflows on Windows and macOS, and browser checks on Ubuntu. Packaging runs on both desktop platforms. A packaged-app smoke test can be run locally with `BENTO_PACKAGED_EXECUTABLE` set to the packaged executable; it exercises the same native workflow through the actual bundle. Packaging alone does not prove installation, signing, or OS approval behavior.

## Data safety cases

- Invalid creation must not insert a partial record or lose existing text.
- Checkbox capture creates one stable todo identity; repeated links agree and removing a reference retains the todo's notes.
- Project relationships survive save/reopen and are inherited by meeting actions.
- Unknown properties, YAML comments, and line endings survive a small edit.
- External changes stop saves instead of overwriting files; local drafts remain available.
- Interrupted saves recover idempotently; divergent external edits preserve both copies and stop writes.
- Edits made during an in-flight save remain dirty until their own save completes.
- Invalid schemas, paths, duplicate IDs and symlinks never permit ambiguous writes.

Add regression coverage at the layer owning each behavior. Use storage tests for file guarantees and desktop tests for navigation/focus; avoid tests that only duplicate implementation details.

## Manual checks before everyday use

1. On Windows and macOS, start a fresh app and create a workspace with no coaching. Create a project, take meeting notes, capture three actions, set dates, and find upcoming work.
2. Navigate with keyboard only. Check visible focus, readable labels, dialog cancellation, narrow windows, and light/dark appearance. Screen-reader evaluation remains outstanding.
3. Exercise multi-paragraph editing, paste, undo/redo, selection, and IME composition with realistic notes. Automated cross-block replacement/history tests pass; broader real IME and screen-reader evaluation remains outstanding.
4. Reopen a workspace after closing the app; edit files in another editor and review how Bento retains drafts when a save stops.
5. Measure startup, typing and navigation with larger synthetic workspaces. No large-workspace performance target has been validated yet.
6. Check packaged-app launch and native folder selection on both platforms. Signing, installers, automatic updates, real agent integration, and multi-device sync are outside current validation.

### Workspace page and database customization regressions

Repository unit tests cover workspace body/title edits, checkbox capture with root-relative links, combined manifest/tag-color saves, preserved metadata/comments, forged configuration rejection, external-change protection, missing definitions, broken capability mappings, unregistered folders, retained relation values, and recovery after definition restoration. Native tests cover Workspace navigation/editing/capture, persisted title, commands using renamed database titles, and read-only editor/properties after database removal. These tests use disposable workspaces and keep native windows hidden.

### File organization and link coverage

Unit tests cover standalone creation without hierarchy, rejected Parent creation/updates, preserved inert legacy metadata (including former cycles and missing parents), unchanged physical paths and existing files, freely removable links, relative link resolution, Workspace links, links after title changes, backlink deduplication, and excluded code/external paths. Browser checks cover standalone creation, `[[` keyboard insertion, standard Markdown persistence, backlinks, empty suggestions, cancellation, and reload. Native checks cover the unified physical file tree, absent Parent/subpage actions, restart restoration, and large/narrow/short-window layouts. Native windows remain hidden.

### Slash-command coverage

Unit tests validate block structures, one-step undo, and invalid commands. Browser checks exercise slash headings, tracked todos, literal `/page`, and unknown/cancelled commands. Page creation remains available through the sidebar and command palette.

### Daily review and next-morning workflow

Unit tests cover all-work grouping including unassigned/inactive projects, active-project urgency and empty cards, deduplicated related notes, dated-note ordering/future exclusion/ambiguous dates, calendar rollover, leap days and daylight-saving boundaries, and invalid dates. A repository test captures a meeting checkbox, adds a due date and supporting todo notes, reopens on the next day, reschedules and clears the date, and verifies the original meeting and todo details remain intact.

Browser checks cover Today/Tomorrow/custom/clear dates, cancellation, keyboard focus, unchanged-date Undo preservation, source navigation, reload persistence, suspended modal navigation shortcuts, read-only date controls, and responsive overview/dialog layouts. Native checks type a meeting checkbox, schedule Today, add todo details, quit, reopen with the next morning's local date, confirm overdue/project summaries, choose Tomorrow, follow the source-note link, and verify persisted Markdown across another restart. Native windows remain hidden.

### Inline-menu stability regression

A browser regression pastes a long Markdown document, positions the caret at the viewport bottom, types a heading followed by `/todo`, and waits for browser scroll delivery before checking that suggestions remain open and execute. The test asserts that real caret scrolling occurred. The same interaction runs at 500, 600, and 720-pixel heights in headless Chrome and hidden Electron windows. It also covers `[[` insertion, keyboard scrolling within the option list without losing selection, Escape followed by fresh commands at reused offsets, real viewport scrolling, and resize dismissal/ARIA cleanup.

The new regression was run against the original picker and failed at the auto-scroll assertion, then passed with the fix. It does not mock picker methods or replace real input/scroll behavior with synthetic scroll events.

### Independent folders and database membership

Repository regressions cover explicit upgrade with retained content locations, identities, schema bytes/comments and legacy metadata; schema-description and incoming-schema link repair; mixed page types in one folder; ordinary creation defaults; missing-schema protection outside creation folders; empty/nested directory persistence; portable path and collision rejection; rejected snapshot membership transfers; external folder-change detection; interrupted upgrade/move recovery; and divergent move recovery retaining both copies. Link tests cover nested labels, code spans, reference definitions, multiline blockquotes, images, queries/fragments, external URLs and unchanged code examples. Session tests cover folder history and fallback when a restored folder disappears. Save-coordinator tests prove organization waits for in-flight and queued edits and never discards an unsavable draft.

Hidden native tests review/execute upgrade, traverse nested empty folders, reject invalid creation, create ordinary and typed meeting pages in the same folder, insert a wiki link, move its target into projects without assigning a database, follow the repaired link after restart, and verify breadcrumbs, back/forward navigation, restored folder view, and narrow/short layout. All workspaces are disposable; the user's live workspace is not migrated by tests.
