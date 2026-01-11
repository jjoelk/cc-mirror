/**
 * useUpdateAll Hook
 * Handles the updateAll screen business logic
 */

import { useEffect, useRef } from 'react';
import type { CoreModule } from '../app.js';
import type { CompletionResult } from './types.js';
import { buildHelpLines } from './useVariantCreate.js';

export interface UseUpdateAllOptions {
  screen: string;
  rootDir: string;
  binDir: string;
  core: CoreModule;
  setProgressLines: (updater: (prev: string[]) => string[]) => void;
  setScreen: (screen: string) => void;
  onComplete: (result: CompletionResult) => void;
}

/**
 * Hook for handling update all variants
 */
export function useUpdateAll(options: UseUpdateAllOptions): void {
  const { screen, rootDir, binDir, core, setProgressLines, setScreen, onComplete } = options;

  // Ref to prevent concurrent execution - persists across renders
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (screen !== 'updateAll') return;
    // Prevent concurrent execution
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    let cancelled = false;

    const runUpdateAll = async () => {
      const entries = core.listVariants(rootDir);
      if (entries.length === 0) {
        onComplete({
          doneLines: ['No variants found.'],
          summary: [],
          nextSteps: [],
          help: [],
        });
        setScreen('updateAll-done');
        return;
      }

      setProgressLines(() => []);

      try {
        for (const entry of entries) {
          if (cancelled) return;
          setProgressLines((prev) => [...prev, `━━ ${entry.name} ━━`]);
          const opts = {
            tweakccStdio: 'pipe' as const,
            binDir,
            onProgress: (step: string) => setProgressLines((prev) => [...prev, `  ${step}`]),
          };

          if (core.updateVariantAsync) {
            await core.updateVariantAsync(rootDir, entry.name, opts);
          } else {
            core.updateVariant(rootDir, entry.name, opts);
          }
        }

        if (cancelled) return;

        const completion: CompletionResult = {
          doneLines: ['All variants updated.'],
          summary: [`Updated ${entries.length} variants.`],
          nextSteps: ['Run any variant by name', 'Use Manage Variants to inspect details'],
          help: buildHelpLines(),
        };

        onComplete(completion);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        onComplete({
          doneLines: [`Failed: ${message}`],
          summary: [],
          nextSteps: [],
          help: [],
        });
      }
      if (!cancelled) {
        isRunningRef.current = false;
        setScreen('updateAll-done');
      }
    };

    runUpdateAll();
    return () => {
      cancelled = true;
      isRunningRef.current = false;
    };
  }, [screen, rootDir, binDir, core, setProgressLines, setScreen, onComplete]);
}
