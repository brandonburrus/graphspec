# graphspec CLI + traversal reference

Condensed reference for consuming an existing graphspec bundle. Every flag here was run against
this repo's own dogfood bundle (`spec/`) and the output shapes below are real, not assumed.

## Command reference

```text
graphspec validate [path] [--strict] [--json]
graphspec query    [path] [--type <T>] [--tag <t>] [--status <s>] [--json]
graphspec graph    [path] [--format json|mermaid|dot] [--from <concept-id>] [--depth <n>] [--rel <name[,name...]>] [--direction out|in|both] [--structure]
graphspec coverage [path] [--json] [--strict]
graphspec order    [path] [--json]
```

- `path` defaults to `.` on every command.
- `graph --format` defaults to `json`: `{ nodes: [{id,type,title}], edges: [{from,to,relation}] }`.
- `graph --from <id>` errors (exit 2) if `<id>` doesn't resolve to a concept in the bundle:
  `error: --from concept not found: <id>`.
- `graph --rel` errors (exit 2) on an unknown relation name.
- `graph --direction` accepts `out` (default), `in`, or `both`; any other value errors (exit 2):
  `error: --direction must be one of out, in, both (got '<value>')`. It only affects traversal
  when `--from` is given — without `--from` it's a no-op and prints a stderr note
  (`note: --direction is ignored without --from`), since the whole graph is emitted either way.
- `coverage --json` shape: `{ unsatisfiedRequirements, untestedRequirements, untestedJourneys,
  emptyFeatures, unrealizedFeatures, danglingConstraints, orphanConcepts, unresolvedTargets,
  totalGaps }` — each a list of concept IDs (or `{from,relation,target}` for unresolved).
- `order --json` shape: `{ order: string[], cycles: string[][] }` — `order` is a prefix of the
  acyclic portion when `cycles` is non-empty.
- `query --json` returns `{ id, type, title, description, tags, status }` per concept — **it does
  not include `relations`**. To see what a concept relates to/from, use `graph` or read the file.

## Traversal direction: `--from` + `--direction`

`graphspec graph --from <id>` does a breadth-first walk bounded by `--depth`, and `--direction`
controls which way it follows edges at each visited node (default `out`, preserving the
historical behavior):

- `out` — follow edges where the visited node is the `from` side. Correct for relations a
  Component/System *originates*, e.g. `satisfies`, `depends-on`.
- `in` — follow edges where the visited node is the `to` side (reverse). Necessary for relations
  that originate elsewhere and merely *target* the concept, e.g. `constrains`, `covers`.
- `both` — follow edges either way from each visited node.

`--structure` edges (implicit directory parent→child containment) follow the same `--direction`
semantics: parent→child is `out` (the direction the edge is stored in), so `--direction in` from
a child walks back up to its structural parent.

| Relation | Direction relative to a Component/System | `--direction` needed with `--from <component-id>` |
|---|---|---|
| `depends-on`, `exposes`, `uses`, `realizes`, `contains`, `satisfies` | Outgoing (Component/System is the source) | `out` (default) |
| `constrains` | **Incoming** (Constraint is the source, Component/System is the target) | `in` |
| `covers` | **Incoming** (TestScenario is the source, Component/Requirement/UserJourney is the target) | `in` |

Verified on this repo's own bundle: `specification/zero-format-awareness.constraint.md` declares
`constrains: [/architecture/graphspec-cli.system.md]`, so the System genuinely *is* constrained.
The default `--direction out` still returns zero edges here, because the Constraint — not the
System — is the `from` side:

```text
$ graphspec graph spec/ --from architecture/graphspec-cli.system --rel constrains --depth 1
{
  "nodes": [
    { "id": "architecture/graphspec-cli.system", "type": "System", "title": "graphspec CLI" }
  ],
  "edges": []
}
```

Adding `--direction in` walks the same edge backward and finds it:

```text
$ graphspec graph spec/ --from architecture/graphspec-cli.system --rel constrains --depth 1 --direction in
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

The same applies to `covers`: pull `--from <id> --rel covers --direction in --depth 1` to find
the TestScenarios that cover a given concept.

*(Earlier versions of this skill had no `--direction` flag and worked around the missing edges by
fetching `--rel constrains,covers` bundle-wide with no `--from`, then filtering the returned edges
for `to === <id>` by hand. That still works — `graph` with no `--from` always emits the whole
graph — but `--direction in` is the direct way to ask "what constrains/covers this concept?" now.)*

## Full relation table (source → target)

| Relation | Source → Target |
|---|---|
| `experiences` | UserPersona → UserJourney |
| `exercises` | UserJourney → Feature |
| `includes` | Feature → Requirement |
| `realizes` | Component, System → Feature |
| `contains` | System → Component |
| `depends-on` | Component → Component, System → System |
| `exposes` | Component, System → Contract |
| `uses` | Component → DataModel, Contract |
| `connects` | Integration → System, Contract |
| `satisfies` | Component, System → Requirement |
| `refines` | Requirement → Requirement |
| `constrains` | Constraint → System, Component, Requirement |
| `covers` | TestScenario → Requirement, Component, UserJourney |
| `supersedes` | Decision → Decision |
| `affects` | Decision → (any type) |
| `refers-to` | (any type) → Term |

## `order`'s algorithm, briefly

`graphspec order` is a topological sort (Kahn's algorithm) over `System`/`Component` concepts'
`depends-on` edges only, alphabetical tie-break for determinism. `order` only looks at
`depends-on` — a System that `contains` every Component in the bundle but has no `depends-on`
edge of its own is just as "no dependencies" as any leaf Component, so it sorts into the ready
set alongside them and the two tie-break alphabetically by ID. Don't read build-order meaning
into `contains`/`realizes`/other relations; only `depends-on` drives this command. Cycles are
reported as `cycles: string[][]` (one representative path per cycle) and make the exit code
non-zero; `order` in that case is only the acyclic prefix.
