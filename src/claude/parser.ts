const SHELL_LANGS = new Set(['bash', 'sh', 'zsh', '']);

/**
 * Extract shell code blocks from a Claude response.
 * Matches fenced blocks tagged with bash/sh/zsh or untagged (bare ```).
 * Ignores blocks tagged with non-shell languages like python, json, etc.
 */
export function extractCodeBlocks(response: string): string[] {
  const blocks: string[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(response)) !== null) {
    const lang = match[1].toLowerCase();
    const code = match[2].trim();
    if (SHELL_LANGS.has(lang) && code.length > 0) {
      blocks.push(code);
    }
  }

  return blocks;
}
