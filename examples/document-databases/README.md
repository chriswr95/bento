# Example Bento workspace

This folder can be opened by the desktop app. Its records are fictional. Copy it before experimenting if you want to preserve the checked-in fixture.

- [workspace.md](workspace.md) registers database folders and default selections.
- [Todos schema](todos/database.md) defines grouped Status, Date, Relation, Select and Number fields and task capabilities.
- [Projects schema](projects/database.md) identifies active project statuses.
- [Meeting Notes schema](meetings/database.md) has a meeting date and a many-project relation.
- [Meeting](meetings/meeting-coordination.md), [todo](todos/todo-review-comments.md), and [project](projects/project-creekside.md) are separate records with their own bodies.
- [Scratch notes](note-scratch.md) and this README are ordinary Markdown documents without database membership.

The source checkbox is an ordinary relative link to the todo. Its metadata keeps a reconciliation checkpoint keyed by the todo ID. There is no separate occurrence ID. The enclosing registered folder determines membership; record metadata does not repeat it.

Schemas are loaded from these files. The schema editor and transfer/conversion UI are not implemented. In-app page moves repair Markdown links. See the [data-model contract](../../docs/data-model.md) for validation and recovery behavior.
