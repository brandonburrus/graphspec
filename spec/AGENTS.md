# spec/ — graphspec's own spec, as a graphspec bundle

This directory is a working graphspec bundle that specifies graphspec itself. It serves
three jobs at once, which is why changes here are not "just docs":

1. **Dogfooding.** It is the proof that the format is usable for a real system.
2. **A test fixture.** Several suites in `tests/` load `spec/` directly, so editing a
   concept can turn a test red.
3. **The worked example** the README and both agent skills point users at.

This file coexists with the bundle because the loader only treats `<name>.<type-token>.md`
files as concepts; `AGENTS.md` has no type token, so it is ignored (and reported in
`validate` output under "file(s) ignored").

## Expected state

`spec/` is expected to stay at **0 errors, 0 warnings (including `--strict`), and 0 coverage
gaps**. Verify after any edit:

```bash
node dist/cli.js validate spec --strict
node dist/cli.js coverage spec
```

## Working in here

- Filenames follow the profile: `<name>.<type-token>.md`. The token must agree with the
  frontmatter `type` or validation warns. **A file that loses its token stops being a concept
  entirely** rather than warning, so check the "file(s) ignored" line in `validate` output if
  a concept seems to have vanished.
- After adding, removing, or renaming a concept, regenerate the directory listings:
  `node dist/cli.js index spec --log "<what changed>"`. The listings and `log.md` are
  generated; hand-editing them is churn that the next `index` run reverts.
- A new Requirement needs both a `satisfies` edge from a System or Component and a `covers`
  edge from a TestScenario, or `coverage` reports a gap. Add the TestScenario only when a
  real test backs it: a scenario describing a test that does not exist makes the coverage
  report lie.
- `index.md` and `log.md` are reserved OKF files, not concepts. They carry no frontmatter,
  are exempt from the type-token rule, and never appear in the graph.

## Gotcha

Tests that assert on this bundle should pin *behavior*, not this bundle's incidental state.
A test that needed a coverage gap to exist here once broke the moment the gap was legitimately
closed; such tests belong on a purpose-built temp fixture instead.
