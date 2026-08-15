---
title: graph
description: Build the spec graph and emit it as JSON, Mermaid, or DOT, optionally sliced to the subgraph reachable from one concept.
sidebar:
  order: 5
---

```bash
npx graph-spec-cli graph [path] [--format json|mermaid|dot] [--from <concept>]
  [--depth <n>] [--rel <name[,name...]>] [--direction out|in|both] [--structure]
```

Builds the graph and emits it. With no `--from`, emits the whole thing. With `--from`, emits
only the subgraph reachable from that concept.

This is the command that makes scoped reads possible, and the one an agent uses most.

| Flag | Effect |
| --- | --- |
| `--format` | `json` (default), `mermaid`, or `dot` |
| `--from <concept>` | Emit only the subgraph reachable from this concept |
| `--depth <n>` | Limit hops from `--from`. Default unlimited |
| `--rel <names>` | Restrict to these relation types, comma separated |
| `--direction` | `out` (default), `in`, or `both`. Requires `--from` |
| `--structure` | Include implicit directory parent to child edges |

## Slicing to one unit of work

```bash
npx graph-spec-cli graph spec/ --from architecture/validator.component --depth 1
```

`--from` accepts either a bare concept ID or the leading-slash reference form used by
`relations:` targets, so a target copied out of frontmatter can be pasted straight in:

```bash
npx graph-spec-cli graph spec/ --from /architecture/validator.component.md --depth 1
```

Narrow further by relation to get exactly the concepts that bear on building something:

```bash
npx graph-spec-cli graph spec/ --from architecture/validator.component \
  --rel exposes,uses,satisfies --depth 1
```

## Direction

`--direction` decides which way edges are followed. The default `out` follows edges where the
visited node is the source.

Relations that originate elsewhere and merely point at a concept, namely `constrains` and
`covers`, need `--direction in`:

```bash
npx graph-spec-cli graph spec/ --from architecture/validator.component \
  --rel covers --depth 1 --direction in
```

```json
{
  "nodes": [
    { "id": "architecture/validator.component", "type": "Component", "title": "Validator" },
    { "id": "specification/strict-promotion.test-scenario", "type": "TestScenario", "title": "Strict Promotes Warnings" },
    { "id": "specification/validate-golden.test-scenario", "type": "TestScenario", "title": "Validate Golden Bundle" }
  ],
  "edges": [
    { "from": "specification/strict-promotion.test-scenario", "to": "architecture/validator.component", "relation": "covers" },
    { "from": "specification/validate-golden.test-scenario", "to": "architecture/validator.component", "relation": "covers" }
  ]
}
```

Edges keep their original orientation in the output. Walking backward changes what is
reachable, not what the edge means.

:::caution[Empty is not proof of absent]
An empty result with the default direction does not mean nothing constrains or covers the
concept. It usually means the wrong direction. Re-run with `--direction in` before concluding.
:::

Without `--from`, `--direction` has nothing to modify. It is ignored and prints a note to
stderr rather than failing, since the whole graph comes back either way.

## Output formats

**JSON** (default), for programs and agents:

```json
{
  "nodes": [{ "id": "...", "type": "...", "title": "..." }],
  "edges": [{ "from": "...", "to": "...", "relation": "..." }]
}
```

**Mermaid**, for a diagram in a markdown file or a pull request:

```bash
npx graph-spec-cli graph spec/ --format mermaid
```

Emits `graph LR` with aliased node IDs and relation-labeled edges.

**DOT**, for Graphviz:

```bash
npx graph-spec-cli graph spec/ --format dot | dot -Tsvg -o spec.svg
```

## Structural edges

```bash
npx graph-spec-cli graph spec/ --structure
```

Adds implicit directory parent to child edges with the kind `child`. These are not profile
relations and are excluded by default. They follow `--direction` too, so `in` from a child
walks up to its parent.

## Slices are self-contained

An edge is emitted only when **both** endpoints are in the selected node set. A slice is
therefore always a valid graph on its own, and unresolved targets never appear as phantom
nodes. Dangling references are [`coverage`](/cli/coverage/)'s business.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `2` | Unknown format, unknown relation name, bad `--depth`, bad `--direction`, unresolved `--from`, or unreadable bundle |

An unresolved `--from` echoes what you typed:

```text
$ npx graph-spec-cli graph spec/ --from /nope/missing.md
error: --from concept not found: /nope/missing.md
```

## Notes

- `--depth` counts hops, so `--depth 1` is the concept plus its immediate neighbours.
- `--rel` validates names against the vocabulary and exits 2 on an unknown one, rather than
  silently returning nothing.
- Traversal skips unresolved edges, so it never walks into a concept that does not exist.
