# graphspec CLI + traversal reference

Condensed reference for consuming an existing graphspec bundle. Every flag here was run against
this repo's own dogfood bundle (`spec/`) and the output shapes below are real, not assumed.

## Command reference

```text
graphspec validate [path] [--strict] [--json]
graphspec query    [path] [--type <T>] [--tag <t>] [--status <s>] [--json]
graphspec graph    [path] [--format json|mermaid|dot] [--from <concept-id>] [--depth <n>] [--rel <name[,name...]>] [--structure]
graphspec coverage [path] [--json] [--strict]
graphspec order    [path] [--json]
```

- `path` defaults to `.` on every command.
- `graph --format` defaults to `json`: `{ nodes: [{id,type,title}], edges: [{from,to,relation}] }`.
- `graph --from <id>` errors (exit 2) if `<id>` doesn't resolve to a concept in the bundle:
  `error: --from concept not found: <id>`.
- `graph --rel` errors (exit 2) on an unknown relation name.
- `coverage --json` shape: `{ unsatisfiedRequirements, untestedRequirements, untestedJourneys,
  emptyFeatures, unrealizedFeatures, danglingConstraints, orphanConcepts, unresolvedTargets,
  totalGaps }` — each a list of concept IDs (or `{from,relation,target}` for unresolved).
- `order --json` shape: `{ order: string[], cycles: string[][] }` — `order` is a prefix of the
  acyclic portion when `cycles` is non-empty.
- `query --json` returns `{ id, type, title, description, tags, status }` per concept — **it does
  not include `relations`**. To see what a concept relates to/from, use `graph` or read the file.

## The critical gotcha: `--from` only follows OUTGOING edges

`graphspec graph --from <id>` does a breadth-first walk **outward** along edges where `<id>` is
the `from` side. That's correct for relations a Component/System *originates*, but silently
empty for relations that originate somewhere else and merely *target* it:

| Relation | Direction relative to a Component/System | Safe with `--from <component-id>`? |
|---|---|---|
| `depends-on`, `exposes`, `uses`, `realizes`, `contains`, `satisfies` | Outgoing (Component/System is the source) | Yes |
| `constrains` | **Incoming** (Constraint is the source, Component/System is the target) | **No — returns empty** |
| `covers` | **Incoming** (TestScenario is the source, Component/Requirement/UserJourney is the target) | **No — returns empty** |

Verified on this repo's own bundle: `specification/zero-format-awareness.constraint.md` declares
`constrains: [/architecture/graphspec-cli.system.md]`, so the System genuinely *is* constrained
— but `graphspec graph spec/ --from architecture/graphspec-cli.system --rel constrains --depth 1`
returns zero edges, because `--from` never walks backward. The same is true for `covers`.

**To find what constrains or covers a given concept, don't use `--from` on that concept.**
Instead pull the relation bundle-wide (no `--from`) and filter the edges for your target:

```bash
graphspec graph <path> --rel constrains,covers --format json
```

Then, in the returned `edges` array, keep entries where `to` equals your concept's ID; each
`from` is the covering TestScenario or constraining Constraint. This does return every node in
the bundle (only edges are filtered without `--from`), but the edge list itself is small and the
filter is a one-line `to === id` check — still far less reading than opening every file.

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
