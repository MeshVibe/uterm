import readline from 'node:readline';

export class InputHandler {
  private rl: readline.Interface | null = null;

  create(prompt: string, completer?: (line: string) => [string[], string]): readline.Interface {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 1000,
      prompt,
      completer,
    });
    return this.rl;
  }

  setPrompt(prompt: string): void {
    this.rl?.setPrompt(prompt);
  }

  question(prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.rl) {
        resolve(null);
        return;
      }
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  pause(): void {
    this.rl?.pause();
  }

  resume(): void {
    this.rl?.resume();
  }

  close(): void {
    this.rl?.close();
    this.rl = null;
  }

  onClose(handler: () => void): void {
    this.rl?.on('close', handler);
  }
}
