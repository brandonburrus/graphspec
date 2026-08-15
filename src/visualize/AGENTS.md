# src/visualize — bundle to a self-contained HTML page

Sits between `validate` and `commands` in the one-way layering: it consumes a bundle, a graph,
diagnostics, and a coverage report, and produces one HTML document. Both `visualize` and
`visualize serve` build a page through here, so there is one pipeline, not two.

The browser half lives in `src/viewer/` and is bundled separately. See `src/viewer/AGENTS.md`.

## Modules

| File | Role |
|------|------|
| `index.ts` | `buildVisualization(path, title)`: load, analyze, fold into a payload. Re-exports the rest. |
| `payload.ts` | The `VisualizePayload` shape and the pure fold that produces it. |
| `render.ts` | `renderHtml(payload, assets, options)`: pure, assets injected. |
| `assets.ts` | The only impure part: reads `dist/viewer/viewer.{js,css}` off disk. |

## Invariants

- **The output is self-contained.** No `<script src>`, no stylesheet `link`, no remote font or
  image, ever. A test in `tests/visualize-render.test.ts` asserts this against the rendered
  document, and a Playwright spec asserts the loaded page issues zero network requests. Both
  exist because "we inlined everything" is the kind of claim that silently stops being true.
- **`render.ts` never touches disk.** Assets arrive as strings. `pnpm test` does not run
  `pnpm build`, so a renderer that read `dist/` at import time would fail the suite on a clean
  checkout. Tests feed it stub assets; `assets.ts` does the real read.
- **`assets.ts` resolves from the package root, not from its own directory.** Both
  `dist/visualize/assets.js` and `src/visualize/assets.ts` sit two levels below the package
  root, so `new URL("../../", import.meta.url)` plus `dist/viewer/...` works when running the
  built CLI *and* when vitest imports straight from `src/`.
- **The payload carries the profile vocabulary.** Node types, relations, and layers all travel
  in the JSON, so the viewer holds no hardcoded knowledge of the 13 types and 16 relations.
  Adding vocabulary stays a one-file change in `src/profile/`.
- **Unresolved relation targets become ghost nodes**, not dropped edges. Reference-first
  authoring is an explicit product constraint; the graph has to show the concept you linked
  before you wrote it.
- **`<` is escaped to `<` in the embedded JSON.** That makes a closing script tag inside
  a concept body impossible to emit rather than something filtered afterwards. Do not
  "simplify" it to a `</script>` replacement.
- **Structural (`child`) edges are always in the payload**, flagged with `structural: true`.
  The CLI's `graph` command needs `--structure` because text output has to choose; a UI can
  toggle, so the data ships and the viewer decides.

## Gotchas

- Concept bodies are embedded whole. That is what makes the page readable offline, and it
  means output size tracks bundle size. There is a stderr note above 5 MB. If it ever needs
  a real fix, the upgrade path is a `--no-body` flag that drops `body` and `sections`.
- `PAYLOAD_VERSION` exists so a stale HTML file and a newer viewer fail loudly rather than
  rendering half a graph. Bump it on any breaking shape change.
