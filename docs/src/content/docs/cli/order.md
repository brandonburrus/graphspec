---
title: order
description: Print the topological build order of systems and components derived from their depends-on edges, and detect dependency cycles.
sidebar:
  order: 7
---

```bash
npx graph-spec-cli order [path] [--json]
```

Topologically sorts `System` and `Component` concepts by their `depends-on` edges, so each
node comes after everything it depends on. A dependency cycle is an error.

| Flag | Effect |
| --- | --- |
| `--json` | Emit `{ order, cycles }` |

## Output

```text
$ npx graph-spec-cli order spec/
1. architecture/graphspec-cli.system
2. architecture/parser.component
3. architecture/graph-model.component
4. architecture/profile-model.component
5. architecture/validator.component

5 node(s).
```

Read it as a build sequence. Here `validator.component` is last because it `depends-on` both
`graph-model.component` and `profile-model.component`, so neither can be stubbed away.

## Only architecture nodes

`order` considers `System` and `Component` concepts only, because `depends-on` is defined
between those types. Requirements, features, and test scenarios are not sequenced: they attach
to the units in this list through `satisfies`, `realizes`, and `covers`.

## Cycles

A dependency cycle means the spec describes something unbuildable, so it exits non-zero rather
than emitting a partial order silently:

```json
{
  "order": ["architecture/parser.component"],
  "cycles": [["architecture/a.component", "architecture/b.component"]]
}
```

`order` holds the acyclic portion that could be sequenced, and `cycles` lists each cycle's
members. Break the cycle by introducing a Contract that both sides depend on, or by moving the
shared piece into its own component.

## Using it with graph

`order` says what to build next; [`graph`](/cli/graph/) says what that unit of work involves:

```bash
npx graph-spec-cli order spec/
npx graph-spec-cli graph spec/ --from architecture/parser.component \
  --rel exposes,uses,satisfies --depth 1
npx graph-spec-cli graph spec/ --from architecture/parser.component \
  --rel covers --direction in --depth 1
```

That is the loop the [`follow-graph-spec`](/guides/agent-skills/) skill runs: order, then
slice, then port the covering scenarios into tests.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success, no cycles |
| `1` | A dependency cycle was found |
| `2` | The bundle could not be read |

## Notes

- Ordering among independent nodes is stable across runs, so the output is diffable.
- A bundle with no `depends-on` edges returns every system and component in a stable order,
  which is correct: nothing constrains the sequence.
