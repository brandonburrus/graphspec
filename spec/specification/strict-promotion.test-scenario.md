---
type: TestScenario
title: Strict Promotes Warnings
description: Under --strict, profile warnings become errors while unresolved targets stay warnings.
level: unit
tags: [test, profile]
relations:
  covers:
    - /specification/strict-mode.requirement.md
    - /architecture/validator.component.md
---

# Given/When/Then

- **Given** a bundle with one filename-token mismatch and one unresolved relation target,
- **When** `graphspec validate --strict` runs,
- **Then** the token mismatch is reported as an error and the process exits non-zero,
- **And** the unresolved target is still reported as a warning, because a target may point at
  a concept that has not been authored yet.
