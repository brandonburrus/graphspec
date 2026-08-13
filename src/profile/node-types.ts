/**
 * graphspec profile — node type definitions.
 *
 * The graphspec profile is a named OKF profile: it layers a filename + frontmatter
 * convention on top of an otherwise-permissive OKF bundle. Every concept file is named
 * `<name>.<token>.md` where `<token>` is the kebab-case token of the node's type.
 *
 * This module is DATA. The validator and query layers consume it; sessions 2 and 3 import
 * it as the single source of truth for the vocabulary.
 */

/** The conceptual layers the profile organizes node types into. */
export type ProfileLayer = "product" | "architecture" | "specification" | "glossary";

/**
 * A required frontmatter field on a node type. When `values` is present, the field is an
 * enum and its value must be one of the listed options (a graphspec profile check). When
 * absent (e.g. Constraint.category), any non-empty string is accepted.
 */
export interface RequiredField {
  /** Frontmatter key name. */
  readonly key: string;
  /** Allowed enum values, or undefined for a free-form non-empty string. */
  readonly values?: readonly string[];
}

/** A node type in the graphspec profile. */
export interface NodeType {
  /** PascalCase type name as it appears in frontmatter `type`. */
  readonly name: string;
  /** kebab-case filename token, e.g. `user-journey`. */
  readonly token: string;
  /** Conceptual layer. */
  readonly layer: ProfileLayer;
  /** Required frontmatter fields beyond OKF's mandatory `type`. */
  readonly requiredFields: readonly RequiredField[];
  /** Conventional body section headings (H1) for this type. */
  readonly sections: readonly string[];
  /** One-line human description of the node type. */
  readonly description: string;
}

/**
 * The 13 node types of the graphspec profile.
 *
 * Order is meaningful for display: product → architecture → specification → glossary.
 */
export const NODE_TYPES: readonly NodeType[] = [
  // ---- Product layer ----
  {
    name: "UserPersona",
    token: "user-persona",
    layer: "product",
    requiredFields: [],
    sections: ["Goals", "Pains"],
    description: "An archetype of a user the software serves.",
  },
  {
    name: "UserJourney",
    token: "user-journey",
    layer: "product",
    requiredFields: [],
    sections: ["Flow"],
    description: "An end-to-end path a persona takes to accomplish something.",
  },
  {
    name: "Feature",
    token: "feature",
    layer: "product",
    requiredFields: [],
    sections: ["Summary"],
    description: "A discrete capability the product provides.",
  },
  // ---- Architecture layer ----
  {
    name: "System",
    token: "system",
    layer: "architecture",
    requiredFields: [],
    sections: ["Responsibility"],
    description: "A top-level runtime or deployable unit.",
  },
  {
    name: "Component",
    token: "component",
    layer: "architecture",
    requiredFields: [],
    sections: ["Responsibility"],
    description: "A module or unit of implementation within a system.",
  },
  {
    name: "Integration",
    token: "integration",
    layer: "architecture",
    requiredFields: [{ key: "direction", values: ["inbound", "outbound", "bidirectional"] }],
    sections: ["Interface"],
    description: "A connection to an external system or party.",
  },
  {
    name: "Contract",
    token: "contract",
    layer: "architecture",
    requiredFields: [],
    sections: ["Interface"],
    description: "An interface agreement (API, event, protocol) between parties.",
  },
  {
    name: "DataModel",
    token: "data-model",
    layer: "architecture",
    requiredFields: [],
    sections: ["Schema"],
    description: "A structured description of persisted or exchanged data.",
  },
  // ---- Specification layer ----
  {
    name: "Requirement",
    token: "requirement",
    layer: "specification",
    requiredFields: [
      { key: "status", values: ["proposed", "accepted", "implemented", "verified"] },
    ],
    sections: ["Acceptance Criteria"],
    description: "A statement of required behavior or capability.",
  },
  {
    name: "Constraint",
    token: "constraint",
    layer: "specification",
    requiredFields: [{ key: "category" }],
    sections: ["Rationale"],
    description: "A non-functional limitation the design must honor.",
  },
  {
    name: "Decision",
    token: "decision",
    layer: "specification",
    requiredFields: [{ key: "status", values: ["proposed", "accepted", "superseded"] }],
    sections: ["Context", "Decision", "Consequences"],
    description: "An architecture/design decision record.",
  },
  {
    name: "TestScenario",
    token: "test-scenario",
    layer: "specification",
    requiredFields: [{ key: "level", values: ["unit", "integration", "e2e"] }],
    sections: ["Given/When/Then"],
    description: "A concrete scenario verifying required behavior.",
  },
  // ---- Glossary ----
  {
    name: "Term",
    token: "term",
    layer: "glossary",
    requiredFields: [],
    sections: [],
    description: "A ubiquitous-language glossary entry.",
  },
];

/** Lookup a node type by its PascalCase `type` name. */
export function nodeTypeByName(name: string): NodeType | undefined {
  return NODE_TYPES.find((t) => t.name === name);
}

/** Lookup a node type by its kebab-case filename token. */
export function nodeTypeByToken(token: string): NodeType | undefined {
  return NODE_TYPES.find((t) => t.token === token);
}

/** The kebab-case token for a given `type` name, or undefined if unknown. */
export function tokenForType(name: string): string | undefined {
  return nodeTypeByName(name)?.token;
}

/** All known type names. */
export const NODE_TYPE_NAMES: readonly string[] = NODE_TYPES.map((t) => t.name);

/** All known filename tokens. */
export const NODE_TYPE_TOKENS: readonly string[] = NODE_TYPES.map((t) => t.token);
