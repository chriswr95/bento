# Bento: product specification

Status: draft for discussion

Updated: 2026-10-20

This document describes who Bento serves, what it should do, and how we will judge the experience. Implementation proposals and technical tradeoffs live in the [design document](design.md).

## 1. Audience and purpose

Bento's first user is Makena, a civil engineer who is familiar with Notion and wants a straightforward way to manage her project work. The first workflow to optimize is **meeting notes → action items → follow-up**.

The broader audience is people managing multiple projects through notes, decisions, deadlines, and follow-up work. Makena's actual workflow takes priority over speculative features for a general productivity market.

Bento should let her capture a meeting, recognize what needs to happen next, organize those actions under a project, and return later with enough context to follow through. She should be able to do this through a familiar interface or ask an agent to help.

Using Bento should not require programming, a terminal, Git knowledge, or understanding the storage format. Changing Bento with an agent should also be approachable, while giving her a clear view of what will change and a way back.

Civil engineering provides the context for organizing work. Engineering calculations, CAD/BIM authoring, formal document control, and approval workflows are outside the initial scope. We still need to learn which project records and processes Makena actually uses before treating them as requirements.

### Agreed starting workflow

- Makena takes meeting notes directly in Bento.
- Todos track her own work initially. Tracking other people's work is a future extension.
- Everyday editing uses one mostly formatted Markdown surface. Makena can type Markdown shortcuts such as `[]` or `- [ ]` followed by a space to get an interactive checkbox immediately, edit the todo label in place, and open its document without switching between reading and writing modes.
- Every document checkbox creates or references a tracked todo with its own Markdown document, with no promotion step.
- The default daily overview surfaces upcoming work across all projects and a summary for each active project.

A locally installed agent on her Windows laptop is the proposed initial agent entry point. Model requests may use a hosted service; running a fully local model is not a requirement.

### Required content model

Bento has three layers: the application, user-managed database definitions, and the documents in those databases.

- Every content record, including each project and todo, has its own openable, editable Markdown document with a free-form body and structured metadata.
- A document **must belong to zero or one database**. Multiple database memberships are invalid. A document may appear in many views and have relationships to many other documents without gaining additional memberships.
- Ordinary Markdown documents may remain outside a database and join one later.
- A workspace is a folder with an editable workspace Markdown document. Database folders contain their schema and structured records; ordinary folders contain unstructured notes. Membership comes from the enclosing database folder, including its subfolders. Database folders cannot nest.
- Moving a document within its database or between regular note folders preserves its properties, identity, and Markdown links. Crossing a database boundary is a separate schema transfer that must validate and preserve existing values.
- Database fields compose from Text, Number, Boolean, Date, Select, Multi-select, Status, and Relation. Status labels are customizable and distinguish Not started, In progress, and Complete; relations allow one or many target records.
- Users can create, rename, update, and remove databases, and create, update, or remove their fields. Users should not need to edit code or raw schema files for these operations.
- Projects and Todos are customizable, removable default databases, rather than mandatory application entity types. Meeting Notes is a candidate starter database in the worked example.
- Database definitions describe the schema; each record's metadata supplies its values. Views present records without owning another copy of their data.
- Opening a todo opens its own Markdown document, where Makena can keep notes, context, references, and progress details.
- Schema changes and database removal must offer recoverable behavior that preserves documents and existing values by default.

This requirement covers workspace content and database definitions. Personal profile settings, credentials, caches, and operational state remain separate from workspace records.

## 2. Product principles

- **Make the daily workflow obvious.** Useful defaults and familiar page interactions should come before customization.
- **Keep context attached to work.** A todo should lead back to the project and notes that explain it.
- **Let people use their own language.** Titles, descriptions, and tags should not require a predefined taxonomy.
- **Keep information accessible.** Markdown editing and content portability remain core capabilities.
- **Make agent changes understandable.** Show the intended scope and meaningful results; make mistakes recoverable.
- **Keep customization optional.** Themes and extensions should enrich an already usable application.

## 3. Required capabilities

