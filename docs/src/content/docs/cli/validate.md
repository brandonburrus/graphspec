---
title: validate
description: Run OKF conformance and GraphSpec profile checks over a bundle, with strict mode and JSON diagnostics.
sidebar:
  order: 2
---

```bash
npx graph-spec-cli validate [path] [--strict] [--json]
```

Runs both validation layers and reports every diagnostic. Exits 1 when errors are present.

| Flag | Effect |
| --- | --- |
| `--strict` | Promote profile warnings to errors, except unresolved targets |
| `--json` | Emit structured diagnostics |

## Output

```text
$ npx graph-spec-cli validate spec/
1 file(s) ignored (no type token): AGENTS.md

27 concept(s), 0 error(s), 0 warning(s)
```

Diagnostics print as `file: severity [rule]: message`, sorted by file, then errors before
warnings, then rule. The ordering is stable, so output diffs cleanly between runs.

The `ignored` line lists `.md` files skipped for having no type token. It is not a problem in
itself, but it is where a concept goes when a rename drops its token, so read it when a node
seems to have disappeared.

## Strict mode

```bash
npx graph-spec-cli validate spec/ --strict
```

```text
27 concept(s), 0 error(s), 0 warning(s) [strict]
```

Every profile warning becomes an error, with one exception: **unresolved relation targets stay
warnings**, because reference-first authoring is a supported workflow. To fail a build on
those, use [`coverage --strict`](/cli/coverage/).

## JSON

```bash
npx graph-spec-cli validate spec/ --json
```

```json
{
  "path": "spec/",
  "strict": false,
  "errorCount": 0,
  "warningCount": 1,
  "conceptCount": 4,
  "ignored": [],
  "diagnostics": [
    {
      "severity": "warning",
      "source": "profile",
      "rule": "profile/missing-required-field",
      "file": "specification/deliver-email.requirement.md",
      "conceptId": "specification/deliver-email.requirement",
      "message": "Requirement requires a non-empty \"status\" frontmatter field."
    }
  ]
}
```

`source` is `okf` or `profile`, which is the fastest way to separate "this bundle is broken"
from "this bundle does not follow the profile". `rule` codes are stable and safe to key off.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | No errors |
| `1` | Errors present |
| `2` | The bundle could not be read |

Under `--strict` a profile warning becomes an error and therefore flips the exit code, which
is the point.

## Notes

- Validation is not a completeness check. A bundle can be `--strict` clean and still be
  missing requirements entirely. That is [`coverage`](/cli/coverage/).
- A file with malformed YAML produces a diagnostic rather than crashing the run, so one bad
  file does not hide the state of the rest of the bundle.

See [Validation](/concepts/validation/) for the full rule list and the reasoning behind the
two layers.
