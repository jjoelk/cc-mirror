/**
 * Extra environment variable utilities
 */

import type { ParsedArgs } from '../args.js';

/**
 * Build extra environment variables from parsed arguments
 */
export function buildExtraEnv(opts: ParsedArgs): string[] {
  const env = Array.isArray(opts.env) ? [...opts.env] : [];
  const timeout = opts['timeout-ms'];
  if (typeof timeout === 'string' && timeout.trim().length > 0) {
    env.push(`API_TIMEOUT_MS=${timeout}`);
  }
  return env;
}
