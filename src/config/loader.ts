export interface Config {
  model: string;
  autoHelp: boolean;
  contextSize: number;
  maxOutput: number;
}

export function loadConfig(): Config {
  return {
    model: 'claude-sonnet-4-20250514',
    autoHelp: true,
    contextSize: 20,
    maxOutput: 10_000,
  };
}
