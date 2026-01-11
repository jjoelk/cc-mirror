export type PromptPackKey = 'zai' | 'minimax';
export type PromptPackMode = 'minimal';

export type OverlayKey =
  | 'main'
  | 'mcpCli'
  | 'bash'
  | 'webfetch'
  | 'websearch'
  | 'mcpsearch'
  | 'taskAgent'
  | 'explore'
  | 'planEnhanced'
  | 'planReminder'
  | 'planReminderSub'
  | 'taskTool'
  | 'enterPlan'
  | 'exitPlan'
  | 'skill'
  | 'conversationSummary'
  | 'conversationSummaryExtended'
  | 'webfetchSummary';

export type OverlayMap = Partial<Record<OverlayKey, string>>;
