/**
 * Analytics Event Recording & Querying for Screenplay Studio (ANA-006)
 * Idempotent event persistence and retrieval.
 */

import type { EntityId, Timestamp, ActivityEvent } from '@/types/screenplay'
import type {
  AnalyticsEvent,
  AnalyticsEventType,
  GoalMetEvent,
  MilestoneReachedEvent,
  SessionEndEvent,
  SessionStartEvent,
  StreakBrokenEvent,
  StreakExtendedEvent,
  WordAddedEvent,
  WordDeletedEvent,
} from '@/types/analytics'
import { ANALYTICS_SCHEMA_VERSION } from '@/types/analytics'
import { db, generateId } from '@/lib/db'
import { getDayBoundaries } from './goals'

/**
 * Generates an idempotent unique EntityId for an event.
 * Uses crypto.randomUUID() when available, falling back to generateId().
 */
export function generateEventId(): EntityId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID() as EntityId
  }
  return generateId()
}

/** Non-writing event types that must be excluded from writing activity */
const NON_WRITING_EVENT_TYPES = new Set([
  'autosave',
  'page_view',
  'background_sync',
  'sync',
  'user_navigation',
  'heartbeat',
  'window_focus',
  'window_blur',
])

/** Writing analytics event types */
const WRITING_EVENT_TYPES = new Set<AnalyticsEventType>([
  'word_added',
  'word_deleted',
  'session_start',
  'session_end',
  'goal_met',
  'streak_extended',
  'streak_broken',
  'milestone_reached',
])

/**
 * Checks whether an event type qualifies as writing activity.
 * Autosaves, page views, and background sync operations do NOT count.
 *
 * @param eventType - Event type string to evaluate
 * @returns True if the event represents writing activity
 */
export function isWritingActivity(eventType: string): boolean {
  if (NON_WRITING_EVENT_TYPES.has(eventType.toLowerCase())) {
    return false
  }
  return WRITING_EVENT_TYPES.has(eventType as AnalyticsEventType)
}

/**
 * Records an analytics event idempotently.
 * - Idempotency is guaranteed by unique event.id.
 * - Non-writing events (autosaves, page views, background sync) are ignored.
 *
 * @param event - The AnalyticsEvent to record
 */
export async function recordEvent(event: AnalyticsEvent): Promise<void> {
  // 1. Filter out non-writing activities
  if (!isWritingActivity(event.type)) {
    return
  }

  // 2. Idempotency check: if an event with the same ID already exists, do nothing
  const existing = await db.activityEvents.get(event.id)
  if (existing) {
    return
  }

  // 3. Store into activityEvents table
  await db.activityEvents.add(event as unknown as ActivityEvent)
}

/**
 * Retrieves analytics events by type for a project, optionally filtered by date range.
 *
 * @param projectId - Project ID
 * @param type - AnalyticsEventType to filter by
 * @param dateRange - Optional start and end date strings (YYYY-MM-DD)
 * @param timezone - Optional timezone for date range boundaries
 * @returns Array of AnalyticsEvent objects sorted by timestamp ascending
 */
export async function getEventsByType(
  projectId: EntityId,
  type: AnalyticsEventType,
  dateRange?: { start: string; end: string },
  timezone: string = 'UTC'
): Promise<AnalyticsEvent[]> {
  let events = (await db.activityEvents
    .where('projectId')
    .equals(projectId)
    .filter(e => e.type === type)
    .toArray()) as unknown as AnalyticsEvent[]

  if (dateRange) {
    const tz = timezone || 'UTC'
    const startBound = getDayBoundaries(dateRange.start, tz).start.getTime()
    const endBound = getDayBoundaries(dateRange.end, tz).end.getTime()

    events = events.filter(e => e.timestamp >= startBound && e.timestamp <= endBound)
  }

  return events.sort((a, b) => a.timestamp - b.timestamp)
}

// ============================================================================
// Event Factory Helpers
// ============================================================================

export function createWordAddedEvent(params: {
  projectId: EntityId
  draftId: EntityId
  count: number
  positions?: number[]
  id?: EntityId
  timestamp?: Timestamp
}): WordAddedEvent {
  return {
    id: params.id || generateEventId(),
    type: 'word_added',
    timestamp: params.timestamp || (Date.now() as Timestamp),
    projectId: params.projectId,
    draftId: params.draftId,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    payload: {
      count: params.count,
      positions: params.positions || [],
    },
  }
}

