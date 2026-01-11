import type { OverlayMap } from './types.js';

const BACKTICK_REGEX = /`/g;

// tweakcc skips prompt replacements when template literals contain unescaped backticks.
// We strip them to ensure overlays are applied reliably across all prompt fragments.
export const sanitizeOverlayText = (text: string): string => text.replace(BACKTICK_REGEX, "'");

export const sanitizeOverlayMap = (overlays: OverlayMap): OverlayMap => {
  const sanitized: OverlayMap = {};
  for (const [key, value] of Object.entries(overlays)) {
    if (!value || !value.trim()) continue;
    sanitized[key as keyof OverlayMap] = sanitizeOverlayText(value);
  }
  return sanitized;
};
