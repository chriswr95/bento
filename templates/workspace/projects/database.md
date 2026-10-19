---
bento_version: 1
kind: database-definition
id: db-projects
title: Projects
schema_version: 1
fields:
  - id: field-project-status
    name: Status
    type: status
    default: option-active
    options:
      - {id: option-active, name: Active, group: in-progress}
      - {id: option-completed, name: Completed, group: complete}
      - {id: option-archived, name: Archived, group: complete}
capabilities:
  project:
    active:
      field: field-project-status
      values: [option-active]
---

# Projects

A customizable starter database. Its active-project capability tells the daily overview how to identify active projects; the name “Projects” has no special engine behavior.
