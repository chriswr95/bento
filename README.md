# Bento

A Markdown workspace for notes, projects, and todos, inspired by Obsidian and Notion. Bento starts with Makena's civil-engineering meeting-to-follow-up workflow.

Each record has its own Markdown file. A workspace contains `workspace.md`, database folders with a `database.md` schema and record files, and regular folders for notes. The enclosing database folder determines a page’s zero-or-one membership. Projects and Todos are customizable defaults built from typed fields.

## Set up Bento with an agent

For this first trial, have a coding agent build and install Bento locally. The unsigned preview downloads can be blocked by the OS; signed downloads are deferred. Give your agent this prompt:

> Set up Bento on this computer following <https://github.com/chriswr95/bento/blob/main/docs/agent-setup.md>. Build the tested v0.1.0-preview.1 source tag, run the hidden checks, install a local app with an easy way to launch it, then open it for me. Preserve existing installations, settings, and workspace files.

See the [first-trial setup guide](docs/install.md) and [agent runbook](docs/agent-setup.md) for Windows and Mac. This public repository can be cloned without a GitHub account; using a signed-in GitHub or coding-agent account is fine.

Open Bento, choose **Try an example workspace**, and select a new empty folder. A short Project → Meeting → Daily review tour introduces two fictional projects. Use Back, skip, or replay at any time; finish with Create my workspace when you're ready for your own work.

## Run from source

Requires Node.js 22.13+ and pnpm 11.25.0. From this repository:

```sh
pnpm install --frozen-lockfile
pnpm setup:desktop
pnpm start
```

`setup:desktop` downloads the pinned Electron runtime. No server, account, or model service is required. First startup offers Try an example workspace, New workspace, and Open workspace. The example creates two fictional civil-engineering projects, meeting notes, and linked todos in an empty folder you choose. A skippable three-step walkthrough introduces project notes, meeting actions, and daily review. Dates are relative to the creation day; all content is editable Markdown. Replay walkthrough is available from the workspace menu for that example. Later launches reopen the last workspace and page automatically. If its folder is unavailable, Bento returns to the welcome screen with a message; if only the page is missing, it opens the workspace overview. Choose an empty folder for a new workspace; it receives editable starter definitions and starts with no content records. The welcome-screen example is the easiest first demo. A separate static fixture remains under `examples/document-databases`.

For a guided first visit, choose **Try an example workspace** and an empty folder. If Bento already opens a workspace, find the same action in the workspace-name menu. To start with your own work:

1. Choose New workspace, then an empty folder. Create your first project by entering its title.
2. Bento opens the project’s Markdown document immediately. Write notes, or choose New meeting note to create a note linked to that project.
3. In the meeting, click into the document, press Enter for a new paragraph, and type `[]` or `- [ ]` followed by a space, then an action title. Bento creates a todo Markdown file with the same project and links it from the meeting.
4. Click the todo label to open its document. Add notes; edit title, Status, due date, and project. Click a property value to edit it; Enter or leaving the field applies it, and Escape cancels. File autosave persists the change.
5. Projects, meetings, and todos share collapsible properties. Required and Important fields appear above the fold; Details live under More/Less. Arrange properties in the Properties menu applies to every record in that database. Tags appear as chips: Enter adds a tag, Backspace on an empty tag input removes the last tag, and spaces and commas remain part of a tag. Relation pickers support search.
6. Save files flushes changes immediately. The Workspace menu holds open/new/reload actions. Close and reopen the workspace to read documents and schemas from disk.

The sidebar shows one collapsible workspace folder containing its home page, named database folders, ordinary folders, and Markdown pages. Database folders have a table icon and open a table of records and fields. Folder expansion is remembered per workspace on this computer; opening a page reveals its ancestor folders. Click a folder name to browse its contents; use the chevron to expand/collapse it. New folder creates nested empty folders. Each folder has a + page action. Database entries stay inside their database folder; ordinary notes stay in regular folders. Ordinary pages default to notes. Document breadcrumbs traverse ancestors, and Move page in document actions preserves properties and repairs Markdown links within a database or among regular folders. Collapsing the workspace hides the entire tree; there is no Collapse all button. Right-click a folder for New file / New folder, or a file for Open / Move / Delete. Arrow keys navigate the tree; Shift+F10 opens the focused row’s menu. Delete or Backspace removes only a focused sidebar file and offers Undo; Cmd/Ctrl+Z restores it while the sidebar has focus. Restore last deleted file is also available in the workspace menu and command palette after restart. Files go to Bento’s local trash; existing links and relations are retained for restoration. The starter and example workspaces use this format directly; there is no upgrade step. Pre-v1 workspace format changes may break older development fixtures. Projects, Meeting Notes, and Todos are customizable starter definitions. Sample content remains available separately under `examples/document-databases`.

