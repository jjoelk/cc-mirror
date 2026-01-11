/**
 * Worker spawning and output capture for judge command
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DEFAULT_BIN_DIR } from '../../../core/index.js';
import type {
  SpawnWorkerOptions,
  WorkerResult,
  WorkerConfig,
  WorkerVerdict,
  WorkerPersonality,
} from './types.js';

/**
 * Check if a variant wrapper exists
 */
export function variantExists(variant: string, binDir: string = DEFAULT_BIN_DIR): boolean {
  const wrapperPath = path.join(binDir, variant);
  return fs.existsSync(wrapperPath);
}

/**
 * Spawn a cc-mirror variant with a prompt and capture output
 */
export async function spawnWorker(options: SpawnWorkerOptions): Promise<WorkerResult> {
  const { variant, prompt, timeout = 120000, binDir = DEFAULT_BIN_DIR } = options;

  const wrapperPath = path.join(binDir, variant);

  if (!fs.existsSync(wrapperPath)) {
    return {
      success: false,
      output: '',
      error: `Variant "${variant}" not found at ${wrapperPath}`,
    };
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Use --print and -p flags for non-interactive single-turn execution
    const child = spawn(wrapperPath, ['--print', '-p', prompt], {
      env: {
        ...process.env,
        CC_MIRROR_SPLASH: '0', // Disable splash for clean output
      },
      stdio: 'pipe',
    });

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0 && !timedOut,
        output: stdout,
        error: timedOut ? 'Worker timed out' : code !== 0 ? stderr || `Exit code ${code}` : undefined,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        output: stdout,
        error: err.message,
      });
    });
  });
}

/**
 * Parse worker output to extract JSON verdict
 */
export function parseWorkerOutput(output: string): Partial<WorkerVerdict> | null {
  // Try to extract JSON from output - look for object containing "verdict"
  const jsonMatch = output.match(/\{[\s\S]*?"verdict"[\s\S]*?\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      verdict: parsed.verdict,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50,
      summary: parsed.summary ?? '',
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch {
    return null;
  }
}

/**
 * Run a single worker and parse its verdict
 */
export async function runWorker(
  config: WorkerConfig,
  context: string,
  options: { binDir?: string; timeout?: number } = {}
): Promise<WorkerVerdict> {
  const prompt = config.promptTemplate.replace('{context}', context);

  const result = await spawnWorker({
    variant: config.variant,
    prompt,
    ...options,
  });

  const parsed = parseWorkerOutput(result.output);

  return {
    worker: config.name as WorkerPersonality,
    verdict: parsed?.verdict ?? 'neutral',
    confidence: parsed?.confidence ?? 0,
    summary: parsed?.summary ?? result.error ?? 'Worker did not provide a verdict',
    concerns: parsed?.concerns ?? [],
    recommendations: parsed?.recommendations ?? [],
    rawOutput: result.output,
  };
}

/**
 * Run multiple workers in parallel
 */
export async function runWorkers(
  configs: WorkerConfig[],
  context: string,
  options: { binDir?: string; timeout?: number; parallel?: boolean } = {}
): Promise<WorkerVerdict[]> {
  const { parallel = true } = options;

  if (parallel) {
    return Promise.all(configs.map((config) => runWorker(config, context, options)));
  } else {
    const results: WorkerVerdict[] = [];
    for (const config of configs) {
      results.push(await runWorker(config, context, options));
    }
    return results;
  }
}
