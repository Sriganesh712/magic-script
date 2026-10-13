/**
 * Streak Calculation for Screenplay Studio (ANA-003)
 * Framework-independent pure logic for writing streak analysis.
 */

import type { DailyStats, StreakInfo } from '@/types/analytics'
import { getDateInTimezone } from './goals'

/**
 * Converts a YYYY-MM-DD string to a calendar day number since epoch.
 */
function dateToDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/**
 * Converts a calendar day number since epoch back to a YYYY-MM-DD string.
 */
function dayNumberToDate(dayNum: number): string {
  return new Date(dayNum * 86400000).toISOString().split('T')[0]
}

/**
 * Calculates current and longest writing streaks, writing status, and risk flags.
 * A 'writing day' requires wordsAdded > 0 (not just opening the app).
 *
 * @param dailyStats - Array of DailyStats records
 * @param timezone - User's IANA timezone (e.g. 'America/New_York', 'UTC')
 * @param referenceDate - Optional reference date to evaluate today against (defaults to now)
 * @returns StreakInfo containing streak metrics
 */
export function calculateStreak(
  dailyStats: DailyStats[],
  timezone: string = 'UTC',
  referenceDate: Date = new Date()
): StreakInfo {
  const tz = timezone || 'UTC'
  const todayStr = getDateInTimezone(referenceDate, tz)
  const todayDayNum = dateToDayNumber(todayStr)
  const yesterdayDayNum = todayDayNum - 1

  // 1. Aggregate wordsAdded by date to handle multiple stats per day
  const wordsByDate = new Map<string, number>()
  for (const stat of dailyStats) {
    const existing = wordsByDate.get(stat.date) || 0
    wordsByDate.set(stat.date, existing + (stat.wordsAdded || 0))
  }

  // 2. Filter only writing days where wordsAdded > 0
  const writingDates: string[] = []
  for (const [date, words] of wordsByDate.entries()) {
    if (words > 0) {
      writingDates.push(date)
    }
  }

  // If no writing days recorded at all
  if (writingDates.length === 0) {
    return {
      current: 0,
      longest: 0,
      lastWritingDate: undefined,
      isWritingToday: false,
      atRisk: false,
    }
  }

  // 3. Convert to unique sorted day numbers
  const uniqueDays = Array.from(new Set(writingDates.map(dateToDayNumber))).sort((a, b) => a - b)
  const lastDayNum = uniqueDays[uniqueDays.length - 1]
  const lastWritingDate = dayNumberToDate(lastDayNum)

  // 4. Calculate longest streak ever
  let longest = 0
  let currentRun = 0

  for (let i = 0; i < uniqueDays.length; i++) {
    if (i === 0 || uniqueDays[i] === uniqueDays[i - 1] + 1) {
      currentRun++
    } else {
      currentRun = 1
    }
    if (currentRun > longest) {
      longest = currentRun
    }
  }

  // 5. Calculate current streak and at-risk status
  const writingDaySet = new Set(uniqueDays)
  const isWritingToday = writingDaySet.has(todayDayNum)
  const wroteYesterday = writingDaySet.has(yesterdayDayNum)

  let current = 0
  let atRisk = false

  if (isWritingToday) {
    // Current streak includes today and consecutive days backwards
    current = 1
    let checkDay = todayDayNum - 1
    while (writingDaySet.has(checkDay)) {
      current++
      checkDay--
    }
    atRisk = false
  } else if (wroteYesterday) {
    // Streak is active from yesterday, but user hasn't written today yet
    current = 1
    let checkDay = yesterdayDayNum - 1
    while (writingDaySet.has(checkDay)) {
      current++
      checkDay--
    }
    atRisk = true
  } else {
    // Neither today nor yesterday was a writing day -> streak broken
    current = 0
    atRisk = false
  }

  return {
    current,
    longest,
    lastWritingDate,
    isWritingToday,
    atRisk,
  }
}
