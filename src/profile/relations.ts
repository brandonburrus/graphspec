/**
 * graphspec profile — typed relation vocabulary.
 *
 * Relations are expressed in a concept's frontmatter under a `relations:` key, a map of
 * relationName -> list of target concept references. Each relation has an allowed set of
 * source node types and target node types. The validator uses this to (softly) check that
 * a relation name is in the vocabulary, the source concept's type is allowed to originate
 * it, and every resolved target's type is an allowed target.
 *
 * `"*"` in a type list means "any node type" (used by `affects` and `refers-to`).
 */

/** Sentinel meaning "any node type is allowed". */
export const ANY_TYPE = "*" as const;

/** A typed relation in the graphspec profile. */
export interface Relation {
  /** Relation name as it appears under `relations:` in frontmatter. */
  readonly name: string;
  /** Allowed source node type names, or [ANY_TYPE]. */
  readonly sourceTypes: readonly string[];
  /** Allowed target node type names, or [ANY_TYPE]. */
  readonly targetTypes: readonly string[];
  /** One-line description of the relation's meaning. */
  readonly description: string;
}

/** The 16 typed relations of the graphspec profile. */
export const RELATIONS: readonly Relation[] = [
  {
    name: "experiences",
    sourceTypes: ["UserPersona"],
    targetTypes: ["UserJourney"],
    description: "A persona experiences a user journey.",
  },
  {
    name: "exercises",
    sourceTypes: ["UserJourney"],
    targetTypes: ["Feature"],
    description: "A journey exercises a feature.",
  },
  {
    name: "includes",
    sourceTypes: ["Feature"],
    targetTypes: ["Requirement"],
    description: "A feature includes a requirement.",
  },
  {
    name: "realizes",
    sourceTypes: ["Component", "System"],
    targetTypes: ["Feature"],
    description: "A component or system realizes a feature.",
  },
  {
    name: "contains",
    sourceTypes: ["System"],
    targetTypes: ["Component"],
    description: "A system contains a component.",
  },
  {
    name: "depends-on",
    sourceTypes: ["Component", "System"],
    targetTypes: ["Component", "System"],
    description: "A component/system depends on another of the same kind.",
  },
  {
    name: "exposes",
    sourceTypes: ["Component", "System"],
    targetTypes: ["Contract"],
    description: "A component or system exposes a contract.",
  },
  {
    name: "uses",
    sourceTypes: ["Component"],
    targetTypes: ["DataModel", "Contract"],
    description: "A component uses a data model or contract.",
  },
  {
    name: "connects",
    sourceTypes: ["Integration"],
    targetTypes: ["System", "Contract"],
    description: "An integration connects to a system or contract.",
  },
  {
    name: "satisfies",
    sourceTypes: ["Component", "System"],
    targetTypes: ["Requirement"],
    description: "A component or system satisfies a requirement.",
  },
  {
    name: "refines",
    sourceTypes: ["Requirement"],
    targetTypes: ["Requirement"],
    description: "A requirement refines another requirement.",
  },
  {
    name: "constrains",
    sourceTypes: ["Constraint"],
    targetTypes: ["System", "Component", "Requirement"],
    description: "A constraint constrains a system, component, or requirement.",
  },
  {
    name: "covers",
    sourceTypes: ["TestScenario"],
    targetTypes: ["Requirement", "Component", "UserJourney"],
    description: "A test scenario covers a requirement, component, or journey.",
  },
  {
    name: "supersedes",
    sourceTypes: ["Decision"],
    targetTypes: ["Decision"],
    description: "A decision supersedes another decision.",
  },
  {
    name: "affects",
    sourceTypes: ["Decision"],
    targetTypes: [ANY_TYPE],
    description: "A decision affects a concept of any type.",
  },
  {
    name: "refers-to",
    sourceTypes: [ANY_TYPE],
    targetTypes: ["Term"],
    description: "Any concept refers to a glossary term.",
  },
];

/** Lookup a relation by name. */
export function relationByName(name: string): Relation | undefined {
  return RELATIONS.find((r) => r.name === name);
}

/** Whether a type list permits the given type name (honoring the ANY_TYPE sentinel). */
export function typeAllowed(allowed: readonly string[], typeName: string): boolean {
  return allowed.includes(ANY_TYPE) || allowed.includes(typeName);
}

/** All known relation names. */
export const RELATION_NAMES: readonly string[] = RELATIONS.map((r) => r.name);
