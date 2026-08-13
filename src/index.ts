/**
 * graphspec public library surface.
 *
 * Exposes the graphspec profile (single source of truth), the OKF core (parser + graph
 * model), and the validation engine. Sessions 2 and 3 build traversal, coverage, and the
 * authoring/following skills on top of these exports without modifying them.
 */

export * from "./profile/index.js";
export * from "./core/index.js";
export * from "./validate/index.js";
