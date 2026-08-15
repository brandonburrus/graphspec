---
title: Gate CI on the spec
description: Run validate and coverage in continuous integration so a malformed or incomplete spec fails the build.
sidebar:
  order: 1
---

A spec that drifts from the code is worse than no spec, because people still trust it. Two
commands in CI keep that from happening quietly.

## The two checks

They answer different questions and you want both:

| Check | Catches |
| --- | --- |
| `validate --strict` | A malformed spec: bad frontmatter, wrong filename token, invalid relation |
| `coverage --strict` | An incomplete spec: requirements nothing implements or tests, dangling references |

A bundle can pass either one and fail the other.

## GitHub Actions

```yaml title=".github/workflows/spec.yml"
name: Spec

on:
  pull_request:
  push:
    branches: [main]

jobs:
  spec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Validate the spec bundle
        run: npx graph-spec-cli validate spec/ --strict

      - name: Check spec coverage
        run: npx graph-spec-cli coverage spec/ --strict
```

Both steps exit 1 on failure, which fails the job. Keeping them as separate steps means the
CI log names which check failed without anyone reading the output.

## Pinning the version

`npx graph-spec-cli` resolves the latest published version, so a new release can change your
build. Pin it if that matters:

```yaml
- run: npx graph-spec-cli@0.1.0 validate spec/ --strict
```

Or add it as a dev dependency and call `npx graphspec`, which resolves the locked version from
`node_modules`.

## Adopting on an existing bundle

Turning on `coverage --strict` against a bundle that has never had it will usually fail. Two
sane ways in:

**Start with validate only.** Add `validate --strict` first, since a well-formed spec is the
prerequisite for coverage meaning anything. Add coverage once the bundle is clean.

**Report before enforcing.** Run coverage without `--strict` for a while so the number is
visible without blocking:

```yaml
- name: Report spec coverage
  run: npx graph-spec-cli coverage spec/
```

Then switch on `--strict` once it reaches zero.

Do not close gaps just to turn the check green. A TestScenario with no real test behind it
makes the report claim protection that does not exist.

## Pre-commit

For faster feedback, run validate before the commit lands:

```bash title=".git/hooks/pre-commit"
#!/bin/sh
npx graph-spec-cli validate spec/ --strict || exit 1
```

Keep `coverage --strict` in CI rather than the hook. Coverage gaps are often legitimately open
mid-branch, and a hook that blocks work in progress gets disabled.

## Keeping generated files current

`index.md` and `log.md` are generated. A stale listing is not a validation failure, so nothing
catches it unless you ask:

```yaml
- name: Check index files are current
  run: |
    npx graph-spec-cli index spec/
    git diff --exit-code spec/
```

This regenerates and fails if anything changed, which means someone added a concept without
re-running `index`.

Omit `--log` here. It is what appends to `log.md`, so leaving it off keeps the check
read-only in effect: the listings are rewritten, and `git diff` decides whether that changed
anything.

## Distinguishing the exit codes

Exit 1 means the spec has a problem. Exit 2 means the command could not run at all, usually a
bad path or a flag typo. In a script, treat them differently:

```bash
npx graph-spec-cli validate spec/ --strict
case $? in
  0) echo "spec ok" ;;
  1) echo "spec has errors"; exit 1 ;;
  2) echo "could not read the bundle; check the path"; exit 2 ;;
esac
```
