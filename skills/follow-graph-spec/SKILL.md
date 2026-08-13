---
name: follow-graph-spec
description: >-
  This skill should be used when implementing or building software FROM an existing
  graphspec-conformant spec bundle, pulling only the relevant subgraph for each unit of work
  instead of re-reading the whole bundle. It applies when the user says "implement this spec",
  "build from the graphspec", "follow this graphspec to build X", "implement the next
  component/requirement in the spec", or a graphspec bundle (an `index.md` plus
  `<name>.<type-token>.md` files) is present or referenced as the source of truth for a coding
  task. It should not be used to author or extend a graphspec bundle (use create-graph-spec
  instead), for specs in any other format the graphspec CLI cannot parse, or as a substitute for
  actually reading the pulled concept files and their test scenarios before writing code.
---

## Purpose

Consume an existing graphspec bundle as the source of truth for implementation, one unit of work
at a time. The value this skill protects: pull the minimal subgraph relevant to the
Component/System you're building right now — its Contracts, DataModels, Requirements,
Constraints, and covering TestScenarios — instead of loading the entire bundle into context for
every change.

Run every command below with the `graphspec` CLI on PATH (or `node dist/cli.js …` / `pnpm exec
graphspec …` from inside a graphspec source checkout).

## Workflow

Copy this checklist and track progress:

```text
Spec-Driven Build Progress:
- [ ] 1. Bundle validated (trust but verify)
- [ ] 2. Coverage gaps surfaced and a decision made about them
- [ ] 3. Build order obtained
- [ ] 4. Per unit of work: targeted subgraph pulled and read
- [ ] 5. Per unit of work: covering test scenarios ported to real tests
- [ ] 6. Post-implementation: coverage gap closed, validate --strict still clean
```

### 1. Trust but verify

Before reading anything else, confirm the bundle is actually sound:

```bash
graphspec validate <path> --strict
```

If this reports errors or warnings, surface them to the user before proceeding — don't silently
build on top of an unsound bundle (a filename/type mismatch, a bad enum value, or a relation to
the wrong target type can all mean the graph doesn't mean what it appears to mean).

### 2. Check completeness

```bash
graphspec coverage <path>
```

This reports, by category: unsatisfied Requirements (nothing `satisfies` them), untested
Requirements/UserJourneys (nothing `covers` them), empty Features (no `includes`), unrealized
Features (nothing `realizes` them), dangling Constraints (nothing they `constrain`), orphan
concepts, and unresolved relation targets. `graphspec coverage <path> --strict` exits non-zero if
any gap exists at all — useful as a CI gate, less useful mid-build since real bundles commonly
have some gaps in flight.

Decide with the user up front: close the gaps that block this unit of work first, or proceed and
track the rest. Don't assume — a dangling Constraint or an unsatisfied Requirement might be
exactly what you're about to implement, or it might be scoped for later.

### 3. Get the build order

```bash
graphspec order <path>
```

This is the topological order of `System`/`Component` concepts from their `depends-on` edges —
each node listed after everything it depends on. **Use this order, not file order or intuition**,
to decide what to build first. A non-zero exit with reported `cycles` means the dependency graph
itself is broken; fix that before using the order.

### 4. Per unit of work: pull the targeted subgraph

For each Component/System in the order from step 3, pull only what it needs — don't re-read the
whole bundle per unit of work. Its outgoing relations (`exposes`, `uses`, `satisfies`,
`depends-on`) are safe to pull with `--from`:

```bash
graphspec graph <path> --from <component-id> --rel exposes,uses,satisfies --depth 1 --format json
```

This surfaces its Contracts (`exposes`), DataModels/Contracts (`uses`), and Requirements
(`satisfies`) in one shot. **Read those specific concept files in full before writing any code**
— the subgraph tells you what's connected, the files tell you what it actually says.

**Important direction gotcha, verified against this repo's own bundle:** `--from` only follows
edges *outgoing* from the given id. `constrains` (Constraint → your concept) and `covers`
(TestScenario → your concept) point the other way, so `--from <component-id> --rel constrains`
returns nothing even when a Constraint genuinely constrains it. To find those, query bundle-wide
instead and filter for your id as the target — see `references/traversal.md` for the exact
command and the verified example that exposed this. Don't skip Constraints just because the
naive `--from` pull came back empty.

### 5. Pull the covering test scenarios

Before or while implementing, find the TestScenarios that cover this unit of work so you can port
them into real automated tests (TDD-friendly: red before green):

```bash
graphspec graph <path> --rel covers --format json
```

Filter the returned `edges` for entries whose `to` is your component or requirement id; each
`from` is a covering TestScenario id. Read that TestScenario's `level` (unit/integration/e2e) and
its `# Given/When/Then` body, and write the corresponding real test before or alongside the
implementation. `graphspec query <path> --type TestScenario --json` lists every TestScenario's
id/title/description if you want the full inventory first — note it does **not** include
`relations`, so confirming which one covers your unit still needs the `graph --rel covers` step
above (or opening the file directly).

### 6. After implementing

Re-run both checks to confirm the targeted gap actually closed and nothing regressed:

```bash
graphspec coverage <path>       # the gap you targeted should be gone
graphspec validate <path> --strict   # must still be clean
```

If you added a Requirement/Component/relation while implementing, this is also when a drifted
bundle would show up — fix the bundle (not just the code) before moving to the next unit of work
in the order from step 3.

## Worked example

`EXAMPLE.md` in this skill directory runs this exact workflow against this repo's own `spec/`
dogfood bundle — including a real coverage gap it surfaces and the `--from` direction gotcha in
practice — using one real Component (`architecture/validator.component`) as the unit of work.

## Reference

`references/traversal.md` has the full CLI flag reference, the complete relation table annotated
with traversal direction, and the `order` algorithm's tie-breaking behavior.
