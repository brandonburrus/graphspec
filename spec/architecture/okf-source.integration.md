---
type: Integration
title: OKF Bundle Source
description: The filesystem directory tree a bundle is read from.
direction: inbound
tags: [architecture, integration]
relations:
  connects:
    - /architecture/graphspec-cli.system.md
---

# Interface

Reads UTF-8 `.md` files from a directory tree, skipping VCS and dependency directories.
