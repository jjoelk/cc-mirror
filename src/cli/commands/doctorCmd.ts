/**
 * Doctor command - checks health of all variants
 */

import * as core from '../../core/index.js';
import { printDoctor } from '../doctor.js';
import type { ParsedArgs } from '../args.js';

export interface DoctorCommandOptions {
  opts: ParsedArgs;
}

/**
 * Execute the doctor command
 */
export function runDoctorCommand({ opts }: DoctorCommandOptions): void {
  const rootDir = (opts.root as string) || core.DEFAULT_ROOT;
  const binDir = (opts['bin-dir'] as string) || core.DEFAULT_BIN_DIR;
  const report = core.doctor(rootDir, binDir);
  printDoctor(report);
}
