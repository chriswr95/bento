# Bento: design document

Status: proposed design; decisions remain open

Updated: 2026-10-19

The [product specification](spec.md) defines the audience, features, and acceptance criteria. This document describes proposed implementation choices and tradeoffs. Earlier technical proposals are retained here; moving them does not approve them.

## 1. Design goals and decision status

Support Makena's meeting-to-follow-up workflow through both the UI and agent assistance. Keep everyday usage independent of implementation details. Share domain behavior across all editing paths, preserve portable content, and make changes recoverable.

| Area | Current position |
| --- | --- |
| Storage | Proposed: Markdown files as authority with a rebuildable index |
| Desktop shell and editor | Open; validate on Windows and macOS |
| Todo representation | Proposed: standalone files; compare against inline managed tasks with Makena's workflow |
| Everyday editing | Must support discoverable formatting; exact editor model remains open |
| Content agent | Proposed: scoped query and command interface sharing application services |
| Application agent | Proposed: external coding-agent integration with isolated trial and explicit adoption |
| Theme system | Proposed: declarative theme packages over shared design tokens |
| Agent providers and transport | Open; neither a hosted provider nor an embedded runtime is selected |

## 2. Recommended initial direction

Use a local-first desktop application with a folder-based Markdown workspace as the durable source of truth. Use a rebuildable local index for fast search, relationships, and task views.

This is a proposal, pending review. It preserves ordinary file ownership while allowing richer behavior than a plain text editor. It also avoids requiring an account, hosted service, or synchronization system to validate the core product.

A desktop application can still use a local backend component to manage files and indexing. File-based storage and a local service are compatible choices. Prefer an in-process service behind a clear interface initially; add a separate process only if isolation, runtime requirements, or measured performance justify it.

### Storage options considered

| Option | Benefits | Costs | Initial recommendation |
| --- | --- | --- | --- |
| Markdown files plus rebuildable index | Portable, inspectable, compatible with external editors and Git | Requires explicit metadata conventions, file watching, and conflict handling | Preferred |
| Local database as the source of truth, with Markdown import/export | Strong structured queries and transactional updates | Export can lose information; users depend on Bento to access the full workspace | Revisit if structured editing outgrows the file model |
| Hosted service as the source of truth | A foundation for shared workspaces and coordinated updates | Accounts, networking, operations, offline behavior, and conflict resolution | Outside the initial release |

## 3. Domain model

| Entity | Initial fields | Meaning |
| --- | --- | --- |
| Workspace | Root folder, format version, preferences | A collection of user-owned files and their working context |
| Note | Stable ID, title, Markdown body, tags | A document with optional relationships to projects |
| Todo | Stable ID, title, status, description, optional project, optional due date, tags, source references | An independently addressable unit of work |
| Project | Stable ID, title, status, Markdown body, tags | A durable planning context with associated todos and notes |
| Tag | User-defined string | A reusable label across entity types |

Proposed todo states: `open`, `in_progress`, `done`, and `cancelled`. Proposed project states: `active`, `on_hold`, `completed`, and `archived`. The UI may simplify these initially, but transitions must be explicit and reversible.

Propose explicit source references from a todo to the note and relevant passage that prompted it. Use stable entity references and optional passage anchors; if a passage changes, preserve the note link and flag an unresolved anchor. The exact serialization remains open.

A todo initially belongs to at most one project. Notes may link to multiple projects. Relationships use stable IDs so renaming or moving a file does not break them. Titles need not be unique. IDs must be unique within a workspace; duplicated IDs are surfaced for repair rather than silently merged.

Due dates initially represent calendar dates (`YYYY-MM-DD`), with no implicit timezone conversion. Reminders and due times are deferred.

Tags are strings rather than a predefined taxonomy. Spaces, punctuation, and Unicode should be supported; storage must quote or escape them safely. Propose trimming surrounding whitespace, rejecting empty values, and preserving spelling and case. Decide case-sensitive identity before implementation. Inline `#tag` shorthand, if supported, is only one input method and must not limit the underlying tag format.

## 4. Proposed file format

Use UTF-8 Markdown with a small, versioned YAML frontmatter schema for structured entities. Keep the body ordinary Markdown and preserve unrecognized metadata.

Example project file, at a user-chosen path:

```markdown
---
bento_version: 1
id: "project-site-review"
type: project
title: "Site review"
status: active
tags: ["site review", "follow-up"]
---

# Site review

Meeting notes, decisions, and follow-up actions.
```

Example todo file:

```markdown
---
bento_version: 1
id: "todo-review-comments"
type: todo
title: "Review meeting comments"
status: open
project: "project-site-review"
due: "2026-10-24"
tags: ["follow-up"]
---

Review the comments captured during the meeting.
```

The example IDs are illustrative; the implementation should generate opaque stable IDs. Folder structure is organizational and does not define entity identity or project membership.

Ordinary `.md` files without Bento metadata remain editable as notes. Assigning metadata should be an explicit action when structured features require it; opening a folder must not rewrite every file.

### Todo representation decision

Propose one Markdown file per first-class todo for the first prototype: stable identity, rich descriptions, and ordinary file operations are easy to explain. A document's plain `- [ ]` checkbox initially remains a local checklist item, with an explicit action to promote it into a linked todo.

The tradeoff is file count and a distinction between checklists and managed todos. Before finalizing the format, test this against an alternative where managed todos live inline with stable identifiers. Whichever representation is chosen, a single todo must have one authoritative record, and completing it must be consistent across all views.

## 5. Interface and customization

