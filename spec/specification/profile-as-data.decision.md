---
type: Decision
title: Profile as Data
description: Express the graphspec vocabulary as a typed data module, not scattered logic.
status: accepted
tags: [decision]
relations:
  affects:
    - /architecture/profile-model.component.md
---

# Context

The validator, queries, and future traversal/coverage all need the same vocabulary.

# Decision

Encode node types and relations as a single importable profile module.

# Consequences

Sessions 2 and 3 import the profile as the single source of truth without redefining it.
