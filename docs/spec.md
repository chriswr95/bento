# Bento: product and technical specification

Status: initial draft for discussion

Date: 2026-10-17

## 1. Product intent

Bento is a desktop workspace for thinking, planning, and getting things done. It brings Markdown documents, projects, and todos into one coherent interface.

Obsidian inspires file ownership and portable Markdown. Notion inspires a polished document experience and useful views of structured information. VS Code inspires configurable workspaces, themes, and an eventual extension model.

The core experience should be simple: open a folder, write a note, turn an idea into a todo, organize work into a project, and find it again through search or tags.

## 2. Confirmed requirements

| Area | Requirement |
| --- | --- |
| Platforms | Runs on Windows and macOS. |
| Documents | Opens, edits, and saves Markdown files. |
| Todos | Todos are first-class entities with dedicated interactions and views. |
| Projects | Projects are first-class entities that group work and carry their own information. |
| Tags | Supports user-defined, free-form string tags. |
| Interface | A clean, Notion-inspired visual experience. |
| Customization | An extensible, editable interface inspired by VS Code, including installable themes. |
| Theme direction | Support styles inspired by Catppuccin, Darcula, and Tokyo Night. These examples describe the desired flexibility; specific theme packages are not yet committed. |

The storage architecture is open. A local backend process and a folder of Markdown documents are both acceptable starting points.

## 3. Recommended initial direction

Use a local-first desktop application with a folder-based Markdown workspace as the durable source of truth. Use a rebuildable local index for fast search, relationships, and task views.

This is a proposal, pending review. It preserves ordinary file ownership while allowing richer behavior than a plain text editor. It also avoids requiring an account, hosted service, or synchronization system to validate the core product.

A desktop application can still use a local backend component to manage files and indexing. File-based storage and a local service are compatible choices. Prefer an in-process service behind a clear interface initially; add a separate process only if isolation, runtime requirements, or measured performance justify it.

### Storage options considered

| Option | Benefits | Costs | Initial recommendation |
| --- | --- | --- | --- |
| Markdown files plus rebuildable index | Portable, inspectable, compatible with external editors and Git | Requires explicit metadata conventions, file watching, and conflict handling | Preferred |
| Local database as the source of truth, with Markdown import/export | Strong structured queries and transactional updates | Export can lose information; users depend on Bento to access the full workspace | Revisit if structured editing outgrows the file model |
| Hosted service as the source of truth | A foundation for shared workspaces and coordinated updates | Accounts, networking, operations, offline behavior, and conflict resolution | Outside the initial release |

## 4. Initial scope

The first usable release includes folder workspaces, Markdown editing, project and todo management, tags, search, a small set of useful views, and theme customization.

Defer real-time collaboration, hosted accounts, mobile apps, calendar integrations, arbitrary executable plugins, and a general-purpose Notion-style database builder. Design boundaries should allow future additions without making them prerequisites for local use.

## 5. Core user journeys

### Open and write

1. Open an existing folder or create a workspace.
2. Browse, create, rename, and move Markdown files.
3. Edit a document with familiar Markdown shortcuts and readable formatting.
4. Switch between source and rendered presentation without losing content.
5. Close and reopen Bento with files and workspace layout intact.

The initial editor should support headings, paragraphs, lists, checkboxes, links, code fences, quotes, tables, and local image references. Unsupported syntax must survive edits unchanged.

### Capture and complete a todo

1. Create a todo from a global capture action or while editing a document.
2. Optionally assign a project, due date, and tags.
3. Find it in the central Todos view and its project view.
4. Mark it complete in either location; every view reflects the same entity.
5. Reopen a completed todo without losing its description or relationships.

### Manage a project

1. Create a project with a title and Markdown description.
2. Add todos and link related notes.
3. View open and completed work, due dates, and project status.
4. Archive a project while retaining its documents and task history.

### Organize through tags

1. Add an existing tag or create a new string directly in the tag picker.
2. Apply tags to notes, projects, and todos.
3. Click a tag to see matching entities and narrow the view by type or status.

### Make the workspace feel personal

1. Select an installed light or dark theme.
2. Install a compatible theme package from disk.
3. Adjust sidebar visibility, panel arrangement, and editor typography.
4. Restore the default layout or theme if customization causes problems.

## 6. Domain model

