---
type: DataModel
title: Concept Record
description: The parsed representation of one concept document.
tags: [architecture, data-model]
---

# Schema

| Field       | Type              | Description                              |
|-------------|-------------------|------------------------------------------|
| `id`        | string            | Bundle-relative path minus `.md`.        |
| `type`      | string            | Frontmatter `type` value.                |
| `title`     | string?           | Optional display title.                  |
| `tags`      | string[]          | Normalized tag list.                     |
| `relations` | RelationRef[]     | Typed edges parsed from `relations:`.    |
| `sections`  | Section[]         | Extracted H1 body sections.              |
