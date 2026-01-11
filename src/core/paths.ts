import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

export const expandTilde = (input?: string): string | undefined => {
  if (!input) return input;
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
};

export const commandExists = (cmd: string): boolean => {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
  });
  return result.status === 0 && result.stdout.trim().length > 0;
};
