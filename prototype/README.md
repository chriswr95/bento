# Shared formatted editor and browser sample

Run `pnpm demo` from the repository root and open http://127.0.0.1:4173/. For the native folder-backed app, see the [root README](../README.md). Both surfaces use the same ProseMirror rich editor and domain model.

## Editing

Click directly into headings, paragraphs, lists, tables or code and type. The document stays formatted; no source textarea appears. Use Ctrl/Cmd+B and Ctrl/Cmd+I. Markdown input shortcuts apply headings, lists, inline bold/italic/code/strike and todos. Enter continues a list; an empty list item exits it. Document undo/redo uses Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z. Selections can span paragraphs. Paste Markdown or sanitized rich HTML into the document.

Type `[] ` or `- [ ] ` and an action title to create a separately editable todo document. The linked ID remains stable while its label is edited. ↗ opens supporting notes. Rich title labels keep their formatting while record metadata stores plain text. Completion in a source note, overview or todo properties updates the same record. Removing a source reference retains the todo document and notes. Code samples do not create todos. Internal links can be opened with Ctrl/Cmd+click; external navigation is blocked by the desktop shell.

## Markdown bridge

`rich-editor.js` owns the view, commands, history, input rules and task node views. `rich-markdown.js` maps Markdown tokens into the editor schema and back. Original source is kept for untouched top-level blocks; opening/focusing alone never writes. Editing a block can normalize its Markdown syntax. Supported content includes headings, paragraphs, inline marks, links, images as placeholders, lists/tasks, quotes, fenced code, horizontal rules and GFM tables. Raw HTML and unsupported blocks are preserved as non-executable atoms, rather than dropped. Arbitrary Markdown extensions are not guaranteed to have visual editing controls.

`workspace.js` owns checkbox capture, stable identities, reference checkpoints, reconciliation and metadata validation. Editor transactions publish Markdown through that model; canonical todo IDs are patched back without rebuilding the whole editor or replacing its selection. Duplicate/copy-pasted references still use one todo ID. Conflicting projections remain visible as model issues.

## Browser persistence

The browser sample uses an independent local snapshot under `bento.prototype.workspace.v4`; the native app uses actual Markdown files. Browser profiles remain in browser storage; desktop profile/appearance live in the local settings file. Profile data is excluded from host widget-state snapshots. Invalid existing browser data is retained; competing-page changes stop overwrites. Version 3 snapshots migrate while keeping their original backup and record identities. Agent suggestions remain simulated.

## Build and checks

Run these commands at the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
pnpm setup:desktop
pnpm test:desktop
```

The browser module is generated locally by `scripts/build-editor.js`; dependencies are pinned and bundled, with no CDN requests. Browser/desktop scripts build it automatically. Set `BENTO_CHROME_PATH` to use an installed Chrome and `BENTO_SCREENSHOT_DIR` to choose a screenshot directory. Tests cover formatted typing, cross-block selection and undo/redo, Markdown shortcuts/paste, todo identity/completion/notes, export/reload, safe HTML handling, profile behavior and responsive widths. Native tests also cover actual files, restart/resume, conflicts and recovery. Broader screen-reader, real IME and large-workspace evaluation remains outstanding.
