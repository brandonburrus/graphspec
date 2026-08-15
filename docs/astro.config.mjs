// @ts-check
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

const require = createRequire(import.meta.url);

/*
 * Starlight's icon names are a closed enum backed by an internal module of filled paths, and
 * there is no config hook for supplying your own. Tabler is a stroked set, so swapping only
 * some icons would leave two visually different families side by side. This maps Starlight's
 * UI icon names onto Tabler equivalents and patches them in at build time.
 *
 * Brand marks (github, astro, npm, and the rest) are deliberately left alone: a logo is not
 * part of an icon family, and Tabler's brand glyphs are the same marks anyway.
 *
 * This reaches into `components-internals`, so a Starlight upgrade could move it. The failure
 * mode is loud: `tablerPaths` throws at config load if an icon is missing, and the assertion
 * below throws if the patch target is gone.
 */
const TABLER_FOR = {
  "up-caret": "chevron-up",
  "down-caret": "chevron-down",
  "right-caret": "chevron-right",
  "left-caret": "chevron-left",
  "up-arrow": "arrow-up",
  "down-arrow": "arrow-down",
  "right-arrow": "arrow-right",
  "left-arrow": "arrow-left",
  bars: "menu-2",
  pencil: "pencil",
  external: "external-link",
  moon: "moon",
  sun: "sun",
  laptop: "device-laptop",
  magnifier: "search",
  close: "x",
  error: "alert-octagon",
  warning: "alert-triangle",
  information: "info-circle",
  "approve-check-circle": "circle-check",
  "approve-check": "check",
  "question-circle": "help-circle",
  star: "star",
  document: "file-text",
  "open-book": "book",
  link: "link",
  download: "download",
  rocket: "rocket",
  setting: "settings",
};

/**
 * Inner markup of a Tabler outline icon, wrapped so it strokes inside Starlight's filled svg.
 *
 * The package's `exports` map is `"./*": "./icons/*"`, so the specifier omits the `icons/`
 * segment that appears in the on-disk path.
 */
function tablerPaths(name) {
  const svg = readFileSync(require.resolve(`@tabler/icons/outline/${name}.svg`), "utf8");
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>[\s\S]*$/, "")
    // Tabler's first path is a transparent 24x24 bounding box; it only adds noise here.
    .replace(/<path\s+stroke="none"[^>]*\/>/, "")
    .trim();
  return `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
}

const tablerIcons = Object.fromEntries(
  Object.entries(TABLER_FOR).map(([starlightName, tablerName]) => [
    starlightName,
    tablerPaths(tablerName),
  ]),
);

/** @returns {import("vite").Plugin} */
function useTablerIcons() {
  return {
    name: "graphspec:tabler-icons",
    enforce: "post",
    transform(code, id) {
      if (!id.includes("starlight/components-internals/Icons")) return null;
      if (!code.includes("export const Icons")) {
        throw new Error(
          "Starlight's Icons module no longer exports `Icons`; the Tabler icon patch needs updating.",
        );
      }
      const patch = JSON.stringify(tablerIcons);
      return `${code}\nObject.assign(BuiltInIcons, ${patch});\nObject.assign(Icons, ${patch});\n`;
    },
  };
}

export default defineConfig({
  site: "https://graphspec.dev",
  vite: { plugins: [useTablerIcons()] },
  integrations: [
    starlight({
      title: "GraphSpec",
      description:
        "Author software specs as a knowledge graph, then build software by traversing it. CLI, library, and agent skills for spec-driven development.",
      logo: { src: "./src/assets/mark.svg", replacesTitle: false },
      favicon: "/favicon.svg",
      customCss: [
        "@fontsource-variable/ibm-plex-sans",
        "@fontsource/ibm-plex-mono/400.css",
        "@fontsource/ibm-plex-mono/500.css",
        "./src/styles/theme.css",
      ],
      // Muted and cool, so code sits inside the slate palette rather than next to it. The
      // frame chrome is overridden because Expressive Code's defaults ship a warm tab
      // indicator and a drop shadow, which would be a second accent and a ghost card.
      expressiveCode: {
        themes: ["github-dark-dimmed", "github-light"],
        styleOverrides: {
          borderRadius: "6px",
          borderColor: "var(--gs-line)",
          codeFontFamily: "var(--sl-font-mono)",
          uiFontFamily: "var(--sl-font)",
          frames: {
            editorActiveTabIndicatorTopColor: "var(--gs-accent)",
            editorTabBarBorderBottomColor: "var(--gs-line)",
            terminalTitlebarBorderBottomColor: "var(--gs-line)",
            frameBoxShadowCssValue: "none",
          },
        },
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/brandonburrus/graphspec",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/brandonburrus/graphspec/edit/main/docs/",
      },
      lastUpdated: true,
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "What GraphSpec is", slug: "start/what-it-is" },
            { label: "Install", slug: "start/install" },
            { label: "Write your first spec", slug: "start/first-spec" },
            { label: "Use it with an agent", slug: "start/agents" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "Bundles and concepts", slug: "concepts/bundles" },
            { label: "Relations and the graph", slug: "concepts/relations" },
            { label: "Validation", slug: "concepts/validation" },
            { label: "Coverage", slug: "concepts/coverage" },
          ],
        },
        {
          label: "Profile reference",
          items: [
            { label: "Node types", slug: "profile/node-types" },
            { label: "Relations", slug: "profile/relations" },
          ],
        },
        {
          label: "CLI reference",
          items: [
            { label: "Overview", slug: "cli/overview" },
            { label: "validate", slug: "cli/validate" },
            { label: "query", slug: "cli/query" },
            { label: "index", slug: "cli/index-command" },
            { label: "graph", slug: "cli/graph" },
            { label: "coverage", slug: "cli/coverage" },
            { label: "order", slug: "cli/order" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Gate CI on the spec", slug: "guides/ci" },
            { label: "Agent skills", slug: "guides/agent-skills" },
          ],
        },
        {
          label: "Library",
          items: [{ label: "JavaScript API", slug: "library/api" }],
        },
      ],
    }),
  ],
});
