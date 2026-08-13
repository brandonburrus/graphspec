---
type: Requirement
title: OKF Conformance
description: Every non-reserved markdown file must have parseable frontmatter with a non-empty type.
status: implemented
tags: [requirement, okf]
relations:
  refers-to:
    - /glossary/concept.term.md
---

# Acceptance Criteria

- A concept with no frontmatter block produces an `okf/missing-frontmatter` error.
- A concept whose frontmatter has no non-empty `type` produces an `okf/missing-type` error.
- Unknown types, broken links, and missing optional fields do NOT hard-fail.