External edits are checked before save. If files changed, Bento keeps its local draft and stops instead of overwriting them. Reload files reads external changes; Restore draft is available only against an unchanged baseline. Download draft preserves the draft for manual comparison when files diverge. Opening a workspace does not rewrite untouched files, except to recover an earlier interrupted save.

Use **Dark mode** in the header to switch between light and dark appearance. The preference is remembered on this computer, separately from workspace files; the initial appearance follows the system.

Open a project document and choose **Review project work**, or use **Review work** on its daily-overview card, to see related notes and overdue/today/upcoming/undated/completed todos together. Every note and todo opens its own Markdown document. Notes linked to several projects appear in each review; existing todo ownership stays unchanged.

Daily overview starts with all personal work. Select an Overdue, Today, Upcoming, or Without a date count to focus that group; All work restores the full list. Counts and project summaries update when you complete or reschedule a todo. Project labels open project review, while meeting links open the source note. Each active-project card shows its recorded status, workload, next deadline, and recent notes. Focus filters last until you leave the overview and do not change workspace files.

Resume information lives in the app’s local `session.json`, separately from personal settings and workspace Markdown. It stores the last workspace path and page/view IDs.

The document is a formatted, directly editable page powered by ProseMirror. Click a heading, paragraph, or list and type; there is no reading/source switch or block textbox. Workspace commands, manual save, and draft recovery live in the workspace-name menu. Changes autosave; Ctrl/Cmd+S saves immediately. A draft notice appears when recovery needs attention. Project actions live in the ⋯ menu beside the document breadcrumb. Desktop documents are already Markdown files, so no download button is needed. Use Ctrl/Cmd+B and Ctrl/Cmd+I for formatting. Markdown shortcuts such as `#` followed by a space, `**bold**`, lists, and `[]` followed by a space apply formatting as you type. Select and replace text across paragraphs; Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z undo/redo document edits. Plain Markdown pastes become formatted content.

Markdown remains the storage format. Opening a document does not rewrite it. The bridge retains original source for untouched blocks; edited blocks can normalize Markdown syntax. Raw HTML and unsupported block types remain preserved, non-executable atoms; images stay placeholders. Tables, fenced code, nested lists, and rich todo labels are supported. Todo metadata stores a plain title while source labels retain inline formatting.

## Keyboard shortcuts

Use **Cmd/Ctrl+P** to find files and **Cmd/Ctrl+Shift+P** to find commands. Both open the same picker: a leading `>` selects commands; removing it selects files. Arrows select, Enter opens/runs, and Escape returns to editing. Use **Cmd+[ / Cmd+]** on macOS (**Ctrl+[ / Ctrl+]** or **Alt+Left / Alt+Right** on Windows/Linux) to go back and forward without undoing edits. **Cmd/Ctrl+,** opens Settings. **Cmd/Ctrl+K, then Cmd/Ctrl+S** opens its searchable Keyboard shortcuts section. See the [shortcut reference](docs/keyboard-shortcuts.md).

## Keyboard-first entry

Type `@` while writing a captured checkbox todo or a new entry’s title. For example, `@da` followed by a space finds **Due date**. Use arrows and Enter/Tab, or click a property, then fill its typed value. Dates offer Today/Tomorrow; project relations support search. Confirming a value returns to writing and keeps a visible `@Due date(2026-10-21)` token; click it to revise. In Markdown, Enter or leaving the paragraph finishes this inline view. New-entry tokens stay in the title area until creation or cancellation. Saved titles and Markdown stay free of these display tokens. Escape preserves unconfirmed literal text without applying a value. Tags use one tag per line and Cmd/Ctrl+Enter to apply.

Type `/Projects` (or another database’s name) in an empty Markdown paragraph to start an entry. Alternatively, open command search and choose **New page in Todos** or any other database. Both open the same title composer with `@` properties; no file is created until you submit. Required custom fields can be filled before creation.

## Colors

