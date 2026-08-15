---
type: TestScenario
title: Serve Reloads Without Losing Place
description: Editing a concept while serving updates the graph and keeps the current selection.
level: e2e
tags: [test, visualize]
relations:
  covers:
    - /specification/live-visualization.requirement.md
---

# Given/When/Then

- **Given** `graphspec visualize serve` running against a bundle, with a concept selected
  in an open page,
- **When** a concept file in that bundle is renamed on disk,
- **Then** the new title appears in the page without a reload, and the previously selected
  concept is still selected.
