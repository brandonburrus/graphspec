# graphspec

A CLI + library for spec-driven development: software specs are authored as an
[OKF v0.1](https://okf.md/spec) knowledge bundle (a directory of markdown files with YAML
frontmatter, cross-linked into a graph), and software is built by traversing that graph.

The audience is AI coding agents as much as humans. `skills/` ships two portable Agent
Skills (`create-graph-spec`, `follow-graph-spec`) so an agent can author a bundle and then
implement from it by pulling only the relevant subgraph per unit of work.

## Critical constraints

These are load-bearing. Violating one silently breaks the product thesis.

- **Zero format awareness.** graphspec knows OKF plus the graphspec profile and nothing
  else. Never add awareness of another spec format, tool, or framework.
- **OKF is permissive; the profile is opinionated.** OKF conformance failures are hard
  errors and there are only two: a missing or unparseable frontmatter block, and a missing
  or empty `type`. Everything else OKF explicitly tolerates (unknown types, missing optional
  fields, unknown frontmatter keys, broken cross-links) and MUST NOT be an error. Profile
  violations are warnings.
- **Unresolved relation targets stay warnings even under `--strict`.** This is deliberate,
  not an oversight: OKF supports reference-first authoring, where you link a concept before
  you write it. `--strict` promotes every other profile warning to an error. If you are
  "fixing" this, you are breaking an intended workflow.
- **The profile is data, not logic.** `src/profile/` is the single source of truth for the
  13 node types and 16 relations. Adding vocabulary means editing that data, never adding
  branches in the validator or commands.

## Structure

| Path | What it is |
|------|------------|
| `src/profile/` | The graphspec vocabulary as data. See `src/profile/AGENTS.md`. |
| `src/core/` | OKF parsing, the in-memory graph, traversal, order, coverage. See `src/core/AGENTS.md`. |
| `src/validate/` | OKF conformance + profile checks producing diagnostics. See `src/validate/AGENTS.md`. |
| `src/commands/` | One module per CLI subcommand, all writer-injected. See `src/commands/AGENTS.md`. |
| `src/cli.ts` | Commander wiring; parses flags and delegates to `src/commands/`. |
| `src/index.ts` | The public library surface (re-exports profile + core + validate). |
| `spec/` | graphspec's own spec, as a graphspec bundle. See "Working in `spec/`" below. |
| `skills/` | Portable `SKILL.md` agent skills, with no dependency on any agent runtime. |
| `tests/` | Vitest suites, mirroring the source module layout. |

## Conventions

- ESM only (`"type": "module"`). Intra-package imports carry the `.js` extension, because
  TypeScript emits ESM that Node resolves at runtime.
- Every module opens with a `/** */` block explaining its role. Comments say *why*, not what.
- Biome owns formatting and lint; it also formats `package.json`, so a `pnpm add` can leave
  the file needing a `pnpm lint:fix` pass.
- Layering runs one way: `profile` → `core` → `validate` → `commands` → `cli`. Nothing lower
  imports from something higher.

## Commands

```bash
pnpm build       # tsc -> dist/
pnpm test        # vitest run
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome check .
pnpm lint:fix    # biome check --write .
```

Verify a change against the real CLI, not just the suite: `pnpm build && node dist/cli.js
validate spec --strict` and `node dist/cli.js coverage spec`. The `spec/` bundle is the
dogfood fixture and is expected to stay at 0 errors, 0 warnings, and 0 coverage gaps.

## Working in `spec/`

`spec/` is a working graphspec bundle specifying graphspec itself. It does three jobs at
once, so changes there are not "just docs": it is the dogfooding proof, a **test fixture**
several suites in `tests/` load directly, and the worked example the README and both agent
skills point at.

- **There is deliberately no `AGENTS.md` inside `spec/`.** The bundle loader treats every
  non-reserved `.md` file as a concept (only `index.md` and `log.md` are reserved), so an
  `AGENTS.md` in a bundle directory fails OKF conformance with a hard `okf/missing-frontmatter`
  error. This bites any repo that keeps agent docs beside a bundle; graphspec has no
  file-level ignore mechanism today.
- Filenames follow the profile: `<name>.<type-token>.md`, token agreeing with the
  frontmatter `type`.
- After adding, removing, or renaming a concept, regenerate the listings with
  `node dist/cli.js index spec --log "<what changed>"`. `index.md` and `log.md` are
  generated; hand edits get reverted by the next run.
- A new Requirement needs a `satisfies` edge from a System or Component and a `covers` edge
  from a TestScenario, or `coverage` reports a gap. Add the TestScenario only when a real
  test backs it, otherwise the coverage report lies.
- Tests should pin *behavior*, not this bundle's incidental state. A test that required a
  coverage gap to exist here broke the moment that gap was legitimately closed; such tests
  belong on a purpose-built temp fixture.

## Key Decisions

- 2026-08-13: Adopt OKF v0.1 as the storage format rather than inventing one. Why: an open
  format keeps bundles readable by other tools and keeps graphspec's scope to the profile.
- 2026-08-13: Express the profile as a typed data module rather than scattered validation
  logic. Why: the vocabulary is then introspectable and extensible in one place.
