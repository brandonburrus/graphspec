---
type: Requirement
title: Concept Filtering
description: Concepts can be filtered by type, tag, and status for querying.
status: implemented
tags: [requirement, query]
---

# Acceptance Criteria

- `--type` matches the frontmatter `type` exactly.
- `--tag` matches any entry in the `tags` list.
- `--status` matches the frontmatter `status` exactly.
