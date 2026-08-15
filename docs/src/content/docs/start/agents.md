---
title: Use it with an agent
description: Install the create-graph-spec and follow-graph-spec skills so a coding agent can author a GraphSpec bundle and implement from it.
sidebar:
  order: 4
---

GraphSpec ships two agent skills. One authors bundles, the other builds software from them.
Together they are the intended way to use the tool: the CLI is the mechanism, the skills are
the workflow.

```bash
npx skills add brandonburrus/graphspec
```

The argument is the GitHub repository, not the npm package. See
[Install](/start/install/#install-the-agent-skills) for the flag variants.

## The two skills

**`create-graph-spec`** turns an intent into a bundle. It maps what you describe onto the
closed vocabulary, writes the concept files with correct filename tokens and required fields,
wires the `relations:` edges, and iterates `validate` until `--strict` is clean. It triggers
on requests like "spec out this feature" or "document this system as a GraphSpec".

**`follow-graph-spec`** implements from an existing bundle. Rather than reading everything, it
validates the bundle, checks coverage, gets the build order, and then for each unit of work
pulls only the relevant subgraph and ports the covering test scenarios into real tests. It
triggers on requests like "implement this spec" or "build the next component".

## What using them looks like

Once installed, you do not invoke them by name:

> Spec out the checkout flow as a GraphSpec.

> Implement the next component from the spec.

The skill descriptions carry trigger phrases, so the agent loads the right one from the
request.

## Why this beats pasting a design doc

An agent given a prose spec either loads all of it, burning context on parts that do not
matter, or guesses which section is relevant and misses a constraint. Both failure modes are
invisible until the code is wrong.

An agent given a bundle runs one command:

```bash
npx graph-spec-cli graph spec/ --from architecture/validator.component \
  --rel exposes,uses,satisfies --depth 1
```

and receives exactly the concepts bearing on that component. The scoping is mechanical rather
than judged.

The same applies to tests. `covers` edges point from a TestScenario to what it covers, so an
agent can ask which scenarios a component owes and turn each one into a real test, instead of
inventing test cases and hoping they match intent.

## Portability

Both skills follow the plain `SKILL.md` convention: YAML frontmatter with a name and a
trigger-phrase description, an imperative body, and optional `references/` and `EXAMPLE.md`
files. They have no dependency on any specific agent runtime, so if your tool reads a skills
directory you can also copy the folders in directly.

Details of each skill's workflow are in [Agent skills](/guides/agent-skills/).
