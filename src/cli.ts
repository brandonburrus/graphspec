#!/usr/bin/env node
/**
 * graphspec CLI entry point.
 */

import { Command } from "commander";
import { banner } from "./banner.js";
import { runCoverage } from "./commands/coverage.js";
import { runGraph } from "./commands/graph.js";
import { runIndex } from "./commands/index-cmd.js";
import { consoleWriter } from "./commands/io.js";
import { runOrder } from "./commands/order.js";
import { runQuery } from "./commands/query.js";
import { runValidate } from "./commands/validate.js";

/** Build the commander program (exported for testing). */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("graphspec")
    .description(
      "Author software specs as an OKF knowledge graph and build software by traversing it.",
    )
    .addHelpText("beforeAll", banner())
    .version("0.1.0");

  program
    .command("validate")
    .argument("[path]", "path to the OKF bundle", ".")
    .description("Validate a bundle against OKF conformance and the graphspec profile")
    .option("--strict", "promote graphspec profile warnings to errors", false)
    .option("--json", "emit diagnostics as JSON", false)
    .action(async (path: string, opts: { strict: boolean; json: boolean }) => {
      const code = await runValidate(path, opts, consoleWriter);
      process.exitCode = code;
    });

  program
    .command("query")
    .argument("[path]", "path to the OKF bundle", ".")
    .description("Query concepts in a bundle, filtered by type/tag/status")
    .option("--type <type>", "filter by frontmatter type")
    .option("--tag <tag>", "filter by tag")
    .option("--status <status>", "filter by frontmatter status")
    .option("--json", "emit results as JSON", false)
    .action(
      async (
        path: string,
        opts: { type?: string; tag?: string; status?: string; json: boolean },
      ) => {
        const code = await runQuery(path, opts, consoleWriter);
        process.exitCode = code;
      },
    );

  program
    .command("index")
    .argument("[path]", "path to the OKF bundle", ".")
    .description("Regenerate per-directory index.md files and optionally append a log entry")
    .option("--log <message>", "append a dated entry to the bundle-root log.md")
    .option("--no-index", "skip regenerating index.md files")
    .option("--dry-run", "show what would change without writing", false)
    .action(async (path: string, opts: { log?: string; index: boolean; dryRun: boolean }) => {
      // commander maps --no-index to `index: false`.
      const code = await runIndex(
        path,
        { log: opts.log, noIndex: opts.index === false, dryRun: opts.dryRun },
        consoleWriter,
      );
      process.exitCode = code;
    });

  program
    .command("graph")
    .argument("[path]", "path to the OKF bundle", ".")
    .description("Build the spec graph and emit it as JSON, Mermaid, or DOT")
    .option("--format <format>", "output format: json, mermaid, or dot", "json")
    .option(
      "--from <concept>",
      "emit only the subgraph reachable from this concept (id or /path.md reference)",
    )
    .option("--depth <n>", "limit hops from --from (default unlimited)")
    .option("--rel <name[,name...]>", "restrict to the given relation type(s)")
    .option(
      "--direction <out|in|both>",
      "with --from, which way to follow edges: out (default), in, or both",
    )
    .option("--structure", "include directory parent/child structural edges", false)
    .action(
      async (
        path: string,
        opts: {
          format?: string;
          from?: string;
          depth?: string;
          rel?: string;
          structure?: boolean;
          direction?: string;
        },
      ) => {
        const code = await runGraph(path, opts, consoleWriter);
        process.exitCode = code;
      },
    );

  program
    .command("coverage")
    .argument("[path]", "path to the OKF bundle", ".")
    .description("Report spec-graph completeness against the graphspec profile")
    .option("--json", "emit the coverage report as JSON", false)
    .option("--strict", "exit non-zero when any gap is found", false)
    .action(async (path: string, opts: { json: boolean; strict: boolean }) => {
      const code = await runCoverage(path, opts, consoleWriter);
      process.exitCode = code;
    });

  program
    .command("order")
    .argument("[path]", "path to the OKF bundle", ".")
    .description("Print the topological build order of System/Component concepts")
    .option("--json", "emit the order (and any cycles) as JSON", false)
    .action(async (path: string, opts: { json: boolean }) => {
      const code = await runOrder(path, opts, consoleWriter);
      process.exitCode = code;
    });

  return program;
}

async function main(): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  process.stderr.write(`error: ${(err as Error).message}\n`);
  process.exitCode = 2;
});
