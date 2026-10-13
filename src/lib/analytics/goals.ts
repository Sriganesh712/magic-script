/**
 * Writing Goals Tracking for Screenplay Studio (ANA-002)
 * Framework-independent goal management and progress computation.
 */

import type { EntityId, Timestamp } from '@/types/screenplay'
import type { GoalProgress, GoalType, WritingGoal, DailyStats } from '@/types/analytics'
import { db, generateId } from '@/lib/db'

/** Parameters for creating a writing goal */
export interface CreateGoalParams {
  id?: EntityId
  projectId: EntityId
  type: GoalType
  targetWords: number
  targetSessions?: number
  targetTime?: number
  startDate?: string
  endDate?: string
  timezone?: string
}

/**
 * Returns the default timezone of the environment.
 */
export function getDefaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Converts a Date object to a YYYY-MM-DD string in the specified timezone.
 *
 * @param date - The Date object (defaults to current date)
 * @param timezone - IANA timezone string (e.g. 'America/New_York', 'UTC')
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateInTimezone(date: Date = new Date(), timezone: string = 'UTC'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(date)
  } catch {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(date)
  }
}

/**
 * Helper to compute the exact UTC Date for a given midnight in a timezone.
 */
function getZonedMidnight(year: number, month: number, day: number, timezone: string): Date {
  const candidate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(candidate)
  } catch {
    return candidate
  }

  let cYear = year, cMonth = month, cDay = day, cHour = 0, cMin = 0, cSec = 0
  for (const p of parts) {
    if (p.type === 'year') cYear = parseInt(p.value, 10)
    else if (p.type === 'month') cMonth = parseInt(p.value, 10)
    else if (p.type === 'day') cDay = parseInt(p.value, 10)
    else if (p.type === 'hour') cHour = parseInt(p.value, 10) === 24 ? 0 : parseInt(p.value, 10)
    else if (p.type === 'minute') cMin = parseInt(p.value, 10)
    else if (p.type === 'second') cSec = parseInt(p.value, 10)
  }

  const candidateLocalAsUtc = Date.UTC(cYear, cMonth - 1, cDay, cHour, cMin, cSec)
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0)
  const diff = candidateLocalAsUtc - targetLocalAsUtc

  return new Date(candidate.getTime() - diff)
}

/**
 * Returns UTC Date objects for start (00:00:00.000) and end (23:59:59.999) of a day in a timezone.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timezone - IANA timezone string
 * @returns Object with start and end Date instances
 */
export function getDayBoundaries(dateStr: string, timezone: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const start = getZonedMidnight(year, month, day, timezone)

  // Next day midnight
  const nextDayUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0))
  const nextYear = nextDayUtc.getUTCFullYear()
  const nextMonth = nextDayUtc.getUTCMonth() + 1
  const nextDay = nextDayUtc.getUTCDate()
  const nextMidnight = getZonedMidnight(nextYear, nextMonth, nextDay, timezone)

  const end = new Date(nextMidnight.getTime() - 1)
  return { start, end }
}

/**
 * Creates a new writing goal.
 *
 * @param params - Goal configuration parameters
 * @returns Newly initialized WritingGoal
 */
export function createGoal(params: CreateGoalParams): WritingGoal {
  const nowTs = Date.now() as Timestamp
  const tz = params.timezone || 'UTC'
  const startDate = params.startDate || getDateInTimezone(new Date(nowTs), tz)
  const id = params.id || ((typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateId()) as EntityId)

  return {
    id,
    projectId: params.projectId,
    type: params.type,
    targetWords: params.targetWords,
    targetSessions: params.targetSessions,
    targetTime: params.targetTime,
    startDate,
    endDate: params.endDate,
    isActive: true,
    createdAt: nowTs,
    updatedAt: nowTs,
  }
}

/**
 * Evaluates progress toward a goal based on daily statistics.
 *
 * @param goal - The WritingGoal to evaluate
 * @param dailyStats - Array of DailyStats records
 * @param referenceDate - Optional reference date to evaluate against (defaults to today)
 * @param timezone - Optional timezone for date calculations
 * @returns GoalProgress summary
 */
