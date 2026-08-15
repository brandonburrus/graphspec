/**
 * The left rail: search, results, filters, and the legend.
 *
 * This panel is also the accessibility story for the graph. A canvas has no accessibility
 * tree, so the results list is the equivalent surface: every concept in the bundle is
 * reachable here as a real focusable button, in DOM order, with the same selection behavior
 * as clicking a node. Anything the canvas can do to a node, this list must be able to do too.
 */

import { clear, el } from "./dom.js";
import { type AnyNode, isConcept, titleOf } from "./nodes.js";
import { layerVar } from "./palette.js";
import type { ViewerState } from "./state.js";

/** Callbacks into the app shell. */
export interface SidebarHandlers {
  onSelect(id: string): void;
  onChanged(): void;
  onFit(): void;
  onUnpinAll(): void;
}

/** Depth options offered for focus mode, mirroring `graph --depth`. */
const FOCUS_DEPTHS = [1, 2, 3];

export class Sidebar {
  private readonly searchInput: HTMLInputElement;
  private readonly resultsList: HTMLElement;
  private readonly resultsCount: HTMLElement;
  private readonly filtersHost: HTMLElement;
  private readonly focusHost: HTMLElement;
  private readonly statsHost: HTMLElement;
  /**
   * The panel's single scroll container.
   *
   * Nesting a scrollable results list inside a scrollable panel makes rows move under the
   * pointer as the two scroll positions interact. One scroller, holding the results and the
   * filters, with the brand, search, and stats pinned outside it.
   */
  private readonly scrollHost: HTMLElement;

  /**
   * Memo keys for partial re-rendering.
   *
   * Every hover emits a state change, so a blanket rebuild here would throw away the
   * results list scroll position, any open filter group, and keyboard focus several times a
   * second. Each region rebuilds only when the state it actually reads has changed.
   */
  private lastPayload: unknown = null;
  private lastQuery: string | null = null;
  private lastFocusKey = "";
  private readonly rowsById = new Map<string, HTMLElement>();
  private readonly groupOpen = new Map<string, boolean>();

  constructor(
    root: HTMLElement,
    private readonly state: ViewerState,
    private readonly handlers: SidebarHandlers,
  ) {
    this.searchInput = el("input", {
      class: "gs-search",
      type: "search",
      placeholder: "Search concepts",
      "aria-label": "Search concepts",
      autocomplete: "off",
      spellcheck: "false",
    });
    this.searchInput.addEventListener("input", () => {
      this.state.query = this.searchInput.value;
      this.state.emit();
    });

    this.resultsCount = el("p", { class: "gs-results-count", role: "status" });
    this.resultsList = el("ul", { class: "gs-results", "aria-label": "Concepts" });
    this.filtersHost = el("div", { class: "gs-filters" });
    this.focusHost = el("div", { class: "gs-focus" });
    this.statsHost = el("div", { class: "gs-stats" });
    this.scrollHost = el("div", { class: "gs-scroll" }, [
      this.resultsCount,
      this.resultsList,
      this.filtersHost,
    ]);

    root.append(this.header(), this.searchInput, this.focusHost, this.scrollHost, this.statsHost);
    this.render();
  }

  /** Move keyboard focus into the search box. */
  focusSearch(): void {
    this.searchInput.focus();
    this.searchInput.select();
  }

  /** Repaint the regions whose inputs changed; refresh selection and hover in place. */
  render(): void {
    if (this.searchInput.value !== this.state.query) {
      this.searchInput.value = this.state.query;
    }
    const payloadChanged = this.lastPayload !== this.state.payload;
    const focusKey =
      this.state.focus === null ? "" : `${this.state.focus.id}:${this.state.focus.depth}`;

    if (payloadChanged || focusKey !== this.lastFocusKey) {
      this.lastFocusKey = focusKey;
      this.renderFocus();
    }
    if (payloadChanged || this.lastQuery !== this.state.query) {
      this.lastQuery = this.state.query;
      this.renderResults();
    }
    if (payloadChanged) {
      this.renderFilters();
      this.renderStats();
    }
    this.lastPayload = this.state.payload;
    this.markRows();
  }

  /** Cheap pass: reflect selection and hover on rows already in the DOM. */
  private markRows(): void {
    for (const [id, row] of this.rowsById) {
      const selected = this.state.selectedId === id;
      row.classList.toggle("gs-result-on", selected);
      row.classList.toggle("gs-result-hover", this.state.hoveredId === id);
      if (selected) {
        row.setAttribute("aria-current", "true");
      } else {
        row.removeAttribute("aria-current");
      }
    }
  }

  /** Force the filter panel to rebuild, e.g. after an All/None sweep. */
  private rebuildFilters(): void {
    this.renderFilters();
  }

  private header(): HTMLElement {
    return el("header", { class: "gs-brand" }, [
      el("h1", { text: this.state.payload.bundle.name }),
      el("p", { class: "gs-brand-sub", text: this.state.payload.bundle.root }),
    ]);
  }

