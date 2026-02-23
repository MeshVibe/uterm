import fs from 'node:fs';
import path from 'node:path';
import { environment } from '../shell/environment.js';
import { CommandIndex } from './command-index.js';

export function createCompleter(
  commandIndex: CommandIndex,
): (line: string) => [string[], string] {
  return (line: string): [string[], string] => {
    const trimmedLeft = line.replace(/^\s+/, '');
    const spaceIndex = trimmedLeft.indexOf(' ');
    const isFirstToken = spaceIndex === -1;

    if (isFirstToken) {
      // Command completion
      const prefix = trimmedLeft;
      const matches = commandIndex.getMatches(prefix);
      return [matches, prefix];
    }

    // Argument position — file/directory completion
    const afterCommand = trimmedLeft.slice(spaceIndex + 1);
    // Get the last space-separated token as the partial path
    const lastSpaceIndex = afterCommand.lastIndexOf(' ');
    const partial = lastSpaceIndex === -1 ? afterCommand : afterCommand.slice(lastSpaceIndex + 1);

    const cwd = environment.getCwd();
    const dir = partial.includes('/')
      ? path.resolve(cwd, partial.slice(0, partial.lastIndexOf('/') + 1))
      : cwd;
    const prefix = partial.includes('/')
      ? partial.slice(partial.lastIndexOf('/') + 1)
      : partial;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const matches: string[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith(prefix)) {
          const basePath = partial.includes('/')
            ? partial.slice(0, partial.lastIndexOf('/') + 1)
            : '';
          const suffix = entry.isDirectory() ? '/' : '';
          matches.push(basePath + entry.name + suffix);
        }
      }
      return [matches.sort(), partial];
    } catch {
      return [[], partial];
    }
  };
}
