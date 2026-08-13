---
type: Feature
title: Validate a Bundle
description: Check a bundle for OKF conformance and graphspec profile adherence.
tags: [feature, validation]
relations:
  includes:
    - /specification/okf-conformance.requirement.md
    - /specification/profile-checks.requirement.md
    - /specification/strict-mode.requirement.md
---

# Summary

`graphspec validate` reports OKF conformance failures as hard errors and graphspec
profile violations as warnings, promoted to errors under `--strict`.
