/**
 * Remove command - removes a variant
 */

import * as core from '../../core/index.js';
import type { ParsedArgs } from '../args.js';

export interface RemoveCommandOptions {
  opts: ParsedArgs;
}

/**
 * Execute the remove command
 */
export function runRemoveCommand({ opts }: RemoveCommandOptions): void {
  const target = opts._ && opts._[0];
  if (!target) {
    console.error('remove requires a variant name');
    process.exit(1);
  }
  const rootDir = (opts.root as string) || core.DEFAULT_ROOT;
  core.removeVariant(rootDir, target);
  console.log(`Removed ${target}`);
}
