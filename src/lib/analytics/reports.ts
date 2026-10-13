/**
 * Analytics Report Generation for Screenplay Studio (ANA-005)
 * Pure local computation of comprehensive writing statistics, trends, and milestone achievements.
 */

import type { EntityId, Timestamp } from '@/types/screenplay'
import type {
  DailyStats,
  GoalProgress,
  MilestoneReachedEvent,
  ProjectReport,
  WritingGoal,
  WritingSession,
} from '@/types/analytics'
import { MILESTONES } from '@/types/analytics'
import { db } from '@/lib/db'
import { getDateInTimezone } from './goals'
import { checkGoalProgress } from './goals'
import { calculateStreak } from './streaks'

/** Parameters for pure report metrics computation */
export interface CalculateReportParams {
  projectId: EntityId
  dateRange?: { start: string; end: string }
  dailyStats: DailyStats[]
  sessions?: WritingSession[]
  goals?: WritingGoal[]
  timezone?: string
  generatedAt?: Timestamp
  referenceDate?: Date
}

/** Converts date string to epoch day number */
function dateToDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** Gets day of week (0=Sunday ... 6=Saturday) in specified timezone */
function getDayOfWeek(timestampOrDate: number | Date, timezone: string): number {
  const date = typeof timestampOrDate === 'number' ? new Date(timestampOrDate) : timestampOrDate
  try {
    const dayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(date)
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return map[dayStr] ?? date.getUTCDay()
  } catch {
    return date.getUTCDay()
  }
}

/** Gets hour of day (0-23) in specified timezone */
function getHour(timestampOrDate: number | Date, timezone: string): number {
  const date = typeof timestampOrDate === 'number' ? new Date(timestampOrDate) : timestampOrDate
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date)
    const hourPart = parts.find(p => p.type === 'hour')
    if (hourPart) {
      const h = parseInt(hourPart.value, 10)
      return h === 24 ? 0 : h
    }
    return date.getUTCHours()
  } catch {
    return date.getUTCHours()
  }
}

/**
 * Pure function to calculate all metrics for a project analytics report.
 * Framework-independent and requires no database access.
 *
 * @param params - Input data for report computation
 * @returns Complete ProjectReport object
 */
