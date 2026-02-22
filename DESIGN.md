# Universal Terminal — Design Document

## What is Universal Terminal?

A terminal where Claude is always co-piloting. Type shell commands normally — they just work. Type natural language — Claude handles it. When commands error, Claude automatically offers help with full context of what you were doing.

It should feel like your normal terminal, but smarter.

## How It Works

### Input Classification

On startup, build a **command index** by scanning:
- All directories in `$PATH` for available binaries
- Shell builtins: `cd`, `export`, `alias`, `source`, `set`, `unset`, `pushd`, `popd`, `dirs`, `history`, `bg`, `fg`, `jobs`, `kill`, `wait`, `eval`, `exec`, `exit`, `logout`, `umask`, `ulimit`, `type`, `hash`, `readonly`, `declare`, `local`, `typeset`, `let`, `test`
- Rebuild index periodically or on PATH changes

When input arrives:
1. Extract the first token
2. If it matches a known command/binary → **run as shell command**
3. If it doesn't match → **send to Claude as a prompt**
4. If a shell command exits non-zero → **automatically send error + context to Claude**

### Edge Cases

- `make me a website` — `make` is a real binary, so it runs, fails ("no rule to make target 'me'"), Claude catches the error and understands the user meant natural language. Claude suggests: "It looks like you wanted me to help make a website, not run GNU make."
- `git` commands with typos — runs, errors, Claude suggests the fix
- Ambiguous input — when in doubt, try as shell first. The error path handles misclassification gracefully.
- Piped commands (`ls | grep foo`) — run as shell
- Commands with operators (`&&`, `||`, `;`, `|`) — run as shell
- Quoted strings, redirects, subshells — all run as shell

### Context Window

Maintain a rolling context buffer of recent terminal activity:
- Last N commands and their outputs (stdout + stderr)
- Current working directory
- Exit codes
- Truncate large outputs to keep context manageable

When Claude is invoked (either by natural language or error), it receives:
- The full rolling context
- The current working directory
- The user's input or the failed command + error

This means Claude always knows what you've been doing and can give contextual help.

### Shell Features

Must feel like a real terminal:
- **`cd` changes directory** — maintained in the process, affects subsequent commands
- **Environment variables** — `export FOO=bar` persists for the session
- **Command history** — up/down arrows, searchable
- **Tab completion** — for file paths and commands (use readline)
- **Prompt** — shows current directory, git branch if applicable
- **Signals** — Ctrl+C cancels running command (not the terminal), Ctrl+D exits
- **Aliases** — support user-defined aliases

### Claude Integration

Options (in order of preference):
1. **Claude API directly** — fastest, most control, can stream responses
2. **Claude Code CLI** (`claude -p`) — simpler, but spawns a process each time

Recommend starting with the Claude API for responsiveness. Stream Claude's response so it feels conversational.

### Error Interception

When a command exits non-zero:
```
$ npm run build
> tsc -p tsconfig.json
error TS2345: Argument of type 'string' is not assignable...

┌─ Claude ─────────────────────────────────────────────┐
│ The TypeScript error is saying you're passing a       │
│ string where a number is expected. Check line 42 of   │
│ src/utils.ts — you probably need parseInt() or a      │
│ type assertion.                                       │
│                                                       │
│ Fix: parseInt(value, 10)                             │
└───────────────────────────────────────────────────────┘
```

The Claude help appears automatically — no need to ask. If the user doesn't want help, they can just type their next command and move on.

### Configuration

`~/.utermrc` or `~/.config/uterm/config.toml`:

```toml
# Claude model to use
model = "sonnet"

# Auto-help on errors (true = always show, false = ask first)
auto_help = true

# Context buffer size (number of recent commands to keep)
context_size = 20

# Max output to capture per command (chars)
max_output = 10000

# Custom prompt format
prompt = "{cwd} $ "

# API key (or use ANTHROPIC_API_KEY env var)
# api_key = "sk-..."
```

## Architecture

```
src/
  index.ts              # Entry point, REPL setup
  repl/
    input.ts            # Readline interface, history, tab completion
    classifier.ts       # Determine if input is command or prompt
    command-index.ts    # Scan PATH, build binary index
  shell/
    executor.ts         # Run shell commands, capture output
    builtins.ts         # Handle cd, export, alias, etc.
    environment.ts      # Manage env vars, cwd
  claude/
    client.ts           # Claude API integration
    context.ts          # Rolling context buffer
    formatter.ts        # Format Claude responses for terminal
  config/
    loader.ts           # Load ~/.utermrc
  utils/
    prompt.ts           # Terminal prompt rendering
    colors.ts           # ANSI color helpers
```

### Data Flow

```
User Input
  │
  ├─ classifier.classify(input)
  │   ├─ "command" → shell/executor.run(input)
  │   │               ├─ success → display output, add to context
  │   │               └─ error   → display output, add to context
  │   │                            → claude/client.help(error, context)
  │   │                            → display Claude suggestion
  │   └─ "prompt"  → claude/client.ask(input, context)
  │                   → stream response to terminal
  │
  └─ Update context buffer
```

## Technical Stack

- **Language**: TypeScript (ESM, Node 20+)
- **REPL**: Node.js readline or ink (for richer TUI)
- **Shell execution**: node:child_process (spawn with shell: true)
- **Claude**: @anthropic-ai/sdk (direct API)
- **Config**: @iarna/toml or similar
- **Package name**: `uterm`
- **Binary**: `uterm`

## MVP Scope

Phase 1 — Get it working:
- Command index from PATH
- Input classification (command vs. natural language)
- Shell execution with output capture
- `cd` support
- Claude API integration for prompts and error help
- Rolling context buffer
- Basic readline with history

Phase 2 — Make it nice:
- Tab completion
- Git branch in prompt
- Streaming Claude responses
- Config file support
- Colored output and Claude response formatting

Phase 3 — Power features:
- Alias support
- Claude can suggest and auto-run commands (with confirmation)
- Multi-line input support
- Session persistence (resume context from last session)
- Plugin system for custom classifiers

## Open Questions

- Should Claude responses be boxed/bordered, or inline with different coloring?
- Should there be a way to force shell mode or Claude mode? (e.g., prefix with `!` or `?`)
- Should Claude be able to run commands on the user's behalf? (with confirmation)
- How to handle long-running commands (e.g., `npm install`) — stream output or wait?
- Should it read the user's `.bashrc`/`.zshrc` for aliases and functions?
