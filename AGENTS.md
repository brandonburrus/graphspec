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
- **The filename convention decides bundle membership.** Only `<name>.<type-token>.md` files
  (plus the reserved `index.md`/`log.md`) are concepts. A plain `AGENTS.md` or `README.md` in
  a bundle directory is ordinary prose and is skipped, so agent docs and specs coexist. The
  skipped paths are kept on `Bundle.ignored` and reported by `validate`, because a concept
  that lost its token would otherwise disappear without a word.

## Structure

| Path | What it is |
|------|------------|
| `src/profile/` | The graphspec vocabulary as data. See `src/profile/AGENTS.md`. |
| `src/core/` | OKF parsing, the in-memory graph, traversal, order, coverage. See `src/core/AGENTS.md`. |
| `src/validate/` | OKF conformance + profile checks producing diagnostics. See `src/validate/AGENTS.md`. |
| `src/visualize/` | Bundle + analyses -> one self-contained HTML page. See `src/visualize/AGENTS.md`. |
| `src/viewer/` | The browser app inlined into that page. See `src/viewer/AGENTS.md`. |
| `src/commands/` | One module per CLI subcommand, all writer-injected. See `src/commands/AGENTS.md`. |
| `src/cli.ts` | Commander wiring; parses flags and delegates to `src/commands/`. |
| `src/index.ts` | The public library surface (re-exports profile + core + validate). |
| `spec/` | graphspec's own spec, as a graphspec bundle. See `spec/AGENTS.md`. |
| `skills/` | Portable `SKILL.md` agent skills, with no dependency on any agent runtime. |
| `tests/` | Vitest suites, mirroring the source module layout. |
| `e2e/` | Playwright specs. The only thing that proves the generated page works in a browser. |
| `docs/` | The graphspec.dev Astro site. See `docs/AGENTS.md`. |
| `.github/workflows/` | `publish.yml` ships the package, `docs.yml` ships the site. Both fire on release. |

## Conventions

- ESM only (`"type": "module"`). Intra-package imports carry the `.js` extension, because
  TypeScript emits ESM that Node resolves at runtime.
- Every module opens with a `/** */` block explaining its role. Comments say *why*, not what.
- Biome owns formatting and lint; it also formats `package.json`, so a `pnpm add` can leave
  the file needing a `pnpm lint:fix` pass.
- Layering runs one way: `profile` → `core` → `validate` → `visualize` → `commands` → `cli`.
  Nothing lower imports from something higher. `src/viewer/` is off to the side: it is browser
  code, imports only types from `src/visualize/`, and nothing imports it back.

## Commands

```bash
pnpm build       # tsc -> dist/, then esbuild the viewer -> dist/viewer/
pnpm test        # vitest run
pnpm test:e2e    # playwright: the generated page, in a real browser
pnpm typecheck   # both tsconfigs (the viewer needs the DOM lib, the CLI must not have it)
pnpm lint        # biome check .
pnpm lint:fix    # biome check --write .
```

`pnpm test` does **not** build. Anything that depends on `dist/viewer/` must build it itself;
`tests/visualize-command.test.ts` does exactly that, so the suite passes on a clean checkout.
`pnpm test:e2e` builds first itself, and needs `npx playwright install chromium` once. It is
deliberately not part of `prepublishOnly`, which would make publishing depend on a browser
download.

Verify a change against the real CLI, not just the suite: `pnpm build && node dist/cli.js
validate spec --strict`, `node dist/cli.js coverage spec`, and for anything touching the
viewer, `node dist/cli.js visualize spec --open` and look at it. The `spec/` bundle is the
dogfood fixture and is expected to stay at 0 errors, 0 warnings, and 0 coverage gaps.

## Releasing

Published to npm as **`graph-spec-cli`** (unscoped, public), while the binary it installs is
named **`graphspec`**. The names differ on purpose: npm rejected `graphspec` with a 403 as too
similar to the existing `graph-spec` package, and renaming the command too would have broken
every documented invocation. Consequences to keep straight:

- `npx graph-spec-cli <cmd>` is the portable form and the one all docs and skills use, because
  npx resolves the *package* name. **That only works because `bin` declares two names**,
  `graphspec` and `graph-spec-cli`, both pointing at `dist/cli.js`. npx runs the bin matching
  the package name and does not fall back to a lone differently-named bin, so dropping the
  second entry breaks every documented invocation with "command not found". A test in
  `tests/version.test.ts` pins this.
- `npx graphspec <cmd>` works only inside this checkout (npx matches the local package's own bin
  name) or where the package is already installed. Do not put it in user-facing docs.
- Library imports use the package name: `import { … } from "graph-spec-cli"`.

`dist/` is gitignored and built at pack time, so never commit it.

Releases are automated. Publishing a GitHub release triggers both
`.github/workflows/publish.yml` (npm) and `.github/workflows/docs.yml` (graphspec.dev), so the
site and the package always describe the same version.

```bash
npm version <patch|minor|major>   # bumps package.json and tags
git push --follow-tags
gh release create <tag> --generate-notes
```

npm uses **trusted publishing** via OIDC, so there is no `NPM_TOKEN` in this repository. The
workflow needs `id-token: write` and npm >= 11.5.1; removing either breaks publishing with an
authentication error rather than an obvious one. The workflow also fails early when the
release tag does not match `package.json`, which is the mistake that would otherwise ship the
wrong version under a right-looking release.

Publishing by hand still works and runs the same gate:

```bash
npm publish
```

- `prepublishOnly` runs lint → typecheck → test, so a red repo cannot be published.
- `prepack` runs the build, so the tarball always carries a fresh `dist/`.
- `files` ships `dist`, `src`, `skills`, `README.md`, `LICENSE`. `src` is included so the
  shipped `.js.map`/`.d.ts.map` files resolve to real sources; dropping it silently breaks
  consumer debugging. `skills` is included because the README points users at those paths.
- The package is **ESM-only**. There is no CommonJS build and `require("graph-spec-cli")` will
  not work; that is deliberate, not an oversight.
- Verify a release candidate the way a consumer sees it, not just via `npm pack`:
  `npm pack`, then in a scratch directory with `"type": "module"`, `npm install
  <tarball>`, run `./node_modules/.bin/graphspec validate <bundle>`, and import the library
  once to confirm `exports` and the bundled types resolve.

## Key Decisions

- 2026-08-13: Adopt OKF v0.1 as the storage format rather than inventing one. Why: an open
  format keeps bundles readable by other tools and keeps graphspec's scope to the profile.
- 2026-08-13: Express the profile as a typed data module rather than scattered validation
  logic. Why: the vocabulary is then introspectable and extensible in one place.
- 2026-08-15: Publish as `graph-spec-cli` but keep the binary named `graphspec`. Why: npm 403s
  the name `graphspec` as too similar to the existing `graph-spec`, and renaming the command
  would have churned every documented invocation.
- 2026-08-15: Bundle d3-force into the viewer via esbuild rather than hand-rolling a layout or
  loading it from a CDN. Why: a CDN breaks the self-contained guarantee, and the library is
  bundled at pack time as a devDependency, so runtime dependencies stay at four.
- 2026-08-15: Only `<name>.<type-token>.md` files count as concepts; other `.md` files are
  ignored and reported. Why: lets `AGENTS.md`/`README.md` live inside a bundle, at the cost of
  a deliberate deviation from OKF's "every non-reserved file is a concept" rule.
