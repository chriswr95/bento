---
bento_version: 1
kind: database-definition
id: db-projects
title: Projects
schema_version: 1
fields:
  - id: field-project-status
    name: Status
    type: select
    default: option-active
    options:
      - {id: option-active, name: Active}
      - {id: option-completed, name: Completed}
      - {id: option-archived, name: Archived}
capabilities:
  project:
    active:
      field: field-project-status
      values: [option-active]
---

# Projects

A customizable starter database. Its active-project capability tells the daily overview how to identify active projects; the name “Projects” has no special engine behavior.
