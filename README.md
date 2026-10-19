# Bento

A Markdown workspace for notes, projects, and todos, inspired by Obsidian and Notion. Bento starts with Makena's civil-engineering meeting-to-follow-up workflow.

Each record has its own Markdown file. A workspace contains `workspace.md`; database folders contain `database.md` definitions. Folder location determines a record's zero-or-one database membership. Projects and Todos are customizable defaults built from typed fields.

## Run the desktop app

Requires Node.js 22.12+ and pnpm 11.25.0. From this repository:

```sh
pnpm install --frozen-lockfile
pnpm setup:desktop
pnpm start
```

`setup:desktop` downloads the pinned Electron runtime. No server, account, or model service is required. The first startup shows Open workspace and New workspace. Choose an empty folder for a new workspace; it receives editable starter definitions and starts with no content records. To explore existing data, open `examples/document-databases` (copy it first if you want to keep the example unchanged).

1. Choose New workspace, then an empty folder. Create your first project by entering its title.
2. Bento opens the project’s Markdown document immediately. Write notes, or choose New meeting note to create a note linked to that project.
3. In the meeting, choose Write a note… and type `[] ` or `- [ ] `, then an action title. Bento creates a todo Markdown file with the same project and links it from the meeting.
4. Use ↗ to open the todo. Add notes; edit title, Status, due date, and project. Save properties applies those values, then autosave persists them.
5. On project and meeting pages, expand Properties to edit the title, tags, and schema fields. Save properties applies the edit; autosave then writes it to Markdown. Tags use one line each and may contain spaces and commas.
6. Save files flushes changes immediately. The Workspace menu holds open/new/reload actions. Close and reopen the workspace to read documents and schemas from disk.

The sidebar shows a collapsible workspace directory tree with database folders, nested subfolders, and Markdown pages. Folder expansion is remembered per workspace on this computer; opening a page reveals its ancestor folders. Todo folders start collapsed. Each database folder has a + creation action. Projects, Meeting Notes, and Todos are customizable starter definitions. Sample content remains available separately under `examples/document-databases`.

External edits are checked before save. If files changed, Bento keeps its local draft and stops instead of overwriting them. Reload files reads external changes; Restore draft is available only against an unchanged baseline. Download draft preserves the draft for manual comparison when files diverge. Opening a workspace does not rewrite untouched files, except to recover an earlier interrupted save.

Use **Dark mode** in the header to switch between light and dark appearance. The preference is remembered on this computer, separately from workspace files; the initial appearance follows the system.

Open a project document and choose **Review project work**, or use **Review work** on its daily-overview card, to see related notes and overdue/today/upcoming/undated/completed todos together. Every note and todo opens its own Markdown document. Notes linked to several projects appear in each review; existing todo ownership stays unchanged.

## Current boundary

This is an early Electron desktop implementation. It loads actual YAML schemas and Markdown files, validates all eight field types, saves through a recoverable journal, and preserves unknown metadata. It shares the live Markdown editor/model with the browser sample.

General database/schema editing controls, custom todo property controls, in-app record transfers, link repair after external moves, conflict/recovery review UI, production rich-text editing/accessibility, search, agents, and Copilot integration remain future work. Definition changes can currently be made in Markdown and loaded through Workspace → Reload files. Creation uses schema defaults; required custom fields without defaults currently report a validation error and require editing the schema/defaults before creation.

The app is local: no model requests, HTTP backend, or remote document resources. Sample agent suggestions are simulated. Profile and appearance live in a versioned Markdown settings file in the native app’s per-user data directory. The Profile page shows the exact path and offers Reload settings after an agent edits the file. Existing browser preferences migrate automatically when the file is first created; originals are retained. Malformed settings produce a warning without blocking workspace access, and conflicting external edits stop saves. Unsaved drafts and sidebar expansion remain in local app storage. `.bento-local/` holds save journals/backups and is ignored by Git in new workspaces. Journaling is not a backup system or multi-device synchronization protocol; its remaining concurrency/power-loss limits are documented in the [data model](docs/data-model.md).

## JavaScript modules

Application code, shared renderer modules, scripts, and tests use `.js` ES modules (`"type": "module"`), with imports/exports and modern JavaScript. The small `desktop/preload.cjs` bridge deliberately remains CommonJS because Electron’s sandboxed preload cannot use ESM imports. The vendored Markdown parser retains its upstream UMD distribution.

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

`prototype/index.html` is served by `pnpm demo` at http://127.0.0.1:4173/. ES modules require a local HTTP server in browser sample mode. It uses an independent browser-local sample snapshot and exports individual Markdown files. It does not gain desktop filesystem access. Its fictional planning date is October 19, 2026; desktop planning and birthday greetings use the local date.

- [Product specification](docs/spec.md): audience, features, and success criteria.
- [Design document](docs/design.md): implementation choices and remaining work.
- [Data-model contract](docs/data-model.md): folders, schemas, metadata, links and save/recovery behavior.
- [Example workspace](examples/document-databases/README.md): inspectable schemas and fictional records.
