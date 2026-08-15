---
title: coverage
description: Report spec-graph completeness gaps, and exit non-zero on any of them so CI can block an incomplete spec.
sidebar:
  order: 6
---

```bash
npx graph-spec-cli coverage [path] [--json] [--strict]
```

Reports the eight completeness gaps. Unlike [`validate`](/cli/validate/), which asks whether
the bundle is well formed, this asks whether it is finished.

| Flag | Effect |
| --- | --- |
| `--json` | Emit the report as structured data |
| `--strict` | Exit 1 when any gap is found |

## Output

```text
$ npx graph-spec-cli coverage spec/
Unsatisfied requirements (no satisfies): 0
Untested requirements (no covers): 0
Untested journeys (no covers): 0
Empty features (no includes): 0
Unrealized features (no realizes): 0
Dangling constraints (no constrains): 0
Orphan concepts (no relations): 0
Unresolved relation targets: 0
0 gap(s)
```

When a count is non-zero, the offending concept IDs are listed under it:

```text
Unsatisfied requirements (no satisfies): 1
  - specification/concept-filtering.requirement
Untested requirements (no covers): 2
  - specification/profile-checks.requirement
  - specification/strict-mode.requirement
```

## The gaps

| Category | JSON key |
| --- | --- |
| Unsatisfied requirements | `unsatisfiedRequirements` |
| Untested requirements | `untestedRequirements` |
| Untested journeys | `untestedJourneys` |
| Empty features | `emptyFeatures` |
| Unrealized features | `unrealizedFeatures` |
| Dangling constraints | `danglingConstraints` |
| Orphan concepts | `orphanConcepts` |
| Unresolved relation targets | `unresolvedTargets` |

Plus `totalGaps`. What each one means, and how seriously to take it, is in
[Coverage](/concepts/coverage/).

## Gating a build

```bash
npx graph-spec-cli coverage spec/ --strict
```

Exits 1 when `totalGaps` is above zero. This is also the only way to fail a build on
unresolved relation targets, since `validate --strict` deliberately leaves those as warnings.

See [Gate CI on the spec](/guides/ci/) for a complete workflow.

## JSON

```bash
npx graph-spec-cli coverage spec/ --json
```

Returns the eight keys above plus `totalGaps`. Most are arrays of concept IDs;
`unresolvedTargets` entries are `{from, relation, target}` objects, because the useful
information is which edge dangles rather than which concept holds it.

## Run it before you start

The most valuable time to run coverage is **before** implementing, not after. A requirement in
`untestedRequirements` that you are about to build means the spec never stated how to prove
the work is done. Finding that while writing the test is cheap; finding it during verification
is not.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. Also the result with gaps present, unless `--strict` |
| `1` | Gaps found, under `--strict` |
| `2` | The bundle could not be read |

## Notes

- A gap is a question, not automatically a defect. An unlinked glossary Term shows up as an
  orphan and may be perfectly fine.
- Do not close a gap by adding a TestScenario with no real test behind it. A false clean
  report is worse than a visible gap.
