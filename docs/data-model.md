# Bento: workspaces, folders, and typed documents

Status: agreed product model; the first desktop implementation covers loading, editing, saving, and interrupted-save recovery.

The [specification](spec.md) describes who Bento serves and what it must do. This document defines the current file contract and its limits.

## Principles

1. Every content record is an editable Markdown document.
2. A workspace is a folder containing `workspace.md`.
3. A database is a registered schema; its definition lives in `databases/<database-id>.md`.
4. A record belongs to zero or one database, explicitly named by its `database` metadata. Folders never confer membership.
5. Relations and views do not confer database membership.
6. Database, document, field, and option identities remain stable when labels change.
7. Unknown values and metadata are retained. Incompatible changes must be surfaced rather than discarded.

Folders answer where a page belongs; databases answer what structured fields it has. A project folder can contain an ordinary note, a Meeting Note, a Todo, and a Project record together. A relation connects pages; it does not move them or change their database.

## Three layers

| Layer | Responsibility |
| --- | --- |
| Application | Supported field types, validation, Markdown editing, capability interpretation, storage and recovery |
| Database definitions | Field names, types, options, defaults, relations and capability mappings |
| Record documents | Identity, schema version, property values, tags and Markdown content |

Workspace and database definition documents have Markdown bodies for descriptions and instructions. The Workspace page projects `workspace.md` into the document model with no database membership; its body is editable in-app and its checkboxes capture todos. Its structural frontmatter remains protected from page edits. Database definitions remain control files edited outside the app; their checkboxes do not capture todos. In-app database/schema controls remain future work.

## Workspace layout

```text
My workspace/
  workspace.md
  databases/                 # Managed schemas, omitted from the file explorer
    db-todos.md
    db-projects.md
    db-meetings.md
  notes/                     # Default for ordinary pages
    note-<id>.md
  projects/                  # Creation default, not a membership boundary
    project-<id>.md
    Creekside/
      meeting-<id>.md
      todo-<id>.md
      assumptions.md
  meetings/
  todos/
```

The workspace manifest registers stable database IDs, schema locations, and optional creation defaults:

```yaml
bento_version: 1
kind: workspace-definition
id: workspace-example
title: My workspace
organization_version: 2
default_page_folder: notes
databases:
  - {id: db-todos, definition: databases/db-todos.md, default_folder: todos}
  - {id: db-projects, definition: databases/db-projects.md, default_folder: projects}
  - {id: db-meetings, definition: databases/db-meetings.md, default_folder: meetings}
default_task_database: db-todos
default_project_database: db-projects
```

Defaults select existing databases; they do not make Todos or Projects mandatory. A missing task destination leaves checkboxes pending instead of recreating a database. Creation controls and summaries use capability mappings. The New page form selects Database and Folder independently. Creating from a folder uses that folder; database commands use the registered creation default outside folder context. Checkbox-created todos use their task database's default folder.

Only `workspace.md` needs to remain at the root. Ordinary root-level files remain valid, but new ordinary pages default to `notes/`. Empty and nested folders are first-class filesystem locations. The `databases/` directory is reserved for schema definitions. Hidden operational folders and symlinks are not traversed. Folder names and paths must be portable across Windows and macOS; creation rejects reserved names, traversal, and case/Unicode collisions.

### Existing workspace upgrade

Legacy workspaces omit `organization_version` and register `{id, path}` entries with `<path>/database.md`. They continue deriving membership from registered folders until the user reviews and runs Upgrade workspace. Opening alone does not migrate content. The static example and template files retain this legacy layout for compatibility coverage; newly created workspaces are upgraded before use.

Upgrade preserves content locations and stable identities, writes each existing membership explicitly (ordinary pages receive `database: null`), relocates schemas, and adds `notes/`. Markdown destinations are rebased when schema descriptions or links to schemas require it. Unknown metadata, inert legacy `parent`, and existing property values remain intact. Original file contents are retained in the journal history. Upgrade refuses unavailable/unrecognized pages and schema/name conflicts before writing. Interrupted upgrades use normal recovery; they are not a single filesystem-wide atomic operation.

## Typed fields

Each field has a stable `id`, user-facing `name`, `type`, optional `required` flag, and optional `default`. Type-specific configuration belongs in the database definition, not every record.

| UI type | Encoding | Configuration and values |
| --- | --- | --- |
| Text / String | `text` | A string |
| Number | `number` | Finite integer/decimal; optional `min`, `max`, `integer` |
| Boolean | `boolean` | `true` or `false` |
| Date | `date` | Real calendar date, `YYYY-MM-DD`, without timezone conversion |
| Select | `select` | One stable option ID from `options` |
| Multi-select | `multi-select` | A list of distinct option IDs |
| Status | `status` | One option ID, with each option assigned a semantic group |
| Relation | `relation` | Document IDs constrained by `target_database` and `cardinality: one` or `many` |

