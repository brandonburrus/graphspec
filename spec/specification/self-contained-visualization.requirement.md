---
type: Requirement
title: Self-Contained Visualization
description: The generated visualization is a single HTML file that works with no network access.
status: implemented
tags: [requirement, visualize]
---

# Acceptance Criteria

- `graphspec visualize` writes exactly one file; no sidecar assets are produced.
- The document references no external resource: no script `src`, no stylesheet `link`, no
  remote font or image.
- Opening it over `file://` renders the graph and issues zero network requests.
- Concept bodies, frontmatter, diagnostics, and coverage gaps are embedded, so the file can
  be read without the bundle it came from.
