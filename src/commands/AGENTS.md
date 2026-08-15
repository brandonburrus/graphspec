# src/commands — CLI subcommand implementations

One module per subcommand (`validate`, `query`, `index-cmd`, `graph`, `coverage`, `order`,
`visualize`, `visualize-serve`), plus `io.ts` (the `Writer` seam) and `table.ts` (shared
formatting). `src/cli.ts` owns
Commander wiring and flag parsing; these modules own behavior.

`src/cli.ts` is the entry point and does nothing but run the program. The program itself is
built in `src/program.ts`, so tests can inspect it without importing a module that parses
argv and exits. Do not merge them back: guarding the entry with an
`import.meta.url === process.argv[1]` check looks equivalent but silently disables the CLI
when it runs through a symlinked `node_modules/.bin` entry.

## Contract every command follows

- Signature is `run<Name>(path, options, writer) => Promise<number>`, returning the process
  exit code. **Commands never touch `process.stdout`/`stderr`/`exit` directly** — all output
  goes through the injected `Writer`. That seam is the only reason these are testable
  in-process; tests pass a `BufferWriter` and assert on `outText`/`errText`.
- Options arrive as raw strings from Commander (`depth: "1"`, not `1`). Each command
  validates and coerces its own flags, and reports a usage error rather than throwing.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success. |
| 1 | The bundle was read fine but failed the check: validation errors, coverage gaps under `--strict`, a dependency cycle in `order`. |
| 2 | Usage or I/O failure: bad flag value, unknown format or relation, unresolved `--from`, unreadable bundle. |

Keep this split intact. Scripts and agents distinguish "your spec has a problem" (1) from
"you invoked me wrong" (2).

## Gotchas

- `graph --from` accepts either a bare concept ID or the leading-slash `.md` reference form
  used by `relations:` targets; it normalizes through `normalizeRef` before selection but
  reports the raw input in the not-found error, so the message echoes what the user typed.
- `--direction` without `--from` is a no-op and emits a note rather than an error, because
  the traversal it would modify never runs.
- `index-cmd` rewrites every `index.md` in place and can append to `log.md`. It is the only
  command that writes *into* the bundle; run it after adding or renaming concepts, and prefer
  `--dry-run` first. `visualize` also writes, but outside the bundle.
- **`visualize` never returns 1.** Validation errors and coverage gaps are rendered into the
  page instead, because a broken graph is the one most worth looking at. That is the
  permissive-OKF constraint applied to this surface, not an oversight.
- `visualize serve` is the only long-running command. It takes an `onReady` option purely as a
  test seam, so a test can drive the live server and shut it down instead of blocking on a
  signal. `serve` being a subcommand means a bundle directory literally named `serve` has to
  be passed as `./serve`.
- Adding a subcommand means: a module here, a `Writer`-injected `run` function, wiring in
  `src/program.ts`, an entry in the `cli-contract.contract.md` concept in `spec/`, and a page
  under `docs/src/content/docs/cli/` plus its sidebar entry in `docs/astro.config.mjs`.