| Area | User-facing requirement |
| --- | --- |
| Platforms | Run on Windows and macOS. |
| Notes | Create, open, edit, organize, and save Markdown documents. |
| Editing experience | Offer a readable, directly editable document with minimal UI. Favor expert workflows through Markdown typing rules and keyboard shortcuts rather than a formatting toolbar. |
| Todos | Every document checkbox creates or references a tracked todo for Makena’s own work. Each todo opens as its own Markdown document with status, optional due date, tags, project context, and space for notes. |
| Projects | Give each project its own Markdown document and related notes, todos, and current status through the default Projects database. |
| Databases | Create, edit, and remove database definitions and fields through the UI. Projects and Todos are customizable, removable defaults. |
| Membership | Each document belongs to at most one database; views and relationships do not change membership. |
| Follow-up | Make outstanding and completed actions easy to find across meetings and projects. |
| Daily overview | Open to upcoming work across all projects and a summary for every active project. |
| Personal profile | Save and edit first name, last name, and an optional birthday locally. Use concise time-of-day greetings with her saved first name, and “hbd Makena!” on her birthday. |
| Tags | Allow free-form string tags on notes, projects, and todos, including spaces and Unicode. |
| Navigation | Provide search and useful project, todo, and tag views. |
| Agent-assisted content | Let Makena use natural language to find, summarize, create, and update workspace content. |
| Microsoft Copilot | Bonus goal: support the relevant Microsoft Copilot experience if feasible; confirm the product, account access, and integration requirements before implementation. |
| Agent-assisted customization | Let Makena describe changes to Bento's behavior or appearance and work with an agent to review, try, and adopt them. |
| Appearance | Provide a calm, Notion-inspired interface with installable themes, including the flexibility to express Catppuccin, Darcula, or Tokyo Night styles. |
| Interface customization | Allow layout and interface customization inspired by VS Code, with a useful default experience. The initial depth of extension support remains open. |
| Reliability | Preserve work through saving, reopening, conflicting edits, and unsuccessful agent changes. |
| Accessibility | Support keyboard navigation, visible focus, scalable text, and understandable status beyond color alone. |

The editor implementation, schema serialization, desktop framework, and agent integration are design decisions. Markdown content records and single-database membership are requirements. These requirements do not select an agent provider or require a particular backend.

## 4. Three high-level workflows

These workflows define Bento's product scope. We will start by validating meeting notes → action items → follow-up, while keeping all three visible in planning and product validation.

| Workflow | Desired outcome |
| --- | --- |
| Meeting notes → action items → follow-up | Turn discussion into clear actions and retain the context needed to follow through. |
| Tracking projects, deadlines, and priorities | Understand the state of ongoing projects and decide what needs attention next. |
| Organizing project notes and references | Keep project knowledge accessible and find the information needed to move work forward. |

### 1. Meeting notes → action items → follow-up

Initial implementation and validation priority.

#### Capture a meeting

1. Open a project and create a meeting note.
2. Take meeting notes directly in Bento and format them using Markdown typing rules and keyboard shortcuts.
3. Record decisions and possible next actions without interrupting the writing flow.
4. Return to the note later through the project or search.

A meeting title, date, attendees, and agenda are candidate template fields to validate with Makena, not mandatory metadata for every note.

#### Turn discussion into action

1. Type a Markdown checkbox (`- [ ]`) anywhere in the meeting document; it immediately becomes a tracked todo. There is no separate task-entry form. An agent can also propose checkboxes from the discussion.
2. Optionally add project context, a due date, or tags to a todo without interrupting note capture.
3. For agent suggestions, review and correct the proposed details before applying them; manually adding a checkbox needs no separate confirmation.
4. See the same todos in the note, project, and central Todos views; no separate promotion or duplicate entry is required.

Checked boxes show completed todos; unchecked boxes show open work. A meeting checkbox references the todo document rather than creating a second todo. Changing completion in any view updates the same todo and its checkbox representations. Renaming or deleting a checkbox reference must not silently erase an independently useful todo document or its notes. Each nested checkbox is also its own todo. Literal checkbox syntax in code samples is text rather than an interactive checkbox. Existing checkboxes, including completed ones, are discoverable on open. Creating their todo documents must not rewrite untouched files without an explicit edit/save or capture action.

Todos initially represent Makena’s work. Notes may mention other people, but the first release does not provide assignment or tracking of their work.