Missing or null optional fields are unset. Defaults initialize new records; loading an existing document does not insert defaults or rewrite it. Unknown properties are preserved. Missing relation targets remain addressable IDs; they must not cause deletion or reassignment. General schema creation/editing UI is not implemented yet.

Status groups are `not-started`, `in-progress`, and `complete`. Labels remain customizable:

```yaml
- id: field-task-status
  name: Status
  type: status
  default: option-open
  options:
    - {id: option-open, name: Todo, group: not-started}
    - {id: option-started, name: In progress, group: in-progress}
    - {id: option-done, name: Done, group: complete}
```

Title and tags are intrinsic document metadata, available outside databases. Tags are free-form strings; a Multi-select field has schema-defined options. A body heading does not automatically rename the document's title metadata.

## Capabilities

Database names and field labels do not identify behavior. A definition opts into task/project capabilities through stable field IDs.

A task capability maps its completion field, designated checked/reopening options, optional due-date value, and project relation. Status values in the complete group count as checked; Not started and In progress count as unchecked. Checking selects the designated completed option. Explicitly unchecking selects the designated reopening option. Refreshing an unchanged unchecked reference preserves In progress.

The [Todos definition](../examples/document-databases/todos/database.md) is customizable. The [Projects definition](../examples/document-databases/projects/database.md) separately maps active status values for summaries. Meeting Notes needs no specialized capability. Renaming labels preserves bindings. Removing or changing a bound field requires repairing its capability mapping.

## Record envelope

An upgraded todo record contains (the [static example](../examples/document-databases/todos/todo-review-comments.md) still uses the legacy layout):

```yaml
bento_version: 1
id: todo-review-comments
database: db-todos
schema_version: 1
title: Review drainage comments
tags: [review]
properties:
  field-task-status: option-open
  field-task-project: project-creekside
```

The Markdown body follows the frontmatter. `schema_version` identifies the selected database's schema. In organization version 2, `database` is a scalar database ID, or absent/null for an ordinary page; multiple memberships are invalid. New ordinary pages explicitly use null and omit schema version. An unavailable database protects each affected record wherever it lives, retaining its original metadata. Legacy workspaces continue checking membership against their registered folder until upgraded.

New todo filenames are their stable ID plus `.md`. Other existing Markdown filenames are retained. Unclassified plain Markdown gets a provisional path-derived identity in memory; explicit editing assigns metadata without rewriting untouched files. Stable identity across external renames requires an explicit document ID.

## Checkbox capture and reconciliation

Authoring a nonempty task checkbox creates its own todo document. Nested checkboxes are independent. Fenced/indented code and raw HTML examples are excluded. Merely opening a workspace does not materialize existing plain checkboxes; an explicit edit/save captures them.

The source becomes an ordinary relative Markdown link:

```markdown
- [ ] [Review drainage comments](../todos/todo-review-comments.md)
```

There is no per-occurrence identity or comment. The source keeps one checkpoint per linked todo:

```yaml
references:
  todo-review-comments:
    base_title: Review drainage comments
    base_completed: false
```

The todo owns title, status and notes. The link label and checkbox are editable projections. Compare source and canonical values to the checkpoint: accept a source-only change, refresh a canonical-only change, and advance the checkpoint when both agree. Preserve differing simultaneous changes or missing checkpoints as issues. Repeated links share a checkpoint; one edited occurrence updates unchanged siblings, while conflicting sibling edits preserve the group atomically. A newly pasted link establishes a checkpoint only when it agrees with its target.

Removing a source link retains the todo and its body. Copying a linked checkbox refers to the same todo; copying plain checkbox text creates a new todo. Clicking its label opens the todo independently of completion.

The repository checks relative paths against its ID-to-path map. In-app page moves repair relative Markdown links, image destinations, and reference definitions across the workspace, including outgoing links on the moved page. Labels, titles, code examples, fragments, and queries are retained. External file moves can still leave broken paths: these are surfaced on reload, without guessing a target.

## Moves and schema evolution

Move page changes only physical location, retaining its filename, identity, database, schema version, and properties. A move creates the destination, updates Markdown destinations, then deletes the source through a journal. It flushes pending autosave first and stops on external changes, unavailable records, or collisions. Directory creation is also journaled. Folder renaming, moving, deletion, and document renaming are not implemented. HTML URLs and arbitrary strings in custom properties are outside Markdown link repair.

