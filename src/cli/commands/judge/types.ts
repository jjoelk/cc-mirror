/**
 * Type definitions for the judge command
 */

export type WorkerPersonality = 'skeptic' | 'auditor' | 'advocate' | 'security';
export type Verdict = 'approve' | 'reject' | 'concern' | 'neutral';

export interface SessionMessage {
  type: 'user' | 'assistant' | 'file-history-snapshot' | string;
  message?: {
    role: string;
    content: string;
  };
  sessionId: string;
  uuid: string;
  timestamp: string;
  cwd?: string;
  isMeta?: boolean;
}

export interface SessionInfo {
  id: string;
  path: string;
  modifiedAt: Date;
}

export interface ParsedSession {
  id: string;
  messages: SessionMessage[];
  cwd?: string;
  startTime: Date;
  endTime: Date;
}

export interface WorkerConfig {
  name: WorkerPersonality;
  variant: string;
  promptTemplate: string;
  description: string;
}

export interface WorkerVerdict {
  worker: WorkerPersonality;
  verdict: Verdict;
  confidence: number;
  summary: string;
  concerns: string[];
  recommendations: string[];
  rawOutput: string;
}

export interface ConsensusResult {
  finalVerdict: 'approve' | 'reject' | 'concern' | 'mixed';
  confidence: number;
  agreement: number;
  summary: string;
  allConcerns: string[];
  allRecommendations: string[];
  dissenting: WorkerVerdict[];
}

export interface SpawnWorkerOptions {
  variant: string;
  prompt: string;
  timeout?: number;
  binDir?: string;
}

export interface WorkerResult {
  success: boolean;
  output: string;
  error?: string;
}
