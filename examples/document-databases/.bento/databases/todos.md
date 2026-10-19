---
bento_version: 1
kind: database-definition
id: db-todos
title: Todos
schema_version: 1
fields:
  - id: field-task-status
    name: Status
    type: select
    default: option-open
    options:
      - {id: option-open, name: Open}
      - {id: option-done, name: Done}
  - id: field-task-due
    name: Due date
    type: date
  - id: field-task-project
    name: Project
    type: relation
    target_database: db-projects
    cardinality: one
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