An agent must distinguish information recorded in the note from its own suggestions. Missing dates, ownership, or decisions must not become invented facts. The user can retain an action without assigning a due date.

#### Follow through

1. Review open actions for a project or across projects, with optional due-date and tag filters.
2. Open a todo’s Markdown document, write progress notes or supporting context, and return to its source meeting when needed.
3. Record progress, complete the action, or reopen it when necessary.
4. Ask an agent for a follow-up summary with links to the underlying notes and todos.
5. Review any suggested updates before applying them.

Example request: “Find the open actions from this project's last meeting and help me prepare a follow-up.” Exact project terminology and meeting conventions still need validation.

### 2. Tracking projects, deadlines, and priorities

1. Open Bento to a daily overview of upcoming work across all projects, with overdue work visible.
2. Review a summary for every active project, including projects with no upcoming todos.
3. Open a project to inspect its description, related notes, and todos.
4. Update work as priorities change and archive finished projects while retaining their history.

Each project summary should make its recorded status, outstanding work, and next deadlines easy to understand, with links to the underlying items. These summaries must remain available without agent access. Agent-written narrative summaries can supplement them; they must identify their sources and distinguish suggestions from recorded facts. Undated open work must remain discoverable rather than disappearing from daily review.

The exact priority controls and any project-level deadlines remain to be validated with Makena. This workflow does not yet select a priority scale or scheduling model.

### 3. Organizing project notes and references

1. Create or associate notes and links to relevant reference material with a project.
2. Organize them with meaningful titles and free-form tags.
3. Retrieve information through project navigation, search, or tags.
4. Move between a reference, related notes, and the work they inform without losing context.

The reference types Makena uses still need validation. Linking to reference material does not imply importing or editing every external file format.

## 5. Supporting journeys

### Customize a database

Create a database, define its fields, and add documents to it. Add a field, rename it without losing its values, and review a field-type change before adopting it. Remove a field or database with a clear explanation of the effects and recoverable content retention by default.

Move a document to another database through an explicit transfer, with a preview of field mapping and any incompatible values. It must not temporarily become a member of both databases. Reuse records in filtered views without copying them or adding memberships.

Specialized features such as task completion and daily review depend on compatible database fields. Users can rename fields while retaining those behaviors. If they remove a required field mapping or the relevant database, Bento explains which features become unavailable and how to configure a replacement; it must not silently recreate removed defaults.

### Use existing Markdown

Open existing Markdown documents and edit them without losing unsupported syntax. Everyday writing should be approachable through the UI; a way to inspect and edit the underlying Markdown remains available. Editor modes and shortcuts are specified in the design document.

### Organize and find work

Apply existing tags or create new ones directly. Search notes, projects, and todos; filter by tag and relevant status. Renaming or moving an item should preserve its project and source relationships. Changing a todo in one view should update every other view of that todo.

### Set up a personal profile

Save a first name, last name, and optional birthday in personal settings. The first name personalizes the daily overview with concise, professional greetings that vary by local time, such as “Good morning, Makena,” “Good afternoon, Makena,” and “At your own pace, Makena.” Phrases rotate hourly and remain stable within the hour, including after reload. Use “hbd Makena!” throughout the day when the local calendar month/day matches her birthday. Updating the profile updates the greeting; clearing the birthday returns to time-of-day greetings. Profile changes persist across reopening. When the saved first and last names are Makena Wong (ignoring case and surrounding spaces), about one in twenty hourly greetings substitutes “Thumper” or “Mak Attack” for the displayed name. The choice stays stable within the hour and across reloads, including birthday greetings. It never changes the saved profile or applies to other names.

This is a local personal profile, not a shared-workspace identity or sign-in requirement. Unknown details stay blank; the sample uses Makena's first name without inventing her surname or birthday.

### Personalize the interface

Select or install a theme, adjust typography and layout, and restore usable defaults. Invalid customization should leave Bento usable and explain what went wrong.

## 6. Two agent experiences

### A. Help with workspace content

Makena should be able to ask for outcomes such as:

- “Turn these meeting notes into action items for this project.”
- “Show what is still open from our last meeting.”
- “Summarize the decisions in these notes and link to the sources.”
- “Move these todos to this project and add the tag ‘permit review’.”

