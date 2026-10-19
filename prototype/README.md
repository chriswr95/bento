# Document-backed todo workflow prototype

Open `index.html` in a modern browser. Keep this directory together: scripts, styles, and the vendored Markdown parser work offline without a build step. The fictional planning records use October 19, 2026; birthday greetings use the real local date.

## Try the flow

1. Open Meeting note. Notes are formatted in one editable page; there is no Read/Write switch.
2. Click a paragraph or heading to edit that block's Markdown. Click elsewhere or press Escape to render it again. Tab to a block and press Enter also opens its source.
3. Choose Write a note… and type `[] ` or `- [ ] `. The marker immediately becomes a checkbox with an editable title. Start typing; the first nonempty title creates its todo document. Enter continues the checklist; Enter on an empty checkbox returns to a new text block.
4. Edit a todo label directly, or use its ↗ button to open its own document. Write context in its body and use Save properties for title/date/project changes. Completion is applied immediately, together with valid property edits currently in the form.
5. Return through the source button. Completing a todo from its document, the meeting, or the overview updates the same record and linked checkbox markers.
6. To remove a reference, focus its containing Markdown block and press Enter to edit its source. Removing the line leaves the todo and its notes accessible through the overview.
7. Download Markdown exports the current document with metadata and body. Todo references use stable ID filenames; keeping exported related files together preserves their relative links. Project documents use the same editor.

Pasted plain checkbox text can include `(due YYYY-MM-DD)` during initial capture. Use the todo's date property for ordinary live editing. Agent suggestions are scripted and make no model requests.

`live-editor.js` implements a limited block-based live preview over the Markdown source. Ordinary blocks expose source while active; task labels and checkboxes are inline controls. It preserves Markdown instead of converting arbitrary HTML back into source. The source control, native selection, and IME composition stay intact while editing an ordinary block. Todo titles are single-line controls; full rich-text selection across blocks, native editor undo, multiline title wrapping, and production editor accessibility require further work. The toolbar provides workspace undo. Select a production editor through a separate evaluation.

## Record model and persistence

`workspace.js` owns records, seeded database definitions, membership validation, checkbox capture, reference reconciliation, and serialization independently of the UI. Each record has zero or one database membership. Task fields are interpreted through capability bindings rather than display names. The UI does not implement a general database or schema editor yet.

Workspace snapshots are stored under `bento.prototype.workspace.v4`, separately from the personal profile. When storage is available, notes and todo records survive reload. Writes replace one complete browser snapshot; undo restores the previous in-memory snapshot. Invalid stored data is retained unchanged with a warning. A detected competing page update stops further overwrites of that saved copy. Browser persistence is a single-tab prototype facility, not a desktop folder, backup system, or multi-device synchronization protocol.

Where browser storage is unavailable or full, the prototype reports session-only operation. The conversation preview may restore small workspace snapshots through host widget state; larger snapshots rely on browser storage. Version 3 document snapshots migrate to version 4 while preserving todo IDs, notes, and agreed checkpoints. The original version 3 storage key is retained. Conflicting legacy checkpoints block migration without overwriting the original copy. Earlier inline-note host snapshots can migrate into record documents. Profile values are never included in host workspace snapshots.

## References and conflicts

The linked todo filename contains the only identity: `- [ ] [Review](todo-<id>.md)`. There is no per-occurrence ID or source comment. A source document stores one last-projected title/completion checkpoint per linked todo ID in its `references` metadata. The todo owns title/completion; source labels/markers are editable projections. Last-projected baselines distinguish source intent from stale projections. Repeated links in one source share a checkpoint: one changed occurrence updates the task and its siblings; disagreeing changes preserve the group and display an issue. Conflicting titles and missing baselines preserve both representations and display an issue. A newly pasted link establishes a checkpoint only when it agrees with its target; otherwise it needs repair. Unresolved task references do not open unrelated records.

Copying an existing linked checkbox creates another reference to the same todo. Duplicating plain checkbox text creates separate todos. Removing a reference removes only that occurrence. Literal task examples inside code or HTML blocks do not create records. Renaming a body heading does not override the document's metadata title.

## Personal profile

Open Profile to save first name, last name, and optional birthday. Settings persist in this browser when storage is available, separately from workspace content. The daily greeting is `Hello, {firstName}` normally and `hbd {firstName}!` on the local birthday. February 29 birthdays match February 29; clearing the birthday disables the birthday greeting. Unknown sample surname and birthday stay blank.

## Boundaries

The [data-model design](../docs/data-model.md) goes beyond this slice. The prototype stores structured envelopes plus Markdown bodies and can export `.md` files. It does not parse/import frontmatter, open/save a desktop workspace folder, load example schema files, expose database/schema CRUD, or implement migration history, production recovery journals, a conflict-resolution dialog, or actual agent/Copilot integration. Its declarative defaults are seeded in JavaScript; arbitrary schema editing is not supported.

Raw document HTML is escaped, external images use their alternate text without loading, and external links display text without navigation. Marked 17.0.5 is vendored in `vendor/marked.umd.js`; attribution is in `vendor/MARKED-LICENSE.md`.

## Checks

The record-model tests require only Node.js and the vendored parser:

```sh
node --test tests/workspace.cjs
```

Browser checks additionally require Playwright:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/workflow.cjs
```

Set `BENTO_CHROME_PATH` to use an existing Chrome executable. `BENTO_SCREENSHOT_DIR` optionally controls the screenshot destination; otherwise screenshots use a temporary directory. Tests use isolated browser contexts and fictional personal details.

Checks cover separate todo documents, notes retention, stable identity after line moves, repeated references, cross-view completion, Markdown export, source unlinking, browser reload, validation/conflicts, keyboard capture, profile behavior, raw HTML handling, and widths of 320, 736, and 1024 pixels. Native desktop packaging and production persistence remain unimplemented.
