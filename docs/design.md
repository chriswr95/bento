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
| Theme system | Implemented: paired light/dark palettes, declarative JSON imports, personal Markdown persistence |
| Agent providers and transport | Proposed: locally installed agent on Windows; provider, transport, and model processing location remain open |
| Daily overview | Required: cross-project upcoming work and summaries for every active project |
| Personal profile | Required: local first name, last name, optional birthday, and personalized greetings |

## 2. Content and storage direction

Workspace content lives in Markdown documents. Database definitions supply structure and specialized behavior over those records. A workspace has a root `workspace.md` manifest. Each registered database folder contains its `database.md` schema and record files. Folder containment is the sole source of membership; regular folders contain unstructured notes. It does not imply a SQL database or hosted service.

Propose versioned YAML frontmatter for the document envelope and property values, with database definitions also represented as Markdown documents. Keep query/search indexes rebuildable. A local backend component may manage files and indexing; a separate process is not required by this model.

The [data-model walkthrough](data-model.md) and [example workspace](../examples/document-databases/README.md) describe the proposed encoding, schema evolution, task references, and recovery behavior. They supersede the earlier inline-only todo authority proposal.

## 3. Three-layer domain model

| Layer | Responsibility | Editing surface |
| --- | --- | --- |
| Application | Markdown editing, storage, validation, supported field types, commands, capability interpretation, and query/index execution | Bento development and supported extensions |
| Database definitions | Stable database/field identities, field types, defaults, relationships, views, and optional specialized capabilities | User-facing database and schema controls |
| Content records | One Markdown document per record, with values in metadata and a free-form body | Document editor and property controls |

Each document has zero or one database membership, derived from its enclosing registered folder and inherited by ordinary subfolders. Database folders cannot overlap or nest. Content files omit redundant membership metadata. Project relations connect documents across databases without changing their location; views query those relationships. Regular note folders remain outside databases.

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

On macOS, a hidden native title bar places the standard traffic-light controls inside the themed application header. The header reserves their space and provides a drag region, with interactive controls and menus explicitly excluded. The preload exposes a read-only platform string for this layout; no window-management IPC is needed. Windows retains its standard native frame. See Electron's [custom title bar guidance](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar). `pnpm test:desktop:chrome` checks native button positioning, drag exclusions, header actions, and narrow layouts without showing the app.

`files/repository.js` parses actual YAML/frontmatter, discovers folders, derives membership from registered folders, validates definitions/records, detects external changes before save, and retains unknown metadata. `files/transaction.js` journals before/after versions, uses a local writer lock and temporary-file replacements, and resumes interrupted writes. Recovery conflicts preserve divergent files and stop further writes. See the data-model document for the guarantees and remaining races; this is not production multi-device synchronization.

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

Query the applied workspace index for documents from databases with valid task capabilities, including unassigned tasks. Use mapped fields rather than database or field display names. Group open work into overdue, today, all future dates, and undated; completed work stays collapsed. Work on inactive projects remains visible. Show project and source-note context on each task.

Use project capability mappings to create a summary for every active project, including those without upcoming work. If no compatible database is configured, show the relevant configuration state rather than inventing records. Initially derive summaries from recorded project status, open/completed task counts, and next due dates, with links to details. Empty and undated states should be explicit. Counts describe recorded work rather than inferred engineering progress. These summaries do not require an agent; optional narrative summaries can be added with source references and refresh timestamps.

### Personal profile and greetings

The desktop application stores profile and appearance in `settings.md` under Electron's per-user application-data directory, separately from workspace Markdown and source control. The Settings page displays the resolved path and offers Reload settings. YAML frontmatter uses `bento_version: 1`, `kind: user-settings`, `appearance: system|light|dark`, and `profile` fields `first_name`, `last_name`, and `birthday` (`YYYY-MM-DD`, or blank). Missing values use defaults. Unknown fields, comments, and body text survive saves.

On first creation, import valid legacy renderer preferences without deleting the originals. Existing settings files always win over legacy values. Use the existing local journal/lock/recovery mechanism for writes, and compare the original file before saving to avoid overwriting agent edits. Malformed files and recovery conflicts disable settings writes while leaving workspace access available; the Settings page explains how to repair/reload. Drafts, directory expansion, and operational journals remain local operational state. Workspace-level `settings.md` remains deferred until a workspace-specific preference is introduced.

The browser prototype stores the versioned profile under `bento.prototype.profile.v1` in local browser storage. It saves only after an explicit Save profile action. If storage is unavailable, keep the profile for the session and disclose that it was not saved. Invalid stored values fall back to editable defaults. The browser profile is not included in host widget-state snapshots, workspace Markdown, or agent context by default.

