import type { OverlayMap, PromptPackKey } from './types.js';
import { sanitizeOverlayMap } from './sanitize.js';
import { buildZaiOverlays } from './providers/zai.js';
import { buildMinimaxOverlays } from './providers/minimax.js';

const buildProviderOverlays = (provider: PromptPackKey): OverlayMap => {
  if (provider === 'zai') return buildZaiOverlays();
  return buildMinimaxOverlays();
};

export const resolveOverlays = (provider: PromptPackKey): OverlayMap => {
  const base = buildProviderOverlays(provider);
  return sanitizeOverlayMap(base);
};
