/**
 * AI Gateway Types (AI-001, AI-006)
 * Explicit, user-consenting AI assistance only.
 */

export type AiTaskType =
  | 'dialogue_polish'
  | 'scene_feedback'
  | 'continuity_check'
  | 'logline_generator'

export interface AiTaskRequest {
  task: AiTaskType
  instruction?: string
  selectedText?: string
  sceneContext?: string
  storyBibleSummary?: string
  model?: string
}

export interface AiTaskResult {
  text: string
  model: string
  tokensUsed: {
    prompt: number
    completion: number
    total: number
  }
  isCached: boolean
  timestamp: number
}

export interface AiUsageBudget {
  maxDailyTokens: number
  tokensUsedToday: number
  estimatedCostUsd: number
  lastResetDate: string
}
