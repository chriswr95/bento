# Bento

A workspace for Markdown notes, projects, and todos, inspired by Obsidian and Notion.

Bento starts with a civil engineer’s meeting-to-follow-up workflow: capture notes, turn discussion into action, and keep project context close. Familiar editing and approachable agent assistance are central to the experience.

Bento aims to combine portable files with a calm, Notion-inspired interface and a customizable theme system.

## Status

Planning, with an interactive workflow prototype. There is no desktop application implementation yet.

- [Product specification](docs/spec.md): audience, workflows, features, and success criteria.
- [Design document](docs/design.md): implementation proposals, tradeoffs, and technical decisions.
- [Data-model walkthrough](docs/data-model.md): proposed database definitions, record documents, and checkbox references.

## Initial direction

- Windows and macOS desktop support.
- Markdown files that remain useful outside Bento.
- A Markdown document for every content record, including projects and todos.
- User-managed database schemas, with Projects and Todos as customizable defaults.
- Zero or one database membership per document, independent of views and relationships.
- Free-form tags.
- Integrated document, project, and task views.
- Configurable layouts and installable themes.
- Agent assistance for workspace content and for changing Bento itself.

## Try the workflow prototype

Open [`prototype/index.html`](prototype/index.html) in a modern browser; no install, build, account, or server is needed. Download or clone the repository first, since GitHub displays the source instead of running it.

Keep the `prototype/` directory together when opening the page; its Markdown parser is bundled for offline use.

The prototype uses fictional projects and a fixed sample date of October 19, 2026. It demonstrates daily review, active-project summaries, meeting-note editing, checkbox capture, shared completion state, one-step undo, and personalized greetings through local profile settings. Workspace documents and personal profile settings persist separately in this browser where local storage is available. The prototype reports session-only operation if browser storage is unavailable.

Agent suggestions are explicitly simulated. Typing a checkbox creates a separately editable todo document and replaces the checkbox with a stable reference. Click a todo title to open its Markdown body and properties; completion stays consistent across the note, todo, and overview. Download Markdown exports the current document with frontmatter. The browser prototype stores document envelopes and bodies in a local snapshot; it does not yet open a desktop workspace folder, import Markdown files, provide schema-management controls, connect to an agent, or implement Copilot integration.

## Development

The application framework and build tooling have not been selected. Next steps are to connect the record model to workspace files, add database/schema controls, and select the desktop shell and editor through a Windows/macOS prototype.
