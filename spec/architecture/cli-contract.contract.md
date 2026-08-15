---
type: Contract
title: CLI Contract
description: "The command-line interface surface: validate, query, index, graph, coverage, order, and visualize subcommands."
tags: [architecture, contract]
---

# Interface

- `graphspec validate [path] [--strict] [--json]`
- `graphspec query [path] [--type] [--tag] [--status] [--json]`
- `graphspec index [path] [--log <msg>] [--no-index] [--dry-run]`
- `graphspec graph [path] [--format json|mermaid|dot] [--from <id>] [--depth <n>] [--rel <names>] [--structure]`
- `graphspec coverage [path] [--json] [--strict]`
- `graphspec order [path] [--json]`
- `graphspec visualize [path] [--out <file>] [--title <text>] [--open]`
- `graphspec visualize serve [path] [--port <n>] [--title <text>] [--no-open]`
