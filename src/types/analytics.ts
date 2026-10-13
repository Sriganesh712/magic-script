/**
 * Analytics Types for Screenplay Studio
 * Framework-independent analytics logic for writing progress tracking
 */

import type { EntityId, Timestamp } from './screenplay'

// ============================================================================
// Analytics Event Types
// ============================================================================

/** Types of analytics events */
export type AnalyticsEventType =
  | 'word_added'
  | 'word_deleted'
  | 'session_start'
  | 'session_end'
  | 'goal_met'
  | 'streak_extended'
  | 'streak_broken'
  | 'milestone_reached'

/** Base analytics event */
export interface BaseAnalyticsEvent {
  /** Unique idempotent ID for this event */
  id: EntityId
  /** Event type discriminator */
  type: AnalyticsEventType
  /** When this event occurred */
  timestamp: Timestamp
  /** Project this event belongs to */
  projectId: EntityId
  /** Draft this event belongs to */
  draftId: EntityId
  /** Schema version for migrations */
  schemaVersion: number
}

/** Word added event */
export interface WordAddedEvent extends BaseAnalyticsEvent {
  type: 'word_added'
  payload: {
    /** Number of words added */
    count: number
    /** Word positions in document (for diff tracking) */
    positions: number[]
  }
}

/** Word deleted event */
export interface WordDeletedEvent extends BaseAnalyticsEvent {
  type: 'word_deleted'
  payload: {
    /** Number of words deleted */
    count: number
    /** Word positions that were removed */
    positions: number[]
  }
}

/** Session start event */
export interface SessionStartEvent extends BaseAnalyticsEvent {
  type: 'session_start'
  payload: {
    /** Session ID */
    sessionId: EntityId
    /** Whether this session counts toward streaks */
    countsForStreak: boolean
  }
}

/** Session end event */
export interface SessionEndEvent extends BaseAnalyticsEvent {
  type: 'session_end'
  payload: {
    /** Session ID */
    sessionId: EntityId
    /** Session duration in milliseconds */
    duration: number
    /** Words added during session */
    wordsAdded: number
    /** Words deleted during session */
    wordsDeleted: number
    /** Net word change */
    netWords: number
    /** Whether this session counted toward streaks */
    countsForStreak: boolean
  }
}

/** Goal met event */
export interface GoalMetEvent extends BaseAnalyticsEvent {
  type: 'goal_met'
  payload: {
    /** Goal ID that was met */
    goalId: EntityId
    /** Goal type */
    goalType: 'daily' | 'weekly' | 'monthly' | 'project'
    /** Target value */
    target: number
    /** Actual value achieved */
    actual: number
  }
}

/** Streak extended event */
export interface StreakExtendedEvent extends BaseAnalyticsEvent {
  type: 'streak_extended'
  payload: {
    /** New current streak */
    currentStreak: number
    /** Longest streak */
    longestStreak: number
  }
}

/** Streak broken event */
export interface StreakBrokenEvent extends BaseAnalyticsEvent {
  type: 'streak_broken'
  payload: {
    /** Streak that was broken */
    brokenStreak: number
    /** Longest streak at break time */
    longestStreak: number
  }
}

/** Milestone reached event */
export interface MilestoneReachedEvent extends BaseAnalyticsEvent {
  type: 'milestone_reached'
  payload: {
    /** Milestone type */
    milestoneType: 'words_written' | 'days_writing' | 'projects_completed' | 'streak_days'
    /** Milestone value reached */
    value: number
    /** Milestone label */
    label: string
  }
}

/** Union of all analytics events */
export type AnalyticsEvent =
  | WordAddedEvent
  | WordDeletedEvent
  | SessionStartEvent
  | SessionEndEvent
  | GoalMetEvent
  | StreakExtendedEvent
  | StreakBrokenEvent
  | MilestoneReachedEvent

// ============================================================================
// Writing Goals
// ============================================================================

/** Writing goal types */
export type GoalType = 'daily' | 'weekly' | 'monthly' | 'project'

/** Writing goal */
export interface WritingGoal {
  id: EntityId
  projectId: EntityId
  type: GoalType
  /** Target word count */
  targetWords: number
  /** Target number of sessions (optional) */
  targetSessions?: number
  /** Target writing time in ms (optional) */
  targetTime?: number
  /** Goal start date (YYYY-MM-DD in user's timezone) */
  startDate: string
  /** Goal end date (YYYY-MM-DD, optional for ongoing goals) */
  endDate?: string
  /** Whether this goal is active */
  isActive: boolean
  /** Goal creation timestamp */
  createdAt: Timestamp
  /** Goal last update timestamp */
  updatedAt: Timestamp
}

