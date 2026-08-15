# GraphSpec

**GraphSpec** is a CLI and library for spec-driven development: author software specs as a
knowledge graph, then build software by traversing it.

A spec is an [Open Knowledge Format v0.1](https://okf.md/spec) bundle, a directory of markdown
files with YAML frontmatter cross-linked by typed relations. Because the spec is a graph
rather than a document, you can pull just the subgraph for the work in front of you, and find
out mechanically which requirements nothing implements or tests.

**Documentation: [graphspec.dev](https://graphspec.dev)**

The npm package is [`graph-spec-cli`](https://www.npmjs.com/package/graph-spec-cli). The
command it installs is `graphspec`.

## Quickstart

With a coding agent, install the two agent skills:

```bash
npx skills add brandonburrus/graphspec
```

Then ask for what you want: "spec out the checkout flow as a GraphSpec", or "implement the
next component from the spec".

Or use the CLI directly, with no install:

```bash
npx graph-spec-cli validate spec/ --strict
npx graph-spec-cli coverage spec/
npx graph-spec-cli graph spec/ --from architecture/validator.component --depth 1
```

Requires Node.js 20 or newer.

## What a concept looks like

Each file is one concept. Its filename carries its type, and its frontmatter declares typed
edges to other concepts.

```yaml
# specification/checkout.feature.md
---
type: Feature
title: Checkout
relations:
  includes:
    - /specification/payment.requirement.md
    - /specification/tax.requirement.md
---

# Summary

Take payment for a cart and issue a receipt.
```

The vocabulary is closed: 13 node types and 16 relations. See the
[profile reference](https://graphspec.dev/profile/node-types/).

## Commands

| Command | Question it answers |
| --- | --- |
| `validate` | Is this bundle well formed? |
| `query` | Which concepts match these filters? |
| `index` | Regenerate the directory listings and log |
| `graph` | What is connected to this concept? |
| `coverage` | What has the spec not said yet? |
| `order` | What should be built first? |

Full flags, output shapes, and exit codes: [graphspec.dev/cli/overview](https://graphspec.dev/cli/overview/).

## Library

```bash
npm install graph-spec-cli
```

```ts
import { loadBundle, Graph, analyzeCoverage } from "graph-spec-cli";

const graph = Graph.fromBundle(await loadBundle("spec"));
console.log(analyzeCoverage(graph).totalGaps);
```

ESM only. Full surface: [graphspec.dev/library/api](https://graphspec.dev/library/api/).

## Example bundle

[`spec/`](spec/) is GraphSpec specified in GraphSpec, and doubles as the test fixture. It
stays clean:

```bash
npx graph-spec-cli validate spec/ --strict   # 27 concept(s), 0 error(s), 0 warning(s)
npx graph-spec-cli coverage spec/            # 0 gap(s)
```

## Development

```bash
pnpm install
pnpm build       # tsc into dist/
pnpm test        # vitest
pnpm lint        # biome check
pnpm typecheck   # tsc --noEmit

pnpm --filter graphspec-docs dev     # docs site at localhost:4321
```

See [AGENTS.md](AGENTS.md) for architecture and constraints.

## License

MIT, see [LICENSE](LICENSE).
