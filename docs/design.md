# Bento: design document

Status: agreed content principles with proposed implementation details

Updated: 2026-10-19

The [product specification](spec.md) defines the audience, features, and acceptance criteria. This document describes proposed implementation choices and tradeoffs. Markdown content records, user-managed databases, and zero-or-one database membership are agreed requirements. Serialization, reconciliation, and runtime choices remain proposed unless explicitly stated.

## 1. Design goals and decision status

Support Makena's meeting-to-follow-up workflow through both the UI and agent assistance. Keep everyday usage independent of implementation details. Share domain behavior across all editing paths, preserve portable content, and make changes recoverable.

| Area | Current position |
| --- | --- |
| Storage | Required: one Markdown document per content record; proposed rebuildable index |
| Database membership | Required: zero or one database per document; relationships and views are separate |
| Database definitions | Required: user-managed schemas; Projects and Todos are customizable, removable defaults |
| Desktop shell and editor | Electron selected for the first file-backed slice; ProseMirror selected for formatted editing; signed OS distribution remains open |
| Todo representation | Required: a Markdown document per todo; proposed checkbox references with the todo document authoritative |
| Everyday editing | Single formatted ProseMirror surface with a Markdown bridge |
| Content agent | Proposed: scoped query and command interface sharing application services |
| Application agent | Proposed: external coding-agent integration with isolated trial and explicit adoption |
| Theme system | Proposed: declarative theme packages over shared design tokens |
| Agent providers and transport | Proposed: locally installed agent on Windows; provider, transport, and model processing location remain open |
| Daily overview | Required: cross-project upcoming work and summaries for every active project |
| Personal profile | Required: local first name, last name, optional birthday, and personalized greetings |

## 2. Content and storage direction

Workspace content lives in Markdown documents. Database definitions supply structure and specialized behavior over those records. A workspace has a root `workspace.md` manifest. Each registered database folder contains `database.md`; the folder determines membership. It does not imply a SQL database or hosted service.

Propose versioned YAML frontmatter for the document envelope and property values, with database definitions also represented as Markdown documents. Keep query/search indexes rebuildable. A local backend component may manage files and indexing; a separate process is not required by this model.

The [data-model walkthrough](data-model.md) and [example workspace](../examples/document-databases/README.md) describe the proposed encoding, schema evolution, task references, and recovery behavior. They supersede the earlier inline-only todo authority proposal.

## 3. Three-layer domain model

| Layer | Responsibility | Editing surface |
| --- | --- | --- |
| Application | Markdown editing, storage, validation, supported field types, commands, capability interpretation, and query/index execution | Bento development and supported extensions |
| Database definitions | Stable database/field identities, field types, defaults, relationships, views, and optional specialized capabilities | User-facing database and schema controls |
| Content records | One Markdown document per record, with values in metadata and a free-form body | Document editor and property controls |

Each document has zero or one database membership, derived from its enclosing registered database folder. Registered database folders cannot nest; ordinary subfolders inherit their containing database. New record files omit redundant `database` metadata. A conflicting legacy value requires repair. Project relationships are ordinary reference fields; a meeting note can refer to multiple projects while remaining a member of just Meeting Notes. Views query documents without changing their membership.

Propose stable document, database, field, and select-option IDs. Display names and paths may change independently. The document envelope needs minimal application-level rules for identity, membership, schema version, and reference bookkeeping; users customize fields within that boundary. Database definitions use a small application-owned metamodel to avoid recursive schema bootstrapping.

Projects and Todos ship as editable starter definitions, not hardcoded content classes. Optional capability mappings identify fields used for completion, due dates, project relationships, and active-project summaries. Deleting a required mapping disables the dependent feature with an explanation; no hidden recreation of a deleted default database.

Initial task use remains personal. The starter task schema can reference at most one project, while another user-defined relationship may allow many records. Due dates are calendar dates with no implicit timezone conversion. Tags remain free-form strings; their case and rename semantics still need a decision.

## 4. Documents, schemas, and checkbox references

A todo document owns its canonical title, completion status, and other properties; its Markdown body stores notes and supporting context. A meeting note owns the discussion and references to those todos. Checkbox completion markers and link labels are editable projections of the referenced document, not independent task records.

