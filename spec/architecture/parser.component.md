---
type: Component
title: OKF Parser
description: Walks a directory, parses frontmatter and body, and computes concept IDs.
tags: [architecture, component]
relations:
  realizes:
    - /product/validate-a-bundle.feature.md
  uses:
    - /architecture/concept.data-model.md
  refers-to:
    - /glossary/concept.term.md
---

# Responsibility

Turn a bundle directory into parsed concepts: frontmatter via gray-matter, H1 section
extraction, concept-ID computation, and `relations:` parsing (preserving unknown keys).
