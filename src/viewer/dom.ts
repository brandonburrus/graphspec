/**
 * Minimal DOM construction helpers.
 *
 * The viewer builds its UI imperatively rather than pulling in a framework: the whole app
 * ships inside a generated HTML file, so every kilobyte of runtime is a kilobyte added to
 * every visualization anyone produces.
 */

/** Attributes accepted by {@link el}: `class`, `text`, `html`, and any plain attribute. */
export interface ElementAttrs {
  class?: string;
  text?: string;
  /** Pre-sanitized HTML. Only ever fed output from `markdown.ts`, which escapes first. */
  html?: string;
  [attr: string]: string | number | boolean | undefined;
}

/** Create an element with attributes and children in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: ElementAttrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) {
      continue;
    }
    // ARIA takes the literal strings "true"/"false"; the bare-attribute form that HTML
    // booleans like `checked` use is invalid there and announces nothing.
    if (typeof value === "boolean" && key.startsWith("aria-")) {
      node.setAttribute(key, String(value));
      continue;
    }
    if (value === false) {
      continue;
    }
    if (key === "class") {
      node.className = String(value);
    } else if (key === "text") {
      node.textContent = String(value);
    } else if (key === "html") {
      node.innerHTML = String(value);
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children) {
    node.append(child);
  }
  return node;
}

/** Remove every child of a node. */
export function clear(node: Element): void {
  node.replaceChildren();
}

/** Query a required element, failing loudly rather than rendering half a UI. */
export function must<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) {
    throw new Error(`viewer: expected element ${selector}`);
  }
  return found;
}