export function checkGoalProgress(
  goal: WritingGoal,
  dailyStats: DailyStats[],
  referenceDate?: Date,
  timezone: string = 'UTC'
): GoalProgress {
  const tz = timezone || 'UTC'
  const todayStr = getDateInTimezone(referenceDate || new Date(), tz)

  let relevantStats: DailyStats[] = []

  if (goal.type === 'daily') {
    // For daily goals, select the relevant day
    let targetDate = todayStr
    if (referenceDate) {
      targetDate = getDateInTimezone(referenceDate, tz)
    } else {
      // If no referenceDate was explicitly passed, match available stats intelligently
      const hasToday = dailyStats.some(s => s.date === todayStr)
      if (!hasToday) {
        if (dailyStats.some(s => s.date === goal.startDate)) {
          targetDate = goal.startDate
        } else if (dailyStats.length > 0) {
          // Use latest date in dailyStats
          const sorted = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date))
          targetDate = sorted[sorted.length - 1].date
        }
      }
    }
    relevantStats = dailyStats.filter(s => s.date === targetDate)
  } else {
    // Weekly, monthly, project goals: filter by date range
    relevantStats = dailyStats.filter(s => {
      if (goal.startDate && s.date < goal.startDate) return false
      if (goal.endDate && s.date > goal.endDate) return false
      return true
    })
  }

  // Aggregate progress metrics
  let currentWords = 0
  let currentSessions = 0
  let currentTime = 0

  for (const stat of relevantStats) {
    currentWords += stat.wordsAdded || 0
    currentSessions += stat.sessionCount || 0
    currentTime += stat.totalSessionTime || 0
  }

  // Calculate percent complete
  const percentComplete = goal.targetWords > 0
    ? Math.min(100, Math.round((currentWords / goal.targetWords) * 100))
    : 100

  // Calculate if goal is met
  const wordsMet = currentWords >= goal.targetWords
  const sessionsMet = goal.targetSessions ? currentSessions >= goal.targetSessions : true
  const timeMet = goal.targetTime ? currentTime >= goal.targetTime : true
  const isMet = wordsMet && sessionsMet && timeMet

  // Calculate days remaining
  let daysRemaining: number | undefined
  if (goal.endDate) {
    const [ey, em, ed] = goal.endDate.split('-').map(Number)
    const [cy, cm, cd] = todayStr.split('-').map(Number)
    const endUtc = Date.UTC(ey, em - 1, ed)
    const curUtc = Date.UTC(cy, cm - 1, cd)
    const diffDays = Math.ceil((endUtc - curUtc) / 86400000)
    daysRemaining = Math.max(0, diffDays)
  }

  return {
    goalId: goal.id,
    currentWords,
    currentSessions,
    currentTime,
    percentComplete,
    isMet,
    daysRemaining,
  }
}

/**
 * Retrieves all active goals for a given project from the database.
 *
 * @param projectId - Project ID
 * @returns Array of active WritingGoal objects
 */
export async function getActiveGoals(projectId: EntityId): Promise<WritingGoal[]> {
  return (await db.writingGoals
    .where('projectId')
    .equals(projectId)
    .filter(g => g.isActive)
    .toArray()) as unknown as WritingGoal[]
}

/**
 * Persists a writing goal to the database.
 */
export async function saveGoal(goal: WritingGoal): Promise<void> {
  await db.writingGoals.put(goal as any)
}

/**
 * Deactivates or deletes a writing goal.
 */
export async function deleteGoal(goalId: EntityId): Promise<void> {
  await db.writingGoals.delete(goalId)
}

/**
 * Gets a goal by ID from the database.
 */
export async function getGoal(goalId: EntityId): Promise<WritingGoal | undefined> {
  return (await db.writingGoals.get(goalId)) as unknown as WritingGoal | undefined
}