| Entity | Initial fields | Meaning |
| --- | --- | --- |
| Workspace | Root folder, format version, preferences | A collection of user-owned files and their working context |
| Note | Stable ID, title, Markdown body, tags | A document with optional relationships to projects |
| Todo | Stable ID, title, status, description, optional project, optional due date, tags | An independently addressable unit of work |
| Project | Stable ID, title, status, Markdown body, tags | A durable planning context with associated todos and notes |
| Tag | User-defined string | A reusable label across entity types |

Proposed todo states: `open`, `in_progress`, `done`, and `cancelled`. Proposed project states: `active`, `on_hold`, `completed`, and `archived`. The UI may simplify these initially, but transitions must be explicit and reversible.

A todo initially belongs to at most one project. Notes may link to multiple projects. Relationships use stable IDs so renaming or moving a file does not break them. Titles need not be unique. IDs must be unique within a workspace; duplicated IDs are surfaced for repair rather than silently merged.

Due dates initially represent calendar dates (`YYYY-MM-DD`), with no implicit timezone conversion. Reminders and due times are deferred.

Tags are strings rather than a predefined taxonomy. Spaces, punctuation, and Unicode should be supported; storage must quote or escape them safely. Propose trimming surrounding whitespace, rejecting empty values, and preserving spelling and case. Decide case-sensitive identity before implementation. Inline `#tag` shorthand, if supported, is only one input method and must not limit the underlying tag format.

## 7. Proposed file format

Use UTF-8 Markdown with a small, versioned YAML frontmatter schema for structured entities. Keep the body ordinary Markdown and preserve unrecognized metadata.

Example project file, at a user-chosen path:

```markdown
---
bento_version: 1
id: "project-kitchen"
type: project
title: "Kitchen refresh"
status: active
tags: ["home", "weekend plans"]
---

# Kitchen refresh

Collect ideas, choose materials, and plan the work.
```

Example todo file:

```markdown
---
bento_version: 1
id: "todo-measure-shelves"
type: todo
title: "Measure the shelves"
status: open
project: "project-kitchen"
due: "2026-10-24"
tags: ["home"]
---

Measure width and depth before ordering materials.
```

The example IDs are illustrative; the implementation should generate opaque stable IDs. Folder structure is organizational and does not define entity identity or project membership.

Ordinary `.md` files without Bento metadata remain editable as notes. Assigning metadata should be an explicit action when structured features require it; opening a folder must not rewrite every file.

### Todo representation decision

Propose one Markdown file per first-class todo for the first prototype: stable identity, rich descriptions, and ordinary file operations are easy to explain. A document's plain `- [ ]` checkbox initially remains a local checklist item, with an explicit action to promote it into a linked todo.

The tradeoff is file count and a distinction between checklists and managed todos. Before finalizing the format, test this against an alternative where managed todos live inline with stable identifiers. Whichever representation is chosen, a single todo must have one authoritative record, and completing it must be consistent across all views.

## 8. Interface and customization

Proposed application shell:

- Sidebar: workspace files, Projects, Todos, Tags, and saved navigation.
- Main area: document editor, project detail, task list, or search results.
- Optional details panel: selected entity metadata and relationships.
- Command palette: quick navigation and discoverable actions.

Start with a document view, a filterable Todos list, and a Projects list with project detail pages. Add a task board after the underlying task lifecycle and filtering are reliable. Saved filters and custom views can follow initial validation.

Use shared design tokens for color, typography, spacing, borders, focus states, and editor syntax. Themes consume a documented, versioned token schema and declare their light/dark appearance. Theme packages initially contain declarative data and permitted assets; importing a theme must not execute code.

Expose layout and typography through settings. Build internal extension points for commands, views, editor contributions, and themes, but defer a public executable extension API until those boundaries stabilize. Arbitrary CSS overrides and third-party code execution require separate design decisions.

Keyboard navigation, visible focus, adequate contrast, scalable text, and accessible names are baseline requirements. Essential state must remain understandable without relying only on color.

## 9. Technical architecture

Separate the following responsibilities behind small interfaces:

1. **Desktop shell:** windows, menus, dialogs, and platform integration.
2. **UI and editor:** document interaction, task/project views, and themes.
3. **Application services:** commands and domain rules shared by all views.
4. **Workspace repository:** safe file reads/writes, schema handling, and change events.
5. **Indexer:** rebuildable search and relationship projections from workspace files.

