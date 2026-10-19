# Meeting-to-follow-up workflow study

Open `index.html` in a modern browser. This is a self-contained interaction prototype with fictional data and a fixed sample date of October 19, 2026. It has no network requests or dependencies.

## Try these journeys

1. Start on Daily overview. Review overdue, today, upcoming, and undated work, plus a summary for each active project. Park access review intentionally has no tasks.
2. Open Meeting note. Edit the discussion notes and use Add a checkbox to capture an action, optionally with a due date.
3. Return to Daily overview. Find the action under the correct date group, then use its source link to return to the note.
4. Complete a task from either screen. Verify the other screen and project summary reflect the same task. Completed tasks remain available in the overview's Completed section.
5. Preview the sample agent suggestion, add it, and undo it. The suggestion is scripted from the sample note; no agent or model is connected.
6. Select a project to narrow the overview. Return to All projects for the daily review.

## Review with Makena

- Is the daily overview the right starting point? What does each project summary need to tell her?
- Does recording an action as a checkbox feel natural while taking notes?
- Is moving between a todo and its source note clear?
- Is reviewing an agent suggestion understandable? What information would she need before applying a batch?

## Boundaries

Changes stay in memory for the current page session and reset on refresh. This prototype has no filesystem persistence, Markdown parser, rich-text editor, account integration, or actual agent connection. The note body and the Add a checkbox control are separate; typing Markdown checkbox syntax in the note body is not parsed into tasks here. The production editor must satisfy automatic checkbox tracking throughout a document.

The inline conversation preview can restore state through the host's optional widget-state API. It also offers a host appearance control where available. The standalone page follows the browser's light/dark preference.

The source is a workflow study, not a selection of the desktop application framework or final file schema.

## Validation

Checked in headless Chrome on macOS: cross-view completion, empty-project summaries, new-task capture, text escaping, reviewed suggestion application without duplicates, one-step undo, note-to-Markdown preview updates, refresh reset, and layout overflow at widths of 320, 736, and 1024 pixels. Light and dark layouts were visually inspected. Native Windows/macOS packaging and production persistence remain unimplemented.