Propose converting a newly authored checkbox into a link to a newly created todo document as one recoverable operation. Use the todo document ID in its stable filename as the only identity in each Markdown link. Retain a last-projected title/completion checkpoint per linked todo ID in the meeting metadata, shared by repeated occurrences. No per-occurrence ID or inline bookkeeping comment is needed. This enables comparison between external note edits and current todo values. See the walkthrough for the encoding and conflict rules.

Opening existing Markdown discovers checkboxes without automatically rewriting the folder or creating files. Existing unlinked boxes appear as pending captures until an explicit save/capture operation materializes them. Within Bento, authoring a new checkbox triggers that operation automatically without a separate task form. If no compatible task database is configured, retain visible pending checkboxes and explain how to choose a destination; do not recreate a removed database.

Removing a checkbox reference unlinks that occurrence and retains the todo document. Deleting a todo document is an explicit, recoverable operation that surfaces affected references. Nested checkboxes are independent todos; code examples and schema-definition documents do not trigger capture. If a note has multiple project relationships, a new todo needs explicit project selection or remains unassigned rather than inheriting an arbitrary project.

### Current implementation boundary

The shared model handles identity, typed field validation, capability mappings, relative todo links, reference checkpoints, and todo-authoritative title/completion. `prototype/schema.js` defines Text, Number, Boolean, Date, Select, Multi-select, Status, and Relation. The [data-model contract](data-model.md) specifies their values and grouped completion behavior.

The Electron shell uses native directory dialogs and a sandboxed, isolated renderer. The preload bridge exposes only create/open/reload/save operations; the desktop process validates the calling frame and constrains paths to the selected workspace. Raw document HTML is escaped; previews do not execute document scripts or load remote content. See Electron's [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) and [security guidance](https://www.electronjs.org/docs/latest/tutorial/security/).

`files/repository.js` parses actual YAML/frontmatter, discovers folders, derives membership, validates definitions/records, detects external changes before save, and retains unknown metadata. `files/transaction.js` journals before/after versions, uses a local writer lock and temporary-file replacements, and resumes interrupted writes. Recovery conflicts preserve divergent files and stop further writes. See the data-model document for the guarantees and remaining races; this is not production multi-device synchronization.

The editor is a single ProseMirror formatted document. Headings, paragraphs, lists and inline styles remain editable in place. Document history supports cross-block replacements and undo/redo; input rules and clipboard parsing apply Markdown formatting. Task node views add a checkbox and document-open button while their labels remain normal editable text. Canonical IDs are synchronized through transactions excluded from user history, preserving selection. Source labels can carry rich formatting while task metadata and reference checkpoints use plain title text.

The Markdown bridge retains raw source for untouched top-level nodes, including comments and definition blocks. Edited blocks can normalize syntax. Unsupported/HTML blocks stay non-executable atoms; images remain placeholders. Rich HTML paste is filtered and parsed through the schema. Desktop edits autosave through the existing draft/session/repository flow. Full IME, screen-reader and scale validation remain separate work.

The browser-only sample continues to use its own local snapshots and profile settings. It does not get filesystem access. Desktop startup reads workspace files instead of importing browser sample data.

## 5. Interface and customization

Proposed application shell:

- Sidebar: daily overview, workspace files, user databases (including Projects and Todos when configured), Tags, and saved navigation.
- Main area: document editor, project detail, task list, or search results.
- Optional details panel: selected entity metadata and relationships.
- Command palette: quick navigation and discoverable actions.

Open to a daily overview, with a document view, a filterable Todos list, and a Projects list with project detail pages available through navigation. Add a task board after the underlying task lifecycle and filtering are reliable. Saved filters and custom views can follow initial validation.

### Database and schema controls

Provide database creation, field creation/editing/retirement, record property editing, and view configuration without raw schema edits. Preview affected records and capability mappings before type changes or removals. Supported field types are application behavior; schema editing does not install arbitrary code.

### Daily overview and project summaries

Query the applied workspace index for documents from databases with valid task capabilities, including unassigned tasks. Use mapped fields rather than database or field display names. Propose overdue, today, upcoming, and undated groups; the upcoming horizon and exact grouping remain open. Show project and source-note context on each task.

Use project capability mappings to create a summary for every active project, including those without upcoming work. If no compatible database is configured, show the relevant configuration state rather than inventing records. Initially derive summaries from recorded project status, open/completed task counts, and next due dates, with links to details. Empty and undated states should be explicit. Counts describe recorded work rather than inferred engineering progress. These summaries do not require an agent; optional narrative summaries can be added with source references and refresh timestamps.

