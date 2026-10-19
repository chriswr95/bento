# Document-backed todo workflow prototype

Open `index.html` in a modern browser. Keep this directory together: scripts, styles, and the vendored Markdown parser work offline without a build step. The fictional planning records use October 19, 2026; birthday greetings use the real local date.

## Try the flow

1. Open Meeting note and type `- [ ] Your next action` into the Markdown document. Bento creates a todo document and inserts a linked checkbox. Continue typing within the link label; Enter at its end starts another checkbox.
2. Switch to Read and click the todo title, or click its title from Daily overview. The todo opens with its own Markdown body, title, completion, optional due date, and project.
3. Write context or progress notes in Todo Markdown. Use Save properties for title/date/project changes. Completion is applied immediately, together with any other valid property edits currently in the form.
4. Return to the meeting using the source button. Completing the todo from its document, the meeting, or the overview updates the same record and linked checkbox markers.
5. Remove the meeting reference. The todo and its notes remain accessible through the overview, including its Completed section when appropriate.
6. Download Markdown exports the current document with its metadata and body. Todo references use stable ID filenames; keeping exported related files together preserves their relative links.
7. Open a project from the sidebar, then Open project document to edit its Markdown body.

Plain checkbox text can include `(due YYYY-MM-DD)` during initial capture. Thereafter, use the todo's due-date property. The production editor and final property syntax remain design decisions. Agent suggestions are scripted and make no model requests.

## Record model and persistence

`workspace.js` owns records, seeded database definitions, membership validation, checkbox capture, reference reconciliation, and serialization independently of the UI. Each record has zero or one database membership. Task fields are interpreted through capability bindings rather than display names. The UI does not implement a general database or schema editor yet.

Workspace snapshots are stored under `bento.prototype.workspace.v4`, separately from the personal profile. When storage is available, notes and todo records survive reload. Writes replace one complete browser snapshot; undo restores the previous in-memory snapshot. Invalid stored data is retained unchanged with a warning. A detected competing page update stops further overwrites of that saved copy. Browser persistence is a single-tab prototype facility, not a desktop folder, backup system, or multi-device synchronization protocol.

Where browser storage is unavailable or full, the prototype reports session-only operation. The conversation preview may restore small workspace snapshots through host widget state; larger snapshots rely on browser storage. Version 3 browser snapshots migrate while retaining the original saved copy. Disagreeing legacy checkpoints block migration instead of overwriting the saved data. Earlier inline-note host snapshots can migrate into record documents. Profile values are never included in host workspace snapshots.

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
