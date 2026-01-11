/**
 * Tweak command - launches tweakcc for a variant
 */

import * as core from '../../core/index.js';
import type { ParsedArgs } from '../args.js';

export interface TweakCommandOptions {
  opts: ParsedArgs;
}

/**
 * Execute the tweak command
 */
export function runTweakCommand({ opts }: TweakCommandOptions): void {
  const target = opts._ && opts._[0];
  if (!target) {
    console.error('tweak requires a variant name');
    process.exit(1);
  }
  const rootDir = (opts.root as string) || core.DEFAULT_ROOT;
  core.tweakVariant(rootDir, target);
}
