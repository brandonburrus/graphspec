---
title: query
description: Filter concepts in a bundle by type, tag, or status, and print them as a table or JSON.
sidebar:
  order: 3
---

```bash
npx graph-spec-cli query [path] [--type <T>] [--tag <t>] [--status <s>] [--json]
```

Filters concepts and prints them. Filters combine with AND.

| Flag | Effect |
| --- | --- |
| `--type <type>` | Exact match on frontmatter `type` |
| `--tag <tag>` | Matches if the tag appears in the `tags` list |
| `--status <status>` | Exact match on frontmatter `status` |
| `--json` | Emit an array of concept records |

## Table output

```text
$ npx graph-spec-cli query spec/ --type Decision
ID                                      TYPE      TITLE
--------------------------------------  --------  ---------------
specification/adopt-okf.decision        Decision  Adopt OKF
specification/profile-as-data.decision  Decision  Profile as Data

2 concept(s).
```

Columns are sized to content and left aligned.

## JSON output

```text
$ npx graph-spec-cli query spec/ --type Requirement --json
```

```json
[
  {
    "id": "specification/concept-filtering.requirement",
    "type": "Requirement",
    "title": "Concept Filtering",
    "description": "Concepts can be filtered by type, tag, and status for querying.",
    "tags": ["requirement", "query"],
    "status": "implemented"
  }
]
```

:::caution[No relations in the output]
`query --json` returns concept fields only. It does **not** include `relations`. To see what a
concept connects to, use [`graph`](/cli/graph/) or read the file.
:::

## Useful queries

Everything still in flight:

```bash
npx graph-spec-cli query spec/ --status proposed
```

Every test scenario, to check what the suite owes:

```bash
npx graph-spec-cli query spec/ --type TestScenario --json
```

Everything in one work area, if you tag by area:

```bash
npx graph-spec-cli query spec/ --tag payments
```

Requirements that claim to be done, which is the list worth auditing against reality:

```bash
npx graph-spec-cli query spec/ --type Requirement --status implemented
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success, including a zero-match result |
| `2` | The bundle could not be read |

An empty result is not an error. If you expected matches and got none, check the filter value
against the actual frontmatter: `--type` and `--status` are exact, case-sensitive matches.

## Notes

- `--type` takes the PascalCase type name (`Requirement`), not the filename token
  (`requirement`).
- A concept missing `title` or `description` shows blank in those columns, which is a decent
  way to spot thin concepts.
