---
title: Relations
description: All 16 GraphSpec relations with their allowed source and target types, grouped by the layer of the graph they wire together.
sidebar:
  order: 2
---

Sixteen relations, and the list is closed. An unknown name is `profile/unknown-relation`;
using a valid name between types it was not defined for is
`profile/invalid-relation-source` or `profile/invalid-relation-target`.

Each relation is declared on its **source** concept and points at the target. See
[Relations and the graph](/concepts/relations/) for how that affects traversal direction.

## Product layer

| Relation | Source | Target | Meaning |
| --- | --- | --- | --- |
| `experiences` | UserPersona | UserJourney | A persona experiences a user journey |
| `exercises` | UserJourney | Feature | A journey exercises a feature |
| `includes` | Feature | Requirement | A feature includes a requirement |

These three chain the product story: who wants it, how they get there, what it is, and what it
must do.

## Architecture layer

| Relation | Source | Target | Meaning |
| --- | --- | --- | --- |
| `realizes` | Component, System | Feature | A component or system realizes a feature |
| `contains` | System | Component | A system contains a component |
| `depends-on` | Component, System | Component, System | One unit depends on another |
| `exposes` | Component, System | Contract | Exposes an interface agreement |
| `uses` | Component | DataModel, Contract | Consumes a data model or contract |
| `connects` | Integration | System, Contract | An integration connects to a system or contract |

`depends-on` is the one [`order`](/cli/order/) reads to derive a build sequence, and the one a
cycle in becomes a hard error.

## Specification layer

| Relation | Source | Target | Meaning |
| --- | --- | --- | --- |
| `satisfies` | Component, System | Requirement | Implements a requirement |
| `refines` | Requirement | Requirement | Narrows or elaborates another requirement |
| `constrains` | Constraint | System, Component, Requirement | A constraint applies to the target |
| `covers` | TestScenario | Requirement, Component, UserJourney | A scenario verifies the target |

`satisfies` and `covers` are the two edges [coverage](/concepts/coverage/) counts. A
Requirement with neither is a requirement nothing implements and nothing proves.

Both `constrains` and `covers` originate away from the thing they describe, so finding them
from a component needs `--direction in`.

## Decisions and glossary

| Relation | Source | Target | Meaning |
| --- | --- | --- | --- |
| `supersedes` | Decision | Decision | This decision replaces an earlier one |
| `affects` | Decision | any type | A decision bears on any concept |
| `refers-to` | any type | Term | Any concept refers to a glossary term |

`affects` and `refers-to` are the two relations with an open end, which is what lets decision
records and glossary links cut across the whole graph without the vocabulary enumerating every
pairing.

## Declaring them

```yaml
---
type: Component
title: Validator
relations:
  depends-on:
    - /architecture/graph-model.component.md
    - /architecture/profile-model.component.md
  satisfies:
    - /specification/okf-conformance.requirement.md
  refers-to:
    - /glossary/profile.term.md
---
```

A relation name maps to a list, even with one target. Targets are bundle-relative paths with a
leading `/`, and the `.md` suffix is optional.

## Choosing between similar relations

**`contains` or `depends-on`?** `contains` is composition: the component lives inside that
system. `depends-on` is a build and runtime ordering edge between peers.

**`realizes` or `satisfies`?** `realizes` points at a Feature (the capability), `satisfies`
points at a Requirement (the specific stated behavior). A component often has both.

**`refines` or a new Requirement?** Use `refines` when the child narrows the parent and both
should stay, such as a general latency requirement and a per-endpoint one under it.

**`affects` or a typed relation?** Prefer the typed one. `affects` is for the case a Decision
genuinely touches a concept no other relation describes.
