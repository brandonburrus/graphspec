# src/profile — the graphspec vocabulary

The single source of truth for what a graphspec bundle may contain: 13 node types and 16
typed relations. Consumed by `src/validate/` and the commands; it imports nothing from them.

## How it works

- `node-types.ts` — `NODE_TYPES`, each with a PascalCase `name` (as it appears in
  frontmatter `type`), a kebab-case filename `token`, a `layer`, `requiredFields`, and
  conventional body `sections`.
- `relations.ts` — `RELATIONS`, each with a `name` plus the allowed `sourceTypes` and
  `targetTypes`. `ANY_TYPE` (`"*"`) means any node type, used by `affects` and `refers-to`.
- `index.ts` — re-exports both and bundles them as `PROFILE`.

## Gotchas

- **This module is data, not behavior.** Extending the vocabulary means adding an entry
  here; it must never mean adding a branch in the validator. If a change cannot be expressed
  as data, the profile shape is wrong, not the caller.
- A `RequiredField` with `values` is an enum and its value is checked against that list. A
  `RequiredField` without `values` accepts any non-empty string. `Constraint.category` is
  the deliberate free-form case; do not "complete" it with an enum.
- `NODE_TYPES` order is display order (product → architecture → specification → glossary)
  and index output depends on it. Append within a layer, do not resort the array.
- The filename token is what ties a file to its type: `<name>.<token>.md`. Two node types
  must never share a token, or filenames stop being unambiguous.
