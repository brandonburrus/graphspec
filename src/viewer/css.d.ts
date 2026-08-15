/**
 * Lets `main.ts` import the stylesheet so esbuild picks it up and emits a sibling
 * `viewer.css` next to the bundle. TypeScript has no notion of a CSS module otherwise.
 */
declare module "*.css";
