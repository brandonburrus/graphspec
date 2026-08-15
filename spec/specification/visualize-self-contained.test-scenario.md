---
type: TestScenario
title: Visualization Loads Offline
description: A generated visualization opened from the filesystem renders and makes no network requests.
level: e2e
tags: [test, visualize]
relations:
  covers:
    - /specification/self-contained-visualization.requirement.md
    - /architecture/visualizer.component.md
---

# Given/When/Then

- **Given** a bundle rendered by `graphspec visualize --out graph.html`,
- **When** the file is opened over `file://` in a browser,
- **Then** the graph, the concept list, and the legend render, and the page issues no
  network request of any kind.
