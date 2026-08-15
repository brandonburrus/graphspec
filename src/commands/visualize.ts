/**
 * `graphspec visualize [path]` — write the bundle as one self-contained HTML file.
 *
 * The only command besides `index` that writes to disk, and the only one that writes outside
 * the bundle. It never fails on a bundle's own problems: validation errors and coverage gaps
 * are rendered inside the page, because a broken spec graph is exactly the one you most need
 * to look at. Exit 2 is reserved for not being able to read the bundle or write the file.
 */

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildVisualization, loadViewerAssets, renderHtml } from "../visualize/index.js";
import type { Writer } from "./io.js";

/** Default output filename, written into the current working directory. */
export const DEFAULT_OUTPUT = "graphspec-graph.html";

/**
 * Output size past which the user gets a heads-up on stderr.
 *
 * Concept bodies are embedded whole, which is what makes the file readable offline; the
 * ceiling is roughly the bundle's own size. Browsers cope well past this, so it is a note
 * rather than a limit. If it ever becomes a real problem the fix is a `--no-body` flag.
 */
const SIZE_NOTE_BYTES = 5 * 1024 * 1024;

/** Options accepted by the visualize command. */
export interface VisualizeCommandOptions {
  out?: string;
  title?: string;
  open?: boolean;
}

/**
 * Run the visualize command against `path`.
 *
 * @returns process exit code: 0 on success, 2 on I/O failure.
 */
export async function runVisualize(
  path: string,
  options: VisualizeCommandOptions,
  writer: Writer,
): Promise<number> {
  const outPath = resolve(options.out ?? DEFAULT_OUTPUT);

  let html: string;
  let conceptCount: number;
  let relationCount: number;
  try {
    const payload = await buildVisualization(path, options.title);
    const assets = await loadViewerAssets();
    html = renderHtml(payload, assets);
    conceptCount = payload.bundle.conceptCount;
    relationCount = payload.edges.filter((e) => !e.structural).length;
  } catch (err) {
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  try {
    await writeFile(outPath, html, "utf8");
  } catch (err) {
    writer.err(`error: could not write ${outPath}: ${(err as Error).message}`);
    return 2;
  }

  const bytes = Buffer.byteLength(html, "utf8");
  writer.out(
    `wrote ${outPath} (${conceptCount} concept(s), ${relationCount} relation(s), ${formatBytes(bytes)})`,
  );
  if (bytes > SIZE_NOTE_BYTES) {
    writer.err(
      `note: ${formatBytes(bytes)} output; concept bodies are embedded so the page works offline`,
    );
  }

  if (options.open === true) {
    openInBrowser(outPath, writer);
  }
  return 0;
}

/**
 * Hand a path or URL to the platform's default opener.
 *
 * Detached and unwatched: a browser that fails to launch is a note, never a failed command,
 * because the file has already been written successfully by this point.
 */
export function openInBrowser(target: string, writer: Writer): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const child = spawn(command, [target], {
      detached: true,
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    child.on("error", () => writer.err(`note: could not open a browser (tried ${command})`));
    child.unref();
  } catch {
    writer.err(`note: could not open a browser (tried ${command})`);
  }
}

/** Human-readable byte count, one decimal place past a kilobyte. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
