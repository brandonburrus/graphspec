# src/viewer — the browser app inlined into every visualization

The only browser code in the repo. esbuild bundles it into `dist/viewer/viewer.{js,css}`, and
`src/visualize/render.ts` inlines both into the generated HTML. Nothing here runs in Node.

## Build and typecheck

This directory is **excluded from the root `tsconfig.json`** and typechecked by
`tsconfig.viewer.json` instead, because it needs the DOM lib and the Node build must not have
it. tsc never emits here; esbuild does.

```bash
npm run build:viewer   # esbuild -> dist/viewer/viewer.{js,css}
npm run typecheck      # both tsconfigs, including this one
```

`main.ts` imports `./viewer.css`, which is what makes esbuild emit the sibling stylesheet.
`css.d.ts` exists only so TypeScript tolerates that import.

## Modules

| File | Role |
|------|------|
| `main.ts` | Entry: read the embedded payload, build the shell, wire the panels, keyboard, deep links, hot reload. |
| `state.ts` | The store. Filters, focus, selection, and every derived view. |
| `canvas.ts` | Force layout, painting, pan/zoom/drag/hit-testing. |
| `sidebar.ts` | Search, results, filters, legend, stats. |
| `inspector.ts` | The concept detail panel. |
| `markdown.ts` | Escape-first markdown subset renderer. |
| `search.ts` | Weighted substring scoring. |
| `palette.ts` | Layer colors, read back out of CSS. |
| `nodes.ts` | The node union, shared by `state` and `search` so they need not import each other. |
| `dom.ts` | `el`/`clear`/`must`. |

## Invariants

- **No network, no dependencies at runtime.** The only fetch in the whole app is the hot-reload
  path in `main.ts`, and it is behind the `serve` config flag. A Playwright spec asserts a
  `file://` load makes zero requests.
- **d3-force is the only bundled library, and only for layout math.** Pan, zoom, and hit
  testing are a camera transform and a distance check. Do not add d3-zoom or d3-selection to
  re-implement fifty lines against the DOM; every kilobyte here is added to every
  visualization anyone generates.
- **Color is by profile layer, never by node type.** Thirteen categorical hues is more than a
  reader can distinguish. The three hues plus a neutral were validated for all-pairs
  colorblind separation against both the light and dark canvas surfaces; the glossary layer
  takes the neutral because no fourth hue cleared the floors in both modes. The reasoning and
  the numbers are in the `palette.ts` header. Do not add a fourth hue without re-validating.
- **Canvas colors live in `viewer.css`, not in TypeScript.** Canvas cannot read CSS, so
  `palette.ts` pulls them back via `getComputedStyle`. Renaming a `--gs-layer-*` token means
  changing both files.
- **The sidebar list is the accessibility surface.** A canvas has no accessibility tree, so
  every concept must stay reachable as a real focusable button in the results list, selection
  must stay announced through the `aria-live` region, and any new canvas-only affordance needs
  a keyboard-reachable equivalent here.
- **`el()` renders `aria-*` booleans as the strings `"true"`/`"false"`.** The bare-attribute
  form that `checked` and `open` use is invalid ARIA and announces nothing.
- **Filters and focus hide; search dims.** They are deliberately different mechanisms. A
  search that empties the graph destroys the context you were searching inside.

## Gotchas

- **`draw()` re-applies the devicePixelRatio matrix every frame.** Resetting the transform to
  identity there paints CSS-pixel coordinates onto a device-pixel canvas and shrinks the whole
  graph into the top-left corner on any retina display.
- **Panels re-render granularly, on purpose.** Every pointer move over the canvas sets
  `hoveredId` and emits, so a blanket rebuild throws away the results scroll position, open
  filter groups, keyboard focus, and text selection several times a second. `Sidebar` and
  `Inspector` both memo on what they actually read.
- **The sidebar has exactly one scroll container** (`.gs-scroll`). It used to nest a
  scrollable list inside a scrollable panel, which made rows drift under the pointer as the
  two scroll positions interacted. Keep it to one.
- **`markdown.ts` escapes before it parses.** Every rule runs on already-escaped text, so the
  only markup in the output is markup that module emitted. Link targets additionally go
  through a scheme allowlist, because a concept body must not be able to produce an
  executable `javascript:` link. Widen the rules; never add a pass that emits raw input.
- The code-span placeholder is `<n>`, which is safe precisely because `<` cannot survive
  escaping. That is why it needs no collision handling.