The UI must not directly mutate metadata or implement its own task lifecycle. Changes flow through application services and the workspace repository; all views consume the resulting state.

Select the desktop framework and editor through a small prototype. Evaluate Windows/macOS packaging, Markdown round-trip fidelity, accessibility, native filesystem integration, startup and memory behavior, theme integration, and maintenance burden. The framework choice remains open; do not introduce a separate web backend by default.

### Data safety and external changes

- Save through temporary files and replacement operations appropriate to each platform; recover unfinished writes where possible.
- Detect external changes, including edits made while a document has unsaved local changes. Preserve both versions and show a resolvable conflict instead of silently overwriting either.
- Keep a recoverable local draft while editing; clearly show pending, saved, and failed save states.
- Make renames, deletes, and multi-file changes recoverable. Prefer the operating system trash for user-requested deletion.
- Preserve unknown frontmatter keys and unsupported Markdown syntax; avoid whole-document formatting changes for small metadata edits.
- Treat files as authoritative. The index can be deleted and rebuilt without losing content, relationships, or task state.
- Keep machine-specific caches, drafts, and window state outside portable content. Shared workspace preferences may live in a versioned `.bento/` folder.
- Treat file content as untrusted: constrain local resource access to authorized paths and prevent document previews from executing scripts.
- Handle Windows path restrictions and case collisions explicitly. Use relative paths for portable links where practical and disclose broken links after file moves.

### Scale and responsiveness

Index incrementally, debounce file watcher bursts, and keep parsing/indexing work off latency-sensitive UI paths. Load document bodies on demand and virtualize long lists where needed. Explicitly report unreadable or malformed files without blocking the rest of the workspace.

Measure prototypes with a representative workspace of 10,000 Markdown files and 20,000 todos. These are validation targets, not current performance claims. Record hardware and dataset characteristics before setting numeric latency and memory budgets.

## 10. Release acceptance criteria

- Install and launch the application on supported Windows and macOS versions, selected and documented before release.
- Open an existing Markdown folder without unsolicited file rewrites.
- Create, edit, save, close, and reopen supported Markdown content without losing unsupported syntax or unknown metadata.
- Create projects and todos, change their status, and see consistent results across document links and dedicated views.
- Filter notes, projects, and todos by free-form tags and search their content.
- Preserve stable relationships when an entity file moves or is renamed.
- Recover from an interrupted save and surface conflicting external edits without losing either version.
- Rebuild the local index and recover equivalent project, todo, tag, and search views.
- Switch themes and import a valid theme package; invalid packages fail with useful errors and leave the current theme usable.
- Complete the core journeys using keyboard navigation.
- Run the full local workflow without an account or network connection under the proposed architecture.

## 11. Delivery plan

1. **Resolve the core model:** review file ownership, todo representation, tag identity, and editing modes; document decisions with short rationale.
2. **Validate the platform:** build a Windows/macOS spike for opening a folder, editing one Markdown file, saving safely, and switching theme tokens.
3. **Build the workspace slice:** navigation, Markdown fidelity, drafts, external change handling, and rebuildable indexing.
4. **Build planning workflows:** project and todo lifecycle, relationships, tags, search, and central views.
5. **Harden and customize:** theme package validation, layout persistence, accessibility, large-workspace measurements, packaging, and recovery checks.

Use focused commits and vertical slices with meaningful checks at domain, file persistence, and cross-platform interaction boundaries.

## 12. Open decisions

- Is a Markdown folder plus rebuildable index the preferred storage foundation?
- Should managed todos be standalone files, inline entries, or an explicitly supported combination?
- Should the initial editor prioritize live preview, rich text with Markdown round-tripping, or source editing with preview?
- Are tag strings case-sensitive? Should renaming a tag update every matching file?
- How much layout editing is needed initially: configurable panels, custom views, CSS overrides, or executable extensions?
- Which desktop framework and editor best satisfy the prototype criteria?
- Which Windows/macOS versions and CPU architectures should the first release support?
- How should users back up or synchronize workspaces across computers? Initial local operation does not promise safe concurrent folder synchronization.
- Which license should the public repository use?

These questions are intentionally open. The draft recommends a starting architecture without treating it as an approved implementation decision.
