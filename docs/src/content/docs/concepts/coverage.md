---
title: Coverage
description: The eight completeness gaps GraphSpec reports, what each one means, and how to gate a build on them.
sidebar:
  order: 4
---

Validation asks whether the spec is well formed. Coverage asks whether it is finished.

Because relationships like "this component satisfies that requirement" are edges rather than
sentences, a missing one is detectable. That is the whole trick: coverage is the set of
questions a graph can answer that a document cannot.

```bash
npx graph-spec-cli coverage spec/
```

```text
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

Each category lists the offending concept IDs when the count is non-zero, so a gap points
directly at the file to fix.

## The eight gaps

| Gap | JSON key | Means |
| --- | --- | --- |
| Unsatisfied requirements | `unsatisfiedRequirements` | A Requirement that no Component or System `satisfies`. Nothing has claimed to implement it. |
| Untested requirements | `untestedRequirements` | A Requirement that no TestScenario `covers`. Nothing says how to prove it works. |
| Untested journeys | `untestedJourneys` | A UserJourney that no TestScenario `covers`. |
| Empty features | `emptyFeatures` | A Feature that `includes` no Requirement. A named idea with no substance. |
| Unrealized features | `unrealizedFeatures` | A Feature that no Component or System `realizes`. Nothing is building it. |
| Dangling constraints | `danglingConstraints` | A Constraint that `constrains` nothing. A rule with no subject. |
| Orphan concepts | `orphanConcepts` | A concept with no relations at all, in either direction. It is in the bundle but not in the graph. |
| Unresolved targets | `unresolvedTargets` | A relation pointing at a concept that does not exist. |

`totalGaps` is the sum. `unresolvedTargets` entries carry `{from, relation, target}` rather
than a bare ID, since the interesting part is which edge dangles.

## Reading a gap correctly

A gap is a question, not automatically a defect.

**Untested requirements** is the one worth taking seriously before implementation. If you are
about to build a requirement and nothing covers it, the spec never said how to prove the work
is done. Finding that out while writing the test is much cheaper than finding out while trying
to verify.

**Orphan concepts** often means a Term nobody has linked with `refers-to` yet, which may be
fine.

**Unresolved targets** is expected during reference-first authoring and only becomes a problem
when the target was supposed to exist.

## Do not close a gap dishonestly

Adding a TestScenario concept with no real test behind it makes the coverage report claim
protection that does not exist. That is worse than a reported gap, because a reported gap is
visible and a false clean report is not.

Close the gap by writing the test, then the scenario that points at it.

## Gate a build on it

```bash
npx graph-spec-cli coverage spec/ --strict
```

`--strict` exits 1 when any gap is found, which makes it usable as a CI check. See
[Gate CI on the spec](/guides/ci/) for a working workflow.

Note the split from [`validate`](/cli/validate/): validate catches a malformed spec, coverage
catches an incomplete one. A bundle can pass one and fail the other, and most CI setups want
both.

## Machine-readable output

```bash
npx graph-spec-cli coverage spec/ --json
```

Returns an object with the eight keys above plus `totalGaps`. Useful for reporting a trend
over time, or for a bot that comments the delta on a pull request.
