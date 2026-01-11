/**
 * Variant Builder Module - Barrel Export
 *
 * Provides VariantBuilder and VariantUpdater for creating and updating variants
 * using composable steps.
 */

export { VariantBuilder } from './VariantBuilder.js';
export { VariantUpdater } from './VariantUpdater.js';
export type {
  BuildContext,
  BuildPaths,
  BuildPreferences,
  BuildResult,
  BuildState,
  BuildStep,
  ReportFn,
  StepExecutor,
  UpdateContext,
  UpdatePaths,
  UpdatePreferences,
  UpdateState,
  UpdateStep,
} from './types.js';
