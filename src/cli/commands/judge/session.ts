/**
 * Session discovery and parsing for Claude Code conversations
 *
 * Claude Code stores sessions at:
 * ~/.claude/projects/<encoded-path>/<session-id>.jsonl
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { SessionInfo, SessionMessage, ParsedSession } from './types.js';

/**
 * Encode a project path to Claude session directory format
 * /mnt/c/Users/build/Documents/foo -> -mnt-c-Users-build-Documents-foo
 */
export function encodeProjectPath(projectPath: string): string {
  // Replace all slashes with dashes, remove leading dash
  return projectPath.replace(/\//g, '-').replace(/^-/, '-');
}

/**
 * Get the sessions directory for a project
 */
export function getSessionsDir(projectPath: string): string {
  const encoded = encodeProjectPath(projectPath);
  return path.join(os.homedir(), '.claude', 'projects', encoded);
}

/**
 * List all sessions for a project, sorted by most recent
 */
export function listSessions(projectPath: string): SessionInfo[] {
  const sessionsDir = getSessionsDir(projectPath);

  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(sessionsDir);

    return files
      .filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'))
      .map((f) => {
        const sessionPath = path.join(sessionsDir, f);
        const stats = fs.statSync(sessionPath);
        return {
          id: f.replace('.jsonl', ''),
          path: sessionPath,
          modifiedAt: stats.mtime,
        };
      })
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  } catch {
    return [];
  }
}

/**
 * Get the most recent session for a project
 */
export function getMostRecentSession(projectPath: string): SessionInfo | null {
  const sessions = listSessions(projectPath);
  return sessions[0] ?? null;
}

/**
 * Parse a session JSONL file
 */
export function parseSession(sessionPath: string): ParsedSession {
  const content = fs.readFileSync(sessionPath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);

  const messages: SessionMessage[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as SessionMessage;
      // Only include actual conversation messages (not file snapshots or meta)
      if (
        parsed.message &&
        (parsed.type === 'user' || parsed.type === 'assistant') &&
        !parsed.isMeta
      ) {
        messages.push(parsed);
      }
    } catch {
      // Skip malformed lines
    }
  }

  const timestamps = messages
    .map((m) => new Date(m.timestamp))
    .filter((d) => !isNaN(d.getTime()));

  return {
    id: path.basename(sessionPath, '.jsonl'),
    messages,
    cwd: messages.find((m) => m.cwd)?.cwd,
    startTime: timestamps[0] ?? new Date(),
    endTime: timestamps[timestamps.length - 1] ?? new Date(),
  };
}

/**
 * Extract conversation context for worker analysis
 * Filters to recent messages and formats for prompt injection
 */
export function extractContext(
  session: ParsedSession,
  options: { maxMessages?: number; maxChars?: number } = {}
): string {
  const { maxMessages = 30, maxChars = 60000 } = options;

  // Take last N messages
  const recent = session.messages.slice(-maxMessages);

  // Format as conversation
  const formatted = recent
    .map((m) => {
      const role = m.type === 'user' ? 'Human' : 'Assistant';
      const content = m.message?.content ?? '';
      return `${role}: ${content}`;
    })
    .join('\n\n');

  // Truncate if needed
  if (formatted.length > maxChars) {
    return '[...earlier messages truncated]\n\n' + formatted.slice(-maxChars);
  }

  return formatted;
}
