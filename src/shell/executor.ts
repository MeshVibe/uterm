import { spawn } from 'node:child_process';
import { environment } from './environment.js';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const INTERACTIVE_COMMANDS = new Set([
  'vim', 'nvim', 'vi', 'nano', 'emacs', 'less', 'more', 'man',
  'top', 'htop', 'ssh', 'python', 'python3', 'node', 'irb', 'ruby',
  'mysql', 'psql', 'sqlite3', 'mongo', 'redis-cli', 'ftp', 'sftp',
  'telnet', 'screen', 'tmux', 'nnn', 'ranger', 'mc',
]);

function isInteractive(input: string): boolean {
  const firstToken = input.trim().split(/\s/)[0];
  if (INTERACTIVE_COMMANDS.has(firstToken)) {
    // Check if the command is being piped or redirected — if so, not interactive
    if (/[|><]/.test(input)) return false;
    // python/node with a filename argument is not interactive
    if ((firstToken === 'python' || firstToken === 'python3' || firstToken === 'node') &&
        input.trim().split(/\s+/).length > 1) {
      return false;
    }
    return true;
  }
  return false;
}

export async function execute(input: string): Promise<ExecutionResult> {
  const cwd = environment.getCwd();
  const env = environment.getEnv();

  if (isInteractive(input)) {
    return executeInteractive(input, cwd, env);
  }

  return executeCapture(input, cwd, env);
}

function executeInteractive(
  input: string,
  cwd: string,
  env: Record<string, string>,
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const child = spawn('zsh', ['-c', input], {
      cwd,
      env,
      stdio: 'inherit',
    });

    // Swallow SIGINT so Node doesn't exit — let the child handle it
    const sigintHandler = () => {};
    process.on('SIGINT', sigintHandler);

    child.on('close', (code) => {
      process.removeListener('SIGINT', sigintHandler);
      resolve({
        stdout: '',
        stderr: '',
        exitCode: code ?? 0,
      });
    });

    child.on('error', (err) => {
      process.removeListener('SIGINT', sigintHandler);
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

function executeCapture(
  input: string,
  cwd: string,
  env: Record<string, string>,
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const child = spawn('zsh', ['-c', input], {
      cwd,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    // Swallow SIGINT — forward it to child instead of killing Node
    const sigintHandler = () => {
      child.kill('SIGINT');
    };
    process.on('SIGINT', sigintHandler);

    child.on('close', (code) => {
      process.removeListener('SIGINT', sigintHandler);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    child.on('error', (err) => {
      process.removeListener('SIGINT', sigintHandler);
      resolve({
        stdout,
        stderr: stderr + err.message,
        exitCode: 1,
      });
    });
  });
}
