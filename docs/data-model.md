# Bento: workspaces, folders, and typed documents

Status: agreed product model; the first desktop implementation covers loading, editing, saving, and interrupted-save recovery.

The [specification](spec.md) describes who Bento serves and what it must do. This document defines the current file contract and its limits.

## Principles

1. Every content record is an editable Markdown document.
2. A workspace is a folder containing `workspace.md`.
3. A database is a registered folder containing `database.md` and its record files.
4. A record belongs to zero or one database, determined by its enclosing registered database folder. Ordinary subfolders inherit that membership.
5. Relations and views do not confer database membership.
6. Database, document, field, and option identities remain stable when labels change.
7. Unknown values and metadata are retained. Incompatible changes must be surfaced rather than discarded.

Database folders contain structured records; regular folders contain ordinary Markdown notes. Relations connect a project to its meetings and todos without physically mixing their files. There is one filesystem tree rooted at the workspace, not a separate page hierarchy.

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
  projects/                  # Projects database
    database.md
    project-<id>.md
  todos/                     # Todos database
    database.md
    Review/
      todo-<id>.md
  meetings/                  # Meeting Notes database
    database.md
    meeting-<id>.md
  notes/                     # Ordinary folders and Markdown
    Drainage/
      assumptions.md
```

The workspace manifest registers stable database IDs and relative folder paths:

```yaml
bento_version: 1
kind: workspace-definition
id: workspace-example
title: My workspace
organization_version: 3
default_page_folder: notes
databases:
  - {id: db-todos, path: todos}
  - {id: db-projects, path: projects}
  - {id: db-meetings, path: meetings}
default_task_default_project_database: db-projects
```

Database folders are distinct and cannot nest. Their schema is `<path>/database.md`; every other content document within that folder or its ordinary subfolders belongs to that database. Names and IDs remain independent, so a database can be relabeled without renaming files. Regular folders live outside databases. New ordinary pages default to `notes/`; root-level ordinary documents remain valid, and `workspace.md` is the workspace home page.

Creation from a database folder selects that database and location. Choosing another database restricts destinations to its folder and subfolders. An ordinary page can only use regular folders. Checkbox capture creates todos in the configured task database folder. Missing task configuration preserves pending checkboxes instead of recreating a database.

The sidebar is one collapsible workspace folder containing its home document, named database folders, regular folders, and Markdown pages. Database folders sort before regular folders and have a table icon; ordinary folders use a folder icon. Schemas are structural files, not separate page entries. Clicking a database folder opens a table of all its records and schema fields; clicking a regular folder opens its contents. Disclosure remains independent of browsing. Collapsing the workspace hides its entire tree without changing descendant disclosure preferences; opening a document reveals its ancestors. There is no Collapse all action or duplicate Workspace shortcut outside the tree.

Hidden operational directories and symlinks are not traversed. Paths must be portable across Windows and macOS; creation rejects traversal, reserved names, and case/Unicode collisions. Empty folders remain visible.

### Development format policy

Bento supports only organization version 3. Templates and the checked-in example use this format directly. There is no in-app upgrade screen, migration command, or alternate metadata-membership mode. Pre-v1 format changes update development workspaces directly; preserving old layouts is not a product requirement. Normal interrupted-save and page-move recovery remains supported.

## Typed fields

Each field has a stable `id`, user-facing `name`, `type`, optional `required` flag, and optional `default`. Type-specific configuration belongs in the database definition, not every record.

Database definitions may also contain `property_layout`, with ordered `important` and `detail` lists of field IDs. `$color` and `$tags` identify shared document properties. Required schema fields are pinned above the fold and must not appear in either list; changing presentation never changes their `required` validation. Page title and todo completion remain fixed document controls. Missing layout entries default to Important; without an authored layout, Color and Tags default to Details. Unknown IDs, duplicate IDs, unknown layout keys and required-field entries are rejected.

```yaml
property_layout:
  important:
    - field-meeting-date
    - field-meeting-projects
  detail:
    - $color
    - $tags
```

Layout belongs to the database definition and applies to all its records. It does not increment `schema_version` or rewrite content documents. The dedicated layout write uses the repository journal, external-change checks and authored YAML preservation. Snapshot saves cannot change other schema metadata.

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

A [todo record](../examples/document-databases/todos/todo-review-comments.md) contains:

```yaml
bento_version: 1
id: todo-review-comments
schema_version: 1
title: Review drainage comments
tags: [review]
properties:
  field-task-status: option-open
  field-task-project: project-creekside
