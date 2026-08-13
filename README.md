# graphspec

**graphspec** is a CLI + library for *spec-driven development*. It lets AI agents (and
humans) author software specifications as a **knowledge graph** and then build software by
traversing that graph.

A graphspec spec is an [Open Knowledge Format (OKF) v0.1](https://okf.md/spec) knowledge
bundle — a directory tree of UTF-8 markdown files, each with YAML frontmatter, cross-linked
into a graph — constrained by the **graphspec profile**. graphspec has zero awareness of
any other spec format; it only knows OKF plus the graphspec profile.

> This is the session-1 foundation: the profile, the OKF parser + in-memory graph model,
> and the `validate`, `query`, and `index` commands. Graph export, coverage, ordering, and
> the authoring/following skills are deferred (see [Roadmap](#roadmap)).

## Installation

```bash
pnpm install
pnpm build
# invoke the built CLI
node dist/cli.js --help
# or link it globally
npm link   # exposes the `graphspec` command
```

Requires Node.js >= 20 and pnpm.

## Concepts

- **Bundle** — a directory of `.md` files forming one spec.
- **Concept** — one non-reserved markdown file: YAML frontmatter + markdown body. Its
  **ID** is the bundle-relative path minus `.md`.
- **Reserved files** — `index.md` (directory listing) and `log.md` (change history) at any
  level; these are not concepts.
- **Relations** — typed edges declared in a concept's frontmatter under `relations:`.

### The graphspec profile

The profile layers a filename convention on OKF: every concept file is named
`<name>.<type-token>.md`, where `<type-token>` is the kebab-case token of the node's type
(e.g. `login.requirement.md`, `auth.system.md`, `checkout.user-journey.md`).

#### Node types (13)

| Layer | Type | Token | Required frontmatter | Conventional sections |
|-------|------|-------|----------------------|-----------------------|
| Product | UserPersona | `user-persona` | — | Goals, Pains |
| Product | UserJourney | `user-journey` | — | Flow |
| Product | Feature | `feature` | — | Summary |
| Architecture | System | `system` | — | Responsibility |
| Architecture | Component | `component` | — | Responsibility |
| Architecture | Integration | `integration` | `direction` (inbound\|outbound\|bidirectional) | Interface |
| Architecture | Contract | `contract` | — | Interface |
| Architecture | DataModel | `data-model` | — | Schema |
| Specification | Requirement | `requirement` | `status` (proposed\|accepted\|implemented\|verified) | Acceptance Criteria |
| Specification | Constraint | `constraint` | `category` (free string) | Rationale |
| Specification | Decision | `decision` | `status` (proposed\|accepted\|superseded) | Context, Decision, Consequences |
| Specification | TestScenario | `test-scenario` | `level` (unit\|integration\|e2e) | Given/When/Then |
| Glossary | Term | `term` | — | — |

#### Relations (16)

Declared in frontmatter as a map of relation name → list of target references. A target is
a bundle-relative path with a leading `/`, with or without `.md`:

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

| Relation | Source → Target |
|----------|-----------------|
| experiences | UserPersona → UserJourney |
| exercises | UserJourney → Feature |
| includes | Feature → Requirement |
| realizes | Component, System → Feature |
| contains | System → Component |
| depends-on | Component → Component, System → System |
| exposes | Component, System → Contract |
| uses | Component → DataModel, Contract |
| connects | Integration → System, Contract |
| satisfies | Component, System → Requirement |
| refines | Requirement → Requirement |
| constrains | Constraint → System, Component, Requirement |
| covers | TestScenario → Requirement, Component, UserJourney |
| supersedes | Decision → Decision |
| affects | Decision → (any type) |
| refers-to | (any type) → Term |

## Validation model

graphspec separates **OKF conformance** (hard errors) from **graphspec profile** checks
(soft warnings, promotable with `--strict`):

- **OKF conformance (errors):** every non-reserved `.md` file has a parseable YAML
  frontmatter block with a non-empty `type`. Unknown types, broken cross-links, and missing
  optional fields never hard-fail — OKF is intentionally permissive.
- **Profile checks (warnings; errors under `--strict`):** filename token matches the
  frontmatter `type`; required fields are present with valid enum values; relation names are
  in the vocabulary; the source type may originate the relation; each resolved target has an
  allowed type. **Unresolved relation targets stay warnings even under `--strict`** (OKF
  tolerates reference-first authoring).

## Usage

### `graphspec validate [path]`

Validate a bundle. Exits non-zero when errors are present.

```bash
graphspec validate spec/
graphspec validate spec/ --strict     # profile warnings become errors
graphspec validate spec/ --json       # machine-readable diagnostics
```

### `graphspec query [path]`

Filter concepts and print a table (or JSON).

```bash
graphspec query spec/ --type Requirement
graphspec query spec/ --status accepted
graphspec query spec/ --tag security --json
```

### `graphspec index [path]`

Regenerate per-directory `index.md` listings (grouped by node type, using each concept's
title + description) and optionally append a dated `log.md` entry.

```bash
graphspec index spec/
graphspec index spec/ --log "Added the payments feature."
graphspec index spec/ --dry-run       # preview without writing
graphspec index spec/ --no-index --log "Note only."
```

### `graphspec graph [path]`

Build the spec graph and emit it as JSON (default), a Mermaid `graph LR` diagram, or a
Graphviz DOT digraph. By default only typed relation edges are emitted; `--structure` adds
the implicit directory parent→child edges.

```bash
graphspec graph spec/                                   # JSON { nodes, edges }
graphspec graph spec/ --format mermaid
graphspec graph spec/ --format dot
graphspec graph spec/ --from architecture/validator.component --depth 1
graphspec graph spec/ --rel depends-on,satisfies        # restrict to relation types
graphspec graph spec/ --structure                        # include parent/child edges
```

`--from <concept-id>` emits only the subgraph reachable from that concept (following typed
relation edges outward), `--depth <n>` limits the number of hops, and an unresolved `--from`
id exits non-zero with a clear error.

### `graphspec coverage [path]`

Report spec-graph completeness against the profile: unsatisfied/untested requirements,
untested journeys, empty/unrealized features, dangling constraints, orphan concepts, and
unresolved relation targets — each with the offending concept ids.

```bash
graphspec coverage spec/
graphspec coverage spec/ --json       # machine-readable report
graphspec coverage spec/ --strict     # exit non-zero when any gap is found (for CI)
```

### `graphspec order [path]`

Print the topological build order of `System` and `Component` concepts derived from their
`depends-on` edges (each node after everything it depends on). Dependency cycles are
reported as an error with a non-zero exit.

```bash
graphspec order spec/
graphspec order spec/ --json          # { order, cycles }
```

## Library API

The package is also importable. The profile is the single source of truth for the
vocabulary; the core exposes the parser and graph model; `validateBundle` runs the checks.

```ts
import { loadBundle, Graph, validateBundle, PROFILE } from "graphspec";

const bundle = await loadBundle("spec");
const graph = Graph.fromBundle(bundle);
const result = validateBundle(bundle, { strict: true });

console.log(result.errorCount, result.warningCount);
console.log(graph.neighbors("architecture/graphspec-cli.system", "contains"));

import { selectSubgraph, buildOrder, analyzeCoverage } from "graphspec";

const view = selectSubgraph(graph, { from: "architecture/validator.component", depth: 1 });
const { order, cycles } = buildOrder(graph);
const coverage = analyzeCoverage(graph);
```

## Example bundle

The [`spec/`](spec/) directory is a dogfooded graphspec specification of graphspec itself.
It validates clean:

```bash
graphspec validate spec/
# 25 concept(s), 0 error(s), 0 warning(s)
```

## Development

```bash
pnpm build       # tsc → dist/
pnpm test        # vitest
pnpm lint        # biome check
pnpm typecheck   # tsc --noEmit
```

## Roadmap

Deferred to later sessions and designed to layer on the existing graph model without a
refactor:

- **Session 3:** the `create-graph-spec` and `follow-graph-spec` skills.

## License

MIT — see [LICENSE](LICENSE).
