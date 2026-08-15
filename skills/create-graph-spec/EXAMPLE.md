# Worked example: authoring a small graphspec bundle

This is a real transcript (commands + actual output) from running the `create-graph-spec`
workflow against a fresh bundle. The intent: capture a small "email notifications" feature —
who wants it, the journey it serves, the feature itself, and the requirement it must satisfy.

## Step 1–2: bundle root + node types

New bundle, root `index.md` with no `type` (reserved file):

```markdown
---
okf_version: "0.1"
---

# Subdirectories
* [product](product/index.md)
* [specification](specification/index.md)
```

Four concepts are enough for this intent: a UserPersona who wants the feature, the UserJourney
that surfaces the need, the Feature itself, and the Requirement it must satisfy.
`experiences`/`exercises`/`includes` chain them together (see `references/profile.md`).

## Step 3–4: concept files with relations wired

`product/notify-user.user-persona.md`:

```markdown
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

`product/send-alert.user-journey.md`:

```markdown
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

1. An account event occurs (e.g. login from a new device).
2. The system matches the event against the user's notification preferences.
3. The system delivers an email notification describing the event.
```

`product/email-notifications.feature.md`:

```markdown
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

`specification/deliver-email.requirement.md` — first draft, **missing** the required `status`
field on purpose, to show what step 5 catches:

```markdown
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

## Step 5: validate iteratively

First pass — the missing `status` shows up as a profile warning, not an OKF error, so the
bundle is still usable, just incomplete:

```text
$ npx graphspec validate .
specification/deliver-email.requirement.md: warning [profile/missing-required-field]: Requirement requires a non-empty "status" frontmatter field.
4 concept(s), 0 error(s), 1 warning(s)
```

Running `--strict` at this point promotes it to a real, non-zero-exit error — confirming
strict mode's promotion rule:

```text
$ npx graphspec validate . --strict
specification/deliver-email.requirement.md: error [profile/missing-required-field]: Requirement requires a non-empty "status" frontmatter field.
4 concept(s), 1 error(s), 0 warning(s) [strict]
$ echo $?
1
```

`--json` shows the same diagnostic structured:

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

Fix: add `status: proposed` to the Requirement's frontmatter (Requirement's valid values are
`proposed | accepted | implemented | verified` — `proposed` fits a not-yet-built requirement).
Re-validate, both plain and strict:

```text
$ npx graphspec validate .
4 concept(s), 0 error(s), 0 warning(s)

$ npx graphspec validate . --strict
4 concept(s), 0 error(s), 0 warning(s) [strict]
```

Clean under `--strict` — the bundle is done.

## Step 6: regenerate the index

```text
$ npx graphspec index . --log "Added the email-notifications feature and its persona/journey/requirement."
wrote index.md
wrote product/index.md
wrote specification/index.md
appended log.md entry
```

Resulting `product/index.md` (generated, grouped by type):

```markdown
# User Personas
* [Notified User](notify-user.user-persona.md) - A user who wants timely alerts about account activity.

# User Journeys
* [Send Alert](send-alert.user-journey.md) - An account event triggers a notification to the user.

# Features
* [Email Notifications](email-notifications.feature.md) - Notify users of important account events by email.
```

Resulting `specification/index.md`:

```markdown
# Requirements
* [Deliver Email Notification](deliver-email.requirement.md) - The system must email the user within one minute of a qualifying event.
```

Resulting `log.md`:

```markdown
# Update Log

## 2026-08-13
* Added the email-notifications feature and its persona/journey/requirement.
```

## Step 7: query sanity check

```text
$ npx graphspec query . --type Feature
ID                                   TYPE     TITLE
-----------------------------------  -------  -------------------
product/email-notifications.feature  Feature  Email Notifications

1 concept(s).

$ npx graphspec query . --type Requirement
ID                                       TYPE         TITLE
---------------------------------------  -----------  --------------------------
specification/deliver-email.requirement  Requirement  Deliver Email Notification

1 concept(s).
```

Both new concepts registered under the expected type. The bundle is ready to hand off to
`follow-graph-spec` for implementation.