```

The Markdown body follows the frontmatter. `schema_version` identifies the enclosing database's schema. Membership is derived only from the registered folder; content files omit `database`. Redundant membership metadata is reported for repair rather than overriding location. An unavailable or unregistered database protects its folder's records while retaining their original contents. Ordinary pages have no database or schema version.

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

Move page changes physical location within the same database, or between regular folders for an ordinary page. It retains the filename, identity, schema version, and properties. A move creates the destination, updates Markdown destinations, then deletes the source through a journal. It flushes pending autosave first and stops on external changes, unavailable records, or collisions. Directory creation is also journaled. Folder renaming, moving, deletion, and document renaming are not implemented. HTML URLs and arbitrary strings in custom properties are outside Markdown link repair.

Moving across database boundaries changes membership and therefore requires a separate schema transfer with field mapping and validation. The ordinary Move page dialog excludes those destinations, and the backend rejects them. Change database / Add to database is deferred. Snapshot saves reject membership changes. External edits are validated on Reload files; unknown values are retained, and incompatible schema versions are surfaced.

Database removal must detach documents while preserving values and sufficient schema history. Field/option retirement and type conversion need recoverable schema revisions before they can become UI commands. Those operations are not implemented by the first file-backed slice; snapshot saves explicitly reject deletion and membership/schema changes.

## Save and recovery contract

`files/repository.js` loads definitions and records. It never writes on open except to resume a previously journaled save. Definitions are interpreted from the selected folder rather than hardcoded desktop seed data. Malformed records are reported and left untouched; duplicate identities or recovery conflicts make the workspace read-only.

1. Mutate and validate a cloned in-memory model.
2. Keep a local renderer draft and show Pending/Saving/Saved/Failed states.
3. Before save, compare the visible folder inventory, Markdown file set, and exact original contents, including definitions and workspace configuration. Any external change stops the save.
4. Acquire a local writer lock and journal all changed file contents, including before/after versions, allocated todo IDs, and planned directories. A null after value represents deletion during a move, trash operation, or restoration.
5. Replace each file through a synced temporary file in its directory. New todo files precede source-link updates.
6. Retain completed journals in `.bento-local/history/` and replay unfinished operations on reopen. A divergent file halts recovery without overwriting it; both planned versions remain in the journal.

An interrupted operation is recoverable, not an atomic filesystem-wide transaction. Other programs do not honor Bento's lock; there remains a narrow race between the last comparison and replacement or unlink. Network shares/cloud-sync conflict coordination, power-loss guarantees across directory metadata, journal retention/pruning, and a recovery-resolution UI require further work. This slice must not be described as production multi-device synchronization or a backup system.

The YAML document API retains unknown values and comments where possible, and updates changed metadata keys rather than intentionally reformatting the entire file. Serialization can normalize YAML layout; Markdown body content and original LF/CRLF style are retained.

## Implementation boundary

The Electron app creates/opens folders, discovers registered definitions, edits notes/todo bodies and title/status/date/project properties, creates todo files from checkboxes, saves, reloads, and recovers interrupted saves. The browser-only sample still uses its independent local snapshot. Personal profile/appearance are stored in the per-user app-data `settings.md`, outside workspace content. Drafts remain in local renderer storage. Personal settings are never included in workspace snapshots or agent context automatically.

Next: database/schema controls, generic record property editing, explicit transfer/conversion tools, recovery/conflict review, incremental external-change watching, editor accessibility/IME/scale evaluation, and Windows/macOS distribution validation. No real agent or Copilot integration is implemented.

### Color assignments

Content records may carry a top-level `color` set to `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, or `pink`. Absent/null means Automatic: a stable choice derived from the record ID. This presentation metadata is independent of database schema fields and survives ordinary edits and exports.

Workspace-wide tag overrides live in `workspace.md` under `tag_colors`, mapping exact tag strings to the same eight names. Removing an override restores the stable automatic color derived from that tag string. Tags remain strings on individual records. Changing a tag's color affects every occurrence in this workspace without rewriting the tagged documents. These assignments belong to workspace content; hex colors belong to personal themes.

The repository saves changed tag assignments transactionally with other workspace changes and preserves workspace frontmatter comments and body text. External changes to `workspace.md` stop the save under the existing conflict rules. Select/status option definitions may optionally declare `color` using the same names; absent status colors follow their completion group, and other choices use stable defaults.

## File organization and page references

The filesystem is the only page hierarchy. Standalone pages created in Bento are `note-<uuid>.md` files in the selected folder, defaulting to `notes/`. Database records live only inside their registered database folders. Folder names browse their contents; chevrons expand/collapse the sidebar independently. New folder supports nested empty directories, page creation restricts folders to the selected database or regular note locations, and document breadcrumbs navigate every physical ancestor. Folder history and the current folder survive navigation/restart. There is no separate subpage model.

Existing top-level `parent` metadata is preserved as unknown legacy metadata. It is ignored when reading, validating, editing, and navigating pages. New documents do not receive it, and document property commands cannot set it. Removing this feature requires no destructive workspace migration: files, paths, database memberships, and authored links remain intact.

The `[[` insertion interaction stores `[label](relative/path.md)`. Links resolve against actual repository paths, including the Workspace document whose filename differs from its ID. Backlinks are derived from Markdown link tokens, deduplicated by source page; code blocks and inline code do not contribute. Relative traversal beyond the workspace and external URL schemes are excluded from page resolution. External file moves can require link repair. Labels remain authored text when a target is renamed. Links can be edited or removed freely; no parent metadata or automatic child-link projection restores them.

## Content deletion and restoration

Content files have dedicated delete/restore operations; snapshot saves continue rejecting deletions. Workspace home and schema files are protected, as are records in unavailable databases. Deletion journals an exact copy of the original file inside `.bento-local/trash/<uuid>.md` before removing its visible path. The archive envelope records the original document ID, relative path, database, title and deletion time; its body is the original file unchanged. Hidden trash entries are not workspace records and do not affect the visible folder inventory.

Restoration creates the original path and then removes its archive. It rejects invalid tokens, hidden/traversal paths, workspace/schema targets, unavailable original folders/databases, path or identity collisions, and records incompatible with the current schema. Newer content is never overwritten. Archives and completed journals remain available after a conflict. The latest valid deletion receipt survives restart and enables Restore last deleted file; restoring it reveals the next remaining receipt.

Deletion retains incoming Markdown links, source checkboxes, reconciliation checkpoints and relation IDs. Missing targets are surfaced through existing link/relation behavior. A missing linked todo is never recaptured as a new todo, and removing a source note retains its separate todos. Undo restores the same identity and file bytes, reconnecting those references. Permanent erasure, trash browsing/retention and bulk/folder deletion are not implemented.
