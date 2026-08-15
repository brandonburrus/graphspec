---
title: CLI overview
description: The seven GraphSpec commands, the invocation forms, exit-code conventions, and which command answers which question.
sidebar:
  order: 1
---

```bash
npx graph-spec-cli <command> [path] [flags]
```

`path` defaults to `.` on every command. The npm package is `graph-spec-cli` and the installed
binary is `graphspec`, so `graphspec <command>` also works once it is installed. See
[Install](/start/install/).

## The commands

| Command | Question it answers |
| --- | --- |
| [`validate`](/cli/validate/) | Is this bundle well formed? |
| [`query`](/cli/query/) | Which concepts match these filters? |
| [`index`](/cli/index-command/) | Regenerate the directory listings and log |
| [`graph`](/cli/graph/) | What is connected to this concept? |
| [`coverage`](/cli/coverage/) | What has the spec not said yet? |
| [`order`](/cli/order/) | What should be built first? |
| [`visualize`](/cli/visualize/) | What does the whole graph look like? |

## Exit codes

Every command uses the same three:

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | The spec failed the check: validation errors, coverage gaps under `--strict`, a dependency cycle |
| `2` | You invoked it wrong: bad flag value, unknown format or relation, unresolved `--from`, unreadable bundle |

`visualize` is the one command that never returns `1`: a bundle with problems is exactly the
one you want to look at, so its problems are drawn into the page instead.

The split between 1 and 2 is deliberate and worth respecting in scripts. `1` means the bundle
has a problem worth reporting to a human. `2` means the command never got far enough to judge,
so retrying with the same arguments will not help.

## JSON output

Every command takes `--json` except `index` and `visualize`, which report what they wrote. Use it for anything
programmatic: the human formats are meant to be read, not parsed.

| Command | Shape |
| --- | --- |
| `validate --json` | `{ path, strict, errorCount, warningCount, conceptCount, ignored, diagnostics }` |
| `query --json` | Array of `{ id, type, title, description, tags, status }` |
| `graph` (default) | `{ nodes: [{id, type, title}], edges: [{from, to, relation}] }` |
| `coverage --json` | Eight gap arrays plus `totalGaps` |
| `order --json` | `{ order: string[], cycles: string[][] }` |

Note that `query --json` does **not** include relations. To see what a concept connects to,
use `graph` or read the file.

## A typical loop

Authoring:

```bash
npx graph-spec-cli validate .            # after every concept or two
npx graph-spec-cli validate . --strict   # the bar before calling it done
npx graph-spec-cli index . --log "..."   # regenerate listings
npx graph-spec-cli query . --type Requirement
npx graph-spec-cli visualize serve .     # a live map while you write
```

Implementing:

```bash
npx graph-spec-cli validate spec/ --strict   # trust but verify
npx graph-spec-cli coverage spec/            # know the gaps before you start
npx graph-spec-cli order spec/               # what to build first
npx graph-spec-cli graph spec/ --from <id> --depth 1   # pull one unit of work
```

## Global flags

| Flag | Effect |
| --- | --- |
| `-V`, `--version` | Print the version |
| `-h`, `--help` | Help for the CLI or a specific command |

`npx graph-spec-cli <command> --help` prints the flags for one command.
