---
title: JavaScript API
description: Load a bundle, build the graph, validate it, and run traversal, ordering, and coverage analysis from JavaScript or TypeScript.
sidebar:
  order: 1
---

Everything the CLI does is available as a library. Install the package and import from it:

```bash
npm install graph-spec-cli
```

```ts
import { loadBundle, Graph, validateBundle, PROFILE } from "graph-spec-cli";
```

The package is **ESM only**. There is no CommonJS build, so `require()` will not work. Types
ship with it.

## The usual flow

```ts
import {
  loadBundle,
  Graph,
  validateBundle,
  selectSubgraph,
  buildOrder,
  analyzeCoverage,
} from "graph-spec-cli";

const bundle = await loadBundle("spec");
const graph = Graph.fromBundle(bundle);

const result = validateBundle(bundle, { strict: true });
console.log(result.errorCount, result.warningCount);

const view = selectSubgraph(graph, {
  from: "architecture/validator.component",
  depth: 1,
});
const { order, cycles } = buildOrder(graph);
const coverage = analyzeCoverage(graph);
```

Parse once, then run every analysis against the same `Graph`. Nothing re-reads the disk.

## Loading

### `loadBundle(root): Promise<Bundle>`

Walks a directory and parses it. Throws if `root` does not exist or is not a directory.

```ts
const bundle = await loadBundle("spec");

bundle.root;      // absolute path
bundle.concepts;  // Concept[]
bundle.reserved;  // ReservedFile[], the index.md and log.md files
bundle.ignored;   // string[], .md paths skipped for having no type token
```

Check `bundle.ignored` when a concept seems missing. A file that lost its type token in a
rename lands there rather than raising an error.

## The graph

### `Graph.fromBundle(bundle): Graph`

Indexes concepts as nodes and materializes typed edges from `relations:`, plus implicit
directory parent to child edges.

```ts
const graph = Graph.fromBundle(bundle);

graph.ids();               // every concept ID
graph.has(id);             // boolean
graph.get(id);             // Concept | undefined
graph.edges();             // every Edge
graph.edgesFrom(id);       // outgoing
graph.edgesTo(id);         // incoming
graph.neighbors(id, kind); // targets of one relation kind
```

Adjacency is indexed in both directions, so reverse traversal costs the same as forward.

An `Edge` carries `from`, `to`, `kind`, `resolved`, and `rawTarget` for relation edges.
**Check `resolved`**: an edge whose target does not exist in the bundle is legal, and walking
it lands on nothing. Structural edges use the kind exported as `CHILD_EDGE`.

## Validation

### `validateBundle(bundle, options?): ValidationResult`

```ts
const result = validateBundle(bundle, { strict: true });

result.diagnostics;   // Diagnostic[], sorted by file, then severity, then rule
result.errorCount;
result.warningCount;
result.conceptCount;
```

A `Diagnostic` has `severity`, `source` (`"okf"` or `"profile"`), `rule`, `file`, `message`,
and an optional `conceptId`. Rule codes are stable, so branching on them is safe.

`checkOkfConformance(concepts)` and `checkProfile(graph, { strict })` run either layer alone.

## Traversal

### `selectSubgraph(graph, selection?): GraphView`

```ts
const view = selectSubgraph(graph, {
  from: "architecture/validator.component",
  depth: 1,
  relations: ["satisfies", "exposes"],
  direction: "out",
  structure: false,
});

view.nodes; // Concept[]
view.edges; // Edge[]
```

With no `from`, returns the whole graph. Every field is optional.

Two behaviours worth knowing. `direction` defaults to `"out"`, so relations that originate
elsewhere (`constrains`, `covers`) need `"in"`. And an edge is included only when both
endpoints are in the node set, so a view is always a self-contained graph.

`from` must be a **concept ID**. The CLI normalizes the `/path.md` reference form before
calling this; if you accept user input, run it through `normalizeRef` first.

Throws `UnknownConceptError` when `from` does not resolve.

### `reachableIds(graph, startId, allowKind, depth?, direction?): Set<string>`

The bare breadth-first walk, when you want IDs rather than a view.

## Ordering

### `buildOrder(graph): { order, cycles }`

```ts
const { order, cycles } = buildOrder(graph);
if (cycles.length > 0) {
  // order holds only the acyclic portion
}
```

Topologically sorts `System` and `Component` concepts by `depends-on`. Always check `cycles`
before trusting `order` as complete.

## Coverage

### `analyzeCoverage(graph): CoverageReport`

```ts
const coverage = analyzeCoverage(graph);

coverage.unsatisfiedRequirements;
coverage.untestedRequirements;
coverage.untestedJourneys;
coverage.emptyFeatures;
coverage.unrealizedFeatures;
coverage.danglingConstraints;
coverage.orphanConcepts;
coverage.unresolvedTargets; // { from, relation, target }[]
coverage.totalGaps;
```

## The profile

`PROFILE` is the single source of truth for the vocabulary, which makes it the right thing to
read if you are building an editor plugin, a linter, or a generator.

```ts
import {
  PROFILE,
  NODE_TYPES,
  RELATIONS,
  nodeTypeByName,
  nodeTypeByToken,
  tokenForType,
  relationByName,
  typeAllowed,
  ANY_TYPE,
} from "graph-spec-cli";

PROFILE.name;              // "graphspec"
PROFILE.okfVersion;        // "0.1"
NODE_TYPES.length;         // 13
RELATIONS.length;          // 16

nodeTypeByName("Requirement")?.requiredFields;
tokenForType("UserJourney");        // "user-journey"
relationByName("covers")?.targetTypes;
```

`typeAllowed(list, type)` handles the `ANY_TYPE` (`"*"`) wildcard used by `affects` and
`refers-to`, so use it rather than comparing arrays yourself.

Also exported: `NODE_TYPE_NAMES`, `NODE_TYPE_TOKENS`, `RELATION_NAMES`, and `DEPENDS_ON`.

## Parsing helpers

For tools that read single files rather than whole bundles:

| Export | Purpose |
| --- | --- |
| `parseConcept(raw, filePath, relPath)` | One markdown file into a `Concept` |
| `parseReserved(raw, filePath, relPath)` | An `index.md` or `log.md` |
| `isReservedFilename(basename)` | Whether a basename is reserved |
| `fileTokenFromName(fileName)` | The `.token` segment, or `undefined` |
| `normalizeRef(ref)` | A raw reference into a concept-ID candidate |
| `parseRelations(value)` | A frontmatter `relations:` value into `RelationRef[]` |
| `extractSections(body)` | H1 sections from a markdown body |
| `sectionHeadings(sections)` | Just the heading names |

`normalizeRef` strips a leading `/`, a trailing `.md`, and any `#` fragment, and resolves `.`
and `..`. Use it instead of writing your own string handling, so your tool accepts exactly
what the CLI accepts.
