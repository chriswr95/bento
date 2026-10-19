# Bento: document-backed databases

Status: agreed product model with proposed encoding and reconciliation details

Date: 2026-10-19

The [specification](spec.md) defines the product requirements. This document makes the three-layer model concrete and explains the design tradeoffs. The [example workspace](../examples/document-databases/README.md) contains inspectable Markdown definitions and records; it is a design fixture, not a production implementation.

## 1. Agreed principles

1. Each content record is its own editable Markdown document, including projects and todos.
2. Each document has **zero or one database membership**. Multiple memberships are invalid, not a choice the application resolves implicitly.
3. Database definitions and fields are first-class user-managed concepts. Projects and Todos are editable, removable defaults.
4. Metadata carries structured values; the body remains free-form Markdown. Opening a todo gives the user space for notes and progress details.
5. Views and relationships reuse records without changing database membership or copying the record.
6. Ordinary Markdown can remain outside any database.
7. Schema changes and removals preserve recoverable documents and values by default.

This scope covers content and its database definitions. Per-user profiles, credentials, caches, and recovery journals are operational state rather than database content records.

## 2. Three layers

| Layer | Owns | What it does not imply |
| --- | --- | --- |
| Application | Supported field types, Markdown editing, validation, storage, query/index execution, capability interpretation, and commands | Users must modify code to add a database |
| Database definitions | Database/field/option IDs, field labels and types, defaults, relationships, views, and capability mappings | Each collection requires its own SQL database or server |
| Record documents | Identity, zero-or-one membership, schema version, property values, tags, and a Markdown body | A view owns another copy of a record |

The engine needs a small fixed metamodel for reading database definitions and a small reserved envelope for record identity. Database definitions can themselves be Markdown documents without needing to belong to a user-defined database. This prevents an infinite chain of schemas defining schemas.

A database name can change. A field label can change. Neither changes the stable IDs used by records and capability mappings. Document paths are navigational; they do not define identity, membership, or project association.

## 3. Proposed representation

See the actual [Todos definition](../examples/document-databases/.bento/databases/todos.md) and [todo record](../examples/document-databases/todos/todo-review-comments.md).

- `bento_version` identifies the document-envelope format.
- `kind` distinguishes control documents such as database/workspace definitions. Ordinary content does not need a hardcoded `type: todo` or `type: project`.
- `id` is stable within the workspace.
- `database` is one scalar database ID, or absent for an unclassified document. Arrays and duplicate membership keys are invalid input; do not silently select one value.
- `schema_version` identifies the database schema used to interpret that record's properties; it is distinct from the envelope format version.
- `title` and `tags` are intrinsic document metadata available even without membership. The UI can hide or relabel their controls, but user fields cannot redefine their identity or storage type.
- `properties` maps stable field IDs to their values. Field display names live in the definition so a label change does not rewrite every record.
- `references` stores reconciliation checkpoints keyed by linked todo document ID. Repeated links to one todo in a source share a checkpoint; there is no separate occurrence identity.

Proposed initial field types: text, number, boolean, calendar date, select, and document relation. Tags are an intrinsic list of free-form strings. The initial vocabulary, query/view encoding, and exact frontmatter names remain design choices; arbitrary user-defined executable field types are outside schema editing.

Markdown without Bento metadata remains editable as an unclassified document. Assign durable metadata when an explicit edit or capture requires it; opening a folder must not bulk-rewrite legacy files.

Property-ID keys are less readable than display-name keys in raw YAML. The benefit is safe renaming and unambiguous agent edits. Property controls should display labels, and agents should query the schema rather than guess keys. Preserve unknown properties and metadata so a schema change or older application does not erase content.

## 4. Membership, relationships, and views

The [meeting document](../examples/document-databases/meetings/coordination.md) belongs only to `db-meetings`. Its Related projects property points to a record in `db-projects`. The [todo document](../examples/document-databases/todos/todo-review-comments.md) belongs only to `db-todos` and independently relates to the same project.

The daily overview, a project's todo list, and an open-work view of Todos can all display that same todo. None assigns another database membership. A view may query multiple databases if their mapped fields are compatible; its result is still a set of referenced documents.