Changing database membership is a separate schema transfer requiring field mapping and validation, not a filesystem move. Snapshot saves reject membership changes. External edits are validated on Reload files; unknown values are retained, and incompatible schema versions are surfaced.

Database removal must detach documents while preserving values and sufficient schema history. Field/option retirement and type conversion need recoverable schema revisions before they can become UI commands. Those operations are not implemented by the first file-backed slice; snapshot saves explicitly reject deletion and membership/schema changes.

## Save and recovery contract

`files/repository.js` loads definitions and records. It never writes on open except to resume a previously journaled save. Definitions are interpreted from the selected folder rather than hardcoded desktop seed data. Malformed records are reported and left untouched; duplicate identities or recovery conflicts make the workspace read-only.

1. Mutate and validate a cloned in-memory model.
2. Keep a local renderer draft and show Pending/Saving/Saved/Failed states.
3. Before save, compare the visible folder inventory, Markdown file set, and exact original contents, including definitions and workspace configuration. Any external change stops the save.
4. Acquire a local writer lock and journal all changed file contents, including before/after versions, allocated todo IDs, and planned directories. A null after value represents deletion during a move or schema relocation.
5. Replace each file through a synced temporary file in its directory. New todo files precede source-link updates.
6. Retain completed journals in `.bento-local/history/` and replay unfinished operations on reopen. A divergent file halts recovery without overwriting it; both planned versions remain in the journal.

An interrupted operation is recoverable, not an atomic filesystem-wide transaction. Other programs do not honor Bento's lock; there remains a narrow race between the last comparison and replacement. Network shares/cloud-sync conflict coordination, power-loss guarantees across directory metadata, journal retention/pruning, and a recovery-resolution UI require further work. This slice must not be described as production multi-device synchronization or a backup system.

The YAML document API retains unknown values and comments where possible, and updates changed metadata keys rather than intentionally reformatting the entire file. Serialization can normalize YAML layout; Markdown body content and original LF/CRLF style are retained.

## Implementation boundary

The Electron app creates/opens folders, discovers registered definitions, edits notes/todo bodies and title/status/date/project properties, creates todo files from checkboxes, saves, reloads, and recovers interrupted saves. The browser-only sample still uses its independent local snapshot. Personal profile/appearance are stored in the per-user app-data `settings.md`, outside workspace content. Drafts remain in local renderer storage. Personal settings are never included in workspace snapshots or agent context automatically.

Next: database/schema controls, generic record property editing, explicit transfer/conversion tools, recovery/conflict review, incremental external-change watching, editor accessibility/IME/scale evaluation, and Windows/macOS distribution validation. No real agent or Copilot integration is implemented.

### Color assignments

Content records may carry a top-level `color` set to `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, or `pink`. Absent/null means Automatic: a stable choice derived from the record ID. This presentation metadata is independent of database schema fields and survives ordinary edits and exports.

Workspace-wide tag overrides live in `workspace.md` under `tag_colors`, mapping exact tag strings to the same eight names. Removing an override restores the stable automatic color derived from that tag string. Tags remain strings on individual records. Changing a tag's color affects every occurrence in this workspace without rewriting the tagged documents. These assignments belong to workspace content; hex colors belong to personal themes.

The repository saves changed tag assignments transactionally with other workspace changes and preserves workspace frontmatter comments and body text. External changes to `workspace.md` stop the save under the existing conflict rules. Select/status option definitions may optionally declare `color` using the same names; absent status colors follow their completion group, and other choices use stable defaults.

## File organization and page references

The filesystem is the only page hierarchy. Standalone pages created in Bento are `note-<uuid>.md` files in the selected folder, defaulting to `notes/`. Database records can share any ordinary folder with them. Folder names browse their contents; chevrons expand/collapse the sidebar independently. New folder supports nested empty directories, page creation allows independent folder/database selection, and document breadcrumbs navigate every physical ancestor. Folder history and the current folder survive navigation/restart. There is no separate subpage model.

Existing top-level `parent` metadata is preserved as unknown legacy metadata. It is ignored when reading, validating, editing, and navigating pages. New documents do not receive it, and document property commands cannot set it. Removing this feature requires no destructive workspace migration: files, paths, database memberships, and authored links remain intact.

The `[[` insertion interaction stores `[label](relative/path.md)`. Links resolve against actual repository paths, including the Workspace document whose filename differs from its ID. Backlinks are derived from Markdown link tokens, deduplicated by source page; code blocks and inline code do not contribute. Relative traversal beyond the workspace and external URL schemes are excluded from page resolution. External file moves can require link repair. Labels remain authored text when a target is renamed. Links can be edited or removed freely; no parent metadata or automatic child-link projection restores them.
