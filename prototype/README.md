# Markdown meeting workflow study

Open `index.html` in a modern browser. Keep this directory together: its local styles, application script, and vendored parser allow offline use with no build step. It uses fictional projects and a fixed sample planning date of October 19, 2026.

## Try the workflow

1. Open Meeting note. The entire note is one Markdown document.
2. Type `- [ ] Your next action` anywhere in the document. The tracked-todo count updates immediately. Optional prototype due-date syntax is `(due YYYY-MM-DD)` at the end of the task line.
3. Open Daily overview. Your action appears in the relevant date group with its source note and project.
4. Complete it from the overview. Return to the note to see `[x]` in the Markdown source.
5. Switch to Read for formatted Markdown and interactive checkboxes. Both modes use the same document.
6. Rename, move, nest, or remove a checkbox in the source; views are derived from the current document. Code examples and HTML blocks are not tracked as tasks.
7. Preview the sample agent suggestion, insert its Markdown checkbox, and undo it. Assistance is simulated and performs no network requests.

## Personal profile

Open Profile to save a first name, last name, and optional birthday. Personal settings persist in this browser when local storage is available. The overview shows `Hello, {firstName}` normally and `hbd {firstName}!` on the birthday, using the current local date rather than the sample planning date. The prototype refreshes the greeting on visibility changes and once a minute while open.

Makena's surname and birthday are deliberately blank in the sample. This profile does not create an account or assign work to other people. Clearing the birthday disables the birthday greeting; February 29 birthdays match only February 29.

If browser storage is unavailable, the page keeps the profile for the session and says it could not persist it. The profile is not sent through host widget-state snapshots or included in Markdown.

## Review with Makena

- Does a Markdown document provide the right writing experience, or should source editing become an optional mode of a richer editor?
- Are project summaries and the daily overview useful for deciding what needs attention?
- Is the source context clear when completing tasks away from their notes?

## Boundaries

Documents stay in memory for the page session and reset on refresh; personal profile settings are stored separately and persist where browser storage is available. The inline conversation preview may restore documents through optional host widget state. No actual workspace files are read or written; no agent or Copilot integration is connected.

Task references use the document and current source line. Reparse after edits before acting on a task; this prototype does not establish durable IDs across edits. Raw document HTML is escaped; images are represented by their alternate text, and links by their text, without loading external content.

Marked 17.0.5 is vendored in `vendor/marked.umd.js`; its license is preserved in `vendor/MARKED-LICENSE.md`. The production desktop framework, editor, and task identity schema remain open.

## Validation

Browser checks cover Markdown task capture, nested/quoted/ordered tasks, fenced and indented code exclusion, duplicate-title targeting, source completion from both views, raw HTML escaping, agent insertion, undo, and layout widths of 320, 736, and 1024 pixels. Profile checks cover save/reload, edits and birthday removal, birthday and normal greetings, local-day rollover, leap days, invalid dates, storage failure, and exclusion from host snapshots. Native desktop packaging and workspace-file persistence remain unimplemented.

Run the browser checks with Node.js and Playwright available:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/workflow.cjs
```

Alternatively, set `BENTO_CHROME_PATH` to an installed Chrome executable. Tests use an isolated browser profile, fictional personal details, and temporary screenshot files.
