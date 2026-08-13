---
type: Constraint
title: Zero Format Awareness
description: graphspec knows only OKF and the graphspec profile — no other spec format.
category: architecture
tags: [constraint]
relations:
  constrains:
    - /architecture/graphspec-cli.system.md
---

# Rationale

Keeping the tool format-agnostic beyond OKF + the profile prevents coupling to any
external methodology and keeps the graph model reusable.
