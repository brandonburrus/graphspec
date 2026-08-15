---
type: Feature
title: Visualize the Graph
description: Render a bundle as a self-contained, interactive HTML graph that can be navigated, searched, and inspected offline.
tags: [feature, visualize]
relations:
  includes:
    - /specification/self-contained-visualization.requirement.md
    - /specification/live-visualization.requirement.md
---

# Summary

`graphspec visualize` writes one HTML file holding the whole bundle: a force-directed graph
of every concept and relation, a search and filter rail, and an inspector showing a concept's
frontmatter, body, relations, diagnostics, and coverage gaps. `graphspec visualize serve`
serves the same view and hot-reloads it while a spec is being authored.
