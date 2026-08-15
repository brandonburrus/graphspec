---
type: TestScenario
title: Profile Violation Warns
description: A filename token disagreeing with the frontmatter type is reported as a warning, not an error.
level: unit
tags: [test, profile]
relations:
  covers:
    - /specification/profile-checks.requirement.md
    - /architecture/profile-model.component.md
---

# Given/When/Then

- **Given** a concept file named `auth.system.md` whose frontmatter `type` is `Component`,
- **When** `graphspec validate` runs without `--strict`,
- **Then** the filename-token mismatch is reported as a warning, the error count stays 0,
  and the process exits 0.
