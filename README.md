# Bento

A workspace for Markdown notes, projects, and todos, inspired by Obsidian and Notion.

Bento starts with a civil engineer’s meeting-to-follow-up workflow: capture notes, turn discussion into action, and keep project context close. Familiar editing and approachable agent assistance are central to the experience.

Bento aims to combine portable files with a calm, Notion-inspired interface and a customizable theme system.

## Status

Planning, with an interactive workflow prototype. There is no desktop application implementation yet.

- [Product specification](docs/spec.md): audience, workflows, features, and success criteria.
- [Design document](docs/design.md): implementation proposals, tradeoffs, and technical decisions.

## Initial direction

- Windows and macOS desktop support.
- Markdown files that remain useful outside Bento.
- First-class projects, todos, and free-form tags.
- Integrated document, project, and task views.
- Configurable layouts and installable themes.
- Agent assistance for workspace content and for changing Bento itself.

## Try the workflow prototype

Open [`prototype/index.html`](prototype/index.html) in a modern browser; no install, build, account, or server is needed. Download or clone the repository first, since GitHub displays the source instead of running it.

Keep the `prototype/` directory together when opening the page; its Markdown parser is bundled for offline use.

The prototype uses fictional projects and a fixed sample date of October 19, 2026. It demonstrates daily review, active-project summaries, meeting-note editing, checkbox capture, shared completion state, one-step undo, and personalized greetings through local profile settings. Document changes last only for the current page session; refreshing restores the sample workspace. Personal profile settings persist in this browser where local storage is available.

Agent suggestions are explicitly simulated. The meeting note is one Markdown document: typing a checkbox creates a tracked todo, and changing completion from the overview updates its source. It does not read or write actual workspace files, connect to an agent, or implement Copilot integration. The production editor remains a design decision.

## Development

The application framework and build tooling have not been selected. The next step is to validate the meeting-to-follow-up workflow, then prototype the editor, file safety, and theme model on both platforms.
