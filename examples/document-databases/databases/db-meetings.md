---
bento_version: 1
kind: database-definition
id: db-meetings
title: Meeting Notes
schema_version: 1
fields:
  - id: field-meeting-date
    name: Meeting date
    type: date
  - id: field-meeting-projects
    name: Related projects
    type: relation
    target_database: db-projects
    cardinality: many
---

# Meeting Notes

A candidate starter database, not a requirement to classify every note. A meeting may relate to several project records without belonging to several databases.
