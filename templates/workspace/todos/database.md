---
bento_version: 1
kind: database-definition
id: db-todos
title: Todos
schema_version: 1
fields:
  - id: field-task-status
    name: Status
    type: status
    default: option-open
    options:
      - {id: option-open, name: Todo, group: not-started}
      - {id: option-started, name: In progress, group: in-progress}
      - {id: option-done, name: Done, group: complete}
  - id: field-task-due
    name: Due date
    type: date
  - id: field-task-project
    name: Project
    type: relation
    target_database: db-projects
    cardinality: one
  - id: field-task-priority
    name: Priority
    type: select
    options:
      - {id: priority-low, name: Low}
      - {id: priority-medium, name: Medium}
      - {id: priority-high, name: High}
  - id: field-task-effort
    name: Estimated hours
    type: number
    min: 0
capabilities:
  task:
    completion:
      field: field-task-status
      checked: option-done
      unchecked: option-open
    due:
      field: field-task-due
    project:
      field: field-task-project
---

# Todos

Each record has its own Markdown body for notes and supporting context. Renaming Status or Due date preserves field IDs and their capability mappings. Changing those mappings requires validation.