Proposed application shell:

- Sidebar: workspace files, Projects, Todos, Tags, and saved navigation.
- Main area: document editor, project detail, task list, or search results.
- Optional details panel: selected entity metadata and relationships.
- Command palette: quick navigation and discoverable actions.

Start with a document view, a filterable Todos list, and a Projects list with project detail pages. Add a task board after the underlying task lifecycle and filtering are reliable. Saved filters and custom views can follow initial validation.

Use shared design tokens for color, typography, spacing, borders, focus states, and editor syntax. Themes consume a documented, versioned token schema and declare their light/dark appearance. Theme packages initially contain declarative data and permitted assets; importing a theme must not execute code.

Expose layout and typography through settings. Build internal extension points for commands, views, editor contributions, and themes, but defer a public executable extension API until those boundaries stabilize. Arbitrary CSS overrides and third-party code execution require separate design decisions.

Keyboard navigation, visible focus, adequate contrast, scalable text, and accessible names are baseline requirements. Essential state must remain understandable without relying only on color.

## 6. Technical architecture

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

## 7. Proposed agent architecture

### Content assistance

Expose scoped queries and domain commands through an adapter usable by an agent. Keep the transport open: an in-app integration, local tool protocol, or external agent may use the same application boundary. Markdown portability also permits external file editing, but that alone does not provide the review and recovery experience required by the spec.

The application services own validation and state transitions for both UI and agent operations. Candidate commands include creating notes/projects/todos, updating fields, linking source notes, tagging entities, and completing or reopening todos. Queries return stable entity references and current revision information alongside results.

Proposed operation flow:

1. Select authorized workspace/project/document scope and identify the agent service or local runtime. For an external service, show the content scope and obtain authorization before transmitting it.
2. Read only the authorized records; treat instructions embedded in notes as content, not permission to widen scope.
3. Produce a structured change proposal containing affected entities, expected revisions, new values, source references, and missing or inferred fields. Clearly distinguish suggestions from facts.
4. Validate the proposal and present an understandable change summary with optional field-level details. Let the user adjust or reject proposed items before applying a batch.
5. Recheck revisions and scope, then apply accepted commands through application services. Concurrent edits invalidate the affected proposal rather than being overwritten.
6. Return per-item results and refresh ordinary views. Preserve an operation record sufficient to inspect the change and attempt recovery.

A journal should record intended changes and before/after revisions for recoverable batches. Filesystem updates across multiple records are not inherently atomic. Define recovery for interruption and partial success, and never report the whole batch as complete when only some changes succeeded. An undo operation must check for later edits and resolve conflicts rather than overwrite them.

Keep credentials in platform-appropriate credential storage; never put them in Markdown, workspace settings, or operation logs. Record only the minimum content needed for recovery and provide a retention policy. Provider choice, permission persistence, operation-log storage, and exact undo semantics need design validation before implementation.

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
- Project/todo status and relationship consistency across UI and agent commands.
- Source references surviving renames, with clear handling of changed or removed passages.
- File-write recovery, external-edit conflicts, duplicated IDs, and malformed records.
- Index rebuild equivalence for projects, todos, tags, and search.
- Agent scope enforcement, pre-transmission authorization, invalid proposals, stale revisions, partial batch recovery, and undo conflicts.
- Representative meeting-note extraction with missing dates and ambiguous actions; verify suggestions do not become asserted facts.
- Application-change trial and rollback using synthetic content, including migration failure behavior.
- Theme validation, keyboard interaction, and packaging on both platforms.

Observe Makena completing the meeting-to-follow-up workflow and reviewing a proposed change. Technical checks establish behavior; the usability trial establishes whether the workflow makes sense to her.

## 9. Delivery plan

1. **Validate the workflow:** use representative meeting notes to review capture, action promotion, follow-up, and agent proposal review with Makena.
2. **Resolve foundational choices:** storage, todo representation, source links, tag identity, and editor model; record rationale and tradeoffs.
3. **Validate the platform:** build a Windows/macOS prototype for opening a folder, approachable Markdown editing, safe saves, and theme tokens.
4. **Build the manual workflow:** projects, meeting notes, linked todos, tags, search, and consistent views, with conflict handling and index recovery.
5. **Add content assistance:** scoped meeting-note queries, reviewable todo proposals, validated application, and recovery.
6. **Validate application assistance:** deliver one small agent-generated change through handoff, testing, trial, adoption, and rollback.
7. **Harden and customize:** accessibility, theme packages, layout persistence, scale measurements, and distribution.

Use small, focused commits and meaningful checks at domain, persistence, agent, and platform boundaries.

## 10. Open technical decisions

- Markdown authority plus index versus a database-authoritative model.
- Standalone todo files versus inline managed entries, and how ordinary checkboxes relate to managed todos.
- Stable ID and source-anchor formats, frontmatter preservation, and schema migration rules.
- Todo/project states, project membership cardinality, and tag case/rename semantics.
- Editor implementation that meets approachable formatting and Markdown fidelity requirements.
- Desktop framework, supported OS versions/architectures, packaging, and signing.
- Agent transport/providers, scope permissions, external transmission UX, audit retention, and recovery semantics.
- Application-agent handoff, isolated build delivery, adoption, and rollback mechanics.
- Initial layout extension surface and whether CSS or executable extensions are ever supported.
- Backup and synchronization behavior; local file ownership does not establish safe concurrent synchronization.
- Repository license.

Product questions about Makena's workflow remain in the [specification](spec.md). Resolve design choices against observed needs rather than adding speculative infrastructure.