The experience must let her identify the workspace, project, notes, or selection the agent may use. Before a batch content change is applied, she can review a plain-language summary and the affected items, adjust the proposal, or cancel it. The precise interaction for an explicitly requested single-item change is a design decision.

Applied changes must appear in ordinary Bento views and remain inspectable and recoverable. An interrupted or unsuccessful operation must report what changed and what remains. The agent must not silently overwrite concurrent edits.

Local writing and project management should remain available when an agent is unavailable. Before workspace information is sent to an external agent service, the experience must make the destination and content scope clear and obtain authorization. Hosted model processing is an acceptable starting assumption; fully local inference is not required.

### B. Help change Bento itself

Makena should be able to describe a desired product change, such as “Make project headings more compact” or “Add a view that groups my todos by project.”

She should be able to:

1. Explain the desired result in ordinary language.
2. Understand whether it is a setting, a theme/layout change, or a change to the application.
3. Review a concrete proposal and try a preview or test version where feasible.
4. See what was checked and any limitations before adopting the change.
5. Return to the previous working version if the result does not work for her.

An application change must not silently replace the running application or alter her workspace content as a side effect. Changing content and changing the application are distinct operations with distinct scope.

The initial integration may connect to an external coding agent rather than embed one. The product should make that handoff understandable; owning an agent runtime is not a requirement. The location of the entry point and degree of automation remain open.

## 7. Initial scope and sequencing

All three high-level workflows are product goals. The first usable product should support the complete manual meeting-to-follow-up workflow: project setup, notes taken directly in Bento, automatically tracked checkboxes for personal work, source context, tags, search, a daily overview with active-project summaries, and consistent project/todo views on Windows and macOS. Include a usable default interface and theme switching.

The first agent-assisted slice should propose action items from a selected meeting note, let the user review them, and apply the chosen items with source links and recovery. Next, validate a small agent-assisted application change through the review, trial, and adoption journey above. Agent usability is a product goal, not an assumption that Markdown alone satisfies it.

User-managed databases and editable schemas are part of the product scope. Start with basic fields, relationships, and views, plus the default Projects and Todos databases. Defer advanced database formulas and rollups, real-time collaboration, hosted accounts, mobile apps, calendar/email integrations, and arbitrary executable plugins. Do not assume a requirement for Notion import or full Notion feature parity.

## 8. Success and acceptance criteria

Validate these with Makena using representative, non-sensitive meeting material before treating the experience as complete:

- She can create a project, capture a meeting, create linked todos, and find outstanding follow-up without terminal use or knowledge of the file format.
- She can review projects and upcoming or overdue work, then identify what needs attention next.
- She can organize project notes and reference links, then retrieve them through project navigation, search, or tags.
- She can format everyday notes through Markdown typing rules and keyboard shortcuts and reopen them with their content intact.
- Every document checkbox, including existing and nested checkboxes, appears as one tracked todo; completion changes in any view update the source checkbox.
- She can open each todo’s own Markdown document and add notes while seeing one consistent status across its checkbox references and views.
- A document can have zero or one database membership; attempts to assign multiple memberships fail clearly without changing content.
- She can create a database and its fields, rename a populated field without losing values, and review incompatible schema changes.
- She can remove a field or a default database while retaining recoverable documents and values, and understand any affected features.
- A document may appear in several views or link to projects without acquiring another database membership.
- She can save and edit her profile, reopen Bento with those settings intact, and see the normal or birthday greeting based on the current local date.
- Bento opens to upcoming work across projects and a summary for each active project, including projects without upcoming work; undated tasks remain accessible.
- She can organize and retrieve notes, projects, and todos with free-form tags and search.
- She can review agent-proposed action items, correct a mistaken suggestion, apply the desired items, and recover from an unwanted change.
- Agent summaries identify their source records, and suggestions remain distinguishable from recorded facts.
- She can identify what an agent is allowed to read or change, including when information would leave her computer.
- She can describe a small change to Bento, understand the proposal, try the result, and retain or revert it with appropriate assistance.
- Core local workflows remain usable when an agent or network connection is unavailable.
- Both platforms preserve work through reopening, failed saves, and conflicting external changes.
- She can change themes and restore defaults without making the workspace unusable.
- The core manual journeys work with keyboard navigation.