Open a page’s **Color** property to pick one of eight theme-aware accents. Project markers, cards and relation chips follow that choice. In Tags, click a tag’s small dot to set its workspace-wide color. **Automatic** restores a stable default. Assignments survive theme changes and save in Markdown.

## Themes

Open **Settings → Appearance** to choose Bento, GitHub, One Dark, Darcula, Tokyo Night, or Catppuccin. Each includes light and dark palettes; the sun/moon toggle changes mode within the selected theme. **Install theme…** imports a Bento theme JSON file; **Export template** gives you a file to customize and share. Try [Sakura](examples/themes/sakura.bento-theme.json). See the [theme format and installation guide](docs/themes.md).

## Current boundary

This is an early Electron desktop implementation. It loads actual YAML schemas and Markdown files, validates all eight field types, saves through a recoverable journal, and preserves unknown metadata. It shares the live Markdown editor/model with the browser sample.

General database/schema editing controls, in-app record transfers, link repair after external moves, conflict/recovery review UI, full accessibility/IME evaluation, search, agents, and Copilot integration remain future work. Definition changes can currently be made in Markdown and loaded through Workspace → Reload files. Creation combines schema defaults with properties collected through `@` before submission. Checkbox capture still requires valid defaults for required fields; use the entry composer to provide custom required values without defaults.

The app is local: no model requests, HTTP backend, or remote document resources. Sample agent suggestions are simulated. Profile and appearance live in a versioned Markdown settings file in the native app’s per-user data directory. The Settings page shows the exact path and offers Reload settings after an agent edits the file. Existing browser preferences migrate automatically when the file is first created; originals are retained. Malformed settings produce a warning without blocking workspace access, and conflicting external edits stop saves. Unsaved drafts and sidebar expansion remain in local app storage. `.bento-local/` holds save journals/backups and is ignored by Git in new workspaces. Journaling is not a backup system or multi-device synchronization protocol; its remaining concurrency/power-loss limits are documented in the [data model](docs/data-model.md).

## JavaScript modules

Application code, shared renderer modules, scripts, and tests use `.js` ES modules (`"type": "module"`), with imports/exports and modern JavaScript. The small `desktop/preload.cjs` bridge deliberately remains CommonJS because Electron’s sandboxed preload cannot use ESM imports. The vendored Markdown parser retains its upstream UMD distribution. `pnpm build` bundles the pinned ProseMirror packages into a local browser module; start, demo, browser/desktop tests, and packaging build it automatically. esbuild’s local binary setup is explicitly allowed in `pnpm-workspace.yaml`; editor packages are bundled rather than loaded from a CDN.

## Check and package

```sh
pnpm test
pnpm test:desktop
pnpm exec playwright install chromium
pnpm test:browser
pnpm package
```

Desktop tests create isolated temporary workspaces and stub only the native directory chooser. They exercise the actual Electron application, on-disk files, restart persistence, and conflict/draft behavior. Unit tests cover schemas, document creation, profiles, draft/save coordination, metadata, membership, reconciliation, and interrupted recovery. See the [test plan](docs/testing.md) for commands, coverage, and manual release checks. CI is configured for Windows/macOS desktop checks and packaging, plus Linux browser checks. A CI configuration is not evidence of a successful remote run.

`package` builds an unsigned application bundle for the current OS/architecture under `dist/`. Signing, notarization, installers and automatic updates are not configured. The macOS ARM64 build can be tested locally; Windows execution and packaging require a Windows runner.

## Browser sample and documentation

`prototype/index.html` is served by `pnpm demo` at <http://127.0.0.1:4173/>. ES modules require a local HTTP server in browser sample mode. It uses an independent browser-local sample snapshot and exports individual Markdown files. It does not gain desktop filesystem access. Its fictional planning date is October 19, 2026; desktop planning and birthday greetings use the local date.

- [Product specification](docs/spec.md): audience, features, and success criteria.
- [Design document](docs/design.md): implementation choices and remaining work.
- [Data-model contract](docs/data-model.md): folders, schemas, metadata, links and save/recovery behavior.
- [Example workspace](examples/document-databases/README.md): inspectable schemas and fictional records.

The [app assets](assets/README.md) include the transparent icon master, macOS/Windows icons, favicon, and header mark. Export regeneration is optional; normal packaging uses the checked-in files.

See [Contributing](CONTRIBUTING.md) for linting, focused commits, CI checks, and dependency maintenance.

The daily greeting varies by local time and changes hourly, with a stable phrase during each hour. Birthday greetings still take precedence.
