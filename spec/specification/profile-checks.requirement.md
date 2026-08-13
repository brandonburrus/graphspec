---
type: Requirement
title: Profile Checks
description: Filename tokens, required fields, and relations are checked against the profile.
status: implemented
tags: [requirement, profile]
---

# Acceptance Criteria

- A filename token that disagrees with the frontmatter `type` yields a warning.
- A missing or out-of-enum required field yields a warning.
- Unknown relations, invalid source/target types, and unresolved targets yield warnings.
