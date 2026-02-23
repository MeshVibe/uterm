# Universal Terminal (uterm)

A terminal where Claude is always co-piloting. Type shell commands normally — they just work. Type natural language — Claude handles it. When commands error, Claude automatically offers help with full context of what you were doing.

## Setup

### Prerequisites

- Node.js 20+
- zsh

### Install

```bash
git clone <repo-url>
cd UniversalTerminal
npm install
npm run build
```

### Add to PATH

Run this once from the project directory:

```bash
npm link
```

Now `uterm` is available globally. Type `uterm` from anywhere to start.

To unlink later: `npm unlink -g uterm`

### Claude API Key

To enable Claude features (natural language input and auto-error-help), set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

For secure key storage with 1Password CLI:

```bash
# In ~/.zprofile
if [[ -z "$ANTHROPIC_API_KEY" ]]; then
  export ANTHROPIC_API_KEY=$(op read "op://Private/Anthropic API Key/credential" 2>/dev/null)
  [[ -n "$ANTHROPIC_API_KEY" ]] && launchctl setenv ANTHROPIC_API_KEY "$ANTHROPIC_API_KEY" 2>/dev/null
fi
```

This prompts Touch ID once on first terminal open, then `launchctl setenv` makes the key available to all subsequent terminals without re-prompting.

Get your API key at https://console.anthropic.com/settings/keys and add credits at https://console.anthropic.com/settings/billing.

Without an API key, uterm still works as a normal shell — Claude features are just disabled.

### Default Shell

To launch uterm automatically when you open a terminal, add this to `~/.zprofile`:

```bash
if [[ -o interactive ]] && [[ -z "$CLAUDECODE" ]]; then
  exec uterm
fi
```

The guards ensure uterm only launches for interactive terminal sessions and not when Claude Code spawns shells. `exec` replaces the zsh process so there's no dangling shell underneath.

## Usage

```
uterm
```

### Shell commands

Run commands as usual:

```
~/projects $ ls
~/projects $ cd my-app
~/my-app $ git status
~/my-app $ echo $PATH
~/my-app $ ls | grep .ts
~/my-app $ echo a && echo b
```

### Natural language

Just type what you want:

```
~/my-app $ explain what a symlink is
~/my-app $ how do I find large files on disk
~/my-app $ what does the -R flag do in chmod
```

### Auto-error-help

When a command fails, Claude automatically explains what went wrong:

```
~/my-app $ npm run build
> tsc -p tsconfig.json
error TS2345: Argument of type 'string' is not assignable...

--- Claude (auto-help) ---
The TypeScript error says you're passing a string where a number
is expected. Check the function call and use parseInt() or a
type assertion.
---
```

### Builtins

`cd`, `export`, `unset`, and `exit` are handled natively:

```
~/projects $ cd my-app
~/my-app $ export FOO=bar
~/my-app $ echo $FOO
~/my-app $ unset FOO
~/my-app $ exit
```

## Development

```bash
npm run build      # compile TypeScript
npm run dev        # watch mode
npm start          # run without rebuilding
npm run uterm      # build + run
npm test           # run tests
```

## Architecture

```
src/
  index.ts              # Entry point, REPL loop
  repl/
    input.ts            # Readline interface, history
    classifier.ts       # Command vs natural language detection
    command-index.ts    # PATH scanning + zsh builtins
    completer.ts        # Tab completion for commands and file paths
  shell/
    executor.ts         # Run commands via zsh
    builtins.ts         # cd, export, unset, exit
    environment.ts      # Env vars and cwd management
  claude/
    client.ts           # Anthropic API with streaming
    context.ts          # Rolling context buffer
    parser.ts           # Extract code blocks from responses
    formatter.ts        # Response formatting
  config/
    loader.ts           # Configuration defaults
  utils/
    prompt.ts           # Terminal prompt rendering
    colors.ts           # ANSI color helpers
```

## How Classification Works

When you type input, uterm decides whether to run it as a shell command or send it to Claude:

1. Contains shell operators (`|`, `&`, `;`, `<`, `>`) → shell command
2. Starts with `(`, `{`, or `$(` → shell command
3. First token is a known binary or builtin → shell command
4. Starts with `./` or `/` → shell command
5. Otherwise → send to Claude as natural language

Misclassification is self-correcting: if "make me a website" runs `make` and fails, Claude catches the error and understands you meant natural language.
