# graphspec profile cheat sheet

The closed vocabulary every graphspec bundle is checked against. Source of truth:
`src/profile/node-types.ts` and `src/profile/relations.ts` in the graphspec repo. Do not add
types or relations outside this list — `npx graphspec validate` only knows these.

## Node types (13)

Filename convention: `<name>.<type-token>.md`. `type` in frontmatter is the PascalCase name.

| Layer | `type` | filename token | Required frontmatter | Body section(s) |
|---|---|---|---|---|
| Product | UserPersona | `user-persona` | — | Goals, Pains |
| Product | UserJourney | `user-journey` | — | Flow |
| Product | Feature | `feature` | — | Summary |
| Architecture | System | `system` | — | Responsibility |
| Architecture | Component | `component` | — | Responsibility |
| Architecture | Integration | `integration` | `direction`: inbound \| outbound \| bidirectional | Interface |
| Architecture | Contract | `contract` | — | Interface |
| Architecture | DataModel | `data-model` | — | Schema |
| Specification | Requirement | `requirement` | `status`: proposed \| accepted \| implemented \| verified | Acceptance Criteria |
| Specification | Constraint | `constraint` | `category`: free-form non-empty string | Rationale |
| Specification | Decision | `decision` | `status`: proposed \| accepted \| superseded | Context, Decision, Consequences |
| Specification | TestScenario | `test-scenario` | `level`: unit \| integration \| e2e | Given/When/Then |
| Glossary | Term | `term` | — | (none conventional) |

Every concept also gets OKF's own required field: a non-empty `type`. `title`, `description`,
and `tags` are recommended on every type (not OKF/profile-enforced, but every concept in this
repo's own dogfood bundle carries them, and `npx graphspec index`/`npx graphspec query` render `title`
and `description` when present).

Enum fields (`status`, `direction`, `level`) are **profile** checks: a wrong or missing value is
a warning normally, an error under `--strict`. `category` just needs to be a non-empty string —
any value is accepted.

## Relations (16)

Declared under frontmatter `relations:` as `relationName: [target, target, ...]`. Each target is
a bundle-relative path with a leading `/`, `.md` suffix optional.

| Relation | Source type(s) → Target type(s) |
|---|---|
| `experiences` | UserPersona → UserJourney |
| `exercises` | UserJourney → Feature |
| `includes` | Feature → Requirement |
| `realizes` | Component, System → Feature |
| `contains` | System → Component |
| `depends-on` | Component → Component, System → System |
| `exposes` | Component, System → Contract |
| `uses` | Component → DataModel, Contract |
| `connects` | Integration → System, Contract |
| `satisfies` | Component, System → Requirement |
| `refines` | Requirement → Requirement |
| `constrains` | Constraint → System, Component, Requirement |
| `covers` | TestScenario → Requirement, Component, UserJourney |
| `supersedes` | Decision → Decision |
| `affects` | Decision → (any type) |
| `refers-to` | (any type) → Term |

A relation edge is directional and one-way: declaring `constrains` in a Constraint's frontmatter
does not create anything in the target System/Component/Requirement's own frontmatter. If you
want traversal to work smoothly in both directions for `follow-graph-spec` later (see that
skill), remember that a Component being constrained or covered doesn't "know" about it in its
own file — the edge lives only on the Constraint/TestScenario side.

## Validation model (what `npx graphspec validate` actually checks)

- **What counts as a concept:** only `<name>.<type-token>.md` files. `index.md` and `log.md` are
  reserved, and every other `.md` (`AGENTS.md`, `README.md`, notes) is ignored, so ordinary prose
  can sit inside a bundle directory. `validate` reports what it skipped — check that line after
  renaming a file, because a concept that lost its type token becomes an ignored file rather than
  a validation error.
- **OKF conformance (always errors):** parseable YAML frontmatter block; non-empty `type`.
  Unknown types, broken links, and missing optional fields never hard-fail on their own — OKF
  is intentionally permissive so partially-authored bundles stay valid.
- **graphspec profile (warnings; `--strict` promotes to errors):** filename token matches
  `type`; required field(s) present with a valid value; relation name is in the vocabulary
  above; the source concept's type may originate that relation; each *resolved* target's type
  is an allowed target for that relation.
- **Exception that never promotes:** an unresolved relation target (a `relations:` entry
  pointing at a concept that doesn't exist in the bundle) stays a warning even under
  `--strict` — reference-first authoring (write the link, fill in the target concept later) is
  a supported workflow, not an error condition.
