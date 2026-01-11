/**
 * Judge command - Multi-agent session analysis
 *
 * Analyzes Claude Code sessions using multiple LLM workers to provide
 * consensus-based validation and feedback.
 *
 * Usage:
 *   cc-mirror judge [options]
 */

import * as core from '../../core/index.js';
import type { ParsedArgs } from '../args.js';
import {
  listSessions,
  getMostRecentSession,
  parseSession,
  extractContext,
  WORKER_CONFIGS,
  getDefaultWorkers,
  parseWorkerList,
  runWorkers,
  variantExists,
  calculateConsensus,
  printVerdict,
  printProgress,
  printError,
  type WorkerConfig,
  type WorkerPersonality,
} from './judge/index.js';

export interface JudgeCommandOptions {
  opts: ParsedArgs;
}

/**
 * Show judge help
 */
function showJudgeHelp(): void {
  console.log(`
npx cc-mirror judge - Multi-agent session analysis

USAGE:
  npx cc-mirror judge [options]

DESCRIPTION:
  Analyzes your current Claude Code session using multiple LLM workers
  (skeptic, auditor, etc.) to provide multi-perspective validation and
  consensus verdicts.

OPTIONS:
  --session <id>     Analyze specific session (default: most recent)
  --project <path>   Project path (default: current directory)
  --workers <list>   Comma-separated workers (default: skeptic,auditor)
                     Available: skeptic, auditor, advocate, security
  --variant <name>   Use specific cc-mirror variant for all workers
  --timeout <ms>     Worker timeout in ms (default: 120000)
  --parallel         Run workers in parallel (default)
  --sequential       Run workers sequentially
  --json             Output as JSON
  --verbose          Show detailed worker outputs
  --list             List available sessions
  --help             Show this help

EXAMPLES:
  npx cc-mirror judge                           # Judge most recent session
  npx cc-mirror judge --workers skeptic,security
  npx cc-mirror judge --session abc123 --verbose
  npx cc-mirror judge --variant zai --json
  npx cc-mirror judge --list                    # List sessions

WORKERS:
  skeptic   Questions assumptions, finds hidden issues
  auditor   Checks for completeness and correctness
  advocate  Highlights strengths, provides balanced view
  security  Focuses on security vulnerabilities and risks
`);
}

/**
 * Run the judge command
 */
export async function runJudgeCommand({ opts }: JudgeCommandOptions): Promise<void> {
  // Help
  if (opts.help || opts.h) {
    showJudgeHelp();
    return;
  }

  const projectPath = (opts.project as string) || process.cwd();
  const binDir = (opts['bin-dir'] as string) || core.DEFAULT_BIN_DIR;
  const json = Boolean(opts.json);
  const verbose = Boolean(opts.verbose);
  const timeout = opts.timeout ? Number(opts.timeout) : 120000;
  const parallel = !opts.sequential;

  // List sessions mode
  if (opts.list) {
    const sessions = listSessions(projectPath);
    if (sessions.length === 0) {
      console.log('No sessions found for this project.');
      console.log(`Project path: ${projectPath}`);
      return;
    }
    console.log(`\nSessions for ${projectPath}:\n`);
    for (const s of sessions.slice(0, 20)) {
      const dateStr = s.modifiedAt.toLocaleString();
      console.log(`  ${s.id.slice(0, 8)}...  ${dateStr}`);
    }
    if (sessions.length > 20) {
      console.log(`  ... and ${sessions.length - 20} more`);
    }
    console.log('');
    return;
  }

  // Get session
  let session;
  if (opts.session) {
    const sessions = listSessions(projectPath);
    const sessionArg = opts.session as string;
    const found = sessions.find((s) => s.id === sessionArg || s.id.startsWith(sessionArg));
    if (!found) {
      printError(`Session not found: ${sessionArg}`);
      console.log('Use --list to see available sessions.');
      process.exitCode = 1;
      return;
    }
    session = parseSession(found.path);
  } else {
    const mostRecent = getMostRecentSession(projectPath);
    if (!mostRecent) {
      printError('No sessions found for this project.');
      console.log(`Project path: ${projectPath}`);
      console.log('Make sure you are in a directory where you have used Claude Code.');
      process.exitCode = 1;
      return;
    }
    session = parseSession(mostRecent.path);
  }

  // Extract context
  const context = extractContext(session, { maxMessages: 30, maxChars: 60000 });

  if (context.trim().length === 0) {
    printError('Session has no messages to analyze.');
    process.exitCode = 1;
    return;
  }

  // Determine workers
  const workerNames = opts.workers
    ? parseWorkerList(opts.workers as string)
    : getDefaultWorkers();

  if (workerNames.length === 0) {
    printError('No valid workers specified.');
    console.log('Available workers: skeptic, auditor, advocate, security');
    process.exitCode = 1;
    return;
  }

  // Build worker configs
  const configs: WorkerConfig[] = workerNames
    .filter((name) => name in WORKER_CONFIGS)
    .map((name) => {
      const config = { ...WORKER_CONFIGS[name] };
      if (opts.variant) {
        config.variant = opts.variant as string;
      }
      return config;
    });

  // Verify variants exist
  const missingVariants: string[] = [];
  const seenVariants = new Set<string>();
  for (const config of configs) {
    if (!seenVariants.has(config.variant)) {
      seenVariants.add(config.variant);
      if (!variantExists(config.variant, binDir)) {
        missingVariants.push(config.variant);
      }
    }
  }

  if (missingVariants.length > 0) {
    printError(`Missing variant(s): ${missingVariants.join(', ')}`);
    console.log(`\nCreate the variant first with:`);
    for (const v of missingVariants) {
      console.log(`  npx cc-mirror quick --provider zai --name ${v} --api-key $Z_AI_API_KEY`);
    }
    process.exitCode = 1;
    return;
  }

  // Progress output
  if (!json) {
    printProgress(`\nAnalyzing session ${session.id.slice(0, 8)}...`);
    printProgress(`Workers: ${configs.map((c) => c.name).join(', ')}`);
    printProgress(`Context: ${session.messages.length} messages\n`);
  }

  // Run workers
  const verdicts = await runWorkers(configs, context, { binDir, timeout, parallel });

  // Calculate consensus
  const consensus = calculateConsensus(verdicts);

  // Output
  printVerdict(consensus, verdicts, { json, verbose });
}