Require a nonempty first name; permit an empty surname and birthday. Leave unknown sample details blank. Validate birthday as a real calendar date in the past or today. Compare its month/day with the current local calendar date, ignoring the birth year: `hbd {name}!` overrides the usual time-of-day greeting throughout the birthday. For February 29, the greeting occurs on February 29 in leap years; an alternate non-leap-year observance is not currently specified. Refresh the greeting on focus/visibility changes and once a minute while open so hour and date changes do not require a restart. Update only the heading when its text changes; preserve the active editor and its caret. The desktop daily overview also refreshes its date groups at midnight, retaining the walkthrough.

`profile.js` holds short phrases for each local time period: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–21:59, and night 22:00–04:59. A deterministic local civil-date/hour index selects the phrase, so it varies across hours and days without random reshuffling on render or reload. A separate mixed civil-hour draw gates the Makena Wong nickname easter egg at approximately 5% of hourly slots, with the two nicknames selected evenly. Name matching trims and ignores case, requires both fields, and leaves the saved identity unchanged. This deterministic cosmetic draw avoids re-rolling on each refresh/reload. Names remain literal strings. Greeting text is presentation only and is not saved into workspace records.

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
- Make renames, deletes, and multi-file changes recoverable. Use journaled workspace-local trash for content deletion so Undo and original-path restoration work consistently across platforms. OS trash integration is deferred.
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

Projects, meetings and todos share compact schema-driven inline properties. Clicking a value opens its editor; Enter or leaving the field commits a validated patch, while Escape cancels pending input. Select/status values commit on selection. Tags are chips with Enter-to-add and Backspace-to-remove behavior; relations and multi-selects use searchable choices. Required fields stay above the fold. Database `property_layout` lists order optional fields into Important and Details; values being empty or populated do not change these groups. More/Less uses a rotating caret, respecting reduced motion. The Properties menu opens Arrange properties: Required is pinned, and optional fields are full-width selectable, draggable rows. Click or Tab selects a row with a visible highlight; Up/Down and Home/End navigate, while Alt+arrow keys reorder or change group and preserve focus. Saving updates the authored database definition through a dedicated journaled operation after flushing pending document edits; Cancel discards the proposed layout. Color and Tags can also be arranged. Invalid input stays beside an inline error. Metadata commits preserve the Markdown editor instance and history. Generic todo fields use the shared update command; completion uses the existing capability mapping, and canonical title/completion project into source references. Changing a meeting relationship does not reassign existing todos. Desktop commits use the existing draft and autosave flow.

### Project review

Project review derives personal todos from their project capability binding and groups them by local calendar date: overdue, today, upcoming, undated, and completed. Completed tasks stay out of upcoming/overdue groups. Related notes use direct one/many schema relations targeting the project’s database, with each note appearing once per review even if several relation fields match. Sharing a note across projects does not move or duplicate its existing todos. Custom/inactive project records can still be reviewed from their document. All entries open their underlying Markdown record. No workspace-specific review preferences are introduced in this slice.

### Resume behavior

The main process owns a local, versioned `session.json` under the per-user app-data directory. A successful folder choice records its canonical workspace path. Page navigation records document IDs and the current overview/profile view through a narrow IPC method; the renderer cannot choose the remembered root. Writes use a synced temporary file and rename. Graceful quit waits for already accepted main-process writes. No document content is stored in this file, and it does not replace draft persistence.

Startup opens the previous workspace through the normal repository, including recovery and validation. Missing/disconnected folders return to the welcome screen with a message and retain the previous session until another folder is chosen. Missing page IDs or invalid project references fall back to the overview. Malformed session data is retained until a subsequent successful selection/navigation replaces it. Session restoration does not automatically apply unsaved drafts.

### Formatted editing implementation

ProseMirror replaces the former block-source textarea implementation. `prototype/rich-editor.js` owns view/history/input rules and keyboard commands. `prototype/rich-markdown.js` owns the schema, parser and source-preserving serializer. `scripts/build-editor.js` creates a local ES module from pinned packages. The runtime has no editor network service or CDN dependency.

Supported visual editing covers headings, paragraphs, inline marks, links, lists/todos, quotes, code, horizontal rules and tables. Unknown/HTML blocks remain explicit preserved atoms. A user edit can normalize its enclosing top-level Markdown block; unsupported extension syntax does not silently disappear. Task projections preserve safe inline labels when their plain text matches the record title. Renaming the record to different plain text replaces the label projection. Clipboard task attributes preserve the linked identity; plain checkboxes capture new records through the same domain command as before.