Record usability observations and unresolved friction. Do not substitute a passing technical test for observing whether Makena can complete the workflow.

## 9. Product questions still to answer

- What does a typical meeting note and follow-up look like in Makena's current workflow?
- Which project details, status labels, meeting templates, summary fields, and upcoming-work time horizon matter most day to day?
- What agent tools can she use in her work environment, and what project information may they access?
- How should the initial external-agent handoff work, and when would an integrated Bento assistant be useful?
- Which Microsoft Copilot product does Makena use, and what work-account integrations are available to her? Copilot integration is optional and does not block the core workflow.
- What would make reviewing content changes and trying application changes feel understandable to her?
- How much interface customization is useful initially beyond themes, typography, and panel arrangement?
- Is existing content migration, backup, or use across multiple computers needed for her first trial?

Technical decisions and their tradeoffs belong in the [design document](design.md). The [data-model walkthrough](data-model.md) works through document-backed databases and meeting-checkbox references; its serialization is proposed rather than frozen.

### First-time walkthrough

A first-time user can try a populated example, start an empty workspace, or open an existing one. The example uses fictional civil-engineering projects and a short, skippable walkthrough centered on Makena’s workflow:

1. Explore a project and its editable notes.
2. Write directly in a meeting note and turn a checkbox into a personal action with its own notes.
3. Review upcoming work across projects, open a project’s review, and complete an action.

The example lives in an empty folder chosen by the user and uses the same Markdown documents and autosave as everyday work. Two projects, two meetings, and four initial actions show work due today, upcoming work, undated work, and a completed action. Dates are relative to creation so a fresh example stays useful. Content is clearly fictional and freely editable. Example creation never adds sample records to an existing workspace or fills in personal profile details.

The workspace menu also offers Try an example workspace for users who already have a workspace open. Walkthrough progress and dismissal are remembered on this computer, and the example’s workspace menu can replay it. Restarting preserves edits and the current page. Skipping or finishing hides the guide and keeps all documents. Empty workspaces retain the existing create-first-project flow.

### Theme installation

Users can select a built-in theme or install a custom Bento color theme from a JSON file through Settings. Light, Dark, and Follow system modes are independent of the chosen theme. Users can export a template to customize/share, update an installed custom theme by ID, and remove it. Theme preferences are personal and apply across workspaces. Current built-ins include Bento adaptations of GitHub, One Dark, Darcula, Tokyo Night, and Catppuccin. Arbitrary editor extension packages are outside this implementation.

### Semantic colors

Users can assign one of eight theme-aware colors to documents/projects and shared workspace tags. Assignments retain their identity across themes and light/dark modes. Automatic colors are stable, and users can reset overrides. Colors provide recognizable markers and tinted chips while labels remain readable; color is supplementary to text. Status and selection chips use the same palette.

### Quick-open navigation and commands

Cmd+P on macOS (Ctrl+P on Windows/Linux), or Quick open in the workspace menu, opens file search. Cmd+Shift+P (Ctrl+Shift+P on Windows/Linux) opens command search in the same picker with `>` prefilled. Users can search page titles, paths, database names and tags; paths help distinguish pages with the same title. A leading `>` selects command results; without it, results contain only workspace pages/files. Adding or removing the prefix switches modes immediately. Using the other shortcut while the picker is open changes the prefix and preserves the search text. Arrow keys move selection, Enter opens/runs it, and Escape restores the previous editing position. Search covers metadata rather than document bodies.

Commands include navigation, Settings, appearance and saving. Desktop workspaces also offer workspace actions and creation in each database; new meetings and todos inherit the current project context. Read-only workspaces omit creation commands. Existing autosave and navigation history apply when opening a page.

## Future ideas

