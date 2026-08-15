# graphspec

**graphspec** is a CLI + library for *spec-driven development*. It lets AI agents (and
humans) author software specifications as a **knowledge graph** and then build software by
traversing that graph.

A graphspec spec is an [Open Knowledge Format (OKF) v0.1](https://okf.md/spec) knowledge
bundle — a directory tree of UTF-8 markdown files, each with YAML frontmatter, cross-linked
into a graph — constrained by the **graphspec profile**. graphspec has zero awareness of
any other spec format; it only knows OKF plus the graphspec profile.

> This is the complete graphspec v1: the profile, the OKF parser + in-memory graph model, all
> six CLI commands (`validate`, `query`, `index`, `graph`, `coverage`, `order`), and the
> [`create-graph-spec` and `follow-graph-spec` agent skills](#agent-skills) for authoring and
> implementing from a graphspec bundle.

## Installation

```bash
npm install -g graphspec   # the `graphspec` command
npx graphspec --help       # or run it without installing
npm install graphspec      # as a library dependency
```

Requires Node.js >= 20. The package is ESM-only: import it with `import`, not `require`.

To work on graphspec itself:

```bash
pnpm install
pnpm build
node dist/cli.js --help
```

## Concepts

- **Bundle** — a directory of `.md` files forming one spec.
- **Concept** — one markdown file named `<name>.<type-token>.md`: YAML frontmatter +
  markdown body. Its **ID** is the bundle-relative path minus `.md`.
- **Reserved files** — `index.md` (directory listing) and `log.md` (change history) at any
  level; these are not concepts.
- **Ignored files** — any other `.md` file with no `.<type-token>` segment, such as
  `AGENTS.md` or `README.md`. These are skipped rather than treated as malformed concepts,
  so ordinary docs can live inside a bundle directory. `validate` lists what it skipped, so
  a concept accidentally missing its type token shows up rather than silently disappearing.
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
# 27 concept(s), 0 error(s), 0 warning(s)
```

## Agent Skills

[`skills/`](skills/) has two portable **Agent Skills** — the `SKILL.md` + directory convention
used by Copilot/Claude-style agent runtimes, each a self-contained instructions file plus
supporting reference/example files — for driving graphspec end to end with a coding agent:

- **[`create-graph-spec`](skills/create-graph-spec/SKILL.md)** — author a new graphspec bundle,
  or add concepts to an existing one, from a product/engineering intent (a feature idea, a
  system design, a requirement to capture). Walks filename/frontmatter conventions, wiring
  `relations:`, and iterative `validate` → `--strict` → `index` → `query` verification. An agent
  reaches for this when asked to write, create, or extend a graphspec.
- **[`follow-graph-spec`](skills/follow-graph-spec/SKILL.md)** — implement software from an
  *existing* graphspec bundle by pulling only the subgraph relevant to each unit of work
  (`graph --from <id> --rel ...`) instead of reading the whole bundle, in `order`-derived build
  sequence, porting each unit's covering `TestScenario`s into real tests. An agent reaches for
  this when asked to implement or build from a graphspec bundle.

Both are written in the plain, portable `SKILL.md` convention (YAML frontmatter with `name` +
a trigger-phrase `description`, an imperative body, optional `references/` and worked
`EXAMPLE.md` files) with no dependency on any specific agent runtime. To use them, point your
agent tool's skills directory at (or copy/symlink into it) `skills/create-graph-spec` and
`skills/follow-graph-spec` — consult your agent runtime's docs for where that directory lives.

## Development

```bash
pnpm build       # tsc → dist/
pnpm test        # vitest
pnpm lint        # biome check
pnpm typecheck   # tsc --noEmit
```

## License

MIT — see [LICENSE](LICENSE).
