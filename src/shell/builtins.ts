import path from 'node:path';
import { environment } from './environment.js';

export interface BuiltinResult {
  handled: boolean;
  output?: string;
  exitCode: number;
}

const NOT_HANDLED: BuiltinResult = { handled: false, exitCode: 0 };

export function handleBuiltin(input: string): BuiltinResult {
  const trimmed = input.trim();
  const [cmd, ...rest] = splitFirst(trimmed);

  switch (cmd) {
    case 'cd':
      return handleCd(rest.join(' ').trim());
    case 'export':
      return handleExport(rest.join(' ').trim());
    case 'unset':
      return handleUnset(rest.join(' ').trim());
    case 'exit':
      return handleExit(rest.join(' ').trim());
    default:
      return NOT_HANDLED;
  }
}

function handleCd(arg: string): BuiltinResult {
  let target: string;

  if (!arg) {
    // cd with no args → HOME
    const home = environment.getVar('HOME');
    if (!home) {
      return { handled: true, output: 'cd: HOME not set', exitCode: 1 };
    }
    target = home;
  } else if (arg === '-') {
    // cd - → OLDPWD
    target = environment.getOldPwd();
  } else if (arg.startsWith('~')) {
    // ~ expansion
    const home = environment.getVar('HOME') ?? '';
    target = home + arg.slice(1);
  } else {
    target = arg;
  }

  // Resolve relative paths against cwd
  if (!path.isAbsolute(target)) {
    target = path.resolve(environment.getCwd(), target);
  }

  try {
    environment.setCwd(target);
    return { handled: true, exitCode: 0 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { handled: true, output: `cd: ${msg}`, exitCode: 1 };
  }
}

function handleExport(arg: string): BuiltinResult {
  if (!arg) {
    // export with no args — list all env vars
    const vars = environment.getEnv();
    const output = Object.entries(vars)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `export ${k}="${v}"`)
      .join('\n');
    return { handled: true, output, exitCode: 0 };
  }

  // Parse KEY=value pairs (handles multiple: export A=1 B=2)
  const parts = splitExportArgs(arg);
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) {
      // export KEY (no value) — just mark as exported, keep current value
      const current = environment.getVar(part);
      if (current !== undefined) {
        environment.setEnv(part, current);
      }
    } else {
      const key = part.slice(0, eqIdx);
      let value = part.slice(eqIdx + 1);
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      environment.setEnv(key, value);
    }
  }

  return { handled: true, exitCode: 0 };
}

function handleUnset(arg: string): BuiltinResult {
  if (!arg) {
    return { handled: true, output: 'unset: not enough arguments', exitCode: 1 };
  }
  const keys = arg.split(/\s+/).filter(Boolean);
  for (const key of keys) {
    environment.unsetEnv(key);
  }
  return { handled: true, exitCode: 0 };
}

function handleExit(_arg: string): BuiltinResult {
  process.exit(0);
}

function splitFirst(input: string): string[] {
  const idx = input.search(/\s/);
  if (idx === -1) return [input];
  return [input.slice(0, idx), input.slice(idx)];
}

function splitExportArgs(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (const ch of input) {
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}
