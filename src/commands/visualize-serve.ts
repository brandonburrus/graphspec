/**
 * `graphspec visualize serve [path]` — the same visualization, live against the bundle.
 *
 * The one long-running command in the CLI. It rebuilds the payload whenever a `.md` file
 * under the bundle changes and pushes a server-sent event; the page re-fetches the payload
 * and swaps it into the running graph, so the camera, filters, selection, and parked nodes
 * survive an edit. A full page reload would show the same data and throw all of that away.
 *
 * Everything is served from memory. Nothing is written to disk in this mode.
 */

import { type FSWatcher, watch } from "node:fs";
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { buildVisualization, loadViewerAssets, renderHtml } from "../visualize/index.js";
import type { Writer } from "./io.js";
import { openInBrowser } from "./visualize.js";

/** Default port. Picked to stay clear of the usual dev-server ports (3000/4321/5173/8080). */
export const DEFAULT_PORT = 3737;

/** Debounce window for filesystem events; editors emit several writes per save. */
const REBUILD_DEBOUNCE_MS = 120;

/** How many ports to try past the default before giving up. */
const PORT_SCAN = 10;

/** Options accepted by the serve subcommand. */
export interface VisualizeServeOptions {
  port?: string;
  title?: string;
  open?: boolean;
  /**
   * Test seam: resolves once the server is listening, so a test can drive it and shut it
   * down without the command blocking forever on a signal.
   */
  onReady?: (info: { port: number; close: () => Promise<void> }) => void | Promise<void>;
}

/**
 * Run the serve subcommand.
 *
 * @returns process exit code: 0 on clean shutdown, 2 on a bad port or an unusable bundle.
 */
export async function runVisualizeServe(
  path: string,
  options: VisualizeServeOptions,
  writer: Writer,
): Promise<number> {
  let requestedPort = DEFAULT_PORT;
  const portWasGiven = options.port !== undefined;
  if (options.port !== undefined) {
    requestedPort = Number(options.port);
    if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
      writer.err(`error: --port must be an integer between 0 and 65535 (got '${options.port}')`);
      return 2;
    }
  }

  // Fail before binding a port if the bundle cannot be read at all, so the user gets the
  // real error instead of a server that serves nothing.
  let payloadJson: string;
  try {
    payloadJson = JSON.stringify(await buildVisualization(path, options.title));
  } catch (err) {
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  let assets: Awaited<ReturnType<typeof loadViewerAssets>>;
  try {
    assets = await loadViewerAssets();
  } catch (err) {
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  const clients = new Set<ServerResponse>();

  const rebuild = async (): Promise<void> => {
    try {
      payloadJson = JSON.stringify(await buildVisualization(path, options.title));
      for (const client of clients) {
        client.write("event: reload\ndata: {}\n\n");
      }
      writer.out(`rebuilt ${path}`);
    } catch (err) {
      // A half-saved file is a normal transient state while someone is typing. Report it and
      // keep serving the last good payload rather than tearing the server down.
      writer.err(`error: rebuild failed: ${(err as Error).message}`);
    }
  };

  const server = createServer((req, res) => {
    handleRequest(req, res, {
      html: () => renderHtml(JSON.parse(payloadJson), assets, { serve: true }),
      payload: () => payloadJson,
      clients,
    });
  });

  let port: number;
  try {
    port = await listen(server, requestedPort, portWasGiven ? 0 : PORT_SCAN);
  } catch (err) {
    writer.err(`error: ${(err as Error).message}`);
    return 2;
  }

  const watcher = startWatching(path, rebuild, writer);
  const url = `http://localhost:${port}/`;
  writer.out(`serving ${path} at ${url}`);
  writer.out("watching for changes; press Ctrl-C to stop");

  if (options.open !== false) {
    openInBrowser(url, writer);
  }

  const close = async (): Promise<void> => {
    watcher?.close();
    for (const client of clients) {
      client.end();
    }
    clients.clear();
    await new Promise<void>((done) => server.close(() => done()));
  };

  if (options.onReady) {
    await options.onReady({ port, close });
    return 0;
  }

  await new Promise<void>((done) => {
    const stop = () => {
      void close().then(done);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  return 0;
}

/** Route the three endpoints the viewer uses. */
function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sources: { html: () => string; payload: () => string; clients: Set<ServerResponse> },
): void {
  const path = (req.url ?? "/").split("?")[0];

  if (path === "/payload.json") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(sources.payload());
    return;
  }

  if (path === "/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    // A first comment flushes headers, so EventSource fires `open` immediately rather than
    // sitting in CONNECTING until the first real event.
    res.write(": connected\n\n");
    sources.clients.add(res);
    req.on("close", () => sources.clients.delete(res));
    return;
  }

  if (path === "/" || path === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(sources.html());
    return;
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("not found\n");
}

/**
 * Bind a port, walking forward when the requested one is taken.
 *
 * Only scans when the port came from the default. An explicitly requested port that is busy
 * is an error the user needs to see, not something to silently work around.
 */
function listen(server: Server, start: number, scan: number): Promise<number> {
  return new Promise((resolveport, reject) => {
    let attempt = 0;
    const tryPort = (port: number): void => {
      const onError = (err: NodeJS.ErrnoException): void => {
        if (err.code === "EADDRINUSE" && attempt < scan) {
          attempt++;
          tryPort(port + 1);
          return;
        }
        reject(
          err.code === "EADDRINUSE"
            ? new Error(`port ${port} is already in use (pass --port to choose another)`)
            : err,
        );
      };
      server.once("error", onError);
      server.listen(port, () => {
        server.removeListener("error", onError);
        const address = server.address();
        resolveport(typeof address === "object" && address !== null ? address.port : port);
      });
    };
    tryPort(start);
  });
}

/**
 * Watch the bundle for markdown changes.
 *
 * Recursive watching is not available on every platform, so a failure degrades to no
 * watching rather than killing the server: a static view is still worth serving, and the
 * user is told which one they got.
 */
function startWatching(
  path: string,
  rebuild: () => Promise<void>,
  writer: Writer,
): FSWatcher | null {
  let timer: NodeJS.Timeout | undefined;
  const schedule = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => void rebuild(), REBUILD_DEBOUNCE_MS);
  };

  try {
    return watch(path, { recursive: true }, (_event, filename) => {
      if (filename === null || filename.endsWith(".md")) {
        schedule();
      }
    });
  } catch (err) {
    writer.err(`note: live reload unavailable (${(err as Error).message}); serving a static view`);
    return null;
  }
}
