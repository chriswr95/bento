# Document-backed database example

Status: design fixtures, not an implemented workspace format or a production migration.

Read the [data-model walkthrough](../../docs/data-model.md) first. All names and work items here are fictional. The short IDs make references readable; production IDs should be opaque and stable.

## Files

| Layer | Files |
| --- | --- |
| Workspace configuration | [workspace definition](.bento/workspace.md) |
| Database definitions | [Projects](.bento/databases/projects.md), [Todos](.bento/databases/todos.md), [Meeting Notes](.bento/databases/meeting-notes.md) |
| Content records | [project](projects/creekside.md), [meeting](meetings/coordination.md), [todo](todos/todo-review-comments.md), [unclassified note](scratch.md) |

Every content record has zero or one database membership. The project relationship in a meeting or todo is not another membership. A database definition describes fields, while the record frontmatter contains values keyed by stable field IDs. Every record also has a free-form Markdown body.

The meeting's linked checkbox and frontmatter reference baseline illustrate the proposed reconciliation mechanism. They are one reference to the todo document, not a second task. The todo document is authoritative for its title and completion; the example's cached checkbox state is intentionally consistent.

The existing browser prototype does not read these files or implement their schemas. The examples do not establish the final file syntax, migration format, copy/paste semantics, or external-edit conflict UI.

## Fixture validation

Checked the YAML for duplicate keys, unique document/definition IDs, scalar database membership, property types/options, schema versions, relation targets/cardinality, task capability mappings, the default capture database, and agreement between the meeting reference, its relative link, and the todo’s title/completion. This is consistency checking of design fixtures, not application integration evidence.
