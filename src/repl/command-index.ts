import fs from 'node:fs';
import path from 'node:path';
import { environment } from '../shell/environment.js';

const ZSH_BUILTINS = new Set([
  // POSIX / common builtins
  'cd', 'export', 'alias', 'source', 'set', 'unset', 'pushd', 'popd',
  'dirs', 'history', 'bg', 'fg', 'jobs', 'kill', 'wait', 'eval', 'exec',
  'exit', 'logout', 'umask', 'ulimit', 'type', 'hash', 'readonly',
  'declare', 'local', 'typeset', 'let', 'test', 'true', 'false',
  'command', 'builtin', 'getopts', 'read', 'printf', 'echo', 'trap',
  'return', 'shift', 'unalias',
  // zsh-specific
  'print', 'whence', 'rehash', 'setopt', 'unsetopt', 'bindkey', 'zle',
  'autoload', 'zmodload', 'emulate', 'repeat', 'coproc', 'vared',
  'compctl', 'compadd', 'compdef', 'zstyle', 'zcompile', 'zformat',
  'zparseopts', 'zregexparse', 'noglob', 'nocorrect', 'disown',
  'sched', 'limit', 'unlimit', 'where', 'which',
]);

const ZSH_RESERVED = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'case', 'esac', 'for', 'while',
  'until', 'do', 'done', 'in', 'function', 'select', 'time', 'coproc',
  'foreach', 'end',
]);

export class CommandIndex {
  private commands: Set<string>;

  constructor() {
    this.commands = new Set<string>();
  }

  build(): void {
    this.commands = new Set([...ZSH_BUILTINS, ...ZSH_RESERVED]);

    const pathVar = environment.getVar('PATH') ?? '';
    const dirs = pathVar.split(':').filter(Boolean);

    for (const dir of dirs) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() || entry.isSymbolicLink()) {
            this.commands.add(entry.name);
          }
        }
      } catch {
        // skip unreadable dirs
      }
    }
  }

  getMatches(prefix: string): string[] {
    const matches: string[] = [];
    for (const cmd of this.commands) {
      if (cmd.startsWith(prefix)) {
        matches.push(cmd);
      }
    }
    return matches.sort();
  }

  has(token: string): boolean {
    return this.commands.has(token);
  }

  get size(): number {
    return this.commands.size;
  }
}
