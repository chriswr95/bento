# Test plan

Bento must preserve Markdown and make the meeting → todo workflow work across Windows and macOS. Tests use disposable workspaces and fictional data.

## Automated checks

| Command | Scope |
| --- | --- |
| `pnpm test` | Quick-open ranking, fuzzy/metadata search, command filtering and result limits; navigation history and cross-platform shortcut/chord tests; semantic-color identity/contrast and Markdown persistence tests; theme palette/validation/storage tests and unit tests for capture/reconciliation, typed schemas, document creation, profiles, settings-file migration/conflict/recovery, typed property values/atomic updates, save coordination, directory tree/state, rich Markdown round trips/source preservation, session-file validation/fallback, and project review date/relationship grouping; repository tests against actual temporary Markdown files. No GUI required. |
| `pnpm test:desktop` | Real Electron app: quick-open command execution, page opening and project-context meeting creation; first-time welcome, empty workspace, personal profile/appearance in settings.md across restart, automatic workspace/page restoration without a chooser, nested directory navigation, keyboard folder disclosure, retained collapse state, active-page reveal, create/open project Markdown, cancel creation, linked meeting, project review with related-note/todo navigation, project status/tags and meeting date/relations across restart, typed checkbox, todo notes/status, restart, completion propagation, sandbox bridge, external conflict, and retained draft. Only the directory chooser is stubbed. |
| `pnpm test:browser` | Quick-open focus/caret restoration, command-only search, keyboard selection, empty results, retained edits and responsive dialog; keyboard navigation/caret/scroll restoration, forward-branch behavior, searchable shortcuts and chord dispatch; eight-color pickers, global tag overrides/reset, cross-theme rendered chip contrast, and native color persistence; paired themes, import/rejection/export/removal, system mode, restart and unchanged workspace data; inline-property cancellation, validation, zero/false values, blur saves, tag chips, relation search/apply/cancel and read-only behavior; shared editor interactions, formatted contenteditable typing, cross-block replacement, undo/redo, Markdown shortcuts and rich paste, checkbox shortcuts, title edits, copies, exports, reload, safe HTML, responsive widths, profiles, unavailable storage, and legacy snapshot migration. The runner starts its own loopback sample server. |
| `pnpm package` | Build an unsigned bundle for the current platform. |

Install prerequisites with `pnpm install --frozen-lockfile` and `pnpm setup:desktop`. Browser checks also need `pnpm exec playwright install chromium`, or `BENTO_CHROME_PATH` pointing to an installed Chrome. Node.js 22.12+ is required.

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
