---
title: Relations and the graph
description: How typed edges are declared, how targets resolve, why direction matters when traversing, and what unresolved targets mean.
sidebar:
  order: 2
---

Relations are the typed edges that make a bundle a graph. They are declared in frontmatter
under `relations:`, as a map of relation name to a list of target references.

```yaml
---
type: Feature
title: Checkout
relations:
  includes:
    - /specification/payment.requirement.md
    - /specification/tax.requirement.md
---
```

Prose markdown links in the body are fine for human narrative, but they are not edges. A
concept participates in the graph only through its frontmatter.

## Target references

A target is a bundle-relative path with a leading `/`. The `.md` suffix is optional, and both
forms resolve to the same concept:

```yaml
- /architecture/parser.component.md
- /architecture/parser.component
```

The same two forms work for `graph --from`, so a target copied out of a frontmatter block can
be pasted straight into a traversal command.

## Every relation is one way

An edge exists only on the side that declares it. Declaring `constrains` in a Constraint's
frontmatter creates nothing in the target's file. The target does not know it is constrained.

This has a direct consequence for traversal, and it is the single most common point of
confusion.

## Direction

`graph --from <id>` walks breadth first from a concept. `--direction` controls which way it
follows edges at each node:

| Value | Follows | Use for |
| --- | --- | --- |
| `out` (default) | Edges where the visited node is the source | Relations a concept originates: `satisfies`, `depends-on`, `exposes`, `uses` |
| `in` | Edges where the visited node is the target | Relations that originate elsewhere and point at it: `constrains`, `covers` |
| `both` | Either direction | Full neighbourhood |

So asking what constrains a component with the default direction returns nothing, because the
Constraint owns that edge:

```text
$ npx graph-spec-cli graph spec/ --from architecture/graphspec-cli.system --rel constrains --depth 1
{
  "nodes": [
    { "id": "architecture/graphspec-cli.system", "type": "System", "title": "graphspec CLI" }
  ],
  "edges": []
}
```

Adding `--direction in` walks the same edge backward and finds it:

```text
$ npx graph-spec-cli graph spec/ --from architecture/graphspec-cli.system --rel constrains --depth 1 --direction in
{
  "nodes": [
    { "id": "architecture/graphspec-cli.system", "type": "System", "title": "graphspec CLI" },
    { "id": "specification/zero-format-awareness.constraint", "type": "Constraint", "title": "Zero Format Awareness" }
  ],
  "edges": [
    { "from": "specification/zero-format-awareness.constraint", "to": "architecture/graphspec-cli.system", "relation": "constrains" }
  ]
}
```

Note the edge keeps its original orientation in the output. Walking backward changes what is
reachable, not what the edge means.

### Which direction a relation needs

| Relation | Relative to a Component or System | Direction needed |
| --- | --- | --- |
| `depends-on`, `exposes`, `uses`, `realizes`, `contains`, `satisfies` | Outgoing | `out` (default) |
| `constrains` | Incoming, the Constraint is the source | `in` |
| `covers` | Incoming, the TestScenario is the source | `in` |

An empty result under the default direction is a common false negative. If you expected
constraints or tests and got none, re-run with `--direction in` before concluding there are
none.

## Unresolved targets

A relation may point at a concept that does not exist yet. This is legal and intentional:
OKF supports reference-first authoring, where you write the link and fill in the target later.

An unresolved target is a **warning**, and it stays a warning even under `--strict`. It is the
one profile check that never promotes to an error. See
[Validation](/concepts/validation/#the-one-exception).

Traversal skips unresolved edges, so a dangling reference never produces a phantom node.
[`coverage`](/cli/coverage/) reports them under `unresolvedTargets`, which is where to look
when you want the list.

## Structural edges

Directory nesting creates implicit parent to child edges with the kind `child`. They are not
profile relations, are excluded from `graph` by default, and are included with `--structure`.
They obey `--direction` the same way: parent to child is `out`.

## Self-contained results

`graph` emits an edge only when both of its endpoints are in the selected node set. A slice is
therefore always a valid graph on its own, with no edges pointing into nothing.

## The full vocabulary

All 16 relations with their allowed source and target types are in
[Relations reference](/profile/relations/). The vocabulary is closed: an unknown relation name
is a warning, and so is using one between types it was not defined for.
