export interface Config {
  model: string;
  autoHelp: boolean;
  contextSize: number;
  maxOutput: number;
}

export function loadConfig(): Config {
  return {
    model: 'claude-haiku-4-5-20251001',
    autoHelp: true,
    contextSize: 20,
    maxOutput: 10_000,
  };
}
