# Bento: product specification

Status: draft for discussion

Updated: 2026-10-19

This document describes who Bento serves, what it should do, and how we will judge the experience. Implementation proposals and technical tradeoffs live in the [design document](design.md).

## 1. Audience and purpose

Bento's first user is Makena, a civil engineer who is familiar with Notion and wants a straightforward way to manage her project work. The first workflow to optimize is **meeting notes → action items → follow-up**.

The broader audience is people managing multiple projects through notes, decisions, deadlines, and follow-up work. Makena's actual workflow takes priority over speculative features for a general productivity market.

Bento should let her capture a meeting, recognize what needs to happen next, organize those actions under a project, and return later with enough context to follow through. She should be able to do this through a familiar interface or ask an agent to help.

Using Bento should not require programming, a terminal, Git knowledge, or understanding the storage format. Changing Bento with an agent should also be approachable, while giving her a clear view of what will change and a way back.

Civil engineering provides the context for organizing work. Engineering calculations, CAD/BIM authoring, formal document control, and approval workflows are outside the initial scope. We still need to learn which project records and processes Makena actually uses before treating them as requirements.

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
| Editing experience | Offer a readable, Notion-inspired writing experience with discoverable formatting controls. Everyday editing must not depend on typing Markdown syntax. |
| Todos | Treat todos as independently manageable work with a title, description, status, optional due date, tags, and project context. |
| Projects | Give each project a home for its description, related notes, todos, and current status. |
| Follow-up | Make outstanding and completed actions easy to find across meetings and projects. |
| Tags | Allow free-form string tags on notes, projects, and todos, including spaces and Unicode. |
| Navigation | Provide search and useful project, todo, and tag views. |
| Agent-assisted content | Let Makena use natural language to find, summarize, create, and update workspace content. |
| Agent-assisted customization | Let Makena describe changes to Bento's behavior or appearance and work with an agent to review, try, and adopt them. |
| Appearance | Provide a calm, Notion-inspired interface with installable themes, including the flexibility to express Catppuccin, Darcula, or Tokyo Night styles. |
| Interface customization | Allow layout and interface customization inspired by VS Code, with a useful default experience. The initial depth of extension support remains open. |
| Reliability | Preserve work through saving, reopening, conflicting edits, and unsuccessful agent changes. |
| Accessibility | Support keyboard navigation, visible focus, scalable text, and understandable status beyond color alone. |

The exact editor interaction, storage model, framework, and agent integration are design decisions. These requirements do not select an agent provider or require a particular backend.

## 4. Primary workflow: meeting notes to follow-up

### Capture a meeting

1. Open a project and create a meeting note.
2. Write and format notes using familiar page controls.
3. Record decisions and possible next actions without interrupting the writing flow.
4. Return to the note later through the project or search.

A meeting title, date, attendees, and agenda are candidate template fields to validate with Makena, not mandatory metadata for every note.

### Turn discussion into action

1. Select text to create a todo, or ask an agent to suggest action items from the meeting.
2. Review the suggested titles, project, due dates, and links to the source note.
3. Correct or omit details, then apply the desired changes.
4. See the resulting todos in both the project and central Todos views.

An agent must distinguish information recorded in the note from its own suggestions. Missing dates, ownership, or decisions must not become invented facts. The user can retain an action without assigning a due date.

### Follow through

1. Review open actions for a project or across projects, with optional due-date and tag filters.
2. Open a todo and return to its source meeting for context.
3. Record progress, complete the action, or reopen it when necessary.
4. Ask an agent for a follow-up summary with links to the underlying notes and todos.
5. Review any suggested updates before applying them.

Example request: “Find the open actions from this project's last meeting and help me prepare a follow-up.” Exact project terminology and meeting conventions still need validation.

## 5. Other core journeys

### Manage a project

Create a project, write its description, associate existing notes, and add todos. Review its status and open work in one place. Archive the project while retaining its notes and task history.

### Use existing Markdown

Open existing Markdown documents and edit them without losing unsupported syntax. Everyday writing should be approachable through the UI; a way to inspect and edit the underlying Markdown remains available. Editor modes and shortcuts are specified in the design document.

### Organize and find work

Apply existing tags or create new ones directly. Search notes, projects, and todos; filter by tag and relevant status. Renaming or moving an item should preserve its project and source relationships. Changing a todo in one view should update every other view of that todo.

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

Local writing and project management should remain available when an agent is unavailable. Before workspace information is sent to an external agent service, the experience must make the destination and content scope clear and obtain authorization. A local-only agent requirement has not been decided.

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

The first usable product should support the complete manual meeting-to-follow-up workflow: project setup, Markdown notes, todo creation with source context, tags, search, and consistent project/todo views on Windows and macOS. Include a usable default interface and theme switching.

The first agent-assisted slice should propose action items from a selected meeting note, let the user review them, and apply the chosen items with source links and recovery. Next, validate a small agent-assisted application change through the review, trial, and adoption journey above. Agent usability is a product goal, not an assumption that Markdown alone satisfies it.

Defer real-time collaboration, hosted accounts, mobile apps, calendar/email integrations, arbitrary executable plugins, and a general-purpose Notion-style database builder. Do not assume a requirement for Notion import or full Notion feature parity.

## 8. Success and acceptance criteria

Validate these with Makena using representative, non-sensitive meeting material before treating the experience as complete:

- She can create a project, capture a meeting, create linked todos, and find outstanding follow-up without terminal use or knowledge of the file format.
- She can format everyday notes through discoverable controls and reopen them with their content intact.
- She can manage a todo from different views and see one consistent status and source context.
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
- Does she track only her own actions, or also actions owned by other people? Shared assignment and collaboration are not yet specified.
- Which project details, status labels, templates, and views matter most day to day?
- Does she want all checkboxes to appear in the Todos view, or an explicit distinction between informal checklists and managed actions?
- What agent tools can she use in her work environment, and what project information may they access?
- Should agent assistance live inside Bento, in an external tool, or offer both entry points?
- What would make reviewing content changes and trying application changes feel understandable to her?
- How much interface customization is useful initially beyond themes, typography, and panel arrangement?
- Is existing content migration, backup, or use across multiple computers needed for her first trial?

Technical decisions and their tradeoffs belong in the [design document](design.md).
