---
type: Decision
title: Adopt OKF
description: Base graphspec bundles on the Open Knowledge Format v0.1.
status: accepted
tags: [decision]
relations:
  affects:
    - /architecture/graphspec-cli.system.md
  refers-to:
    - /glossary/knowledge-bundle.term.md
---

# Context

We need a portable, human- and agent-readable substrate for specs that is diffable in
version control.

# Decision

Adopt OKF v0.1 as the bundle format and constrain it with a named graphspec profile.

# Consequences

We inherit OKF's permissive conformance model; graphspec-specific rules must be layered as
soft profile checks rather than OKF errors.
