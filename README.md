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

`setup:desktop` downloads the pinned Electron runtime. No server, account, or model service is required. The first startup shows Open workspace and New workspace. Choose an empty folder for a new workspace; it receives editable starter definitions and fictional notes. To explore existing data, open `examples/document-databases` (copy it first if you want to keep the example unchanged).

1. Open Meeting note and choose Write a note….
2. Type `[] ` or `- [ ] `, then the action's title. Bento creates a todo Markdown file and a relative link from the meeting after autosave.
3. Use ↗ to open the todo. Add notes; edit title, Status, due date, and project. Save properties applies those values, then autosave persists them.
4. Use Save files to flush changes immediately. The header distinguishes unsaved drafts, saving, saved files, and a stopped save.
5. Close and reopen the workspace. Its documents and schema are read from disk.

A new workspace has Todos, Projects, and Meeting Notes folders. Status supports Todo, In progress, and Done; checking completion and editing status use the same record. The sidebar lists loaded documents and active projects.

External edits are checked before save. If files changed, Bento keeps its local draft and stops instead of overwriting them. Reload files reads external changes; Restore draft is available only against an unchanged baseline. Download draft preserves the draft for manual comparison when files diverge. Opening a workspace does not rewrite untouched files, except to recover an earlier interrupted save.

## Current boundary

This is an early Electron desktop implementation. It loads actual YAML schemas and Markdown files, validates all eight field types, saves through a recoverable journal, and preserves unknown metadata. It shares the live Markdown editor/model with the browser sample.

General database/schema editing controls, generic property forms/document creation, in-app record transfers, link repair after external moves, conflict/recovery review UI, production rich-text editing/accessibility, search, agents, and Copilot integration remain future work. Definition changes can currently be made in Markdown and loaded through Reload files.

The app is local: no model requests, HTTP backend, or remote document resources. Sample agent suggestions are simulated. Profiles and unsaved drafts use local app storage, separately from workspace Markdown. `.bento-local/` holds save journals/backups and is ignored by Git in new workspaces. Journaling is not a backup system or multi-device synchronization protocol; its remaining concurrency/power-loss limits are documented in the [data model](docs/data-model.md).

## Check and package

```sh
pnpm test
pnpm test:desktop
pnpm exec playwright install chromium
pnpm test:browser
pnpm package
```

Desktop tests create isolated temporary workspaces and stub only the native directory chooser. They exercise the actual Electron application, on-disk files, restart persistence, and conflict/draft behavior. Unit tests cover schemas, metadata, membership, reconciliation, and interrupted recovery. CI is configured for Windows/macOS desktop checks and packaging, plus Linux browser checks. A CI configuration is not evidence of a successful remote run.

`package` builds an unsigned application bundle for the current OS/architecture under `dist/`. Signing, notarization, installers and automatic updates are not configured. The macOS ARM64 build can be tested locally; Windows execution and packaging require a Windows runner.

## Browser sample and documentation

`prototype/index.html` still opens directly in a modern browser without a build step. It uses an independent browser-local sample snapshot and exports individual Markdown files. It does not gain desktop filesystem access. Its fictional planning date is October 19, 2026; desktop planning and birthday greetings use the local date.

- [Product specification](docs/spec.md): audience, features, and success criteria.
- [Design document](docs/design.md): implementation choices and remaining work.
- [Data-model contract](docs/data-model.md): folders, schemas, metadata, links and save/recovery behavior.
- [Example workspace](examples/document-databases/README.md): inspectable schemas and fictional records.
