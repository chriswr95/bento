---
bento_version: 1
kind: workspace-definition
id: example-workspace
title: Example workspace
databases:
  - { id: db-todos, path: todos }
  - { id: db-projects, path: projects }
  - { id: db-meetings, path: meetings }
default_task_database: db-todos
default_project_database: db-projects
organization_version: 3
default_page_folder: notes
---

# Example workspace

Fictional data for exploring Bento. Database folders are registered here. Each contains its schema and records; regular folders contain ordinary notes.