  private renderFocus(): void {
    clear(this.focusHost);
    const focus = this.state.focus;
    if (focus === null) {
      return;
    }
    const node = this.state.node(focus.id);
    this.focusHost.append(
      el("p", { class: "gs-focus-label" }, [
        el("strong", { text: "Focused: " }),
        el("span", { text: node ? titleOf(node) : focus.id }),
      ]),
      el(
        "div",
        { class: "gs-focus-controls" },
        FOCUS_DEPTHS.map((depth) => {
          const button = el("button", {
            type: "button",
            class: depth === focus.depth ? "gs-chip gs-chip-on" : "gs-chip",
            text: `${depth} hop${depth === 1 ? "" : "s"}`,
            "aria-pressed": depth === focus.depth,
          });
          button.addEventListener("click", () => {
            this.state.focus = { id: focus.id, depth };
            this.handlers.onChanged();
          });
          return button;
        }),
      ),
      this.button("Clear focus", () => {
        this.state.focus = null;
        this.handlers.onChanged();
      }),
    );
  }

  private renderResults(): void {
    const results = this.state.results();
    const total = this.state.payload.nodes.length;
    this.resultsCount.textContent =
      this.state.query.trim() === ""
        ? `${total} concept${total === 1 ? "" : "s"}`
        : `${results.length} of ${total} match`;

    // Rebuilding replaces the scroll container's children, so restore where the user was.
    const scrollTop = this.scrollHost.scrollTop;
    clear(this.resultsList);
    this.rowsById.clear();
    for (const { node } of results) {
      this.resultsList.append(this.resultRow(node));
    }
    this.scrollHost.scrollTop = scrollTop;
    if (results.length === 0) {
      this.resultsList.append(el("li", { class: "gs-empty", text: "No matching concepts." }));
    }
  }

  private resultRow(node: AnyNode): HTMLElement {
    const button = el("button", { type: "button", class: "gs-result" });
    this.rowsById.set(node.id, button);
    button.append(
      el("span", {
        class: "gs-dot",
        style: `background:var(${layerVar(this.state.layerOf(node))})`,
        "aria-hidden": "true",
      }),
      el("span", { class: "gs-result-title", text: titleOf(node) }),
      el("span", {
        class: "gs-result-type",
        text: isConcept(node) ? (node.type ?? "untyped") : "missing",
      }),
    );
    button.addEventListener("click", () => this.handlers.onSelect(node.id));
    // Hovering a row previews the node's neighborhood on the canvas, so the list and the
    // graph stay one surface rather than two.
    button.addEventListener("mouseenter", () => {
      this.state.hoveredId = node.id;
      this.state.emit();
    });
    button.addEventListener("mouseleave", () => {
      if (this.state.hoveredId === node.id) {
        this.state.hoveredId = null;
        this.state.emit();
      }
    });
    return el("li", {}, [button]);
  }

  private renderFilters(): void {
    clear(this.filtersHost);
    const { filters, payload } = this.state;

    const typeCounts = new Map<string, number>();
    const layerCounts = new Map<string, number>();
    for (const node of payload.nodes) {
      if (!isConcept(node)) {
        continue;
      }
      const type = node.type ?? "untyped";
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      const layer = this.state.layerOf(node);
      layerCounts.set(layer, (layerCounts.get(layer) ?? 0) + 1);
    }

    this.filtersHost.append(
      this.filterGroup(
        "Layers",
        [...layerCounts.keys()],
        filters.layers,
        (name) => `${name} (${layerCounts.get(name)})`,
        true,
      ),
      this.filterGroup(
        "Types",
        [...typeCounts.keys()].sort(),
        filters.types,
        (name) => `${name} (${typeCounts.get(name)})`,
      ),
      this.filterGroup(
        "Relations",
        [...new Set(payload.edges.filter((e) => !e.structural).map((e) => e.relation))].sort(),
        filters.relations,
        (name) => name,
      ),
      this.tagGroup(),
      this.optionsGroup(),
      this.legend(),
    );
  }

  /** A collapsible group of on/off chips backed by a Set in the filter state. */
  private filterGroup(
    title: string,
    names: string[],
    selected: Set<string>,
    label: (name: string) => string,
    open = false,
  ): HTMLElement {
    if (names.length === 0) {
      return el("div");
    }
    const chips = names.map((name) => {
      const on = selected.has(name);
      const chip = el("button", {
        type: "button",
        class: on ? "gs-chip gs-chip-on" : "gs-chip",
        "aria-pressed": on,
        text: label(name),
      });
      chip.addEventListener("click", () => {
        const next = !selected.has(name);
        if (next) {
          selected.add(name);
        } else {
          selected.delete(name);
        }
        // The chip owns its own visual state, so toggling one does not rebuild the panel
        // and collapse whatever groups the user had opened.
        chip.classList.toggle("gs-chip-on", next);
        chip.setAttribute("aria-pressed", String(next));
        this.handlers.onChanged();
      });
      return chip;
    });

    const details = this.group(title, open);
    details.append(
      el("div", { class: "gs-chips" }, chips),
      this.linkRow(
        [
          ["All", () => setAll(selected, names, true)],
          ["None", () => setAll(selected, names, false)],
        ],
        true,
      ),
    );
    return details;
  }

