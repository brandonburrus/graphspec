# Worked example: implementing from graphspec's own dogfood bundle

This is a real transcript (commands + actual output) from running the `follow-graph-spec`
workflow against this repo's own `spec/` bundle, treating `architecture/validator.component` as
one unit of work. Every command below was actually run from the repo root.

## Step 1: trust but verify

```text
$ graphspec validate spec/ --strict
25 concept(s), 0 error(s), 0 warning(s) [strict]
```

Clean. Safe to proceed.

## Step 2: check completeness

```text
$ graphspec coverage spec/
Unsatisfied requirements (no satisfies): 1
  - specification/concept-filtering.requirement
Untested requirements (no covers): 2
  - specification/profile-checks.requirement
  - specification/strict-mode.requirement
Untested journeys (no covers): 0
Empty features (no includes): 0
Unrealized features (no realizes): 0
Dangling constraints (no constrains): 0
Orphan concepts (no relations): 0
Unresolved relation targets: 0
3 gap(s)
```

Real, non-trivial finding: two of the three Requirements that `architecture/validator.component`
itself satisfies — `profile-checks.requirement` and `strict-mode.requirement` — have no covering
TestScenario yet. (`okf-conformance.requirement`, the third, *is* covered — see step 5.) That's a
concrete gap directly relevant to this unit of work, not just abstract bundle hygiene.
`graphspec coverage spec/ --strict` exits `1` here, confirming the CI-gate behavior.

## Step 3: get the build order

```text
$ graphspec order spec/
1. architecture/graphspec-cli.system
2. architecture/parser.component
3. architecture/graph-model.component
4. architecture/profile-model.component
5. architecture/validator.component

5 node(s).
```

`validator.component` is last — it `depends-on` both `graph-model.component` and
`profile-model.component`, so both must exist first. This matches its frontmatter exactly:

```yaml
relations:
  depends-on:
    - /architecture/graph-model.component.md
    - /architecture/profile-model.component.md
```

## Step 4: pull the targeted subgraph

```text
$ graphspec graph spec/ --from architecture/validator.component --rel exposes,uses,satisfies,constrains --depth 1
{
  "nodes": [
    { "id": "architecture/validator.component", "type": "Component", "title": "Validator" },
    { "id": "specification/okf-conformance.requirement", "type": "Requirement", "title": "OKF Conformance" },
    { "id": "specification/profile-checks.requirement", "type": "Requirement", "title": "Profile Checks" },
    { "id": "specification/strict-mode.requirement", "type": "Requirement", "title": "Strict Mode" }
  ],
  "edges": [
    { "from": "architecture/validator.component", "to": "specification/okf-conformance.requirement", "relation": "satisfies" },
    { "from": "architecture/validator.component", "to": "specification/profile-checks.requirement", "relation": "satisfies" },
    { "from": "architecture/validator.component", "to": "specification/strict-mode.requirement", "relation": "satisfies" }
  ]
}
```

Only `satisfies` edges came back — this component has no `exposes`/`uses`/`constrains` edges of
its own, which the full (unfiltered) subgraph confirms: its only other relation is `depends-on`
its two dependencies. **Next: read the three Requirement files in full.** They say, in short:

- `okf-conformance.requirement`: every non-reserved file needs parseable frontmatter with a
  non-empty `type` — no other checks hard-fail.
- `profile-checks.requirement`: filename/type mismatches, missing/invalid required fields, and
  bad relations all yield warnings.
- `strict-mode.requirement`: `--strict` promotes those warnings to errors, except unresolved
  relation targets, which stay warnings.

That's the actual acceptance criteria to implement/verify against — read directly from the spec,
not inferred.

### The `--from` direction gotcha, proven on this same bundle

`constrains` came back empty above — but is validator.component actually unconstrained? Checking
a *different* concept in the same bundle proves the gotcha rather than just asserting it:
`specification/zero-format-awareness.constraint.md` declares
`constrains: [/architecture/graphspec-cli.system.md]`, so the System genuinely is constrained.
Pulling `--from` on the constrained concept itself still comes back empty:

```text
$ graphspec graph spec/ --from architecture/graphspec-cli.system --rel constrains --depth 1
{
  "nodes": [
    { "id": "architecture/graphspec-cli.system", "type": "System", "title": "graphspec CLI" }
  ],
  "edges": []
}
```

`--from` only walks edges outgoing from the given id, and `constrains` originates at the
Constraint, not at the System. The correct way to check whether *anything* constrains a given
concept is a bundle-wide, `--from`-less pull filtered by target:

```text
$ graphspec graph spec/ --rel constrains
...
  "edges": [
    { "from": "specification/permissive-okf.constraint", "to": "specification/okf-conformance.requirement", "relation": "constrains" },
    { "from": "specification/zero-format-awareness.constraint", "to": "architecture/graphspec-cli.system", "relation": "constrains" }
  ]
```

Filtering this list for `to === "architecture/validator.component"` finds nothing — so
validator.component really has no Constraint targeting it (confirmed correctly this time,
bundle-wide rather than via the blind-spot `--from` pull).

## Step 5: pull the covering test scenarios

```text
$ graphspec graph spec/ --rel covers
...
  "edges": [
    { "from": "specification/query-filter.test-scenario", "to": "product/author-a-spec.user-journey", "relation": "covers" },
    { "from": "specification/query-filter.test-scenario", "to": "specification/concept-filtering.requirement", "relation": "covers" },
    { "from": "specification/validate-golden.test-scenario", "to": "architecture/validator.component", "relation": "covers" },
    { "from": "specification/validate-golden.test-scenario", "to": "specification/okf-conformance.requirement", "relation": "covers" }
  ]
```

Filtering for `to === "architecture/validator.component"` finds
`specification/validate-golden.test-scenario` (`level: integration`):

```markdown
# Given/When/Then

- **Given** a bundle whose concepts all conform to OKF and the graphspec profile,
- **When** `graphspec validate` runs,
- **Then** it reports zero errors and zero warnings and exits 0.
```

Port this into a real integration test before/while touching the validator's code. Note the gap
found in step 2: `profile-checks.requirement` and `strict-mode.requirement` have no covering
TestScenario at all — a real follow-up would be writing those TestScenario concepts (via
`create-graph-spec`) and their corresponding tests, then closing the gap.

## Step 6: after implementing

```text
$ graphspec coverage spec/       # re-run after closing a gap; totalGaps should drop
$ graphspec validate spec/ --strict   # must still report 0 errors, 0 warnings
```

Both must be checked — the second confirms the implementation work didn't drift the bundle
itself (e.g. a relation edited by hand introducing a typo).
