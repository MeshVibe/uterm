import { execFileSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { ContextBuffer } from './context.js';
import { formatStreamStart, formatStreamEnd } from './formatter.js';
import { environment } from '../shell/environment.js';

function resolveApiKeyFromVault(): string | undefined {
  try {
    return execFileSync('vault', ['get', 'anthropic-api-key'], {
      encoding: 'utf-8',
      timeout: 5_000,
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}

const MODEL = 'claude-sonnet-4-6';

export class ClaudeClient {
  private client: Anthropic | null = null;
  private available: boolean = false;

  constructor() {
    try {
      const apiKey = process.env['ANTHROPIC_API_KEY'] || resolveApiKeyFromVault();
      if (apiKey) {
        this.client = new Anthropic({ apiKey });
        this.available = true;
      }
    } catch {
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async ask(prompt: string, context: ContextBuffer): Promise<string> {
    if (!this.client) return '';

    const systemPrompt = buildSystemPrompt(context);

    try {
      process.stdout.write(formatStreamStart(false));
      const response = await this.streamResponse(systemPrompt, prompt);
      process.stdout.write('\n');
      process.stdout.write(formatStreamEnd());
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\n(Claude error: ${msg})\n`);
      return '';
    }
  }

  async help(
    command: string,
    stdout: string,
    stderr: string,
    exitCode: number,
    context: ContextBuffer,
  ): Promise<string> {
    if (!this.client) return '';

    const systemPrompt = buildSystemPrompt(context);
    const userMessage = [
      `The following command failed with exit code ${exitCode}:`,
      `$ ${command}`,
      stdout ? `stdout:\n${stdout}` : '',
      stderr ? `stderr:\n${stderr}` : '',
      '',
      'Please explain what went wrong and suggest a fix. Be concise.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      process.stdout.write(formatStreamStart(true));
      const response = await this.streamResponse(systemPrompt, userMessage);
      process.stdout.write('\n');
      process.stdout.write(formatStreamEnd());
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\n(Claude error: ${msg})\n`);
      return '';
    }
  }

  private async streamResponse(systemPrompt: string, userMessage: string): Promise<string> {
    if (!this.client) return '';

    let fullResponse = '';

    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    process.stdout.write('\n');

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        process.stdout.write(text);
        fullResponse += text;
      }
    }

    return fullResponse;
  }
}

function buildSystemPrompt(context: ContextBuffer): string {
  const cwd = environment.getCwd();
  const parts = [
    'You are Claude, integrated into Universal Terminal (uterm).',
    'Rules:',
    '- Max 3 sentences unless user asks for detail',
    '- Commands go in ```bash blocks, no explanation unless non-obvious',
    '- Error diagnosis: cause → fix. No preamble',
    '- Never repeat the user\'s question back',
    '- Skip filler ("Sure!", "Of course!", "Let me help", etc.)',
    `Current working directory: ${cwd}`,
    '',
    'Recent terminal activity:',
    context.format(),
  ];
  return parts.join('\n');
}
