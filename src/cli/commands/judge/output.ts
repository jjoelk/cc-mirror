/**
 * Terminal output formatting for judge verdict display
 */

import type { ConsensusResult, WorkerVerdict } from './types.js';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const verdictColors: Record<string, string> = {
  approve: colors.green,
  reject: colors.red,
  concern: colors.yellow,
  mixed: colors.cyan,
  neutral: colors.gray,
};

const verdictIcons: Record<string, string> = {
  approve: '✓',
  reject: '✗',
  concern: '!',
  mixed: '?',
  neutral: '○',
};

/**
 * Format and print the judge verdict to console
 */
export function printVerdict(
  consensus: ConsensusResult,
  verdicts: WorkerVerdict[],
  options: { json?: boolean; verbose?: boolean } = {}
): void {
  if (options.json) {
    console.log(JSON.stringify({ consensus, verdicts }, null, 2));
    return;
  }

  const color = verdictColors[consensus.finalVerdict] ?? colors.gray;

  // Header
  console.log('');
  console.log(`${colors.bold}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║                      JUDGE VERDICT                       ║${colors.reset}`);
  console.log(`${colors.bold}╚══════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');

  // Final verdict
  const icon = verdictIcons[consensus.finalVerdict] ?? '?';
  console.log(`  ${colors.bold}Final Verdict:${colors.reset} ${color}${icon} ${consensus.finalVerdict.toUpperCase()}${colors.reset}`);
  console.log(`  ${colors.bold}Confidence:${colors.reset}    ${consensus.confidence}%`);
  console.log(`  ${colors.bold}Agreement:${colors.reset}     ${consensus.agreement}%`);
  console.log('');

  // Worker breakdown
  console.log(`${colors.dim}───────────────────── Worker Analysis ─────────────────────${colors.reset}`);
  console.log('');

  for (const verdict of verdicts) {
    const vColor = verdictColors[verdict.verdict] ?? colors.gray;
    const vIcon = verdictIcons[verdict.verdict] ?? '?';

    console.log(`  ${vColor}${vIcon}${colors.reset} ${colors.bold}${verdict.worker.toUpperCase()}${colors.reset} — ${vColor}${verdict.verdict}${colors.reset} (${verdict.confidence}%)`);
    console.log(`    ${colors.dim}${verdict.summary}${colors.reset}`);

    if (options.verbose && verdict.concerns.length > 0) {
      console.log(`    ${colors.yellow}Concerns:${colors.reset}`);
      for (const concern of verdict.concerns) {
        console.log(`      • ${concern}`);
      }
    }

    console.log('');
  }

  // Aggregated concerns
  if (consensus.allConcerns.length > 0) {
    console.log(`${colors.dim}─────────────────────── Concerns ──────────────────────────${colors.reset}`);
    console.log('');
    for (const concern of consensus.allConcerns) {
      console.log(`  ${colors.yellow}•${colors.reset} ${concern}`);
    }
    console.log('');
  }

  // Recommendations
  if (consensus.allRecommendations.length > 0) {
    console.log(`${colors.dim}────────────────────── Recommendations ────────────────────${colors.reset}`);
    console.log('');
    for (const rec of consensus.allRecommendations) {
      console.log(`  ${colors.cyan}→${colors.reset} ${rec}`);
    }
    console.log('');
  }

  // Footer
  console.log(`${colors.dim}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log('');
}

/**
 * Print a progress message
 */
export function printProgress(message: string): void {
  console.log(`${colors.dim}${message}${colors.reset}`);
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.error(`${colors.red}Error:${colors.reset} ${message}`);
}
