#!/usr/bin/env node

import { CommandIndex } from './repl/command-index.js';
import { classify } from './repl/classifier.js';
import { createCompleter } from './repl/completer.js';
import { InputHandler } from './repl/input.js';
import { handleBuiltin } from './shell/builtins.js';
import { execute } from './shell/executor.js';
import { ClaudeClient } from './claude/client.js';
import { ContextBuffer } from './claude/context.js';
import { extractCodeBlocks } from './claude/parser.js';
import { environment } from './shell/environment.js';
import { renderPrompt } from './utils/prompt.js';
import { loadConfig } from './config/loader.js';
import { bold, cyan, dim, yellow } from './utils/colors.js';

async function main() {
  const config = loadConfig();
  const commandIndex = new CommandIndex();
  const context = new ContextBuffer(config.contextSize);
  const claude = new ClaudeClient();
  const input = new InputHandler();

  // Build command index
  commandIndex.build();

  // Startup banner
  console.log(bold(cyan('Universal Terminal')) + dim(` (uterm v0.1.0)`));
  if (claude.isAvailable()) {
    console.log(dim('Claude is available — type natural language for AI help'));
  } else {
    console.log(yellow('No ANTHROPIC_API_KEY found — running in shell-only mode'));
  }
  console.log('');

  const completer = createCompleter(commandIndex);
  const rl = input.create(renderPrompt(), completer);

  // Handle Ctrl+D
  input.onClose(() => {
    console.log(dim('\nGoodbye!'));
    process.exit(0);
  });

  // REPL loop
  const promptLoop = () => {
    input.setPrompt(renderPrompt());
    input.question(renderPrompt()).then(async (line) => {
      if (line === null) {
        process.exit(0);
        return;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        promptLoop();
        return;
      }

      const classification = classify(trimmed, commandIndex);

      if (classification === 'prompt') {
        // Natural language → Claude
        if (claude.isAvailable()) {
          const response = await claude.ask(trimmed, context);
          context.add({
            type: 'claude_response',
            input: trimmed,
            output: response,
            timestamp: Date.now(),
          });

          // Offer to execute any shell code blocks from the response
          const codeBlocks = extractCodeBlocks(response);
          for (const cmd of codeBlocks) {
            const answer = await input.question(dim('  $ ') + bold(cmd) + dim('  Run? [Y/n] '));
            if (answer === null) break;
            const t = answer.trim().toLowerCase();
            if (t === 'n' || t === 'no') continue;

            // Execute the command
            const builtinResult = handleBuiltin(cmd);
            if (builtinResult.handled) {
              if (builtinResult.output) console.log(builtinResult.output);
              context.add({
                type: 'command',
                input: cmd,
                output: builtinResult.output,
                exitCode: builtinResult.exitCode,
                cwd: environment.getCwd(),
                timestamp: Date.now(),
              });
            } else {
              input.pause();
              const result = await execute(cmd);
              input.resume();
              const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
              context.add({
                type: 'command',
                input: cmd,
                output: combinedOutput,
                exitCode: result.exitCode,
                cwd: environment.getCwd(),
                timestamp: Date.now(),
              });
            }
          }
        } else {
          console.log(yellow('Claude is not available (no API key). Try running as a shell command.'));
        }
        promptLoop();
        return;
      }

      // It's a command — check builtins first
      const builtinResult = handleBuiltin(trimmed);
      if (builtinResult.handled) {
        if (builtinResult.output) {
          console.log(builtinResult.output);
        }
        context.add({
          type: 'command',
          input: trimmed,
          output: builtinResult.output,
          exitCode: builtinResult.exitCode,
          cwd: environment.getCwd(),
          timestamp: Date.now(),
        });
        promptLoop();
        return;
      }

      // Execute shell command
      input.pause();
      const result = await execute(trimmed);
      input.resume();

      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');

      context.add({
        type: 'command',
        input: trimmed,
        output: combinedOutput,
        exitCode: result.exitCode,
        cwd: environment.getCwd(),
        timestamp: Date.now(),
      });

      // Auto-help on error
      if (result.exitCode !== 0 && config.autoHelp && claude.isAvailable()) {
        const response = await claude.help(
          trimmed,
          result.stdout,
          result.stderr,
          result.exitCode,
          context,
        );
        if (response) {
          context.add({
            type: 'claude_response',
            input: `auto-help for: ${trimmed}`,
            output: response,
            timestamp: Date.now(),
          });
        }
      }

      promptLoop();
    });
  };

  promptLoop();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