### Personal profile and greetings

The desktop application stores profile and appearance in `settings.md` under Electron's per-user application-data directory, separately from workspace Markdown and source control. The Profile page displays the resolved path and offers Reload settings. YAML frontmatter uses `bento_version: 1`, `kind: user-settings`, `appearance: system|light|dark`, and `profile` fields `first_name`, `last_name`, and `birthday` (`YYYY-MM-DD`, or blank). Missing values use defaults. Unknown fields, comments, and body text survive saves.

On first creation, import valid legacy renderer preferences without deleting the originals. Existing settings files always win over legacy values. Use the existing local journal/lock/recovery mechanism for writes, and compare the original file before saving to avoid overwriting agent edits. Malformed files and recovery conflicts disable settings writes while leaving workspace access available; the Profile page explains how to repair/reload. Drafts, directory expansion, and operational journals remain local operational state. Workspace-level `settings.md` remains deferred until a workspace-specific preference is introduced.

The browser prototype stores the versioned profile under `bento.prototype.profile.v1` in local browser storage. It saves only after an explicit Save profile action. If storage is unavailable, keep the profile for the session and disclose that it was not saved. Invalid stored values fall back to editable defaults. The browser profile is not included in host widget-state snapshots, workspace Markdown, or agent context by default.

Require a nonempty first name; permit an empty surname and birthday. Leave unknown sample details blank. Validate birthday as a real calendar date in the past or today. Compare its month/day with the current local calendar date, ignoring the birth year: use `Hello, {firstName}` normally and `hbd {firstName}!` on the birthday. For February 29, the greeting occurs on February 29 in leap years; an alternate non-leap-year observance is not currently specified. Refresh the greeting when the app becomes visible and periodically while open so crossing midnight does not require a restart.

The prototype's planning records retain their clearly labeled fixed sample date; birthday greetings use the actual local clock rather than that sample date.

### Theme and layout customization

Use shared design tokens for color, typography, spacing, borders, focus states, and editor syntax. Themes consume a documented, versioned token schema and declare their light/dark appearance. Theme packages initially contain declarative data and permitted assets; importing a theme must not execute code.

Expose layout and typography through settings. Build internal extension points for commands, views, editor contributions, and themes, but defer a public executable extension API until those boundaries stabilize. Arbitrary CSS overrides and third-party code execution require separate design decisions.

Keyboard navigation, visible focus, adequate contrast, scalable text, and accessible names are baseline requirements. Essential state must remain understandable without relying only on color.

## 6. Technical architecture

Separate the following responsibilities behind small interfaces:

1. **Desktop shell:** windows, menus, dialogs, and platform integration.
2. **UI and editor:** document interaction, task/project views, and themes.
3. **Application services:** document, database/schema, reference, and capability commands shared by all UI and agent paths.
4. **Workspace repository:** safe file reads/writes, schema handling, and change events.
5. **Indexer:** rebuildable search and relationship projections from workspace files.

The UI must not directly mutate metadata or implement its own task lifecycle. Changes flow through application services and the workspace repository; all views consume the resulting state.

Select the desktop framework and editor through a small prototype. Evaluate Windows/macOS packaging, Markdown round-trip fidelity, accessibility, native filesystem integration, startup and memory behavior, theme integration, and maintenance burden. Electron is selected for this slice: it reuses the current JavaScript model/editor and provides native dialogs and filesystem integration with consistent Chromium rendering. It carries a larger runtime and requires timely security updates. Tauri remains an alternative if measured distribution/startup needs justify a Rust bridge and differing system webviews. No separate HTTP backend is introduced.

### Data safety and external changes

