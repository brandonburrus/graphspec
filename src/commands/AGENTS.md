# src/commands — CLI subcommand implementations

One module per subcommand (`validate`, `query`, `index-cmd`, `graph`, `coverage`, `order`),
plus `io.ts` (the `Writer` seam) and `table.ts` (shared formatting). `src/cli.ts` owns
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
  command that writes to the bundle; run it after adding or renaming concepts, and prefer
  `--dry-run` first.
- Adding a subcommand means: a module here, a `Writer`-injected `run` function, wiring in
  `src/cli.ts`, and an entry in the `cli-contract.contract.md` concept in `spec/`.
