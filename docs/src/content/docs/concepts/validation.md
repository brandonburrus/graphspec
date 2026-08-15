---
title: Validation
description: The two validation layers, why OKF conformance has only two hard errors, what --strict promotes, and the one warning that never becomes an error.
sidebar:
  order: 3
---

Validation runs in two layers that are deliberately kept apart, because they answer different
questions.

| Layer | Question | Severity |
| --- | --- | --- |
| OKF conformance | Is this a readable knowledge bundle at all? | Always errors |
| GraphSpec profile | Does it follow the GraphSpec vocabulary and conventions? | Warnings, promoted by `--strict` |

## OKF conformance

Conformance asks two things of every concept file: that its frontmatter parses, and that it
declares a non-empty `type`. Those produce three rule codes:

| Rule | Meaning |
| --- | --- |
| `okf/missing-frontmatter` | The file has no parseable YAML frontmatter block |
| `okf/unparseable-frontmatter` | A frontmatter block exists but is not valid YAML |
| `okf/missing-type` | Frontmatter has no non-empty `type` |

Everything else OKF tolerates on purpose. Unknown types, broken cross-links, missing optional
fields, and unrecognized frontmatter keys do not hard-fail, because a partially authored
bundle is still a valid bundle. This permissiveness is a property of the format, not an
oversight, and GraphSpec preserves it.

Parsing is defensive: a file with malformed YAML produces a structured error on that concept
rather than aborting the run, so one bad file cannot take down a whole-bundle operation.

## Profile checks

These enforce the GraphSpec layer. All are warnings by default:

| Rule | Catches |
| --- | --- |
| `profile/filename-token-mismatch` | Filename token disagrees with frontmatter `type` |
| `profile/missing-filename-token` | Filename has no type token |
| `profile/unknown-type` | `type` is outside the 13 type vocabulary |
| `profile/missing-required-field` | A type's required field is absent or empty |
| `profile/invalid-field-value` | A required enum field holds a value outside its list |
| `profile/unknown-relation` | Relation name is not one of the 16 |
| `profile/invalid-relation-source` | The source concept's type may not originate that relation |
| `profile/invalid-relation-target` | A resolved target's type is not allowed for that relation |
| `profile/unresolved-target` | A relation points at a concept that does not exist |

Rule codes are stable and namespaced, so tooling can key off them.

## Strict mode

`--strict` promotes profile warnings to errors, which makes the process exit non-zero:

```bash
npx graph-spec-cli validate spec/ --strict
```

This is the bar to hold a bundle to. A warning that never gets fixed is a spec that quietly
means something other than it appears to.

### The one exception

**Unresolved relation targets stay warnings even under `--strict`.**

This is intentional. OKF supports reference-first authoring: link the concept now, write it
later. Promoting that to an error would break a workflow the format is designed around.

If you want unresolved targets to fail a build, gate on
[`coverage --strict`](/cli/coverage/) instead, which counts them as gaps.

## Reading the output

Diagnostics are sorted by file, then errors before warnings, then rule, so output is stable
across runs and diffable in CI.

```text
$ npx graph-spec-cli validate spec/
specification/deliver-email.requirement.md: warning [profile/missing-required-field]: Requirement requires a non-empty "status" frontmatter field.
4 concept(s), 0 error(s), 1 warning(s)
```

The format is `file: severity [rule]: message`. For structured output use `--json`, which adds
`conceptId` per diagnostic and the `ignored` file list.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | No errors |
| 1 | Errors present |
| 2 | The bundle could not be read |

Note that 1 and 2 are different failures: 1 means your spec has a problem, 2 means the command
could not do its job. Scripts should treat them differently.

## What validation does not check

It does not check that your spec is correct, complete, or sensible. A bundle can pass
`--strict` and still describe nothing useful. Completeness is a separate question, answered by
[coverage](/concepts/coverage/).