/** Goal progress */
export interface GoalProgress {
  goalId: EntityId
  currentWords: number
  currentSessions: number
  currentTime: number
  percentComplete: number
  isMet: boolean
  daysRemaining?: number
}

// ============================================================================
// Daily Stats
// ============================================================================

/** Daily writing statistics */
export interface DailyStats {
  /** Date in YYYY-MM-DD format (user's timezone) */
  date: string
  /** Project ID */
  projectId: EntityId
  /** Words added this day */
  wordsAdded: number
  /** Words deleted this day */
  wordsDeleted: number
  /** Net word change */
  netWords: number
  /** Number of writing sessions */
  sessionCount: number
  /** Total session time in ms */
  totalSessionTime: number
  /** Goal IDs met on this day */
  goalsMet: EntityId[]
  /** Whether this day counts as a writing day for streaks */
  isWritingDay: boolean
}

// ============================================================================
// Writing Sessions
// ============================================================================

/** Writing session */
export interface WritingSession {
  id: EntityId
  projectId: EntityId
  draftId: EntityId
  /** Session start timestamp */
  startTime: Timestamp
  /** Session end timestamp */
  endTime?: Timestamp
  /** Words added during session */
  wordsAdded: number
  /** Words deleted during session */
  wordsDeleted: number
  /** Net word change */
  netWords: number
  /** Whether this session counts toward streaks */
  countsForStreak: boolean
  /** Session state */
  state: 'active' | 'completed' | 'abandoned'
}

// ============================================================================
// Streaks
// ============================================================================

/** Streak information */
export interface StreakInfo {
  /** Current streak (consecutive writing days) */
  current: number
  /** Longest streak ever */
  longest: number
  /** Last writing date (YYYY-MM-DD) */
  lastWritingDate?: string
  /** Whether today is a writing day */
  isWritingToday: boolean
  /** Whether streak is at risk (yesterday was not a writing day) */
  atRisk: boolean
}

// ============================================================================
// Project Reports
// ============================================================================

/** Project analytics report */
export interface ProjectReport {
  projectId: EntityId
  /** Report generation timestamp */
  generatedAt: Timestamp
  /** Date range covered */
  dateRange: {
    start: string // YYYY-MM-DD
    end: string   // YYYY-MM-DD
  }
  /** Total words written */
  totalWordsWritten: number
  /** Total words deleted */
  totalWordsDeleted: number
  /** Net word change */
  netWords: number
  /** Total writing sessions */
  totalSessions: number
  /** Total writing time in ms */
  totalWritingTime: number
  /** Average words per session */
  avgWordsPerSession: number
  /** Average words per day (writing days only) */
  avgWordsPerWritingDay: number
  /** Writing consistency percentage */
  consistencyPercent: number
  /** Current streak */
  currentStreak: number
  /** Longest streak */
  longestStreak: number
  /** Goals progress */
  goalsProgress: GoalProgress[]
  /** Milestones reached */
  milestones: MilestoneReachedEvent[]
  /** Average session duration in ms */
  avgSessionDuration: number
  /** Most productive day of week (0=Sunday) */
  mostProductiveDay: number
  /** Most productive hour (0-23) */
  mostProductiveHour: number
}

/** Milestone definitions */
export const MILESTONES = {
  words_written: [
    { value: 1000, label: 'First 1,000 words' },
    { value: 5000, label: '5,000 words written' },
    { value: 10000, label: '10,000 words written' },
    { value: 25000, label: '25,000 words written' },
    { value: 50000, label: '50,000 words (NaNoWriMo!)' },
    { value: 100000, label: '100,000 words written' },
  ],
  days_writing: [
    { value: 7, label: '1 week of writing' },
    { value: 30, label: '30 days of writing' },
    { value: 100, label: '100 days of writing' },
    { value: 365, label: '1 year of writing' },
  ],
  streak_days: [
    { value: 3, label: '3-day streak' },
    { value: 7, label: '1-week streak' },
    { value: 14, label: '2-week streak' },
    { value: 30, label: '30-day streak' },
    { value: 100, label: '100-day streak' },
  ],
} as const

// ============================================================================
// Schema Version
// ============================================================================

export const ANALYTICS_SCHEMA_VERSION = 1

export const ANALYTICS_MIGRATIONS = [] as const