# Bento: workspaces, folders, and typed documents

Status: agreed product model; the first desktop implementation covers loading, editing, saving, and interrupted-save recovery.

The [specification](spec.md) describes who Bento serves and what it must do. This document defines the current file contract and its limits.

## Principles

1. Every content record is an editable Markdown document.
2. A workspace is a folder containing `workspace.md`.
3. A database is an explicitly registered folder containing `database.md`.
4. A record belongs to zero or one database, determined by its enclosing database folder. Ordinary subfolders inherit that membership.
5. Relations and views do not confer database membership.
6. Database, document, field, and option identities remain stable when labels change.
7. Unknown values and metadata are retained. Incompatible changes must be surfaced rather than discarded.

This folder rule supersedes the earlier proposal that a record's `database` metadata independently determines membership. Membership is derived in memory and is not repeated in new record files.

## Three layers

| Layer | Responsibility |
| --- | --- |
| Application | Supported field types, validation, Markdown editing, capability interpretation, storage and recovery |
| Database definitions | Field names, types, options, defaults, relations and capability mappings |
| Record documents | Identity, schema version, property values, tags and Markdown content |

Workspace and database definition documents have Markdown bodies for descriptions and instructions. They are control documents, not records in their containing databases; their checkboxes do not create todos. They can be edited as files today. In-app database/schema controls remain future work.

## Workspace layout

```text
My workspace/
  workspace.md
  todos/
    database.md
    todo-<id>.md
  projects/
    database.md
    project-<id>.md
  meetings/
    database.md
    meeting-<id>.md
  Inbox/
    ordinary-note.md
```

The [example workspace](../examples/document-databases/workspace.md) registers stable database IDs and relative folder paths:

```yaml
bento_version: 1
kind: workspace-definition
id: workspace-example
title: My workspace
databases:
  - {id: db-todos, path: todos}
  - {id: db-projects, path: projects}
  - {id: db-meetings, path: meetings}
default_task_database: db-todos
default_project_database: db-projects
```

Defaults select existing databases; they do not make Todos or Projects mandatory. A missing task destination leaves checkboxes pending instead of recreating a database. The project default is recorded for future creation commands; current summaries use project capabilities across databases.

Database folders must be distinct and non-nested. Ordinary subfolders are allowed. A new `database.md` in an unregistered location is reported as a control document needing configuration; arbitrary folders do not silently become databases. Renaming a database folder requires updating its registered path while retaining its ID. Automatic folder-rename repair is not implemented.

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

The Markdown body follows the frontmatter. `schema_version` identifies the containing database's schema. The loader derives membership from the folder. A matching legacy scalar `database` field is accepted and removed only on an explicit save; a mismatched or array-valued legacy membership is a repair issue.

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

Removing a source link retains the todo and its body. Copying a linked checkbox refers to the same todo; copying plain checkbox text creates a new todo. The open-document control opens the todo independently of completion.

The current repository checks relative paths against its ID-to-path map. Moving a linked file externally can leave a broken path: this is surfaced, not automatically retargeted. General link repair and a conflict-resolution UI remain future work.

## Moves and schema evolution

Moving between database folders is a database transfer, not a display-only operation. The eventual in-app move should preview field mappings and incompatible values. External moves are recognized on Reload files: validate against the destination schema, retain unknown values, and report incompatible values/schema versions. There is no automatic conversion. Documents outside database folders are unclassified.

Database removal must detach documents while preserving values and sufficient schema history. Field/option retirement and type conversion need recoverable schema revisions before they can become UI commands. Those operations are not implemented by the first file-backed slice; snapshot saves explicitly reject deletion and membership/schema changes.

## Save and recovery contract

`files/repository.cjs` loads definitions and records. It never writes on open except to resume a previously journaled save. Definitions are interpreted from the selected folder rather than hardcoded desktop seed data. Malformed records are reported and left untouched; duplicate identities or recovery conflicts make the workspace read-only.

1. Mutate and validate a cloned in-memory model.
2. Keep a local renderer draft and show Pending/Saving/Saved/Failed states.
3. Before save, compare the visible Markdown file set and exact original contents, including definitions and workspace configuration. Any external change stops the save.
4. Acquire a local writer lock and journal all changed file contents, including before/after versions and allocated todo IDs.
5. Replace each file through a synced temporary file in its directory. New todo files precede source-link updates.
6. Retain completed journals in `.bento-local/history/` and replay unfinished operations on reopen. A divergent file halts recovery without overwriting it; both planned versions remain in the journal.

An interrupted operation is recoverable, not an atomic filesystem-wide transaction. Other programs do not honor Bento's lock; there remains a narrow race between the last comparison and replacement. Network shares/cloud-sync conflict coordination, power-loss guarantees across directory metadata, journal retention/pruning, and a recovery-resolution UI require further work. This slice must not be described as production multi-device synchronization or a backup system.

The YAML document API retains unknown values and comments where possible, and updates changed metadata keys rather than intentionally reformatting the entire file. Serialization can normalize YAML layout; Markdown body content and original LF/CRLF style are retained.

## Implementation boundary

The Electron app creates/opens folders, discovers registered definitions, edits notes/todo bodies and title/status/date/project properties, creates todo files from checkboxes, saves, reloads, and recovers interrupted saves. The browser-only sample still uses its independent local snapshot. Profile/drafts remain in local app storage, separate from workspace content and agent context.

Next: database/schema controls, generic record property editing and creation, explicit transfer/conversion tools, recovery/conflict review, incremental external-change watching, production editor/accessibility work, and Windows/macOS distribution validation. No real agent or Copilot integration is implemented.
