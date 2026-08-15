---
title: index
description: Regenerate the per-directory index.md listings in a bundle and append a dated entry to log.md.
sidebar:
  order: 4
---

```bash
npx graph-spec-cli index [path] [--log <message>] [--no-index] [--dry-run]
```

Rewrites every directory's `index.md` from the concepts in it, and optionally appends a dated
entry to the bundle-root `log.md`.

This is the only command that **writes to your bundle**.

| Flag | Effect |
| --- | --- |
| `--log <message>` | Append a dated entry to the root `log.md` |
| `--no-index` | Skip regenerating `index.md` files, log only |
| `--dry-run` | Print what would change without writing |

## Output

```text
$ npx graph-spec-cli index spec/ --log "Added the payments feature."
wrote index.md
wrote architecture/index.md
wrote glossary/index.md
wrote product/index.md
wrote specification/index.md
appended log.md entry
```

Preview first when unsure:

```text
$ npx graph-spec-cli index spec/ --dry-run
would write index.md
would write architecture/index.md
would write glossary/index.md
would write product/index.md
would write specification/index.md
```

## What it generates

Each `index.md` lists that directory's concepts grouped by type, using each concept's `title`
and `description`:

```markdown title="product/index.md"
# User Personas
* [Notified User](notify-user.user-persona.md) - A user who wants timely alerts about account activity.

# User Journeys
* [Send Alert](send-alert.user-journey.md) - An account event triggers a notification to the user.

# Features
* [Email Notifications](email-notifications.feature.md) - Notify users of important account events by email.
```

Group order follows the profile's layer order: product, then architecture, then specification,
then glossary.

The root `log.md` accumulates newest-first dated sections:

```markdown title="log.md"
# Update Log

## 2026-08-15
* Added the payments feature.

## 2026-08-13
* Initial dogfood spec.
```

## These files are generated

Hand edits to `index.md` or `log.md` are reverted by the next run. If a listing looks wrong,
fix the concept's `title` or `description` and regenerate, rather than editing the listing.

This is also why a missing `description` is worth fixing: it produces a bare listing entry
that tells a reader nothing.

## When to run it

After adding, removing, or renaming any concept. Two reasons:

1. The listings are how a human browses the bundle in a Git host, where `index.md` renders as
   the directory README.
2. A stale listing quietly misrepresents the bundle to anyone reading it, including an agent.

## Log only

```bash
npx graph-spec-cli index spec/ --no-index --log "Reviewed the payment requirements."
```

Records a change note without touching the listings, for when nothing structural moved.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `2` | The bundle could not be read or written |

## Notes

- `--dry-run` reports which files it would write, not a diff of their contents.
- The date comes from the system clock, in `YYYY-MM-DD`.
- Ignored files such as `AGENTS.md` never appear in a listing, since they are not concepts.
