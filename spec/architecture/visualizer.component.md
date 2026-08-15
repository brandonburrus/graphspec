---
type: Component
title: Visualizer
description: Folds a bundle, its diagnostics, and its coverage report into one self-contained HTML page.
tags: [architecture, component]
relations:
  depends-on:
    - /architecture/graph-model.component.md
    - /architecture/validator.component.md
  realizes:
    - /product/visualize-the-graph.feature.md
  satisfies:
    - /specification/self-contained-visualization.requirement.md
    - /specification/live-visualization.requirement.md
  refers-to:
    - /glossary/knowledge-bundle.term.md
---

# Responsibility

Build the viewer payload (nodes, edges, the profile vocabulary, diagnostics, coverage) and
inline it together with the bundled browser viewer into a single HTML document. Serving that
document live and rebuilding it on change is the same pipeline with a file watcher in front.