export function calculateReportMetrics(params: CalculateReportParams): ProjectReport {
  const {
    projectId,
    dailyStats = [],
    sessions = [],
    goals = [],
    timezone = 'UTC',
    generatedAt = Date.now() as Timestamp,
    referenceDate = new Date(),
  } = params

  const tz = timezone || 'UTC'
  const todayStr = getDateInTimezone(referenceDate, tz)

  // 1. Determine Date Range
  let rangeStart = params.dateRange?.start
  let rangeEnd = params.dateRange?.end

  if (!rangeStart || !rangeEnd) {
    const allDates: string[] = []
    for (const s of dailyStats) allDates.push(s.date)
    for (const s of sessions) allDates.push(getDateInTimezone(new Date(s.startTime), tz))
    if (allDates.length > 0) {
      allDates.sort()
      rangeStart = rangeStart || allDates[0]
      rangeEnd = rangeEnd || allDates[allDates.length - 1]
    } else {
      rangeStart = rangeStart || todayStr
      rangeEnd = rangeEnd || todayStr
    }
  }

  const finalDateRange = { start: rangeStart, end: rangeEnd }

  // 2. Filter stats and sessions to date range
  const filteredStats = dailyStats.filter(
    s => s.date >= finalDateRange.start && s.date <= finalDateRange.end
  )

  const filteredSessions = sessions.filter(s => {
    const sDate = getDateInTimezone(new Date(s.startTime), tz)
    return sDate >= finalDateRange.start && sDate <= finalDateRange.end
  })

  // 3. Aggregate word counts and session metrics
  let totalWordsWritten = 0
  let totalWordsDeleted = 0
  let totalSessions = 0
  let totalWritingTime = 0

  if (filteredStats.length > 0) {
    for (const stat of filteredStats) {
      totalWordsWritten += stat.wordsAdded || 0
      totalWordsDeleted += stat.wordsDeleted || 0
      totalSessions += stat.sessionCount || 0
      totalWritingTime += stat.totalSessionTime || 0
    }
  } else if (filteredSessions.length > 0) {
    for (const s of filteredSessions) {
      totalWordsWritten += s.wordsAdded || 0
      totalWordsDeleted += s.wordsDeleted || 0
      totalSessions++
      if (s.endTime && s.startTime) {
        totalWritingTime += Math.max(0, s.endTime - s.startTime)
      }
    }
  }

  // Adjust totalSessions if sessions list has more records
  if (filteredSessions.length > totalSessions) {
    totalSessions = filteredSessions.length
  }

  const netWords = totalWordsWritten - totalWordsDeleted

  // 4. Calculate writing days
  const writingDaysSet = new Set<string>()
  for (const stat of filteredStats) {
    if ((stat.wordsAdded || 0) > 0) {
      writingDaysSet.add(stat.date)
    }
  }
  for (const s of filteredSessions) {
    if ((s.wordsAdded || 0) > 0) {
      writingDaysSet.add(getDateInTimezone(new Date(s.startTime), tz))
    }
  }
  const writingDaysCount = writingDaysSet.size

  // 5. Averages
  const avgWordsPerSession = totalSessions > 0 ? Math.round(totalWordsWritten / totalSessions) : 0
  const avgWordsPerWritingDay = writingDaysCount > 0 ? Math.round(totalWordsWritten / writingDaysCount) : 0
  const avgSessionDuration = totalSessions > 0 ? Math.round(totalWritingTime / totalSessions) : 0

  // 6. Consistency Percentage
  const calendarDays = Math.max(
    1,
    dateToDayNumber(finalDateRange.end) - dateToDayNumber(finalDateRange.start) + 1
  )
  const consistencyPercent = Math.min(100, Math.round((writingDaysCount / calendarDays) * 100))

  // 7. Streak calculation
  const streakInfo = calculateStreak(dailyStats, tz, referenceDate)

  // 8. Productivity by Day of Week & Hour
  const dayWords = [0, 0, 0, 0, 0, 0, 0]
  const hourWords = new Array(24).fill(0)

  if (filteredSessions.length > 0) {
    for (const s of filteredSessions) {
      const dow = getDayOfWeek(s.startTime, tz)
      const hr = getHour(s.startTime, tz)
      dayWords[dow] += s.wordsAdded || 0
      hourWords[hr] += s.wordsAdded || 0
    }
  } else {
    for (const stat of filteredStats) {
      const [y, m, d] = stat.date.split('-').map(Number)
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
      const dow = getDayOfWeek(date, tz)
      dayWords[dow] += stat.wordsAdded || 0
    }
  }

  let mostProductiveDay = 0
  let maxDayWords = -1
  for (let i = 0; i < 7; i++) {
    if (dayWords[i] > maxDayWords) {
      maxDayWords = dayWords[i]
      mostProductiveDay = i
    }
  }

  let mostProductiveHour = 0
  let maxHourWords = -1
  for (let h = 0; h < 24; h++) {
    if (hourWords[h] > maxHourWords) {
      maxHourWords = hourWords[h]
      mostProductiveHour = h
    }
  }

  // 9. Goals progress
  const goalsProgress: GoalProgress[] = goals.map(goal =>
    checkGoalProgress(goal, dailyStats, referenceDate, tz)
  )

  // 10. Milestones achieved
  const milestones: MilestoneReachedEvent[] = []

  // Total words milestones
  for (const m of MILESTONES.words_written) {
    if (totalWordsWritten >= m.value) {
      milestones.push({
        id: `milestone_words_${m.value}` as EntityId,
        type: 'milestone_reached',
        timestamp: generatedAt,
        projectId,
        draftId: '' as EntityId,
        schemaVersion: 1,
        payload: {
          milestoneType: 'words_written',
          value: m.value,
          label: m.label,
        },
      })
    }
  }

  // Writing days milestones
  for (const m of MILESTONES.days_writing) {
    if (writingDaysCount >= m.value) {
      milestones.push({
        id: `milestone_days_${m.value}` as EntityId,
        type: 'milestone_reached',
        timestamp: generatedAt,
        projectId,
        draftId: '' as EntityId,
        schemaVersion: 1,
        payload: {
          milestoneType: 'days_writing',
          value: m.value,
          label: m.label,
        },
      })
    }
  }

  // Streak days milestones
  for (const m of MILESTONES.streak_days) {
    if (streakInfo.longest >= m.value) {
      milestones.push({
        id: `milestone_streak_${m.value}` as EntityId,
        type: 'milestone_reached',
        timestamp: generatedAt,
        projectId,
        draftId: '' as EntityId,
        schemaVersion: 1,
        payload: {
          milestoneType: 'streak_days',
          value: m.value,
          label: m.label,
        },
      })
    }
  }

  return {
    projectId,
    generatedAt,
    dateRange: finalDateRange,
    totalWordsWritten,
    totalWordsDeleted,
    netWords,
    totalSessions,
    totalWritingTime,
    avgWordsPerSession,
    avgWordsPerWritingDay,
    consistencyPercent,
    currentStreak: streakInfo.current,
    longestStreak: streakInfo.longest,
    goalsProgress,
    milestones,
    avgSessionDuration,
    mostProductiveDay,
    mostProductiveHour,
  }
}

/**
 * Generates an analytics project report by reading all relevant project data
 * from the Dexie database and computing metrics locally.
 *
 * @param projectId - Project ID
 * @param dateRange - Optional start and end date range (YYYY-MM-DD)
 * @param timezone - Optional user timezone (defaults to system timezone)
 * @returns Complete ProjectReport
 */
export async function generateProjectReport(
  projectId: EntityId,
  dateRange?: { start: string; end: string },
  timezone: string = 'UTC'
): Promise<ProjectReport> {
  const [dailyStats, sessions, goals] = await Promise.all([
    db.dailyStats.where('projectId').equals(projectId).toArray(),
    db.writingSessions.where('projectId').equals(projectId).toArray(),
    db.writingGoals.where('projectId').equals(projectId).filter(g => g.isActive).toArray(),
  ])

  return calculateReportMetrics({
    projectId,
    dateRange,
    dailyStats: dailyStats as unknown as DailyStats[],
    sessions: sessions as unknown as WritingSession[],
    goals: goals as unknown as WritingGoal[],
    timezone,
  })
}
