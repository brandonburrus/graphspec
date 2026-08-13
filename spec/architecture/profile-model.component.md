---
type: Component
title: Profile Model
description: The graphspec vocabulary as data — node types and typed relations.
tags: [architecture, component]
relations:
  realizes:
    - /product/validate-a-bundle.feature.md
  refers-to:
    - /glossary/profile.term.md
---

# Responsibility

Be the single source of truth for the 13 node types (tokens, required fields, sections)
and 17 relations (allowed source and target types), imported by the validator and queries.
