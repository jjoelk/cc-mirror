import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ParsedArgs } from './args.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const shouldLaunchTui = (cmd: string, opts: ParsedArgs): boolean => {
  if (opts.noTui) return false;
  if (opts.tui) return true;
  if (!process.stdout.isTTY) return false;
  if (cmd === 'create') {
    const hasArgs =
      opts.yes ||
      Boolean(opts.name) ||
      Boolean(opts.provider) ||
      Boolean(opts['base-url']) ||
      Boolean(opts['api-key']) ||
      (opts._?.length ?? 0) > 0;
    return !hasArgs;
  }
  return false;
};

export const runTui = async () => {
  const candidates = [
    process.env.CC_MIRROR_TUI_PATH,
    path.join(dirname, '..', 'tui', 'index.tsx'),
    path.join(dirname, '..', 'tui', 'index.mjs'),
    path.join(dirname, 'tui.mjs'),
  ].filter(Boolean) as string[];

  const target = candidates.find((filePath) => fs.existsSync(filePath));
  if (!target) {
    throw new Error('Unable to locate TUI entrypoint.');
  }

  await import(pathToFileURL(target).href);
};
