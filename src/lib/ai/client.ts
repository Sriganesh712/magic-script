/**
 * Groq AI Client & Gateway (AI-001, AI-005, AI-006, AI-007)
 * Implements explicit user-driven assistance with caching, deduplication, and budgeting.
 */

import type { AiTaskRequest, AiTaskResult, AiUsageBudget } from './types'
import { computeTaskHash, getCachedResult, deduplicateInFlight } from './cache'

const GROQ_STORAGE_KEY = 'screenplay_groq_api_key'
const BUDGET_STORAGE_KEY = 'screenplay_groq_budget'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

// ============================================================================
// Configuration & Budget
// ============================================================================

export function getGroqApiKey(): string | null {
  return (
    localStorage.getItem(GROQ_STORAGE_KEY) ||
    (import.meta.env.VITE_GROQ_API_KEY as string) ||
    null
  )
}

export function setGroqApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(GROQ_STORAGE_KEY, key.trim())
  } else {
    localStorage.removeItem(GROQ_STORAGE_KEY)
  }
}

export function isGroqConfigured(): boolean {
  return Boolean(getGroqApiKey())
}

export function getAiBudget(): AiUsageBudget {
  const today = new Date().toISOString().split('T')[0]
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.lastResetDate === today) {
        return parsed
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return {
    maxDailyTokens: 100000,
    tokensUsedToday: 0,
    estimatedCostUsd: 0,
    lastResetDate: today,
  }
}

export function recordTokenUsage(tokens: number): void {
  const budget = getAiBudget()
  const updated: AiUsageBudget = {
    ...budget,
    tokensUsedToday: budget.tokensUsedToday + tokens,
    // Approximate cost: ~$0.59 / 1M tokens for Llama 3.3 70B
    estimatedCostUsd: Number(
      (budget.estimatedCostUsd + (tokens / 1_000_000) * 0.59).toFixed(4)
    ),
  }
  localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(updated))
}

// ============================================================================
// Core Execution Engine
// ============================================================================

export async function executeAiTask(request: AiTaskRequest): Promise<AiTaskResult> {
  const apiKey = getGroqApiKey()
  if (!apiKey) {
    throw new Error(
      'Groq API Key is not configured. Please enter your API key in Settings > AI Assistance.'
    )
  }

  const model = request.model || DEFAULT_MODEL
  const systemPrompt = buildSystemPrompt(request.task)
  const userPrompt = buildUserPrompt(request)

  const hashKey = computeTaskHash(request.task, userPrompt, request.storyBibleSummary, model)

  // 1. Check cache first
  const cached = getCachedResult(hashKey)
  if (cached) {
    return cached
  }

  // 2. Execute with in-flight deduplication
  return deduplicateInFlight(hashKey, async () => {
    const response = await fetch(GROQ_API_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}))
      const msg = errJson.error?.message || response.statusText
      throw new Error(`Groq API Error (${response.status}): ${msg}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    recordTokenUsage(usage.total_tokens)

    return {
      text: content.trim(),
      model,
      tokensUsed: {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
        total: usage.total_tokens,
      },
      isCached: false,
      timestamp: Date.now(),
    }
  })
}

// ============================================================================
// Specialized Assistant Actions
// ============================================================================

export async function punchUpDialogue(
  dialogueText: string,
  characterName: string,
  sceneContext?: string
): Promise<AiTaskResult> {
  return executeAiTask({
    task: 'dialogue_polish',
    selectedText: dialogueText,
    instruction: `Punch up this dialogue for character "${characterName}". Provide 3 alternative versions: 1) Sharper & Snappier, 2) Richer Subtext, 3) Raw & Gritty.`,
    sceneContext,
  })
}

export async function checkContinuity(
  sceneText: string,
  storyBibleSummary: string
): Promise<AiTaskResult> {
  return executeAiTask({
    task: 'continuity_check',
    sceneContext: sceneText,
    storyBibleSummary,
    instruction:
      'Check this scene for character consistency, props, location logic, and tone based on the provided story bible.',
  })
}

export async function getSceneFeedback(
  sceneText: string,
  storyBibleSummary?: string
): Promise<AiTaskResult> {
  return executeAiTask({
    task: 'scene_feedback',
    sceneContext: sceneText,
    storyBibleSummary,
    instruction:
      'Analyze this scene for dramatic tension, pacing, conflict, and visual storytelling. Provide 3 specific actionable improvements.',
  })
}

export async function generateLoglineSuggestions(
  storyBibleSummary: string
): Promise<AiTaskResult> {
  return executeAiTask({
    task: 'logline_generator',
    storyBibleSummary,
    instruction:
      'Create 3 compelling industry-standard loglines (Protagonist + Inciting Incident + Conflict + Stakes).',
  })
}

// ============================================================================
// Prompt Templates
// ============================================================================

function buildSystemPrompt(task: AiTaskRequest['task']): string {
  const base =
    'You are an expert Hollywood screenplay consultant and script doctor. Give concise, actionable, and professionally formatted advice. Avoid boilerplate pleasantries.'

  switch (task) {
    case 'dialogue_polish':
      return `${base} You specialize in distinctive character voices, dialogue subtext, and cutting empty small talk.`
    case 'continuity_check':
      return `${base} You specialize in script continuity, timeline tracking, and character logic.`
    case 'scene_feedback':
      return `${base} You specialize in scene pacing, dramatic conflict, and visual economy.`
    case 'logline_generator':
      return `${base} You specialize in high-concept loglines and market pitch brevity.`
    default:
      return base
  }
}

function buildUserPrompt(req: AiTaskRequest): string {
  const parts: string[] = []

  if (req.storyBibleSummary) {
    parts.push(`=== STORY BIBLE ===\n${req.storyBibleSummary}\n`)
  }

  if (req.sceneContext) {
    parts.push(`=== SCENE CONTEXT ===\n${req.sceneContext}\n`)
  }

  if (req.selectedText) {
    parts.push(`=== TARGET TEXT ===\n"${req.selectedText}"\n`)
  }

  if (req.instruction) {
    parts.push(`=== INSTRUCTION ===\n${req.instruction}`)
  }

  return parts.join('\n')
}
