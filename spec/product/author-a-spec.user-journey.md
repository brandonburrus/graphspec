---
type: UserJourney
title: Author a Spec
description: An agent drafts an OKF bundle and validates it against the graphspec profile.
tags: [journey]
relations:
  exercises:
    - /product/validate-a-bundle.feature.md
    - /product/query-concepts.feature.md
  refers-to:
    - /glossary/profile.term.md
---

# Flow

1. Create concept files named `<name>.<type-token>.md` with YAML frontmatter.
2. Declare typed `relations:` between concepts.
3. Run `graphspec validate` and resolve diagnostics.
4. Run `graphspec index` to refresh directory listings.
