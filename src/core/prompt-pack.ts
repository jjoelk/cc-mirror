import fs from 'node:fs';
import path from 'node:path';
import { resolveOverlays } from './prompt-pack/overlays.js';
import { OVERLAY_MARKERS, PROMPT_PACK_TARGETS } from './prompt-pack/targets.js';
import type { OverlayMap, PromptPackKey } from './prompt-pack/types.js';

export type { PromptPackKey } from './prompt-pack/types.js';

const isPromptPackKey = (value: string): value is PromptPackKey => value === 'zai' || value === 'minimax';

const insertOverlay = (content: string, overlay: string): string => {
  if (!overlay.trim()) return content;
  const block = `${OVERLAY_MARKERS.start}\n${overlay.trim()}\n${OVERLAY_MARKERS.end}`;
  if (content.includes(OVERLAY_MARKERS.start) && content.includes(OVERLAY_MARKERS.end)) {
    const start = content.indexOf(OVERLAY_MARKERS.start);
    const end = content.indexOf(OVERLAY_MARKERS.end, start);
    const before = content.slice(0, start).trimEnd();
    const after = content.slice(end + OVERLAY_MARKERS.end.length).trimStart();
    return `${before}\n\n${block}\n\n${after}`.trimEnd() + '\n';
  }
  return `${content.trimEnd()}\n\n${block}\n`.trimEnd() + '\n';
};

const updatePromptFile = (filePath: string, overlay?: string): boolean => {
  if (!overlay) return false;
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = insertOverlay(content, overlay);
  if (updated === content) return false;
  fs.writeFileSync(filePath, updated);
  return true;
};

const applyOverlays = (systemPromptsDir: string, overlays: OverlayMap): string[] => {
  const updated: string[] = [];
  for (const target of PROMPT_PACK_TARGETS) {
    const filePath = path.join(systemPromptsDir, target.filename);
    const overlay = overlays[target.key];
    if (updatePromptFile(filePath, overlay)) {
      updated.push(target.filename);
    }
  }
  return updated;
};

export const applyPromptPack = (tweakDir: string, providerKey: string): { changed: boolean; updated: string[] } => {
  if (!isPromptPackKey(providerKey)) {
    return { changed: false, updated: [] };
  }

  const overlays = resolveOverlays(providerKey);
  const systemPromptsDir = path.join(tweakDir, 'system-prompts');
  const updated = applyOverlays(systemPromptsDir, overlays);

  return { changed: updated.length > 0, updated };
};
