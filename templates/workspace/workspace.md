---
bento_version: 1
kind: workspace-definition
id: workspace-template
title: My workspace
databases:
  - { id: db-todos, definition: databases/db-todos.md, default_folder: todos }
  - { id: db-projects, definition: databases/db-projects.md, default_folder: projects }
  - { id: db-meetings, definition: databases/db-meetings.md, default_folder: meetings }
default_task_database: db-todos
default_project_database: db-projects
organization_version: 2
default_page_folder: notes
---

# My workspace

Your notes, projects, and todos live here. Schema locations and creation defaults are declared here; each page’s metadata determines its database membership.
