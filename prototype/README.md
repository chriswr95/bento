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

## Review with Makena

- Does a Markdown document provide the right writing experience, or should source editing become an optional mode of a richer editor?
- Are project summaries and the daily overview useful for deciding what needs attention?
- Is the source context clear when completing tasks away from their notes?

## Boundaries

Documents stay in memory for the page session and reset on refresh. The inline conversation preview may restore documents through optional host widget state. No actual workspace files are read or written; no agent or Copilot integration is connected.

Task references use the document and current source line. Reparse after edits before acting on a task; this prototype does not establish durable IDs across edits. Raw document HTML is escaped; images are represented by their alternate text, and links by their text, without loading external content.

Marked 17.0.5 is vendored in `vendor/marked.umd.js`; its license is preserved in `vendor/MARKED-LICENSE.md`. The production desktop framework, editor, and task identity schema remain open.

## Validation

Browser checks cover Markdown task capture, nested/quoted/ordered tasks, fenced and indented code exclusion, duplicate-title targeting, source completion from both views, raw HTML escaping, agent insertion, undo, and layout widths of 320, 736, and 1024 pixels. Native desktop packaging and workspace-file persistence remain unimplemented.
