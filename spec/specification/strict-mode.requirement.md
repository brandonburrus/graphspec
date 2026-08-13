---
type: Requirement
title: Strict Mode
description: The --strict flag promotes profile warnings to errors, except unresolved targets.
status: accepted
tags: [requirement, profile]
relations:
  refines:
    - /specification/profile-checks.requirement.md
---

# Acceptance Criteria

- With `--strict`, profile warnings become errors and the process exits non-zero.
- Unresolved relation targets remain warnings even under `--strict`.
