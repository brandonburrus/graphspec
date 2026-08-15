/**
 * Viewer entry point: read the embedded payload, build the shell, wire everything together.
 *
 * Bundled by esbuild into `dist/viewer/viewer.js` and inlined verbatim into every generated
 * HTML file. Nothing here may reach the network unless `serve` mode is on, which is the only
 * case where an origin exists to talk to.
 */

import "./viewer.css";
import type { VisualizePayload } from "../visualize/payload.js";
import { GraphCanvas } from "./canvas.js";
import { el, must } from "./dom.js";
import { Inspector } from "./inspector.js";
import { Sidebar } from "./sidebar.js";
import { ViewerState } from "./state.js";

/** Render-time flags written by `render.ts`. */
interface ViewerConfig {
  serve: boolean;
}

/** Default depth when focus mode is entered, matching a useful `graph --depth`. */
const DEFAULT_FOCUS_DEPTH = 1;

function readJson<T>(id: string, fallback: T): T {
  const node = document.getElementById(id);
  if (!node?.textContent) {
    return fallback;
  }
  return JSON.parse(node.textContent) as T;
}

function boot(): void {
  const payload = readJson<VisualizePayload | null>("graphspec-payload", null);
  const config = readJson<ViewerConfig>("graphspec-config", { serve: false });
  const app = must(document, "#app");

  if (payload === null) {
    app.append(el("p", { class: "gs-fatal", text: "No graph payload found in this document." }));
    return;
  }

  const state = new ViewerState(payload);

  const layout = el("div", { class: "gs-layout" });
  const sidebarHost = el("aside", { class: "gs-sidebar", "aria-label": "Graph controls" });
  const canvasHost = el("main", { class: "gs-canvas-host" });
  const canvas = el("canvas", {
    class: "gs-canvas",
    // The canvas is decorative to assistive tech; the sidebar list is the real surface, and
    // saying so is more honest than an aria-label that promises navigable content.
    role: "presentation",
  });
  const inspectorHost = el("aside", { class: "gs-inspector", "aria-label": "Concept details" });
  const liveRegion = el("p", { class: "gs-sr-only", role: "status", "aria-live": "polite" });

  canvasHost.append(canvas, liveRegion);
  layout.append(sidebarHost, canvasHost, inspectorHost);
  app.append(layout);

  // `graph` is referenced by the select closure defined below it, so it cannot be const.
  let graph: GraphCanvas;

  /** Select a node, sync the URL, and announce it for screen readers. */
  const select = (id: string | null, recenter = false): void => {
    state.selectedId = id;
    const hash = id === null ? "" : `#/${id}`;
    if (window.location.hash !== hash) {
      // replaceState, not assignment: a click per node would otherwise fill the back stack
      // with selections and make the browser Back button useless for leaving the page.
      window.history.replaceState(null, "", hash === "" ? window.location.pathname : hash);
    }
    if (id !== null) {
      const node = state.node(id);
      liveRegion.textContent = node ? `Selected ${node.title}` : "";
      if (recenter) {
        graph.centerOn(id);
      }
    }
    state.emit();
  };

  const focusOn = (id: string): void => {
    const already = state.focus?.id === id;
    state.focus = already ? null : { id, depth: DEFAULT_FOCUS_DEPTH };
    state.selectedId = id;
    graph.rebuild();
    state.emit();
  };

  graph = new GraphCanvas(canvas, state, {
    onSelect: (id) => select(id),
    onFocus: focusOn,
  });
  const sidebar = new Sidebar(sidebarHost, state, {
    onSelect: (id) => select(id, true),
    onChanged: () => {
      graph.rebuild();
      state.emit();
    },
    onFit: () => graph.fit(),
    onUnpinAll: () => graph.unpinAll(),
  });
  const inspector = new Inspector(inspectorHost, state, {
    onSelect: (id) => select(id, true),
    onFocus: focusOn,
  });

  state.subscribe(() => {
    sidebar.render();
    inspector.render();
    graph.draw();
  });

  bindKeyboard(sidebar, state, select);
  bindDeepLink(state, select);
  if (config.serve) {
    bindHotReload(state, graph);
  }

  // Honor a deep link on first load, once the layout has somewhere to center on.
  const initial = conceptFromHash();
  if (initial !== null && state.node(initial)) {
    setTimeout(() => select(initial, true), 400);
  }
}

/** `#/<conceptId>` in the URL, or null. */
function conceptFromHash(): string | null {
  const hash = window.location.hash;
  return hash.startsWith("#/") ? decodeURIComponent(hash.slice(2)) : null;
}

function bindDeepLink(state: ViewerState, select: (id: string | null, recenter?: boolean) => void) {
  window.addEventListener("hashchange", () => {
    const id = conceptFromHash();
    if (id !== state.selectedId && (id === null || state.node(id))) {
      select(id, true);
    }
  });
}

function bindKeyboard(
  sidebar: Sidebar,
  state: ViewerState,
  select: (id: string | null, recenter?: boolean) => void,
): void {
  window.addEventListener("keydown", (event) => {
    const typing =
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement;

    if (event.key === "Escape") {
      if (state.query !== "" || state.focus !== null || state.selectedId !== null) {
        state.query = "";
        state.focus = null;
        select(null);
      }
      return;
    }
    if (typing) {
      return;
    }
    if (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key === "k")) {
      event.preventDefault();
      sidebar.focusSearch();
    }
  });
}

/**
 * Subscribe to `visualize serve` reload events.
 *
 * The payload is swapped into the existing store rather than reloading the page, so the
 * camera, filters, selection, and any parked nodes survive an edit. A page reload would
 * technically show the same data and throw away everything the user set up to look at it.
 */
function bindHotReload(state: ViewerState, graph: GraphCanvas): void {
  const events = new EventSource("/events");
  events.addEventListener("reload", () => {
    void fetch("/payload.json")
      .then((response) => response.json())
      .then((next: VisualizePayload) => {
        state.replacePayload(next);
        graph.rebuild();
      })
      .catch(() => {
        // The server went away (Ctrl-C). The page keeps working against the payload it
        // already has, which is strictly better than blanking it out with an error.
      });
  });
}

boot();