The [future-ideas backlog](design.md#11-future-ideas) tracks suggestions separately from committed product scope. Current ideas are:

- **Clickable directory path:** show where the current page lives, with every path segment navigable.
- **Page references:** reference any other page from the document using `[[...]]` or a similar writing interaction.
- **External file references:** link pages to files outside Bento.
- **Subpages:** deferred; use filesystem folders and ordinary page links for now.
- **Slash commands:** create or insert different content by typing `/`.

These are captured ideas, not scheduled requirements. Their interaction details and open design questions live in the backlog.

### Workspace page and customizable database availability

Daily overview and Workspace are separate destinations. Workspace opens the Markdown page in `workspace.md`; its body, title, tags, and color are editable like other pages. Checkboxes follow the same todo-capture rules. Database registrations and structural settings remain protected from ordinary page edits.

Creation commands use current database titles, including renamed or custom databases. Project pages offer creation actions for ordinary page databases with a relation to that project's database. Todo tracking and project review depend on explicit capability mappings, not starter database identities.

Missing definitions or invalid capability mappings show explanatory notices. Affected capabilities are unavailable, existing values are retained, and pages belonging to an unavailable database are readable but protected from edits. Other valid pages remain usable. Safe database deletion, field/type migration, and moving retained pages out of a deleted database remain future work.

### File organization and page references

Pages follow the existing filesystem layout. The sidebar has one collapsible file explorer, with actual folder names and readable page titles; relative file paths are available on hover. The Workspace page appears inside the enclosing workspace folder. Ordinary pages default to a notes folder. Users can create nested folders and browse their contents. Ordinary pages live outside databases, and database records live within their database folder. Clickable breadcrumbs traverse physical ancestors; Move page preserves membership and repairs Markdown links. There is no separate subpage hierarchy or Parent property.

Typing `[[` in prose opens searchable page suggestions. Titles and file paths distinguish matching pages. Arrow keys and Enter select a target; Escape leaves the literal input intact. The selected reference is a regular Markdown link, with no duplicate reference identity. References open their target on click; Alt-click allows editing the link text. Linked from lists incoming links once per source document, excluding code examples. Raw pasted wiki syntax is retained literally; this release provides an insertion interaction rather than a second stored link syntax.

### Slash commands

At the beginning of a paragraph, `/` opens a keyboard-accessible menu for Text, Heading 1–3, Bulleted list, Numbered list, Todo, Quote, Code block, Divider, and Table. Typing filters choices; arrows and Enter select; Escape retains the typed text. Code, inline code, tracked todo labels, composition, and read-only documents do not activate the menu. Unknown commands remain literal text.

`/page` is not a supported command and remains literal Markdown. Users create ordinary pages from the sidebar or command palette and link them using `[[` or standard Markdown links. Links are freely editable and removable; Bento does not regenerate them.

Existing files and links are preserved. Legacy `parent` metadata is retained as inert, unsupported metadata rather than deleted or migrated on disk. It has no effect on page placement, validation, or editing.

### Sidebar navigation

The explorer remembers folder disclosure state per workspace and reveals the current document’s physical ancestors when opened. Selected pages have a quiet accent highlight; decorative page dots are omitted. Page creation actions appear on folder hover or keyboard focus and remain visible on touch devices. Folder names open their contents while chevrons expand/collapse the tree. Empty folders remain visible. A collapsible workspace folder encloses every file and database; there is no Collapse all control. Database folders show their readable names and a distinct icon, and open a table of records and properties. Folder organization is available immediately when opening or creating a workspace. Pre-v1 development does not require compatibility with older workspace formats. Long lists scroll inside the sidebar, keeping Workspace, Daily overview, and Settings available.

### Daily review of personal work

Daily overview puts My work first, grouping all open todos into Overdue, Today, Upcoming, and Without a date, with completed work collapsed. Upcoming includes every future due date. Unassigned work and work on inactive projects remain visible. Task titles open the todo Markdown document, and source-note links return to the meeting context.

Every active project has a summary, including projects with no open work. Summaries show open/completed counts, overdue and today counts, the next deadline from today onward, undated work, and links to recent notes. Projects needing attention appear first. Counts reflect recorded work rather than inferred project progress.

Select a task's date to choose Today, Tomorrow, a calendar date, or No date. Cancel/Escape leaves the todo unchanged; successful changes regroup work and update summaries immediately, retain keyboard focus, support Undo, and use the existing autosave/conflict protection. Protected workspaces and unavailable records remain read-only. Required due-date fields cannot be cleared.

Recent notes use a note database's single date field (Meeting date in the starter workspace), showing the two latest dates up to today. Multiple date fields are ambiguous and are not guessed. Where no dated notes qualify, summaries show ordinary related-note links. This is recorded note chronology, not an inferred edit history.
