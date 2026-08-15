# src/core — OKF parsing and the graph model

Turns a directory of markdown into parsed concepts, indexes them as a directed graph, and
provides the graph algorithms the commands render. Knows the profile's *shape* but holds no
command-specific logic, so traversal, ordering, and coverage all layer on one model.

## Modules

| File | Role |
|------|------|
| `types.ts` | `Concept`, `Bundle`, `RelationRef`, `ReservedFile`. |
| `refs.ts` | `normalizeRef`: raw reference → concept-ID candidate. |
| `sections.ts` | H1 body-section extraction. |
| `parser.ts` | One file → one `Concept`, or recognize a reserved file. |
| `bundle.ts` | Walk a directory tree into a `Bundle`. |
| `graph.ts` | `Graph`: nodes, typed edges, structural edges. |
| `traverse.ts` | `selectSubgraph` / `reachableIds`, bounded and directional. |
| `order.ts` | Topological build order over `depends-on`. |
| `coverage.ts` | Gap analysis against the profile. |

## Invariants and gotchas

- **A concept ID is the bundle-relative path minus `.md`**, always POSIX-separated even on
  Windows (`bundle.ts` converts). Anything comparing IDs to paths must normalize first.
- **`index.md` and `log.md` are reserved at every level and are not concepts.** They never
  appear as graph nodes. Code that counts concepts must not count them.
- **Edges may not resolve.** `Edge.resolved` is false when `to` names no existing concept.
  This is legal (reference-first authoring), so every traversal must skip unresolved edges
  or it will walk into nodes that do not exist.
- **`selectSubgraph` emits an edge only when both endpoints survived node selection**, so a
  view is always self-contained. Dangling references are a coverage concern, not a graph one.
- Adjacency is stored both forward and reverse, which is what makes `--direction in|both`
  cheap. Keep both indexes in sync when adding edge kinds.
- Structural parent→child edges use the `CHILD_EDGE` (`"child"`) kind and are opt-in
  (`structure: true`). They are not profile relations and must not be validated as such.
- Parsing is defensive by design: malformed YAML yields a `frontmatterError` on the concept
  instead of throwing, so one bad file cannot abort a whole-bundle operation.
- `normalizeRef` resolves `.`/`..` and strips a leading `/`, a trailing `.md`, and any `#`
  fragment. It is the right place to widen accepted reference syntax; callers should not
  hand-roll their own string munging.
- `IGNORED_DIRS` in `bundle.ts` skips `.git`, `node_modules`, `dist`, `.vscode`. A bundle
  nested under one of those names is invisible to the walker.