- Save through temporary files and replacement operations appropriate to each platform; recover unfinished writes where possible.
- Detect external changes, including edits made while a document has unsaved local changes. Preserve both versions and show a resolvable conflict instead of silently overwriting either.
- Keep a recoverable local draft while editing; clearly show pending, saved, and failed save states.
- Make renames, deletes, and multi-file changes recoverable. Prefer the operating system trash for user-requested deletion.
- Preserve unknown frontmatter keys and unsupported Markdown syntax; avoid whole-document formatting changes for small metadata edits.
- Preserve schema definitions and history, record properties, reference baselines, and operation recovery data alongside content; reindexing must not invent schema or reconcile unknown edits by guessing.
- Treat files as authoritative. The index can be deleted and rebuilt without losing content, relationships, or task state.
- Keep machine-specific caches, drafts, and window state outside portable content. Shared workspace preferences may live in a versioned `.bento/` folder.
- Treat file content as untrusted: constrain local resource access to authorized paths and prevent document previews from executing scripts.
- Handle Windows path restrictions and case collisions explicitly. Use relative paths for portable links where practical and disclose broken links after file moves.

### Scale and responsiveness

Index incrementally, debounce file watcher bursts, and keep parsing/indexing work off latency-sensitive UI paths. Load document bodies on demand and virtualize long lists where needed. Explicitly report unreadable or malformed files without blocking the rest of the workspace.

Measure prototypes with a representative workspace of 10,000 Markdown files and 20,000 todos. These are validation targets, not current performance claims. Record hardware and dataset characteristics before setting numeric latency and memory budgets.

## 7. Proposed agent architecture

### Content assistance

Propose starting with an agent installed on Makena's Windows laptop, operating on an authorized local Bento workspace. Hosted model processing is acceptable as an architectural assumption; fully local model support is not required. The provider is not selected. Confirm the model service and permitted content before real project material is used. Local tool access, local file storage, and model processing location are separate properties.

Possible integration paths are direct file edits with Bento reconciling external changes, a local command/tool adapter with validated domain operations, or an embedded Bento assistant using that adapter. Prefer validating a small external-agent workflow first; the exact transport remains open. Direct file edits must still provide inspectable changes and recovery rather than bypass the product requirements.

Expose scoped queries and domain commands through an adapter usable by an agent. Keep the transport open: an in-app integration, local tool protocol, or external agent may use the same application boundary. Markdown portability also permits external file editing, but that alone does not provide the review and recovery experience required by the spec.

The application services own validation and state transitions for both UI and agent operations. Candidate commands include creating/editing documents, updating properties, linking references, tagging records, and completing or reopening tasks through capability mappings. Database/schema commands form a separate scope: a content update does not grant permission to change field definitions, migrations, or capability mappings. Queries return stable entity references and current revision information alongside results.

Proposed operation flow:

1. Select authorized workspace/project/document scope and identify the agent service or local runtime. For an external service, show the content scope and obtain authorization before transmitting it.
2. Read only the authorized records; treat instructions embedded in notes as content, not permission to widen scope.
3. Produce a structured change proposal containing affected entities, expected revisions, new values, source references, and missing or inferred fields. Clearly distinguish suggestions from facts.
4. Validate the proposal and present an understandable change summary with optional field-level details. Let the user adjust or reject proposed items before applying a batch.
5. Recheck revisions and scope, then apply accepted commands through application services. Concurrent edits invalidate the affected proposal rather than being overwritten.
6. Return per-item results and refresh ordinary views. Preserve an operation record sufficient to inspect the change and attempt recovery.

A journal should record intended changes and before/after revisions for recoverable batches. Filesystem updates across multiple records are not inherently atomic. Define recovery for interruption and partial success, and never report the whole batch as complete when only some changes succeeded. An undo operation must check for later edits and resolve conflicts rather than overwrite them.

Keep credentials in platform-appropriate credential storage; never put them in Markdown, workspace settings, or operation logs. Record only the minimum content needed for recovery and provide a retention policy. Provider choice, permission persistence, operation-log storage, and exact undo semantics need design validation before implementation.

### Optional Microsoft Copilot integration

Treat this as a bonus investigation rather than a dependency for the first release. Confirm which product Makena uses: Microsoft 365 Copilot, a consumer Copilot experience, and GitHub Copilot have different integration surfaces. Do not treat them as interchangeable or imply that support for one establishes support for the others.

For Microsoft 365 Copilot, the documented declarative-agent route supports MCP/API tools. That route requires an internet-reachable endpoint; a local-only tool server on the laptop is insufficient. See Microsoft's [plugin overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/overview-plugins) and [local debugging requirements](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-debug-local), checked 2026-10-19.

Design implication: retain provider-neutral domain commands, then evaluate a separately authenticated remote adapter or approved bridge if this route is useful. Determine packaging, work-account availability, tenant policies, and authentication before promising compatibility. A development tunnel is not a selected production architecture. This investigation does not authorize exposing the laptop or publishing workspace content.

