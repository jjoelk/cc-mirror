import { spawnSync } from 'node:child_process';

export const openUrl = (url: string): boolean => {
  const platform = process.platform;
  let command = 'xdg-open';
  if (platform === 'darwin') command = 'open';
  if (platform === 'win32') command = 'start';
  const result = spawnSync(command, [url], { stdio: 'ignore', shell: platform === 'win32' });
  return result.status === 0;
};