  private tagGroup(): HTMLElement {
    const tags = [...this.state.filters.tags].sort();
    const all = new Set<string>();
    for (const node of this.state.payload.nodes) {
      if (isConcept(node)) {
        for (const tag of node.tags) {
          all.add(tag);
        }
      }
    }
    return this.filterGroup(
      "Tags",
      [...all].sort(),
      this.state.filters.tags,
      (t) => t,
      tags.length > 0 && all.size <= 8,
    );
  }

  private optionsGroup(): HTMLElement {
    const { filters } = this.state;
    const details = this.group("Display", true);
    details.append(
      el("div", { class: "gs-toggles" }, [
        this.toggle("Directory structure edges", filters.showStructural, (on) => {
          filters.showStructural = on;
        }),
        this.toggle("Unwritten link targets", filters.showGhosts, (on) => {
          filters.showGhosts = on;
        }),
        this.toggle("Orphan concepts", filters.showOrphans, (on) => {
          filters.showOrphans = on;
        }),
      ]),
      this.linkRow([
        ["Fit to view", () => this.handlers.onFit()],
        ["Release pinned", () => this.handlers.onUnpinAll()],
      ]),
    );
    return details;
  }

  private legend(): HTMLElement {
    const details = this.group("Legend", true);
    const rows = this.state.payload.profile.layers.map((layer) =>
      el("li", {}, [
        el("span", {
          class: "gs-dot",
          style: `background:var(${layerVar(layer)})`,
          "aria-hidden": "true",
        }),
        el("span", { text: layer }),
      ]),
    );
    rows.push(
      el("li", {}, [
        el("span", { class: "gs-dot gs-dot-ghost", "aria-hidden": "true" }),
        el("span", { text: "not yet written" }),
      ]),
      el("li", {}, [
        el("span", { class: "gs-dot gs-dot-error", "aria-hidden": "true" }),
        el("span", { text: "has an error" }),
      ]),
    );
    details.append(el("ul", { class: "gs-legend" }, rows));
    return details;
  }

  private renderStats(): void {
    clear(this.statsHost);
    const { payload } = this.state;
    const errors = payload.diagnostics.filter((d) => d.severity === "error").length;
    const warnings = payload.diagnostics.filter((d) => d.severity === "warning").length;
    const relations = payload.edges.filter((e) => !e.structural).length;

    const line = (label: string, value: string, tone?: string) =>
      el("div", { class: tone ? `gs-stat gs-stat-${tone}` : "gs-stat" }, [
        el("span", { class: "gs-stat-value", text: value }),
        el("span", { class: "gs-stat-label", text: label }),
      ]);

    this.statsHost.append(
      line("concepts", String(payload.bundle.conceptCount)),
      line("relations", String(relations)),
      line("errors", String(errors), errors > 0 ? "error" : undefined),
      line("warnings", String(warnings), warnings > 0 ? "warning" : undefined),
      line(
        "gaps",
        String(payload.coverage.totalGaps),
        payload.coverage.totalGaps > 0 ? "warning" : undefined,
      ),
    );
  }

  /**
   * A collapsible group whose expanded state outlives a rebuild.
   *
   * The panel is re-created wholesale when the payload changes, and a hot reload that
   * silently re-collapsed every group the user had opened would be worse than no reload.
   */
  private group(title: string, defaultOpen: boolean): HTMLDetailsElement {
    const open = this.groupOpen.get(title) ?? defaultOpen;
    const details = el("details", { class: "gs-group", open });
    details.append(el("summary", { text: title }));
    details.addEventListener("toggle", () => this.groupOpen.set(title, details.open));
    return details;
  }

  private toggle(label: string, checked: boolean, apply: (on: boolean) => void): HTMLElement {
    const input = el("input", { type: "checkbox", checked });
    input.addEventListener("change", () => {
      apply(input.checked);
      this.handlers.onChanged();
    });
    return el("label", { class: "gs-toggle" }, [input, el("span", { text: label })]);
  }

  private button(label: string, onClick: () => void): HTMLElement {
    const button = el("button", { type: "button", class: "gs-link", text: label });
    button.addEventListener("click", onClick);
    return button;
  }

  private linkRow(actions: [string, () => void][], rebuild = false): HTMLElement {
    return el(
      "div",
      { class: "gs-link-row" },
      actions.map(([label, action]) =>
        this.button(label, () => {
          action();
          if (rebuild) {
            this.rebuildFilters();
          }
          this.handlers.onChanged();
        }),
      ),
    );
  }
}

function setAll(target: Set<string>, names: string[], on: boolean): void {
  for (const name of names) {
    if (on) {
      target.add(name);
    } else {
      target.delete(name);
    }
  }
}
