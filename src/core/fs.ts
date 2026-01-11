import fs from 'node:fs';

export const ensureDir = (dir: string) => {
  fs.mkdirSync(dir, { recursive: true });
};

export const writeJson = <T>(filePath: string, data: T) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

export const readJson = <T>(filePath: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
};
