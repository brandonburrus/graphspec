---
title: Install
description: Install the GraphSpec CLI with npx or npm, install the agent skills with the skills CLI, or add the library as a dependency.
sidebar:
  order: 2
---

The npm package is **`graph-spec-cli`**. The command it installs is **`graphspec`**. The two
names differ because npm rejects `graphspec` as too similar to an unrelated existing package.

That distinction matters in exactly one place: `npx` resolves package names, so the portable
invocation is `npx graph-spec-cli`.

## Run without installing

```bash
npx graph-spec-cli validate spec/
```

This is the form used throughout these docs and by both agent skills, because it works in any
directory with no prior setup.

## Install the command

```bash
npm install -g graph-spec-cli
graphspec validate spec/
```

A global install puts `graphspec` on your PATH, which is the shorter thing to type if you run
it often.

Per project instead of globally:

```bash
npm install --save-dev graph-spec-cli
npx graphspec validate spec/
```

Once the package is a local dependency, `npx graphspec` resolves from `node_modules/.bin`, so
either name works.

## Requirements

Node.js 20 or newer. The package is ESM only: `import` it, do not `require` it.

## Install the agent skills

The two skills install with the [skills](https://skills.sh) CLI, which supports Claude Code,
Cursor, Codex, Copilot, Windsurf, Gemini, and others:

```bash
npx skills add brandonburrus/graphspec
```

| Command | Effect |
| --- | --- |
| `npx skills add brandonburrus/graphspec` | Choose skills and agents interactively |
| `npx skills add brandonburrus/graphspec -s create-graph-spec` | Install one skill |
| `npx skills add brandonburrus/graphspec --all` | Every skill, every agent, no prompts |
| `npx skills add brandonburrus/graphspec -g` | Install at user level instead of project level |

Note that the skills argument is the **GitHub repository** (`brandonburrus/graphspec`), which
is a different string from the npm package name. See [Agent skills](/guides/agent-skills/).

## Use as a library

```bash
npm install graph-spec-cli
```

```ts
import { loadBundle, Graph, validateBundle } from "graph-spec-cli";
```

The full surface is in the [JavaScript API](/library/api/) reference.

## Verify

```bash
npx graph-spec-cli --version
npx graph-spec-cli --help
```
