/**
 * The right panel: everything known about one concept.
 *
 * This is what makes the generated file a real offline read of the bundle rather than a
 * picture of it. Frontmatter (including keys the profile has never heard of), the rendered
 * body, both directions of every relation, and the concept's own diagnostics and coverage
 * gaps all land here, so a reader never has to go back to the filesystem.
 */

import type { PayloadEdge } from "../visualize/payload.js";
import { clear, el } from "./dom.js";
import { renderMarkdown } from "./markdown.js";
import { type AnyNode, isConcept, titleOf } from "./nodes.js";
import { layerVar } from "./palette.js";
import type { ViewerState } from "./state.js";

/** Callbacks into the app shell. */
export interface InspectorHandlers {
  onSelect(id: string): void;
  onFocus(id: string): void;
}

export class Inspector {
  /**
   * What the panel currently shows. Hover emits a state change on every pointer move, and
   * re-rendering a markdown body that often is both wasteful and destroys text selection.
   */
  private renderedId: string | null = null;
  private renderedPayload: unknown = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly state: ViewerState,
    private readonly handlers: InspectorHandlers,
  ) {
    // One delegated listener rather than per-link wiring: the body is re-rendered wholesale
    // on every selection change, and links inside it are generated markdown.
    root.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest("[data-concept]");
      const id = target?.getAttribute("data-concept");
      if (id !== null && id !== undefined && this.state.node(id)) {
        event.preventDefault();
        this.handlers.onSelect(id);
      }
    });
    this.render();
  }

  render(): void {
    const payloadChanged = this.renderedPayload !== this.state.payload;
    if (!payloadChanged && this.renderedId === this.state.selectedId) {
      return;
    }
    this.renderedId = this.state.selectedId;
    this.renderedPayload = this.state.payload;

    clear(this.root);
    const id = this.state.selectedId;
    const node = id === null ? undefined : this.state.node(id);

    if (!node) {
      this.root.append(this.placeholder());
      return;
    }
    this.root.append(...(isConcept(node) ? this.conceptView(node) : this.ghostView(node)));
  }

  private placeholder(): HTMLElement {
    return el("div", { class: "gs-placeholder" }, [
      el("p", { text: "Select a concept to inspect it." }),
      el("ul", { class: "gs-hints" }, [
        el("li", { text: "Click a node, or a row in the list on the left." }),
        el("li", { text: "Double-click a node to focus its neighborhood." }),
        el("li", { text: "Drag a node to park it; shift-click a parked node to release it." }),
        el("li", { text: "Press / to search, Escape to clear." }),
      ]),
    ]);
  }

  /** The reference-first case: something links here, but the file does not exist yet. */
  private ghostView(node: AnyNode & { referencedBy: readonly string[] }): HTMLElement[] {
    return [
      el("header", { class: "gs-inspect-head" }, [
        el("p", { class: "gs-badge gs-badge-ghost", text: "not yet written" }),
        el("h2", { text: node.id }),
        el("p", {
          class: "gs-inspect-note",
          text: "This concept is referenced but has no file in the bundle. Under OKF that is legal: you can link a concept before you write it.",
        }),
      ]),
      this.section(
        "Referenced by",
        el(
          "ul",
          { class: "gs-rel-list" },
          node.referencedBy.map((from) => el("li", {}, [this.conceptLink(from)])),
        ),
      ),
    ];
  }

  private conceptView(node: AnyNode): HTMLElement[] {
    if (!isConcept(node)) {
      return [];
    }
    const parts: HTMLElement[] = [];
    const layer = this.state.layerOf(node);

    const head = el("header", { class: "gs-inspect-head" }, [
      el("p", { class: "gs-badge", style: `--badge:var(${layerVar(layer)})` }, [
        el("span", { class: "gs-dot", style: `background:var(${layerVar(layer)})` }),
        el("span", { text: node.type ?? "untyped" }),
      ]),
      el("h2", { text: titleOf(node) }),
      el("p", { class: "gs-inspect-path", text: node.relPath }),
    ]);
    if (node.description !== null) {
      head.append(el("p", { class: "gs-inspect-desc", text: node.description }));
    }

    const focusButton = el("button", {
      type: "button",
      class: "gs-link",
      text: "Focus neighborhood",
    });
    focusButton.addEventListener("click", () => this.handlers.onFocus(node.id));
    head.append(el("div", { class: "gs-link-row" }, [focusButton]));
    parts.push(head);

    const problems = this.problems(node);
    if (problems) {
      parts.push(problems);
    }

    parts.push(this.section("Frontmatter", this.frontmatterTable(node.frontmatter)));

    const relations = this.relations(node.id);
    if (relations) {
      parts.push(relations);
    }

    if (node.body.trim() !== "") {
      parts.push(
        this.section(
          "Body",
          el("div", {
            class: "gs-md",
            html: renderMarkdown(node.body, (href) => this.resolveLink(href)),
          }),
        ),
      );
    }
    return parts;
  }

  /**
   * Diagnostics and coverage gaps for this concept.
   *
   * Surfaced at the top rather than buried: the reason to open a spec graph is usually to
   * find what is wrong with it, and `validate` and `coverage` already know.
   */
  private problems(node: AnyNode): HTMLElement | null {
    const diagnostics = this.state.diagnosticsFor(node);
    const gaps = this.state.coverageGapsFor(node.id);
    if (diagnostics.length === 0 && gaps.length === 0) {
      return null;
    }
    const items = [
      ...diagnostics.map((d) =>
        el("li", { class: `gs-problem gs-problem-${d.severity}` }, [
          el("span", { class: "gs-problem-rule", text: d.rule }),
          el("span", { text: d.message }),
        ]),
      ),
      ...gaps.map((gap) =>
        el("li", { class: "gs-problem gs-problem-gap" }, [
          el("span", { class: "gs-problem-rule", text: "coverage" }),
          el("span", { text: gap }),
        ]),
      ),
    ];
    return this.section("Problems", el("ul", { class: "gs-problems" }, items));
  }

  /** Every frontmatter key in file order, so custom keys are as visible as profile ones. */
  private frontmatterTable(frontmatter: Record<string, unknown>): HTMLElement {
    const rows = Object.entries(frontmatter).map(([key, value]) =>
      el("tr", {}, [el("th", { scope: "row", text: key }), el("td", { text: formatValue(value) })]),
    );
    if (rows.length === 0) {
      return el("p", { class: "gs-empty", text: "No frontmatter." });
    }
    return el("table", { class: "gs-fm" }, [el("tbody", {}, rows)]);
  }

  private relations(id: string): HTMLElement | null {
    const { outgoing, incoming } = this.state.edgesTouching(id);
    if (outgoing.length === 0 && incoming.length === 0) {
      return null;
    }
    const body = el("div", { class: "gs-rels" });
    if (outgoing.length > 0) {
      body.append(this.relationGroup("Outgoing", outgoing, (edge) => edge.to));
    }
    if (incoming.length > 0) {
      body.append(this.relationGroup("Incoming", incoming, (edge) => edge.from));
    }
    return this.section("Relations", body);
  }

  private relationGroup(
    title: string,
    edges: PayloadEdge[],
    other: (edge: PayloadEdge) => string,
  ): HTMLElement {
    const byRelation = new Map<string, PayloadEdge[]>();
    for (const edge of edges) {
      const list = byRelation.get(edge.relation);
      if (list) {
        list.push(edge);
      } else {
        byRelation.set(edge.relation, [edge]);
      }
    }

    const groups = [...byRelation].map(([relation, list]) => {
      const meta = this.state.payload.profile.relations.find((r) => r.name === relation);
      return el("div", { class: "gs-rel-group" }, [
        el("p", {
          class: "gs-rel-name",
          text: relation,
          // The profile's own description of the relation, so the vocabulary is learnable
          // from inside the graph rather than from the docs site.
          title: meta?.description ?? "implicit directory containment",
        }),
        el(
          "ul",
          { class: "gs-rel-list" },
          list.map((edge) => {
            const target = other(edge);
            const row = el("li", {}, [this.conceptLink(target)]);
            if (!edge.resolved) {
              row.append(el("span", { class: "gs-badge-inline", text: "unwritten" }));
            }
            return row;
          }),
        ),
      ]);
    });
    return el("div", {}, [el("h4", { class: "gs-rel-dir", text: title }), ...groups]);
  }

  private conceptLink(id: string): HTMLElement {
    const node = this.state.node(id);
    const button = el("button", {
      type: "button",
      class: "gs-concept-link",
      "data-concept": id,
      text: node ? titleOf(node) : id,
    });
    return button;
  }

  private section(title: string, body: Node): HTMLElement {
    return el("section", { class: "gs-section" }, [el("h3", { text: title }), body]);
  }

  /**
   * Map a markdown link target onto a concept ID, or null when it points outside the bundle.
   *
   * Mirrors the CLI's reference normalization (drop a leading slash and a trailing `.md`) so
   * a link written the way `relations:` targets are written navigates in-app.
   */
  private resolveLink(href: string): string | null {
    if (href.startsWith("#")) {
      return null;
    }
    const candidate = href.replace(/^\//, "").replace(/#.*$/, "").replace(/\.md$/, "");
    return this.state.node(candidate) ? candidate : null;
  }
}

/** Render a frontmatter value compactly: scalars as-is, structures as JSON. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
