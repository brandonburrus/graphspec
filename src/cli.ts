#!/usr/bin/env node
/**
 * graphspec CLI entry point.
 *
 * This module exists only to run the program, so importing anything for tests never triggers
 * argv parsing. The program itself lives in `program.ts`.
 */

import { buildProgram } from "./program.js";

async function main(): Promise<void> {
  await buildProgram().parseAsync(process.argv);
}

main().catch((err) => {
  process.stderr.write(`error: ${(err as Error).message}\n`);
  process.exitCode = 2;
});