### Installed themes

`prototype/themes.js` validates paired palettes and maps their eight semantic colors to app variables. Appearance mode remains independent from the selected color theme, so system changes and the sun/moon button select the appropriate palette. `theme-picker.js` handles selection/import/template export/removal in Settings. Custom files are JSON with fixed metadata and hexadecimal colors; no arbitrary CSS or executable assets are accepted. Import uses the browser's file picker in both Electron and the sample, without expanding the filesystem preload API.

Desktop settings persist the selected `color_theme` and installed `themes` together through the existing transactional `SettingsStore`. Installation is a copy into personal settings, independent from the original file and workspace data. Built-in IDs are protected; reimporting a custom ID updates its definition. Missing selected IDs fall back to Bento. Browser preferences use a separate local-storage key. See [themes](themes.md) for the format and palette references.

### Semantic accent colors

`colors.js` defines the eight persistent color identities, deterministic automatic assignments, optional theme accent fallbacks, and foreground/tinted-background pairs. Authored accents are part of the existing light/dark theme palettes. Applying a theme updates CSS variables for every identity, so all rendered chips and markers change together without rewriting document metadata. Chip foregrounds are adjusted against their actual tinted backgrounds for at least 4.5:1 contrast.

Document colors use optional record metadata; shared tag overrides use `workspace.tagColors` in memory and `tag_colors` in `workspace.md`. Both are validated by the shared model. The repository includes manifest presentation changes in the same verified transaction as content changes. Inline color pickers preserve the Markdown editor instance, support Automatic/reset, and retain unsubmitted tag text when choosing a tag color. Status/select choices use explicit option colors when present, otherwise semantic/status or stable defaults.

### Keyboard shortcuts and navigation history

`shortcuts.js` defines app bindings plus the reference entries for editor/property shortcuts. A capture-phase controller handles workspace commands before editor keymaps, with platform-specific Cmd/Ctrl modifiers, Windows/Linux Alt-arrow aliases, and a three-second chord prefix for the shortcuts section. Formatting/history within the document remains in ProseMirror. `shortcut-reference.js` renders the searchable command/keybinding/context table in Settings. Bindings are fixed in this slice; user rebinding and conflict resolution remain future work.

`navigation-history.js` stores up to 100 page locations and optional presentation state, without workspace/content snapshots. Navigation commits valid pending property edits before leaving, drops forward history after a branch, ignores duplicate locations, and skips unavailable targets. Back/forward restores compatible editor selections and scroll positions. Workspace activation and browser snapshot replacement reset the stack. Existing desktop last-page persistence remains independent. The document footer no longer displays linked-todo counts; unresolved-reference errors remain visible.

### Quick-open pages and commands

Cmd/Ctrl+P opens file search; Cmd/Ctrl+Shift+P opens the same modal prefilled with `>` followed by a space for commands. The input prefix is the sole mode state: a leading `>` selects only commands, and its absence selects only pages/files. Manual edits switch modes immediately. Invoking the other shortcut while open changes the prefix and retains the query and original focus-restoration callback; repeating the current mode shortcut closes the picker. Commands reuse the shortcut registry and existing handlers, with contextual creation and workspace actions added for the desktop. Unavailable history directions and read-only creation commands are omitted. Each invocation reads fresh workspace records; activation resolves the selected ID against current state.

`quick-open-search.js` ranks normalized, accent-insensitive title matches ahead of database/path/tag matches and fuzzy title matches. It returns at most 40 results in stable order. This is an in-memory metadata search, not full-text indexing. Paths disambiguate duplicate titles. `quick-open.js` owns the accessible dialog, combobox/listbox, keyboard selection, empty state, and cancellation. Opening and cancelling preserve editor focus, caret and scroll without rerendering the document. Running an action closes the modal first so navigation history captures the restored editor position. The picker uses existing theme tokens and filesystem operations; no new preload capabilities are needed.

### Guided example workspace

`files/example-workspace.js` populates the standard empty template using the normal document-creation and checkbox-capture commands. It creates two fictional projects, two meetings, and four todo documents; dates use local calendar arithmetic rather than a frozen fixture date. Supporting todo notes demonstrate that actions are documents. The repository saves seeded content through the existing transaction mechanism, then adds a versioned `walkthrough` descriptor to `workspace.md` containing the project and meeting IDs. A failed seed does not mark the workspace as ready for a guide. Normal opening never reseeds content or advances dates.