Moving a file to another folder does not move it to another database. An explicit database transfer validates a property mapping, previews incompatible fields, and replaces the single membership in one recoverable operation. Unmapped values remain retained in recoverable metadata rather than being silently discarded. Duplicate document IDs, missing definitions, and malformed membership stay visible as validation problems; they are not silently reclassified.

## 5. Optional capabilities over customizable schemas

The application cannot infer that a field called Status controls task completion, particularly after it is renamed. A definition can therefore opt into a supported capability and bind it to stable fields/options.

The example Todos definition maps completion to `field-task-status`, with `option-open` and `option-done` as unchecked/checked values. It separately maps due dates and project context. The Projects definition identifies which status values count as active. Meeting Notes has no specialized capability requirement.

Renaming Status to Progress preserves the field ID and bindings. Changing its type, removing a bound option, or retiring the field requires validating and updating dependent mappings. Disable a broken capability with an explanation rather than interpreting arbitrary values as done or active.

Several databases may provide task capabilities. The workspace chooses one valid default capture destination; the daily overview can include every compatible task database. Do not select a new default by display name or silently recreate a removed default. If no valid destination exists, retain new checkboxes visibly as pending capture and offer configuration. Existing records remain openable as Markdown even when their specialized behavior is unavailable.

## 6. A meeting checkbox becomes a todo document

Proposed sequence:

1. Makena types `- [ ] Review drainage comments` in the meeting document.
2. Bento recognizes a real task-list node, excluding fenced/indented code and control documents.
3. The capture command allocates one stable todo ID, and records the intended operation before writing multiple files.
4. It creates the todo document in the configured task database with the unchecked status. A checked source box initializes a completed todo. Inherit project context only when unambiguous; otherwise leave it unassigned.
5. It replaces the source line with a linked checkbox and records the projected title/completion baseline in the meeting's frontmatter.
6. The task label is editable in place. Its open-document control opens the todo's Markdown document; the checkbox changes completion without navigation.

The [meeting fixture](../examples/document-databases/meetings/coordination.md) shows the resulting line:

```markdown
- [ ] [Review drainage comments](../todos/todo-review-comments.md)
```

The linked filename is the stable document ID plus `.md`; the metadata `id` must agree. A relative directory prefix is allowed, but the identity-bearing basename stays stable when the title or containing folder changes. The link remains ordinary Markdown outside Bento. Bento can repair moved links through its ID index; a path resolving to a document with a different ID is an issue to repair, not permission to retarget a todo. The browser prototype exports a flat collection of ID-named files; folder repair is still future work.

The source keeps a checkpoint for conflict detection, without a second ID or a redundant target field:

```yaml
references:
  todo-review-comments:
    base_title: Review drainage comments
    base_completed: false
```


The link label and checkbox marker are caches of the todo's canonical title and completion. Editing either through Bento issues a command against the todo record, then refreshes its known references. The first heading in a record body is ordinary Markdown and does not independently override the metadata title. Any heading/title synchronization needs its own editor rule.

A todo may be referenced from several notes without creating more task records. A plain checkbox is a new task; copying an existing linked reference intentionally refers to the same task. Copied links retain the same todo ID. Within a source document all occurrences share one checkpoint. One changed occurrence updates its unchanged siblings; conflicting edits among siblings preserve the group for review. Duplicating a task document is an explicit new-record action with a new document ID. Exact external copy/paste repair remains open.

Opening untouched existing Markdown only discovers provisional checkboxes. An explicit edit/save or capture action materializes their todo documents; merely browsing a folder does not rewrite it. Newly authored checkboxes inside Bento trigger capture automatically. A standalone todo-capture action can create a todo document directly; it does not need a synthetic source note. A checklist within a todo's body creates separate todos and must not recursively create the containing todo again.

## 7. External edits and conflict rules

Two editable Markdown representations need an explicit reconciliation contract. A rebuildable index alone is not enough: losing it must not lose the knowledge needed to distinguish a user edit from an outdated projection.

Propose retaining a last-projected baseline for each linked todo ID in the source document's metadata. Compare each title/completion field independently, validate the whole group, then apply it atomically:

| Source reference versus baseline | Todo value versus baseline | Proposed action |
| --- | --- | --- |
| Unchanged | Unchanged | No action |
| Changed | Unchanged | Treat the reference edit as requested intent; validate, update the todo, then refresh references |
| Unchanged | Changed | Refresh the stale reference from the todo |
| Both changed to the same value | Same new value | Advance the baseline |
| Both changed differently | Different new value | Preserve both and show a conflict |
| Missing or invalid baseline | Any value | Keep the todo authoritative; surface the unresolved reference without guessing or silently overwriting the source |

