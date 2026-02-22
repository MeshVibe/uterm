export interface ContextEntry {
  type: 'command' | 'claude_response';
  input: string;
  output?: string;
  exitCode?: number;
  cwd?: string;
  timestamp: number;
}

const MAX_OUTPUT_LENGTH = 10_000;

export class ContextBuffer {
  private entries: ContextEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 20) {
    this.maxEntries = maxEntries;
  }

  add(entry: ContextEntry): void {
    if (entry.output && entry.output.length > MAX_OUTPUT_LENGTH) {
      entry.output =
        entry.output.slice(0, MAX_OUTPUT_LENGTH) +
        `\n... (truncated, ${entry.output.length - MAX_OUTPUT_LENGTH} chars omitted)`;
    }
    this.entries.push(entry);
    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  getEntries(): readonly ContextEntry[] {
    return this.entries;
  }

  format(): string {
    if (this.entries.length === 0) return 'No recent terminal activity.';

    return this.entries
      .map((e) => {
        if (e.type === 'command') {
          let s = `[${e.cwd ?? '?'}] $ ${e.input}`;
          if (e.output) s += `\n${e.output}`;
          if (e.exitCode !== undefined && e.exitCode !== 0) {
            s += `\n(exit code: ${e.exitCode})`;
          }
          return s;
        }
        return `[Claude] ${e.output ?? e.input}`;
      })
      .join('\n\n');
  }

  clear(): void {
    this.entries = [];
  }
}