The existing creation IPC accepts only the optional `example` mode. Both creation paths require an empty folder, preserve folder-picker cancellation, and use the same sandboxed bridge. Example creation opens its first project and persists that location through the existing session store; normal creation remains empty.

`prototype/walkthrough.js` owns three nonmodal steps and validates referenced pages before rendering. Step progress/dismissal is local presentation state keyed by the example project ID, independently from shared content and personal profile settings. It survives restart, tolerates unavailable browser storage for the session, and supports replay. Navigation uses the existing app commands; the guide never edits documents, checks actions automatically, or locks the user into a required sequence. The workspace menu shows Replay walkthrough only for a recognized example. Desktop integration tests remain hidden according to the existing test policy.

`welcome.js` renders a theme-aware two-column welcome, with a decorative Bento tray built from HTML/CSS and the existing icon. Small windows prioritize actions over the illustration; its entrance is optional under reduced motion. The walkthrough adds Back, step markers, Try it prompts, and a transient completion card that invokes the existing workspace chooser. No new content model or workspace migration is required.

`scripts/distribute.js` wraps a packaged app as a verified macOS disk image (with an Applications symlink) or Windows portable ZIP, includes setup instructions, and emits SHA-256 checksums. Preview downloads CI builds and tests natively on both platforms, smoke-tests packaged onboarding, and creates a draft prerelease with those assets for review. Publishing is a separate release action. Packages are currently unsigned; signing, notarization, and automatic updates require additional release infrastructure.

macOS packaging uses Electron's signing helper with an ad-hoc identity to seal the renamed bundle and its nested code; signing failure stops packaging. Distribution independently checks `codesign --verify --deep --strict` before copying it into the DMG. This is integrity signing only: it supplies neither Developer ID verification nor notarization and does not remove OS approval prompts.

The unsigned preview was blocked in the first installation attempt. The current handoff uses [agent-guided source setup](agent-setup.md): clone the known working preview tag, build locally, smoke-test the packaged app, and copy it to a per-user installation directory with a repeatable launch path. Keep the source checkout, installed app, personal settings, and workspace distinct. Direct signed downloads remain deferred as IDEA-012; source setup does not bypass managed-device policy.

## 11. Future ideas

This is the shared idea backlog for Bento. **Captured** means worth exploring, not approved scope, a delivery promise, or a priority order. Keep new ideas here; promote agreed product behavior into the spec and concrete implementation decisions into the relevant design sections. When an idea ships, update its status and link the implementation.