A new link can establish a checkpoint when its label/status agrees with the canonical todo. If they disagree, preserve both and request repair. An existing association with a missing checkpoint must not silently adopt an arbitrary baseline.

Use optimistic revision checks on the actual files before applying a planned update. An invalid status/capability mapping blocks a semantic task update without blocking ordinary document access. Rebuild indexes from definitions, records, and reference baselines; do not turn every stale checkbox into a new command after a rebuild.

Capture, title/status propagation, schema transfers, and schema changes can touch multiple files. Use an operation journal, allocated IDs, and per-step results to make retries idempotent and interruption recoverable. An incomplete capture must be visible; do not report a todo as durably created after only indexing it. Rollback and undo must detect later edits rather than overwrite them.

## 8. Schema evolution and deletion

| Operation | Proposed behavior |
| --- | --- |
| Rename a database/field/option | Keep stable IDs; update labels without rewriting property keys |
| Add a field | Supply an optional value or an explicit default; do not rewrite every document just to add a blank |
| Make a field required | Preview missing values and choose a migration before activating the constraint |
| Change a field type | Preview incompatible values and affected capabilities; provide explicit conversions and recoverable originals |
| Remove a field/option | Retire it from active UI/schema behavior while retaining values and sufficient historical interpretation |
| Transfer a document | Preview field mappings, replace membership once, and retain incompatible values for recovery |
| Remove a database | Preview dependent records, relations, views, and capabilities; default to detaching documents and retaining schema history/values |
| Remove a checkbox reference | Remove that occurrence; retain the todo and its body |
| Delete a todo document | Explicit recoverable deletion; show broken references and offer repair without deleting source discussions |

Keep immutable schema revisions or equivalent lossless history so older records can be interpreted and changed operations can be undone. Propose active definitions under `.bento/databases/` and historical definitions under `.bento/schema-history/`; exact paths and transaction format remain open. Database removal retains a tombstone/history rather than erasing the only explanation of existing property values. Detachment clears active membership while retaining the former membership/schema provenance for recovery.

For a schema migration, update the definition, capability mappings, and record versions as one planned recoverable operation. Mixed or interrupted versions must remain interpretable and visibly incomplete. Adding a harmless optional field can use defaults without immediate record rewrites; introducing an incompatible constraint cannot silently reinterpret old values.

Relationships are independent of membership. Deleting a database definition does not delete the documents referenced by another database, but target-database constraints may become unresolved and must be shown. Removing a built-in database can disable daily-review sections until the user configures a compatible replacement.

## 9. Agent boundaries

A content agent can read a definition and edit authorized record values/body through domain commands. Permission to edit a todo does not automatically grant schema editing, database removal, migration, or application-code access. Schema changes belong to layer two and should present affected records/capabilities before application. Application changes belong to layer one and retain their separate trial/adoption workflow.

File access remains possible, but malformed direct edits are validation problems rather than authority to bypass membership or capability rules. The application must preserve unreadable/unknown values and show repair options.

## 10. Implementation status and next slice

The first browser slice implements create/open/edit/toggle across meeting references, todo bodies/properties, and daily review. It includes focused model tests for identity, references, validation, conflicts, and unlink retention, plus browser workflow checks.

Next steps:

1. Load the example definitions and records from actual workspace files with strict frontmatter validation, duplicate-key detection, and scalar membership.
2. Add file-level revision checks and production recovery for interrupted multi-file capture, projection, and migration operations.
3. Extend conflict review beyond the current issue messages and verify arbitrary external-file editing against the persisted baselines.
4. Add user-facing database/field CRUD and recoverable field retirement before broader query or view customization.

The current browser prototype implements the create/open/edit/toggle record flow with stable references, reference baselines, one-record membership checks, independent todo notes, browser persistence, and individual Markdown export. Its seeded definitions and serialized record snapshots are a browser implementation, not a folder-backed database engine. The example fixtures are not yet loaded by the prototype, and schema management, production multi-file reconciliation/recovery, imports, and migrations remain unimplemented. Resolve the proposed reference/baseline syntax and migration semantics before treating the example as a frozen file format.
