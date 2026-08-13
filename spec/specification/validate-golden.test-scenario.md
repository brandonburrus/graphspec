---
type: TestScenario
title: Validate Golden Bundle
description: A clean bundle validates with zero errors and warnings.
level: integration
tags: [test]
relations:
  covers:
    - /specification/okf-conformance.requirement.md
    - /architecture/validator.component.md
---

# Given/When/Then

- **Given** a bundle whose concepts all conform to OKF and the graphspec profile,
- **When** `graphspec validate` runs,
- **Then** it reports zero errors and zero warnings and exits 0.
