import os from 'node:os';

const sanitizeLabel = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
};

export const getUserLabel = (): string => {
  const candidates = [
    sanitizeLabel(process.env.CLAUDE_CODE_USER_LABEL),
    sanitizeLabel(process.env.USER),
    sanitizeLabel(process.env.USERNAME),
  ];

  for (const candidate of candidates) {
    if (candidate) return candidate;
  }

  try {
    const info = os.userInfo();
    const name = sanitizeLabel(info.username);
    if (name) return name;
  } catch {
    // ignore os.userInfo failures (rare containers)
  }

  return 'user';
};

export const formatUserMessage = (label: string): string => ` [${label}] {} `;