First validation target: query a synthetic project's open todos and apply a reviewed checkbox update through the same domain commands. No Copilot integration is implemented in the workflow prototype.

### Changing Bento itself

Keep application development separate from content commands. A content agent connection must not implicitly gain access to the source repository, build environment, or application installation.

Propose an external coding-agent handoff first. Provide the requested behavior, relevant application version, and authorized technical context. Do not include Makena's workspace content by default; use synthetic fixtures for development and previews.

Route requests for existing preferences to settings; route theme/layout requests to the supported customization mechanisms; reserve source changes for behavior that requires them. The user should see this distinction in plain language.

For source changes, prepare an isolated branch or checkout, run appropriate checks, and produce a preview or test build. Show the behavior change and validation results before adoption. Use a known working application version and a documented rollback path; a development agent must not patch the running installation in place.

Try schema changes against a disposable workspace copy. Back up content before an adopted migration and document downgrade limits: reverting the application binary alone may not reverse a data migration. Decide packaging, signing, trial-build delivery, and update permissions after selecting the desktop shell.

The initial handoff may require developer assistance. Validate the end-to-end experience with Makena before claiming that application changes are easy for her. An embedded coding runtime and autonomous deployment are not selected designs.

## 8. Validation plan

Use the product acceptance criteria as the release bar. Complement observation with focused technical checks:

- Markdown and metadata round trips, including unknown syntax and keys.
- Single database membership, independent relationship cardinality, stable IDs, schema-version validation, field rename/retirement/type conversion, and database detach/removal without content loss.
- Checkbox discovery and materialization, one canonical todo document, reference deduplication, baseline-aware external edits, interrupted multi-file recovery, and consistent completion across views and agent commands.
- Daily overview ordering and summaries for active projects with overdue, undated, or no tasks.
- Local profile save/reload/edit/clear, valid and invalid dates, leap-day behavior, birthday/normal greetings, local-day rollover, and storage-unavailable fallback.
- Source references surviving renames, with clear handling of changed or removed passages.
- File-write recovery, external-edit conflicts, duplicated IDs, and malformed records.
- Index rebuild equivalence for projects, todos, tags, and search.
- Agent scope enforcement, pre-transmission authorization, invalid proposals, stale revisions, partial batch recovery, and undo conflicts.
- Representative meeting-note extraction with missing dates and ambiguous actions; verify suggestions do not become asserted facts.
- Application-change trial and rollback using synthetic content, including migration failure behavior.
- Theme validation, keyboard interaction, and packaging on both platforms.

Observe Makena completing the meeting-to-follow-up workflow and reviewing a proposed change. Technical checks establish behavior; the usability trial establishes whether the workflow makes sense to her.

## 9. Delivery plan

1. **Validate the workflow:** use representative meeting notes to review direct capture, automatically tracked checkboxes, daily review, follow-up, and agent proposal review with Makena.
2. **Resolve foundational choices:** the document/schema envelope, capability mappings, checkbox-reference reconciliation, tag identity, and editor model; record rationale and tradeoffs.
3. **Validate the platform:** build a Windows/macOS prototype for opening a folder, approachable Markdown editing, safe saves, and theme tokens.
4. **Build the data foundation and manual workflow:** user databases and basic schema controls, default Projects/Todos definitions, record documents, meeting-checkbox references, tags, search, and daily overview/project summaries, with conflict handling and index recovery.
5. **Add content assistance:** scoped meeting-note queries, reviewable todo proposals, validated application, and recovery.
6. **Validate application assistance:** deliver one small agent-generated change through handoff, testing, trial, adoption, and rollback.
7. **Harden and customize:** accessibility, theme packages, layout persistence, scale measurements, and distribution.

Use small, focused commits and meaningful checks at domain, persistence, agent, and platform boundaries.

## 10. Open technical decisions

