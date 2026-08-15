/**
 * Load the esbuild-bundled browser assets off disk.
 *
 * The only impure part of `src/visualize`. It is deliberately separate from `render.ts` so
 * the renderer stays testable without a build: `pnpm test` does not run `pnpm build`, and a
 * renderer that read `dist/` at import time would fail the suite on a clean checkout.
 *
 * Assets live at `<package>/dist/viewer/` and are resolved from the package root rather than
 * relative to this module. Both the compiled module (`dist/visualize/assets.js`) and the
 * TypeScript source (`src/visualize/assets.ts`) sit two levels below that root, so one path
 * works from an installed package, a local `dist/`, a symlinked `node_modules/.bin` entry,
 * and a vitest run that imports straight from `src/`.
 */

import { readFile } from "node:fs/promises";
import type { ViewerAssets } from "./render.js";

/** Raised when the viewer bundle is missing, which always means the build did not run. */
export class MissingViewerAssetsError extends Error {
  constructor(cause: unknown) {
    super("viewer assets not found in dist/viewer (run `npm run build` to generate them)");
    this.name = "MissingViewerAssetsError";
    this.cause = cause;
  }
}

/** The installed package root, two directories above this module in both layouts. */
const packageRoot = new URL("../../", import.meta.url);

/** Read the bundled viewer JavaScript and CSS. */
export async function loadViewerAssets(): Promise<ViewerAssets> {
  try {
    const [js, css] = await Promise.all([
      readFile(new URL("dist/viewer/viewer.js", packageRoot), "utf8"),
      readFile(new URL("dist/viewer/viewer.css", packageRoot), "utf8"),
    ]);
    return { js, css };
  } catch (err) {
    throw new MissingViewerAssetsError(err);
  }
}
