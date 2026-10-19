---
bento_version: 1
kind: workspace-definition
id: workspace-template
title: My workspace
databases:
  - {id: db-todos, path: todos}
  - {id: db-projects, path: projects}
  - {id: db-meetings, path: meetings}
default_task_database: db-todos
default_project_database: db-projects
---

# My workspace

Fictional data for exploring Bento. Database locations are declared here; the enclosing database folder determines record membership.
