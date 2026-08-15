// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://graphspec.dev",
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
      // Shiki's default themes highlight in blues, which fights the amber accent. Vitesse is
      // warm and low-saturation, so code sits inside the palette instead of next to it.
      expressiveCode: {
        themes: ["vitesse-dark", "vitesse-light"],
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
