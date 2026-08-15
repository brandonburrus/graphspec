---
title: Agent skills
description: How the create-graph-spec and follow-graph-spec skills work, what each one does step by step, and how to install them.
sidebar:
  order: 2
---

GraphSpec ships two agent skills. They are the intended workflow: the CLI is the mechanism,
the skills are how an agent uses it well.

```bash
npx skills add brandonburrus/graphspec
```

The argument is the GitHub repository, which is a different string from the npm package name
(`graph-spec-cli`). Flag variants are in [Install](/start/install/#install-the-agent-skills).

## `create-graph-spec`

Turns a product or engineering intent into a valid bundle.

It triggers on requests like "write a spec", "spec out this feature", "document this system as
a GraphSpec", or "add a requirement to the spec", and when the agent is working in a directory
that already looks like a bundle.

Its workflow:

1. **Establish or locate the bundle root.** Work inside an existing bundle rather than
   starting a second one.
2. **Choose node types from the closed vocabulary.** Map the intent onto the 13 types instead
   of inventing new ones.
3. **Write each concept file.** Correct filename token, required fields for that type, and the
   conventional body sections.
4. **Wire relations.** Only source and target type combinations the profile allows.
5. **Validate iteratively.** After every concept or two, not only at the end. OKF errors
   first, then profile warnings, then `--strict` clean.
6. **Regenerate the index.**
7. **Sanity check with query.** Confirm the new concepts registered under the expected type.

The step that most changes output quality is 5. Validating continuously catches a wrong
filename token while there is one file to fix, rather than fifteen.

## `follow-graph-spec`

Implements software from an existing bundle, pulling only the subgraph relevant to each unit
of work.

It triggers on "implement this spec", "build from the GraphSpec", or "implement the next
component in the spec".

Its workflow:

1. **Trust but verify.** `validate --strict` before reading anything. Do not build on an
   unsound bundle: a filename mismatch or a relation to the wrong target type means the graph
   does not mean what it appears to.
2. **Surface coverage gaps and decide about them.** Before starting, not after.
3. **Get the build order.** `order` derives the sequence from `depends-on`.
4. **Per unit of work, pull the targeted subgraph.** `graph --from <id> --rel ... --depth 1`,
   then read the returned concept files in full.
5. **Port the covering test scenarios into real tests.** Found with `--rel covers
   --direction in`, since `covers` originates at the TestScenario.
6. **After implementing,** confirm the gap closed and the bundle is still `--strict` clean.

Step 4 is the whole point. The alternative, reading the entire bundle for every change, is
what the graph exists to avoid.

## Why the direction detail matters

Both skills carry the same non-obvious rule: `constrains` and `covers` originate at the
Constraint and the TestScenario, not at the thing they describe. Asking what constrains a
component with the default `--direction out` returns nothing, which reads like "unconstrained"
but actually means "wrong direction".

An agent that does not know this silently ships code that violates a constraint the spec
states plainly. That is why it is written down in the skill rather than left to inference.

## What ships with each skill

Both follow the plain `SKILL.md` convention with no dependency on a specific agent runtime:

| File | Contents |
| --- | --- |
| `SKILL.md` | Frontmatter with trigger phrases, plus the imperative workflow |
| `EXAMPLE.md` | A real transcript, commands and actual output |
| `references/` | `profile.md` for the vocabulary, `traversal.md` for the CLI and direction rules |

The `EXAMPLE.md` files are real runs rather than illustrations, which matters because an
example whose output does not match the tool teaches the agent something false.

## Using them

You do not invoke skills by name. The trigger phrases in each description let the agent pick
the right one:

> Spec out the checkout flow as a GraphSpec.

> Implement the next component from the spec.

## Installing manually

If your agent tool reads a skills directory but you would rather not use the skills CLI, copy
`skills/create-graph-spec` and `skills/follow-graph-spec` from the repository into it. There is
nothing runtime-specific inside them.
