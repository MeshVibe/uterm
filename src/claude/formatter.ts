import { cyan, magenta, dim, bold } from '../utils/colors.js';

const DIVIDER_WIDTH = 60;

function divider(label: string): string {
  const prefix = '--- ';
  const suffix = ' ---';
  return dim(prefix + bold(label) + suffix);
}

export function claudeHeader(): string {
  return '\n' + divider(magenta('Claude'));
}

export function claudeAutoHelpHeader(): string {
  return '\n' + divider(cyan('Claude (auto-help)'));
}

export function claudeFooter(): string {
  return dim('---') + '\n';
}

export function formatStreamStart(autoHelp: boolean): string {
  return autoHelp ? claudeAutoHelpHeader() : claudeHeader();
}

export function formatStreamEnd(): string {
  return claudeFooter();
}
