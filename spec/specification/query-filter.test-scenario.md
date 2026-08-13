---
type: TestScenario
title: Query Filter By Type
description: Filtering by type returns only concepts of that type.
level: unit
tags: [test]
relations:
  covers:
    - /specification/concept-filtering.requirement.md
    - /product/author-a-spec.user-journey.md
---

# Given/When/Then

- **Given** a bundle with concepts of several types,
- **When** `graphspec query --type Requirement` runs,
- **Then** only Requirement concepts appear in the output.