- Further envelope compatibility, schema-history storage, migration/retirement transactions, and recovery review/retention. The first folder/YAML/journal contract is documented in data-model.md.
- Checkbox-reference syntax, capture journal/idempotency, stale/missing-baseline recovery, and copy/paste rules.
- Capability vocabulary beyond the current task/project mappings, view/query format, and explicit database-transfer mappings.
- Task/project starter statuses, project-relationship cardinality defaults, and tag case/rename semantics. The zero-or-one database membership rule is required and no longer open.
- Editor implementation that meets approachable formatting and Markdown fidelity requirements.
- Supported OS versions/architectures, signed installers, update delivery, and Windows/macOS distribution validation. The first shell uses Electron.
- Agent transport/providers, scope permissions, external transmission UX, audit retention, and recovery semantics.
- Application-agent handoff, isolated build delivery, adoption, and rollback mechanics.
- Initial layout extension surface and whether CSS or executable extensions are ever supported.
- Backup and synchronization behavior; local file ownership does not establish safe concurrent synchronization.
- Repository license.

Product questions about Makena's workflow remain in the [specification](spec.md). Resolve design choices against observed needs rather than adding speculative infrastructure.


### Current first-time flow and modules

New desktop workspaces contain database definitions and no fictional content. The empty overview guides the user to create a project and immediately opens that project’s Markdown document. Projects can create linked meeting notes; captured checkboxes inherit their project. Sidebar navigation lists each record once under its database; project navigation opens documents, while project work summaries remain a separate action. Creation validates defaults and entered properties before inserting a record; schema fields requiring values without defaults currently block creation with an error.

All first-party JavaScript except the sandboxed Electron preload uses native ES modules. `preload.cjs` remains a deliberately narrow CommonJS bridge. The browser sample uses a loopback static server (`pnpm demo`) for module loading; the desktop app still loads local files without a server.


### Page property editing

Non-task pages expose a collapsible Properties form generated from their database schema. It supports text, finite numbers, calendar dates, optional three-state booleans, single choices/status, multiple choices, and one/many record relations. Title and free-form tags are document metadata; tags are entered one per line. Existing unresolved relationship IDs remain visible and removable instead of disappearing from a save. Optional unset values stay absent when unchanged, and unknown properties are retained.

Form submission constructs and validates a metadata patch before replacing the workspace snapshot. Rejected edits stay in the form with an inline error. Saving page metadata leaves body Markdown and reference checkpoints unchanged; task metadata changes, when performed through the shared model, project canonical title/completion into their source references. Changing a meeting's project relationship does not reassign existing todos. Todo pages retain their specialized status/completion controls; editing additional custom todo fields remains future work.


### Project review

Project review derives personal todos from their project capability binding and groups them by local calendar date: overdue, today, upcoming, undated, and completed. Completed tasks stay out of upcoming/overdue groups. Related notes use direct one/many schema relations targeting the project’s database, with each note appearing once per review even if several relation fields match. Sharing a note across projects does not move or duplicate its existing todos. Custom/inactive project records can still be reviewed from their document. All entries open their underlying Markdown record. No workspace-specific review preferences are introduced in this slice.


### Resume behavior

The main process owns a local, versioned `session.json` under the per-user app-data directory. A successful folder choice records its canonical workspace path. Page navigation records document IDs and the current overview/profile view through a narrow IPC method; the renderer cannot choose the remembered root. Writes use a synced temporary file and rename. Graceful quit waits for already accepted main-process writes. No document content is stored in this file, and it does not replace draft persistence.

Startup opens the previous workspace through the normal repository, including recovery and validation. Missing/disconnected folders return to the welcome screen with a message and retain the previous session until another folder is chosen. Missing page IDs or invalid project references fall back to the overview. Malformed session data is retained until a subsequent successful selection/navigation replaces it. Session restoration does not automatically apply unsaved drafts.


### Formatted editing implementation

ProseMirror replaces the former block-source textarea implementation. `prototype/rich-editor.js` owns view/history/input rules and toolbar commands. `prototype/rich-markdown.js` owns the schema, parser and source-preserving serializer. `scripts/build-editor.js` creates a local ES module from pinned packages. The runtime has no editor network service or CDN dependency.

Supported visual editing covers headings, paragraphs, inline marks, links, lists/todos, quotes, code, horizontal rules and tables. Unknown/HTML blocks remain explicit preserved atoms. A user edit can normalize its enclosing top-level Markdown block; unsupported extension syntax does not silently disappear. Task projections preserve safe inline labels when their plain text matches the record title. Renaming the record to different plain text replaces the label projection. Clipboard task attributes preserve the linked identity; plain checkboxes capture new records through the same domain command as before.
