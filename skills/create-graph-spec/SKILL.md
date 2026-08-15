---
name: create-graph-spec
description: >-
  This skill should be used when authoring a new graphspec-conformant OKF knowledge-graph spec
  bundle, or adding concepts to an existing one, from a product or engineering intent: a feature
  idea, a system or component design, a requirement, a decision, or a user journey to capture. It
  applies when the user says "write a spec", "create a graphspec", "document this system as a
  graphspec", "spec out this feature", "add a requirement/component/decision to the spec", "wire
  this concept into the graph", or is working inside a directory that already looks like a
  graphspec bundle (an `index.md` plus `<name>.<type-token>.md` files). It should not be used to
  implement or build software FROM an already-written graphspec bundle (use follow-graph-spec
  instead), to author specs in any other format such as a PRD, ADR, or OpenAPI document (graphspec
  has zero awareness of other spec formats), or to invent node types or relation names outside the
  closed 13-type/16-relation graphspec vocabulary.
---

## Purpose

Turn a product or engineering intent into a valid graphspec bundle: a directory of OKF markdown
concepts, cross-linked by typed `relations:` frontmatter, that passes `npx graph-spec-cli validate --strict`
clean. The graphspec vocabulary is closed — 13 node types, 16 typed relations — so authoring means
mapping the intent onto that vocabulary, never extending it.

Always invoke the CLI as `npx graph-spec-cli …` — that is the npm package name, and it needs no
prior install. The installed binary is named `graphspec`, so `graphspec …` also works wherever
the package is already installed or on PATH.

## Workflow

Copy this checklist and track progress:

```text
Spec Authoring Progress:
- [ ] 1. Bundle root established/located
- [ ] 2. Node types chosen from the closed vocabulary
- [ ] 3. Concept files written (filename + frontmatter + body)
- [ ] 4. Relations wired
- [ ] 5. Validated iteratively (errors, then warnings, then --strict)
- [ ] 6. Index regenerated
- [ ] 7. Query sanity check
```

### 1. Establish or locate the bundle root

If no bundle exists yet, create the root directory and a root `index.md`. `index.md` and
`log.md` are OKF "reserved files" — they are never concepts and need no `type` frontmatter (only
an optional `okf_version`):

```markdown
---
okf_version: "0.1"
---

# Subdirectories
* [product](product/index.md)
```

If a bundle already exists, work inside it — locate its root (the directory containing the
top-level `index.md`) rather than starting a second one.

### 2. Decide which node types the intent needs

Pick only from the 13 types below (full required-field and section detail in
`references/profile.md`):

| Layer | Types |
|---|---|
| Product | UserPersona, UserJourney, Feature |
| Architecture | System, Component, Integration, Contract, DataModel |
| Specification | Requirement, Constraint, Decision, TestScenario |
| Glossary | Term |

Do not invent a new type or a new relation name — the vocabulary is closed by design so
`npx graph-spec-cli validate` can check it mechanically. A typical unit of work is small: a Feature plus
the Requirement(s) it includes, or a Component plus the Requirement(s) it satisfies and the
Contract/DataModel it uses. Don't manufacture personas, journeys, or decisions the intent
doesn't call for.

### 3. Write each concept file

For every concept:

- **Filename**: `<name>.<type-token>.md`, kebab-case, in whatever directory groups it logically
  (graphspec has no fixed directory layout — `product/` / `architecture/` / `specification/` /
  `glossary/` is just this repo's own convention; use whatever grouping fits the target bundle).
  Token from `references/profile.md`, e.g. `deliver-email.requirement.md`,
  `auth-service.system.md`.
- **Frontmatter**: `type` (PascalCase) plus that type's required field(s) — `direction` for
  Integration, `status` for Requirement/Decision, `category` for Constraint, `level` for
  TestScenario — plus recommended `title`, `description`, `tags`.
- **Body**: use that type's conventional H1 section(s) from `references/profile.md` (e.g.
  `# Schema` for DataModel, `# Given/When/Then` for TestScenario, `# Acceptance Criteria` for
  Requirement, `# Context` / `# Decision` / `# Consequences` for Decision, `# Flow` for
  UserJourney). OKF doesn't enforce these headings, but following them keeps the bundle
  consistent with every other graphspec bundle.

### 4. Wire relations

Declare typed edges in frontmatter under `relations:`, a map of relation name to a list of
target references (bundle-relative path with a leading `/`, `.md` suffix optional):

```yaml
relations:
  includes:
    - /specification/deliver-email.requirement.md
```

Only use a relation name / source type / target type combination that's in the vocabulary (full
source→target table in `references/profile.md`) — e.g. `includes` only goes Feature →
Requirement, `satisfies` only goes Component/System → Requirement. Prose markdown links in the
body are fine for human narrative, but `relations:` is what `npx graph-spec-cli graph`, `coverage`, and
`order` actually traverse — a concept only participates in the graph through its frontmatter
relations, not through prose links.

It's fine to point a relation at a concept that doesn't exist yet — OKF is reference-first by
design, so an unresolved target is a warning, not a blocker (confirmed in step 5). Just don't
leave typos in targets you DO expect to resolve.

### 5. Validate iteratively

Run validate after every concept or two, not just at the end:

```bash
npx graph-spec-cli validate <path>
```

This reports both OKF conformance errors and graphspec profile warnings together. Fix OKF hard
errors first (missing/unparseable frontmatter, empty `type`) — these are the only things that
actually break the bundle. Then address profile warnings (wrong filename token, missing required
field, invalid enum value, unknown relation, wrong source/target type). When a diagnostic isn't
obvious from the text, `--json` gives the structured `rule` / `file` / `conceptId`:

```bash
npx graph-spec-cli validate <path> --json
```

Before declaring the bundle done, run strict mode — this is the real bar, since it promotes
every profile warning to an error **except** unresolved relation targets (those stay warnings
even under `--strict`, honoring reference-first authoring):

```bash
npx graph-spec-cli validate <path> --strict     # must exit 0 before you're done
```

### 6. Regenerate the index

```bash
npx graph-spec-cli index <path> --log "<what you added>"
```

This rewrites every directory's `index.md` (concepts grouped by type, using each concept's title
+ description) and appends a dated entry to the bundle-root `log.md`. Use `--dry-run` first to
preview which files would change without writing, or `--no-index` to append only the log entry.

### 7. Sanity-check with query

Confirm the new concepts actually registered as expected:

```bash
npx graph-spec-cli query <path> --type Requirement
npx graph-spec-cli query <path> --type Feature --json
```

If a concept you just wrote is missing or shows the wrong type, re-check its filename token
against its frontmatter `type` — a mismatch there is the most common warning caught in step 5.

## Worked example

`EXAMPLE.md` in this skill directory is a real, command-by-command transcript: four concepts
(UserPersona → UserJourney → Feature → Requirement) created and wired together, one deliberate
missing-required-field warning caught and fixed, then validated `--strict` clean, indexed, and
queried. Read it for the exact commands and their real output.

## Reference

`references/profile.md` has the full node-type table (token, required fields, conventional
sections) and the full relation table (source type → target type) — the closed vocabulary every
intent gets mapped onto.
