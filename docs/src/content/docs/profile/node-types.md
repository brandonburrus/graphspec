---
title: Node types
description: All 13 GraphSpec node types with their filename tokens, required frontmatter fields, and conventional body sections.
sidebar:
  order: 1
---

The vocabulary is **closed**. These 13 types are all there are, and a `type` outside the list
is a `profile/unknown-type` warning. The list below is generated from the same data the
validator reads.

Every concept file is named `<name>.<type-token>.md`. The token column is what goes in the
filename.

## Product

| Type | Token | Required | Sections |
| --- | --- | --- | --- |
| `UserPersona` | `user-persona` | none | Goals, Pains |
| `UserJourney` | `user-journey` | none | Flow |
| `Feature` | `feature` | none | Summary |

**UserPersona** is an archetype of a user the software serves. **UserJourney** is an
end-to-end path a persona takes to accomplish something. **Feature** is a discrete capability
the product provides.

## Architecture

| Type | Token | Required | Sections |
| --- | --- | --- | --- |
| `System` | `system` | none | Responsibility |
| `Component` | `component` | none | Responsibility |
| `Integration` | `integration` | `direction`: `inbound` \| `outbound` \| `bidirectional` | Interface |
| `Contract` | `contract` | none | Interface |
| `DataModel` | `data-model` | none | Schema |

**System** is a top-level runtime or deployable unit. **Component** is a module or unit of
implementation within a system. **Integration** is a connection to an external system or
party. **Contract** is an interface agreement such as an API, event, or protocol.
**DataModel** describes persisted or exchanged data.

## Specification

| Type | Token | Required | Sections |
| --- | --- | --- | --- |
| `Requirement` | `requirement` | `status`: `proposed` \| `accepted` \| `implemented` \| `verified` | Acceptance Criteria |
| `Constraint` | `constraint` | `category`: any non-empty string | Rationale |
| `Decision` | `decision` | `status`: `proposed` \| `accepted` \| `superseded` | Context, Decision, Consequences |
| `TestScenario` | `test-scenario` | `level`: `unit` \| `integration` \| `e2e` | Given/When/Then |

**Requirement** states required behavior or capability. **Constraint** is a non-functional
limitation the design must honor. **Decision** is an architecture or design decision record.
**TestScenario** is a concrete scenario verifying required behavior.

## Glossary

| Type | Token | Required | Sections |
| --- | --- | --- | --- |
| `Term` | `term` | none | none |

**Term** is a ubiquitous-language glossary entry. Any concept can point at one with
`refers-to`.

## Required fields

A required field is checked two ways. If the field has an enum, the value must be one of the
listed options, and anything else is `profile/invalid-field-value`. If it has no enum, any
non-empty string is accepted.

`Constraint.category` is the deliberate free-form case. It exists so projects can invent their
own categories (`security`, `performance`, `compliance`) without the profile guessing at them
in advance.

An absent or empty required field is `profile/missing-required-field`. Both rules are
warnings by default and errors under `--strict`.

## Conventional sections

The Sections column lists H1 headings by convention. These are **not enforced**: a Requirement
with no `# Acceptance Criteria` heading validates fine.

Following them is still worth it. The parser extracts H1 sections, so a consistent bundle is
one where the acceptance criteria are always in the same place, which matters when the reader
is an agent looking for them.

## `level` picks the test suite

`TestScenario.level` is the one required field that carries downstream meaning. It tells an
implementer which suite the ported test belongs in, so the spec decides the test's altitude
rather than the person writing it.

## Extending

You cannot add a type. The vocabulary is closed by design, because a closed vocabulary is what
makes [coverage](/concepts/coverage/) checkable: the analysis knows what a Requirement is and
what satisfying one looks like.

Use `tags` for project-specific classification, and the free-form `Constraint.category` for
constraint taxonomies.
