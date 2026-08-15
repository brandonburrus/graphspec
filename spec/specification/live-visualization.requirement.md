---
type: Requirement
title: Live Visualization
description: Serving the visualization reflects bundle edits without discarding the reader's place in the graph.
status: implemented
tags: [requirement, visualize]
---

# Acceptance Criteria

- `graphspec visualize serve` serves the page, the payload as JSON, and a reload event stream.
- Changing any `.md` file under the bundle rebuilds the payload and notifies open pages.
- The page swaps the new payload into the running graph rather than navigating, so the
  camera position, filters, selection, and parked nodes survive the edit.
- A rebuild that fails, such as a half-saved file, keeps serving the last good payload.
