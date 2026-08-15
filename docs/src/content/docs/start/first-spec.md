---
title: Write your first spec
description: Build a four concept GraphSpec bundle from an empty directory, wire its relations, and iterate with validate until it passes under --strict.
sidebar:
  order: 3
---

This walks a small bundle from empty directory to a clean `--strict` run. The intent being
captured: email notifications, covering who wants them, the journey that surfaces the need,
the feature itself, and the requirement it must satisfy.

Every command and every output below is real.

## 1. Create the bundle root

A bundle is just a directory. Its root `index.md` is a **reserved file**: it is never a
concept and needs no `type`.

```markdown title="index.md"
---
okf_version: "0.1"
---

# Subdirectories
* [product](product/index.md)
* [specification](specification/index.md)
```

Grouping into `product/` and `specification/` is a convention, not a rule. GraphSpec derives
type from the filename, never from the folder.

## 2. Write the concepts

Each file is named `<name>.<type-token>.md`, where the token is the kebab-case form of the
type. Relations go in frontmatter under `relations:`.

```markdown title="product/notify-user.user-persona.md"
---
type: UserPersona
title: Notified User
description: A user who wants timely alerts about account activity.
tags: [persona]
relations:
  experiences:
    - /product/send-alert.user-journey.md
---

# Goals

- Learn about important account activity as soon as it happens.

# Pains

- Misses critical events because there is no timely notification.
```

```markdown title="product/send-alert.user-journey.md"
---
type: UserJourney
title: Send Alert
description: An account event triggers a notification to the user.
tags: [journey]
relations:
  exercises:
    - /product/email-notifications.feature.md
---

# Flow

1. An account event occurs, such as a login from a new device.
2. The system matches the event against the user's notification preferences.
3. The system delivers an email notification describing the event.
```

```markdown title="product/email-notifications.feature.md"
---
type: Feature
title: Email Notifications
description: Notify users of important account events by email.
tags: [feature, notifications]
relations:
  includes:
    - /specification/deliver-email.requirement.md
---

# Summary

Send an email to the user within one minute of a qualifying account event.
```

The last one deliberately omits `status`, which Requirement requires, to show what validation
catches:

```markdown title="specification/deliver-email.requirement.md"
---
type: Requirement
title: Deliver Email Notification
description: The system must email the user within one minute of a qualifying event.
tags: [requirement, notifications]
---

# Acceptance Criteria

- A qualifying account event enqueues an email notification within 1 minute.
- The email includes the event type, timestamp, and a link to account activity.
- Delivery failures are retried up to 3 times before being logged as failed.
```

Those three relations chain the concepts together: persona `experiences` journey, journey
`exercises` feature, feature `includes` requirement.

## 3. Validate, and keep validating

Run `validate` every concept or two rather than only at the end.

```text
$ npx graph-spec-cli validate .
specification/deliver-email.requirement.md: warning [profile/missing-required-field]: Requirement requires a non-empty "status" frontmatter field.
4 concept(s), 0 error(s), 1 warning(s)
```

The missing field is a **warning**, not an error, so the bundle still loads and the graph is
still usable. Only two things are hard errors: unparseable frontmatter, and a missing `type`.
See [Validation](/concepts/validation/).

`--strict` promotes profile warnings to errors and exits non-zero:

```text
$ npx graph-spec-cli validate . --strict
specification/deliver-email.requirement.md: error [profile/missing-required-field]: Requirement requires a non-empty "status" frontmatter field.
4 concept(s), 1 error(s), 0 warning(s) [strict]
$ echo $?
1
```

When a message is not enough, `--json` gives the structured `rule`, `file`, and `conceptId`:

```json
{
  "path": ".",
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

Add `status: proposed` to the requirement, then re-run both:

```text
$ npx graph-spec-cli validate .
4 concept(s), 0 error(s), 0 warning(s)

$ npx graph-spec-cli validate . --strict
4 concept(s), 0 error(s), 0 warning(s) [strict]
```

Clean under `--strict` is the bar.

## 4. Regenerate the index

```text
$ npx graph-spec-cli index . --log "Added the email-notifications feature and its persona/journey/requirement."
wrote index.md
wrote product/index.md
wrote specification/index.md
appended log.md entry
```

Every directory's `index.md` is rewritten from the concepts in it, grouped by type:

```markdown title="product/index.md"
# User Personas
* [Notified User](notify-user.user-persona.md) - A user who wants timely alerts about account activity.

# User Journeys
* [Send Alert](send-alert.user-journey.md) - An account event triggers a notification to the user.

# Features
* [Email Notifications](email-notifications.feature.md) - Notify users of important account events by email.
```

These files are generated. Editing them by hand is churn that the next `index` run reverts.

## 5. Sanity check

```text
$ npx graph-spec-cli query . --type Feature
ID                                   TYPE     TITLE
-----------------------------------  -------  -------------------
product/email-notifications.feature  Feature  Email Notifications

1 concept(s).
```

If a concept you just wrote is missing here, check its filename token against its frontmatter
`type`. A mismatch between the two is the most common warning.

## Next

- [Relations and the graph](/concepts/relations/) for how edges resolve and traverse.
- [Coverage](/concepts/coverage/) to find what the spec has not said yet.
- [Node types](/profile/node-types/) for the full vocabulary and required fields.
