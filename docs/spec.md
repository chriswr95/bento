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

### Agreed starting workflow

- Makena takes meeting notes directly in Bento.
- Todos track her own work initially. Tracking other people's work is a future extension.
- Every document checkbox is a tracked todo, with no promotion step.
- The default daily overview surfaces upcoming work across all projects and a summary for each active project.

A locally installed agent on her Windows laptop is the proposed initial agent entry point. Where its model processes information is a separate question; a fully offline model is not currently required or ruled out.

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
| Todos | Every document checkbox is a tracked todo for Makena’s own work, with a title, description, status, optional due date, tags, and project context. |
| Projects | Give each project a home for its description, related notes, todos, and current status. |
| Follow-up | Make outstanding and completed actions easy to find across meetings and projects. |
| Daily overview | Open to upcoming work across all projects and a summary for every active project. |
| Tags | Allow free-form string tags on notes, projects, and todos, including spaces and Unicode. |
| Navigation | Provide search and useful project, todo, and tag views. |
| Agent-assisted content | Let Makena use natural language to find, summarize, create, and update workspace content. |
| Agent-assisted customization | Let Makena describe changes to Bento's behavior or appearance and work with an agent to review, try, and adopt them. |
| Appearance | Provide a calm, Notion-inspired interface with installable themes, including the flexibility to express Catppuccin, Darcula, or Tokyo Night styles. |
| Interface customization | Allow layout and interface customization inspired by VS Code, with a useful default experience. The initial depth of extension support remains open. |
| Reliability | Preserve work through saving, reopening, conflicting edits, and unsuccessful agent changes. |
| Accessibility | Support keyboard navigation, visible focus, scalable text, and understandable status beyond color alone. |

The exact editor interaction, storage model, framework, and agent integration are design decisions. These requirements do not select an agent provider or require a particular backend.

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
2. Take meeting notes directly in Bento and format them using familiar page controls.
3. Record decisions and possible next actions without interrupting the writing flow.
4. Return to the note later through the project or search.

A meeting title, date, attendees, and agenda are candidate template fields to validate with Makena, not mandatory metadata for every note.

#### Turn discussion into action

1. Add a checkbox while writing; it immediately becomes a tracked todo. An agent can also propose checkboxes from the discussion.
2. Optionally add project context, a due date, or tags to a todo without interrupting note capture.
3. For agent suggestions, review and correct the proposed details before applying them; manually adding a checkbox needs no separate confirmation.
4. See the same todos in the note, project, and central Todos views; no separate promotion or duplicate entry is required.

Checked boxes are completed todos; unchecked boxes are open work. Changing completion in any view updates the same checkbox. Each nested checkbox is also its own todo. Literal checkbox syntax in code samples is text rather than an interactive checkbox. An existing document’s checkboxes appear as todos when opened, including those already completed.

Todos initially represent Makena’s work. Notes may mention other people, but the first release does not provide assignment or tracking of their work.

An agent must distinguish information recorded in the note from its own suggestions. Missing dates, ownership, or decisions must not become invented facts. The user can retain an action without assigning a due date.

#### Follow through

1. Review open actions for a project or across projects, with optional due-date and tag filters.
2. Open a todo and return to its source meeting for context.
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

All three high-level workflows are product goals. The first usable product should support the complete manual meeting-to-follow-up workflow: project setup, notes taken directly in Bento, automatically tracked checkboxes for personal work, source context, tags, search, a daily overview with active-project summaries, and consistent project/todo views on Windows and macOS. Include a usable default interface and theme switching.

The first agent-assisted slice should propose action items from a selected meeting note, let the user review them, and apply the chosen items with source links and recovery. Next, validate a small agent-assisted application change through the review, trial, and adoption journey above. Agent usability is a product goal, not an assumption that Markdown alone satisfies it.

Defer real-time collaboration, hosted accounts, mobile apps, calendar/email integrations, arbitrary executable plugins, and a general-purpose Notion-style database builder. Do not assume a requirement for Notion import or full Notion feature parity.

## 8. Success and acceptance criteria

Validate these with Makena using representative, non-sensitive meeting material before treating the experience as complete:

- She can create a project, capture a meeting, create linked todos, and find outstanding follow-up without terminal use or knowledge of the file format.
- She can review projects and upcoming or overdue work, then identify what needs attention next.
- She can organize project notes and reference links, then retrieve them through project navigation, search, or tags.
- She can format everyday notes through discoverable controls and reopen them with their content intact.
- Every document checkbox, including existing and nested checkboxes, appears as one tracked todo; completion changes in any view update the source checkbox.
- She can manage her own todos from different views and see one consistent status and source context.
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
- Is an external agent installed on her Windows laptop the preferred initial entry point, with a Bento-integrated experience later? Local execution does not by itself establish local-only model processing.
- What would make reviewing content changes and trying application changes feel understandable to her?
- How much interface customization is useful initially beyond themes, typography, and panel arrangement?
- Is existing content migration, backup, or use across multiple computers needed for her first trial?

Technical decisions and their tradeoffs belong in the [design document](design.md).