| ID | Idea | Status | Experience and design notes |
| --- | --- | --- | --- |
| IDEA-001 | Clickable directory path | Implemented | Files → physical folders → page breadcrumbs open folder contents. Folder views participate in navigation history and restart restoration. |
| IDEA-002 | References between any pages | Implemented | Typing `[[` opens keyboard-accessible page suggestions with file paths. Selection writes a normal Markdown link; incoming links appear under Linked from. Page references remain independent of todo checkbox identity. |
| IDEA-003 | Cute Bento logo | Implemented | A green bento box with rice, a red plum, and two colorful side dishes. Native macOS/Windows icons, PNG exports, a favicon and the in-app mark share one transparent master. See [asset notes](../assets/README.md). |
| IDEA-004 | Cmd+P quick-open commands | Implemented | One picker supports file search with Cmd/Ctrl+P and command search with Cmd/Ctrl+Shift+P; adding/removing `>` switches modes. Supports keyboard selection, contextual desktop creation, existing navigation history, and cancellation with editor caret restoration. See [quick-open design](#quick-open-pages-and-commands). |
| IDEA-005 | References to external files | Captured | Link to files outside the workspace from a page. Decide portable versus machine-specific paths, missing-file behavior, and the explicit action used to open a referenced file. |
| IDEA-006 | Subpages under pages | Deferred | Removed from the current product. Use the existing filesystem layout and ordinary Markdown links; revisit only if a separate hierarchy solves a demonstrated workflow need. |
| IDEA-007 | Slash commands | Implemented | A filtered `/` menu inserts Markdown blocks or starts an entry in an available database. Entry creation shares `@` property composition with palette commands. Keyboard selection, cancellation, code/read-only guards, and normal Markdown persistence share the rich editor. |
| IDEA-008 | Inline menu stability while typing | Implemented | Shared slash/wiki pickers ignore queued scroll and resize events when the measured anchor is unchanged. Escape suppression expires when the query changes. Browser and native regressions exercise real caret auto-scroll at short window heights. |
| IDEA-009 | Sidebar file management | Implemented | Folder/file context menus, exact-parent creation, focused-row Delete/Backspace, keyboard explorer navigation, compatible moves, and recoverable file deletion with restart restoration. |
| IDEA-010 | Further explorer management | Captured | Add filename/title-aware Rename with link repair, drag-and-drop moves, multi-selection, recoverable folder deletion, and a trash browser/retention controls. Keep database transfers separate from ordinary moves. |
| IDEA-011 | Readable Markdown filenames | Deferred | Prefer title-derived filenames such as `Tree trimming permit.md`, keeping stable IDs in metadata. Requires portable collision handling and link repair on rename. The current ID-based filenames remain sufficient for now. |
| IDEA-012 | Signed downloads and straightforward installation | Deferred | Mac Developer ID signing/notarization and Windows publisher signing, followed by download/install/launch checks on fresh computers. The unsigned preview did not provide a usable install for the first trial. Use the [agent-guided source setup](agent-setup.md) for now; ad-hoc integrity signing does not establish publisher trust. |

Captured entries remain proposals. Implemented entries link the delivered behavior above.

### Shared micro-syntax and entry composition

`micro-syntax.js` owns bounded literal `@` query parsing, normalized property-name matching, schema-driven field discovery, typed patches and canonical choice IDs. Queries require a token boundary (so email addresses are unaffected), match case-insensitively, and permit trailing spaces: `@da` followed by a space finds Due date. Punctuation is literal text, not executable regular expressions. All current field types are supported, along with intrinsic Tags and Color. Unavailable relation fields are excluded. Tags remain free-form strings entered one per line.

`MicroPropertyPicker` implements a shared two-stage interaction: choose a property with arrows and Enter/Tab or a mouse, then fill its typed value. Dates support a calendar input and Today/Tomorrow; choices and relations use native keyboard-selectable lists, with search for larger lists and relations. Multiple values remain arrays. Enter applies values; multiline tags use Cmd/Ctrl+Enter. Escape cancels without consuming text. Invalid values and unmatched value searches stay visible without mutating records. Input composition, inline/code blocks and read-only document guards prevent accidental activation.

`MicroInput` adapts a creation-title input, keeping selected properties as an in-memory draft until Create page succeeds. Clickable `@Field(value)` tokens show that draft inside the title area until submission or cancellation; changing database clears incompatible draft properties. Required values are validated together when creating the record, so several required fields can be supplied before any file exists. Palette database commands and dynamic `/Database name` actions open this same composer. A cancelled form creates no document. Creation remains an explicit form submission rather than executing arbitrary text in the palette.

The rich-editor adapter resolves a checkbox's linked todo identity, or otherwise the current document, and validates its query range before applying. It removes the raw query and applies the typed metadata patch against a cloned workspace before publishing either change. A ProseMirror widget keeps the confirmed `@Field(value)` visible without changing the document model, serialization or clipboard text. Positions map through edits; clicking a token or pressing Backspace immediately after it reopens its value selector. Confirmation returns the caret to the token. Enter, moving to another paragraph, or leaving the editor clears this transient display; moving into the value picker preserves it. Revisions replace the existing field token. Checkbox status still projects through the task capability into the source note. Stable IDs, source checkpoints and normal Markdown links remain the existing representation. Text undo uses the existing editor history; metadata changes use the workspace change path. Checkbox capture still requires valid task-schema defaults; custom required values without defaults can be collected with the new-entry composer.

Picker menus keep queued scroll events from dismissing a still-valid anchor, close on actual anchor movement, and are destroyed with their host. Property setters use the existing draft/autosave and external-change protection; no new filesystem or IPC surface is needed. Returning to the saved state after a no-op selection clears transient drafts and refreshes status, while an in-flight save retains the latest recovery draft.

### Workspace document and database availability

The repository projects `workspace.md` into `records[home]` with its real path. It has no database membership and uses ordinary document navigation, history, properties, rich editing, and checkbox capture. The workspace home document appears once, inside the enclosing workspace tree; Daily overview remains a separate application view. File search includes it.

Manifest saves whitelist page presentation fields (`title`, `body`, `tags`, `color`, `references`) and combine them with shared tag colors in one transaction entry. Authored database registrations, unknown metadata, and comments are preserved. Structural snapshot changes are rejected, and external edits invalidate the complete transaction, including newly captured todo files.

`files/database-definitions.js` validates registered schemas independently. Missing/invalid definitions protect their folders. Unregistered definitions are reported without rewriting their contents. Invalid task/project mappings disable only that runtime role. Missing relation targets receive derived availability flags; their current values remain intact and their property controls are disabled. Runtime availability never repairs or rewrites authored schema files. Restoring definitions and reloading restores capabilities.

Protected pages remain visible as read-only document projections. Both rich editing and property controls respect that status; repository checks reject modified protected snapshots independently of the renderer. A missing default task destination becomes null at runtime, retaining plain checkboxes with capture notices. Generic creation commands derive labels from current titles. Project creation actions use explicit relation targets rather than a special meeting database ID or a first-match meeting heuristic. Safe database deletion and schema migrations remain separate future operations; ordinary content deletion uses the workspace-local trash.

### Inline todo navigation and project titles

Resolved checkbox labels are focusable links in the rich editor. Clicking the label or focusing it and pressing Enter opens the todo document; the checkbox independently changes completion. Alt-click places the caret for label editing, and selecting text does not navigate. Pending or unresolved checkboxes have no navigation link. These decorations preserve Markdown links, label formatting, stable identity, and clipboard metadata without a separate open icon.

Project pages omit the Page title property. Editing the first top-level H1 updates the stored title, sidebar label, file-search entry, and document header through the shared edit operation. Empty, removed, or oversized headings retain the last valid title while editing. Other document types keep their existing title properties.

### Workflow motion

Document navigation fades in the new document over 220 ms after navigation and focus restoration begin. Quick open uses a 220 ms fade with a four-pixel entrance; focus, search, activation, and dismissal are immediate. These effects preserve layout and never animate the editor during typing.

Overview and project-review completion apply and persist the domain change synchronously. The completed row dims, briefly lingers, and collapses over 300 ms before refreshing the projection. Undo remains available during that interval. Refreshing or navigating cancels outstanding presentation callbacks; those callbacks never mutate domain state. Keyboard focus moves to the next action or Undo when a focused row disappears. Document checkboxes keep their position and use a short text-color transition.

Sidebar folders, including the enclosing workspace, expand and collapse over 320 ms so following rows move naturally with the changing height. Children fade in over 220 ms after a short 40 ms lead-in, and fade out over 140 ms on close. Chevrons rotate over the same 320 ms as the height change. Properties and More/Less share this treatment; menus remain immediate.

Scoped `::details-content` transitions interpolate between zero and intrinsic height, using `content-visibility` with discrete transitions to retain the closing content long enough to animate. Native disclosure state and persisted preferences update immediately. Closing content ignores pointer events and leaves explorer keyboard navigation immediately. CSS handles reversal and content changes without timers, fixed maximum heights, or per-row transforms. Unsupported browsers retain ordinary native disclosure behavior. See Chrome's [details styling guidance](https://developer.chrome.com/blog/styling-details).

System reduced motion disables entrances, completion animation, disclosure height/fade, and chevron rotation transitions. Switching the preference during completion cancels motion and immediately refreshes the projection with focus restoration. Headless interaction checks cover persistence before animation finishes, Undo, interruption by navigation, keyboard focus, and both initial and changed reduced-motion preferences. Hidden sidebar checks sample actual rendered heights, opacity and sibling positions across opening/closing, rapid reversal, workspace nesting, Properties/More, and reduced motion.

### File organization and linking

The sidebar uses one `directoryTree` projection rooted at the workspace title. Its children include the Workspace document, named database folders, regular folders, and Markdown documents. Database folders are annotated from `databasePaths`, sorted ahead of regular folders, and distinguished by a small table icon; ordinary folders use a folder icon. Every folder, including the root, has native disclosure with rotating chevrons. Root collapse preserves descendant states; page reveal opens ancestors. The previous Files header, duplicate Workspace shortcut, and Collapse all control are removed. Creation allocates an ID-based filename inside the chosen database or regular folder, with eligible destinations derived by the shared folder policy.

Legacy `parent` metadata is preserved like other unknown metadata, without validation, warnings, ancestry, or inferred links. Model commands reject attempts to create or update Parent. Existing Markdown links are ordinary authored content and can be removed without restoration. The editor reads the stored body directly.

`page-link-picker.js` watches the rich editor selection for an unfinished `[[` query in prose, excluding code. It keeps editor focus, handles arrows/Enter/Escape and composition, displays titles plus file paths, and replaces only the query range with a link mark. Titles outrank file-path matches. Suggestions use text nodes to render authored strings safely. Blur, navigation, viewport movement that changes the caret anchor, and editor destruction close the popup. Scrolls within the option list retain the keyboard selection. Raw wiki syntax is not reinterpreted on load.

`page-links.js` resolves relative Markdown links through an index of real file paths and derives backlinks by walking Markdown link tokens. It excludes external URLs, traversal outside the workspace, and code examples. Resolution does not assume the filename equals the record ID, supporting `workspace.md` and externally named ordinary pages. Backlinks refresh on document entry and property changes, avoiding workspace-wide text scans on each keystroke. Missing targets keep their source Markdown. Links use physical file paths; general external file-move repair remains separate work.

### Slash commands

`slash-commands.js` defines the block catalog and composes query deletion plus block transformation into one undoable transaction. It uses the shared ProseMirror schema and commands for paragraphs, headings, lists, todos, quotes, and code; divider/table insertion requires an empty top-level block. Unsupported contexts preserve the command and report the limitation. `slash-picker.js` reuses the inline page picker's focus, filtering, placement, composition, cancellation, and cleanup behavior. Scoped option IDs and ARIA ownership keep the two menus independent. Page creation is available in the sidebar and command palette; `/page` is unsupported and remains literal text.

### Unified file explorer

The tree includes the Workspace home page exactly once and omits structural database definitions. Relative paths are available in document tooltips. Folder creation adds a physical directory through a narrow IPC operation. Folder + creates a page with membership inferred from that folder; database commands retain their title/capability mappings. Workspace disclosure persists independently of descendant state. Navigation reveals physical ancestors and scrolls only the explorer to expose the selection. Renders preserve explorer scroll. The desktop sidebar stays within the viewport with a scrollable tree and fixed navigation; narrow layouts cap tree height. Creation actions use hover/focus disclosure with a visible touch fallback. Native disclosure controls retain keyboard behavior and rotating chevrons.

### Personal daily review and rescheduling

`dailyReview` and `projectReview` share an indexed projection of mapped task capabilities and direct project relations. Tasks are sorted by date, title, and stable identity; relation targets are deduplicated before notes are assigned to projects. The daily projection includes all personal work and a summary for every active project. Cards sort by overdue count, today count, next deadline, then title. The next deadline excludes already-overdue work, which has its own count. No per-project scan of the full task list is needed.

Project status labels resolve through the project capability's active-field mapping and current option names, so custom field IDs and renamed statuses work. The renderer keeps a transient date-group filter outside saved workspace state. Pressed buttons expose global counts and control the My work groups; project summaries and collapsed completed work stay available. Navigation or workspace activation resets the filter. Changing it does not persist, replace Undo, or create history entries. Rescheduling into a hidden group returns focus to the selected filter when its original date button disappears. Completing the last visible action also falls back to that filter. Task context contains separate project-review and source-document buttons.

Recent-note entries use exactly one available date field in the note's database. The two latest valid dates no later than the local review date are shown. Databases without an unambiguous date use related-note links instead. No filesystem modification time, agent inference, new metadata, or database-specific field name is required.

`DueDatePicker` opens a small native HTML dialog from a date button in daily or project review. Today and Tomorrow use the current local review date, with Tomorrow advancing a calendar day rather than a fixed number of hours. Set date/Enter validates the date input; Cancel/Escape restores focus without a write. Application navigation shortcuts are suspended while this dialog is open. Clearing a required mapped date reports the schema error and leaves the dialog open. Unchanged dates create no Undo entry.

Successful rescheduling calls the existing `updateTodo` command with the mapped due field, then rerenders the projection, restores date-button focus, and uses the same autosave/draft/conflict path as document edits. The existing Undo snapshot restores the prior workspace. Todo Markdown bodies, source-note checkboxes, project assignments, and database membership are preserved. The dialog lives outside the changing main view so date rollover or regrouping does not destroy its input. Desktop focus/visibility/minute refreshes continue to update review groups when the local date changes.

### Inline-menu scroll and dismissal stability

The editor may scroll synchronously to reveal its caret before the inline picker is positioned. Browser scroll events arrive later. Treating every captured scroll event as a dismissal closed correctly placed menus during typing. The shared picker now records the caret coordinates and viewport size when positioning the menu: queued scroll events with an unchanged anchor, and queued resize events with an already-measured viewport size, leave it open. Actual viewport movement still closes the menu. Positioning does not refilter results or reset keyboard selection on scroll.

Escape suppresses only the current query. As soon as the query changes or the caret leaves it, the dismissal key is cleared, allowing a later command at the same document offset to open normally. The fix needs no timers, animation-frame retries, or changes to Markdown commands and persistence.

### Database folders and one workspace tree

Organization version 3 registers `{id, path}` entries in `workspace.md`. `files/database-definitions.js` loads `<path>/database.md`; the runtime `databasePaths` includes registrations with unavailable schemas so their files remain protected. `prototype/folders.js` shares containment and eligible-folder rules between the renderer and repository. Plain Markdown within a registered folder belongs to that database; content serialization omits `database`. Duplicate/nested database paths and a default notes folder inside a database are rejected. Unregistered schema folders are reported and protected.

`files/organization.js` plans directory creation and same-database page moves through the existing journal. Ordinary notes can move among regular folders. Database entries can move among their database's subfolders. The UI filters destinations, and repository save/move independently reject mismatched placement and snapshot membership changes. Schema transfer, including Add to database and Change database, requires a separate future mapping operation. Unknown values remain intact; an external cross-database move is validated against its new schema on reload.

The current format is the only supported filesystem layout. Templates and example fixtures use it directly; no upgrade view, upgrade IPC, or alternate membership loader exists. Development workspace updates are explicit one-time operations rather than application compatibility code. Interrupted-save and move recovery remains journaled.

Database folder browsing renders record titles and schema-defined fields as a horizontally scrollable table, including choice labels, relation titles, booleans, and unset values. Regular folder browsing remains a simple list. The workspace title replaces Files in breadcrumbs. Folder + selects its enclosing database automatically; changing Database in creation resets the destination to that database's folder, while ordinary pages return to notes. New folder remains available inside databases to organize their records.

`files/move-links.js` uses the [mdast Markdown parser](https://github.com/syntax-tree/mdast-util-from-markdown) to identify link/image/reference-definition nodes, then edits destination spans only. Incoming and outgoing relative paths are rebased while labels, code, titles, fragments and queries remain intact. Moves retain basenames. Destination creation precedes link edits and source deletion; divergent recovery preserves both copies. HTML URLs and custom property strings are outside this operation. Folder rename/delete/move remains deferred.

`FileSession.mutate` flushes pending edits before organizing files and retains failed drafts. Main-process IPC uses trusted-sender and serialized-operation checks. Existing paths, membership, and schemas remain repository-owned.

### Sidebar actions and recoverable content deletion

`prototype/sidebar-explorer.js` owns sidebar selection, context menus, and contextual keyboard events. It delegates from the stable sidebar element so renders can replace tree rows. Visible rows determine arrow navigation and focus after deletion. Menus use menu/menuitem roles, keyboard selection, Escape/focus restoration, outside-click and scroll/resize dismissal, and viewport-clamped placement. Global application shortcuts pause while a menu is open. Queued scroll/resize events are ignored when the measured row, viewport and scroll positions remain unchanged; actual movement dismisses the menu. Delete/Backspace only apply to an unmodified, non-composing key event on a visible focused sidebar file; they never use a remembered selection to delete from the editor. Held deletion keys do not remove multiple files. Cmd/Ctrl+Z restores the latest deletion only when a sidebar row has focus, leaving editor history handling independent.

Folder actions reuse the existing creation form and folder dialog with an explicit parent path. Database membership comes from that parent. File actions reuse compatible Move page and narrow delete/restore IPC operations. `FileSession.mutate` flushes current edits before deletion. Workspace activation preserves unfinished creation fields across an unrelated mutation and clears invalid project filters when their project is deleted.

`files/trash.js` plans deletion and restoration. A deleted file is archived as `.bento-local/trash/<uuid>.md`, with a small JSON-compatible YAML envelope recording its identity, original relative path, database, title and deletion time; the body contains the exact original file bytes as text, including its own frontmatter. The journal creates this archive before unlinking the source. Restoration validates the token, path, identity, destination collision and current schema, creates the original file, then removes the archive. No operation overwrites a replacement file. Interrupted operations recover through the existing before/after journal; divergent external edits stop recovery and retain both versions.

The transaction layer permits only the UUID trash files and their exact directory as exceptions to the hidden-destination rule, with normal workspace containment and symlink checks. The main process validates trusted IPC senders and owns all paths. Snapshots still cannot delete records. Workspace/schema documents and protected records cannot be removed through content actions. Missing definitions elsewhere do not block deleting an unrelated ordinary note.

Trash discovery returns only the most recent valid receipt in the workspace view, never its body. Malformed entries are retained and ignored; directory access failures are reported without disabling unrelated content. Repeated restoration exposes the previous remaining receipt. The workspace menu and palette support restoration across restart; the immediate deletion notice offers Undo. Links, checkbox source text and relation IDs are retained, so restoration reconnects existing references without rewriting those documents. Permanent purge and trash retention controls remain future work.
