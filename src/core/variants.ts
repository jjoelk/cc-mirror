import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './fs.js';
import type { VariantEntry, VariantMeta } from './types.js';

export const loadVariantMeta = (variantDir: string): VariantMeta | null => {
  const metaPath = path.join(variantDir, 'variant.json');
  if (!fs.existsSync(metaPath)) return null;
  return readJson<VariantMeta>(metaPath);
};

export const listVariants = (rootDir: string): VariantEntry[] => {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(rootDir, name, 'variant.json')))
    .map((name) => ({ name, meta: loadVariantMeta(path.join(rootDir, name)) }));
};
