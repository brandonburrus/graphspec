---
title: What GraphSpec is
description: A CLI and library that stores software specifications as a typed knowledge graph of markdown files, so specs can be queried, checked for completeness, and traversed in build order.
sidebar:
  order: 1
---

GraphSpec stores a software specification as a **knowledge graph** instead of a document.
Every concept (a feature, a component, a requirement, a decision) is one markdown file with
YAML frontmatter, and the frontmatter declares typed edges to other concepts. The CLI reads
that directory, builds the graph in memory, and answers questions about it.

The storage format is [Open Knowledge Format v0.1](https://okf.md/spec), constrained by a
layer GraphSpec calls the **profile**: a closed vocabulary of 13 node types and 16 relations,
plus a filename convention that ties each file to its type.

GraphSpec knows OKF and the GraphSpec profile. It has no awareness of any other spec format.

## What that buys you

**Scoped reads.** The whole point of typed edges is that you can ask for a slice. Building
one component means pulling that component plus the contracts it exposes, the requirements it
satisfies, the constraints on it, and the test scenarios that cover it. A 40 page design doc
cannot be sliced; a graph can.

**Mechanical completeness checks.** Because "this requirement is satisfied by that component"
is an edge rather than a sentence, a missing edge is detectable. `coverage` reports
requirements nothing satisfies, requirements no test scenario covers, features with no
requirements, and constraints attached to nothing.

**A derived build order.** `depends-on` edges between systems and components topologically
sort into a build sequence, and a dependency cycle becomes an error instead of a surprise.

## What it does not do

GraphSpec does not generate code, and it does not write your spec for you. It parses,
validates, queries, and traverses. The [agent skills](/guides/agent-skills/) are what put an
LLM on either end of that pipeline: one authors bundles, the other implements from them.

It also does not enforce a directory layout. Concepts can be grouped however the project
wants. The filename token, not the folder, is what determines a concept's type.

## Who it is for

Both humans and coding agents, with agents as the sharper case. An agent working from a prose
spec either loads the entire document or guesses which part is relevant. An agent working
from a GraphSpec bundle runs one `graph --from` command and gets precisely the concepts that
bear on its current task.

## Next

- [Install](/start/install/) the CLI or the agent skills.
- [Write your first spec](/start/first-spec/) to see the authoring loop end to end.
- [Bundles and concepts](/concepts/bundles/) for how files map to graph nodes.
