/**
 * Shared command IO plumbing so commands are testable without touching the real process.
 */

/** Sink for command output. */
export interface Writer {
  out(text: string): void;
  err(text: string): void;
}

/** A Writer backed by console (default for the real CLI). */
export const consoleWriter: Writer = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
};

/** Collects output into arrays; handy for tests. */
export class BufferWriter implements Writer {
  readonly stdout: string[] = [];
  readonly stderr: string[] = [];
  out(text: string): void {
    this.stdout.push(text);
  }
  err(text: string): void {
    this.stderr.push(text);
  }
  /** Full stdout joined by newlines. */
  get outText(): string {
    return this.stdout.join("\n");
  }
  /** Full stderr joined by newlines. */
  get errText(): string {
    return this.stderr.join("\n");
  }
}