export function createWordDeletedEvent(params: {
  projectId: EntityId
  draftId: EntityId
  count: number
  positions?: number[]
  id?: EntityId
  timestamp?: Timestamp
}): WordDeletedEvent {
  return {
    id: params.id || generateEventId(),
    type: 'word_deleted',
    timestamp: params.timestamp || (Date.now() as Timestamp),
    projectId: params.projectId,
    draftId: params.draftId,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    payload: {
      count: params.count,
      positions: params.positions || [],
    },
  }
}

export function createSessionStartEvent(params: {
  projectId: EntityId
  draftId: EntityId
  sessionId: EntityId
  countsForStreak?: boolean
  id?: EntityId
  timestamp?: Timestamp
}): SessionStartEvent {
  return {
    id: params.id || generateEventId(),
    type: 'session_start',
    timestamp: params.timestamp || (Date.now() as Timestamp),
    projectId: params.projectId,
    draftId: params.draftId,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    payload: {
      sessionId: params.sessionId,
      countsForStreak: params.countsForStreak ?? false,
    },
  }
}

export function createSessionEndEvent(params: {
  projectId: EntityId
  draftId: EntityId
  sessionId: EntityId
  duration: number
  wordsAdded: number
  wordsDeleted: number
  countsForStreak?: boolean
  id?: EntityId
  timestamp?: Timestamp
}): SessionEndEvent {
  const netWords = params.wordsAdded - params.wordsDeleted
  return {
    id: params.id || generateEventId(),
    type: 'session_end',
    timestamp: params.timestamp || (Date.now() as Timestamp),
    projectId: params.projectId,
    draftId: params.draftId,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    payload: {
      sessionId: params.sessionId,
      duration: params.duration,
      wordsAdded: params.wordsAdded,
      wordsDeleted: params.wordsDeleted,
      netWords,
      countsForStreak: params.countsForStreak ?? (params.wordsAdded > 0),
    },
  }
}

export function createGoalMetEvent(params: {
  projectId: EntityId
  draftId: EntityId
  goalId: EntityId
  goalType: 'daily' | 'weekly' | 'monthly' | 'project'
  target: number
  actual: number
  id?: EntityId
  timestamp?: Timestamp
}): GoalMetEvent {
  return {
    id: params.id || generateEventId(),
    type: 'goal_met',
    timestamp: params.timestamp || (Date.now() as Timestamp),
    projectId: params.projectId,
    draftId: params.draftId,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    payload: {
      goalId: params.goalId,
      goalType: params.goalType,
      target: params.target,
      actual: params.actual,
    },
  }
}

export function createStreakExtendedEvent(params: {
  projectId: EntityId
  draftId: EntityId
  currentStreak: number
  longestStreak: number
  id?: EntityId
  timestamp?: Timestamp
}): StreakExtendedEvent {
  return {
    id: params.id || generateEventId(),
    type: 'streak_extended',
    timestamp: params.timestamp || (Date.now() as Timestamp),
    projectId: params.projectId,
    draftId: params.draftId,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    payload: {
      currentStreak: params.currentStreak,
      longestStreak: params.longestStreak,
    },
  }
}

export function createStreakBrokenEvent(params: {
  projectId: EntityId
  draftId: EntityId
  brokenStreak: number
  longestStreak: number
  id?: EntityId
  timestamp?: Timestamp
}): StreakBrokenEvent {
  return {
    id: params.id || generateEventId(),
    type: 'streak_broken',
    timestamp: params.timestamp || (Date.now() as Timestamp),
    projectId: params.projectId,
    draftId: params.draftId,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    payload: {
      brokenStreak: params.brokenStreak,
      longestStreak: params.longestStreak,
    },
  }
}

export function createMilestoneReachedEvent(params: {
  projectId: EntityId
  draftId: EntityId
  milestoneType: 'words_written' | 'days_writing' | 'projects_completed' | 'streak_days'
  value: number
  label: string
  id?: EntityId
  timestamp?: Timestamp
}): MilestoneReachedEvent {
  return {
    id: params.id || generateEventId(),
    type: 'milestone_reached',
    timestamp: params.timestamp || (Date.now() as Timestamp),
    projectId: params.projectId,
    draftId: params.draftId,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    payload: {
      milestoneType: params.milestoneType,
      value: params.value,
      label: params.label,
    },
  }
}
