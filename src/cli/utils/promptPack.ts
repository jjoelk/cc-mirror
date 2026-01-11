/**
 * Prompt pack utilities
 */

/**
 * Parse prompt pack mode from string value
 * @deprecated promptPackMode is deprecated - only 'minimal' is supported now
 */
export function parsePromptPackMode(value?: string): 'minimal' | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  // Only 'minimal' is supported now, 'maximal' is deprecated
  if (normalized === 'minimal') return normalized;
  return undefined;
}
