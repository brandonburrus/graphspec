---
type: Component
title: Validator
description: Runs OKF conformance and graphspec profile checks over the graph.
tags: [architecture, component]
relations:
  depends-on:
    - /architecture/graph-model.component.md
    - /architecture/profile-model.component.md
  satisfies:
    - /specification/okf-conformance.requirement.md
    - /specification/profile-checks.requirement.md
    - /specification/strict-mode.requirement.md
---

# Responsibility

Emit diagnostics: OKF hard errors for missing frontmatter/type, and profile warnings for
filename-token mismatches, invalid fields, and relation violations (strict promotes them).
