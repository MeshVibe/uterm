import type { CommandIndex } from './command-index.js';

export type Classification = 'command' | 'prompt' | 'empty';

const SHELL_OPERATORS = /[|&;<>]/;
const SHELL_PATTERNS = /^[\(\{]|^\$\(/;
const PATH_EXECUTION = /^[.\/]/;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

export function classify(input: string, commandIndex: CommandIndex): Classification {
  const trimmed = input.trim();
  if (!trimmed) return 'empty';

  // Shell operators → always a command
  if (SHELL_OPERATORS.test(trimmed)) return 'command';

  // Shell patterns (subshell, brace group, command substitution)
  if (SHELL_PATTERNS.test(trimmed)) return 'command';

  // Tokenize to get the first meaningful token
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return 'empty';

  let idx = 0;

  // Skip leading env assignments (FOO=bar cmd ...)
  while (idx < tokens.length && ENV_ASSIGNMENT.test(tokens[idx])) {
    idx++;
  }

  // If only env assignments, treat as command (shell will handle it)
  if (idx >= tokens.length) return 'command';

  const firstToken = tokens[idx];

  // Known command or builtin
  if (commandIndex.has(firstToken)) return 'command';

  // Path execution (./script, /usr/bin/foo, ../something)
  if (PATH_EXECUTION.test(firstToken)) return 'command';

  // Otherwise, treat as a natural language prompt for Claude
  return 'prompt';
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (const ch of input) {
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      current += ch;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (!inSingle && !inDouble && (ch === ' ' || ch === '\t')) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}
