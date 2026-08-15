---
title: visualize
description: Render a bundle as one self-contained, interactive HTML graph that can be navigated, searched, and inspected offline, or serve it live while authoring.
sidebar:
  order: 7
---

```bash
npx graph-spec-cli visualize [path] [--out <file>] [--title <text>] [--open]
npx graph-spec-cli visualize serve [path] [--port <n>] [--title <text>] [--no-open]
```

Writes the whole bundle as a single HTML file: a force-directed graph of every concept and
relation, a search and filter rail, and an inspector that shows a concept's frontmatter, body,
relations, diagnostics, and coverage gaps.

Where `graph` gives you a slice to feed a tool, `visualize` gives you the whole thing to look
at. It is the command for reviewing a spec with someone, or for finding your bearings in a
bundle you did not write.

| Flag | Effect |
| --- | --- |
| `--out <file>` | Output path. Default `graphspec-graph.html` |
| `--title <text>` | Page title. Defaults to the bundle directory name |
| `--open` | Open the file in your default browser once written |

```bash
npx graph-spec-cli visualize spec/ --out spec-graph.html --open
```

```
wrote /private/tmp/spec-graph.html (33 concept(s), 60 relation(s), 112.3 KB)
```

## One file, no network

The output references nothing external: no CDN script, no stylesheet link, no remote font.
Concept bodies travel inside it, so the page is a complete offline read of the bundle. Mail
it, commit it as a build artifact, or open it on a machine with no internet.

The size is roughly the size of the bundle's markdown plus about 50 KB of viewer. A bundle
large enough for that to matter gets a note on stderr.

## Reading the graph

Every node type has its own color, and every profile layer its own shape. The two work
together: thirteen colors alone is more than anyone can tell apart, so the shape narrows it to
at most five, and the color names the type within that group.

| Shape | Layer | Types |
| --- | --- | --- |
| Circle | product | UserPersona, UserJourney, Feature |
| Square | architecture | System, Component, Integration, Contract, DataModel |
| Diamond | specification | Requirement, Constraint, Decision, TestScenario |
| Triangle | glossary | Term |

The legend in the left rail lists all thirteen. Node size tracks how many relations a concept
has.

| Signal | Meaning |
| --- | --- |
| Dashed hollow node | A relation target with no file yet. See below |
| Red ring | The concept has a validation error |
| Thin ring | You parked this node by dragging it |
| Dashed edge | An implicit directory parent-to-child edge |
| Arrowhead | The direction the relation points |

Targets you have linked but not written yet appear as dashed hollow nodes rather than being
dropped. OKF supports reference-first authoring, so those are legal, and seeing them is the
point: the graph shows what you have promised yourself you will write.

## Getting around

| Action | Result |
| --- | --- |
| Click a node or a list row | Select it and open the inspector |
| Double-click a node | Focus its neighborhood; everything else hides |
| Drag a node | Park it there. Shift-click a parked node to release it |
| Scroll | Zoom, anchored at the pointer |
| Drag the background | Pan |
| `/` or `Cmd`/`Ctrl`+`K` | Jump to search |
| `Escape` | Clear the search, the focus, and the selection |

Search matches titles, IDs, types, tags, descriptions, and body text, and every term has to
match. It dims non-matches rather than hiding them, so you keep the context you were searching
inside. The filter chips are what actually hide things.

Selecting a concept puts `#/<concept-id>` in the URL, so a particular concept is a link you
can bookmark or paste to someone.

## Serving it live

```bash
npx graph-spec-cli visualize serve spec/
```

```
serving spec at http://localhost:3737/
watching for changes; press Ctrl-C to stop
```

Serves the same view and rebuilds it whenever a `.md` file under the bundle changes. The page
swaps the new data into the running graph instead of reloading, so your camera position,
filters, selection, and parked nodes all survive the edit. That makes it usable as a second
monitor while you author.

| Flag | Effect |
| --- | --- |
| `--port <n>` | Port to listen on. Default `3737` |
| `--no-open` | Do not launch a browser on start |

If `3737` is busy the server walks forward to the next free port and prints the URL it got. A
port you asked for explicitly is an error if it is taken, rather than a silent substitution.

One naming quirk: `serve` is a subcommand, so a bundle directory literally named `serve` has
to be passed as `./serve`.

## Exit codes

`visualize` never returns `1`. A bundle with validation errors is exactly the one worth
looking at, so problems are rendered inside the page rather than blocking it. `2` still means
the bundle could not be read or the file could not be written.

## Accessibility

The graph is a canvas, which assistive technology cannot navigate. The concept list in the
left rail is the equivalent surface: every concept in the bundle is a real focusable button
there, selection is announced, and every control is reachable by keyboard.

Color is never the only channel. Each node's shape carries its layer, every list row and
legend entry is labeled with its type in text, and the color ramps were checked for
colorblind separation against both the light and dark backgrounds.
