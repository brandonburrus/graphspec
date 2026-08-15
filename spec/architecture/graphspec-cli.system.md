---
type: System
title: graphspec CLI
description: The command-line tool and library that validates, queries, and indexes bundles.
tags: [architecture, system]
relations:
  contains:
    - /architecture/parser.component.md
    - /architecture/graph-model.component.md
    - /architecture/validator.component.md
    - /architecture/profile-model.component.md
    - /architecture/visualizer.component.md
  realizes:
    - /product/validate-a-bundle.feature.md
    - /product/query-concepts.feature.md
    - /product/visualize-the-graph.feature.md
  exposes:
    - /architecture/cli-contract.contract.md
  satisfies:
    - /specification/okf-conformance.requirement.md
    - /specification/concept-filtering.requirement.md
  refers-to:
    - /glossary/knowledge-bundle.term.md
---

# Responsibility

Own the end-to-end flow: load a bundle from disk, build the graph, run validation, and
serve the `validate`, `query`, and `index` subcommands.
