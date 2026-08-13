---
type: Component
title: Graph Model
description: An in-memory directed graph of concepts with typed and hierarchy edges.
tags: [architecture, component]
relations:
  depends-on:
    - /architecture/parser.component.md
  uses:
    - /architecture/concept.data-model.md
---

# Responsibility

Index concepts as nodes, materialize typed edges from `relations:`, and add implicit
parent/child edges from the directory hierarchy. Built for reuse by traversal and coverage.
