# src/validate — conformance and profile checks

Produces `Diagnostic`s over a bundle in two distinct layers that must not be conflated.

## The two layers

- `okf.ts` — **OKF v0.1 conformance. Always hard errors, and there are only two:** no
  parseable frontmatter block, and no non-empty `type`. OKF is otherwise permissive by
  specification. Adding a new hard error here is almost always wrong; it breaks bundles that
  are legally OKF-conformant.
- `profile.ts` — **graphspec profile checks. Warnings by default**, promoted to errors under
  `strict`. Covers filename-token/type agreement, vocabulary membership, required fields and
  their enums, relation names, and allowed relation source and target types.
- `diagnostics.ts` — the `Diagnostic` shape, `Severity`, and `summarize`.
- `index.ts` — `validateBundle` orchestrates both and sorts the result.

## Gotchas

- **Unresolved relation targets stay warnings even under `strict`.** This is the one
  deliberate exception to strict promotion, because OKF supports linking a concept before
  authoring it. Do not "fix" it.
- Every check reads the vocabulary from `src/profile/`. A new node type or relation must
  require zero edits in this directory; if it does not, the check is hardcoding vocabulary.
- Rule codes are namespaced and stable (`okf/missing-type`, `profile/filename-token-
  mismatch`). Machine consumers and any future suppression mechanism key off them, so treat
  a rule code as API: renaming one is a breaking change.
- Diagnostics are sorted by file, then errors before warnings, then rule. Output ordering is
  asserted by tests and by the golden-bundle expectation, so keep the sort stable.
- `checkProfile` takes the `Graph`, not the raw concept list, because relation checks need
  target resolution. `checkOkfConformance` takes the concept list, because it is per-file.
