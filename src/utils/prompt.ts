import { environment } from '../shell/environment.js';
import { cyan, bold } from './colors.js';

export function renderPrompt(): string {
  const cwd = environment.getCwd();
  const home = environment.getVar('HOME') ?? '';
  const display = home && cwd.startsWith(home)
    ? '~' + cwd.slice(home.length)
    : cwd;
  return `${cyan(display)} ${bold('$')} `;
}
