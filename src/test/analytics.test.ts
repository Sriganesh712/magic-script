/**
 * Comprehensive Unit Tests for Writing Analytics Engine (ANA-001 through ANA-008)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { EntityId, Timestamp } from '@/types/screenplay'
import type { DailyStats, WritingSession } from '@/types/analytics'

// Mock database layer for isolated, robust testing
vi.mock('@/lib/db', () => {
  const store = {
    activityEvents: new Map<string, any>(),
    writingGoals: new Map<string, any>(),
    writingSessions: new Map<string, any>(),
    dailyStats: new Map<string, any>(),
  }

  function makeMockTable(map: Map<string, any>) {
    return {
      get: vi.fn(async (id: string) => map.get(id)),
      add: vi.fn(async (item: any) => {
        map.set(item.id, { ...item })
        return item.id
      }),
      put: vi.fn(async (item: any) => {
        map.set(item.id, { ...item })
        return item.id
      }),
      delete: vi.fn(async (id: string) => {
        map.delete(id)
      }),
      clear: vi.fn(async () => {
        map.clear()
      }),
      toArray: vi.fn(async () => Array.from(map.values())),
      where: vi.fn((field: string) => ({
        equals: vi.fn((val: any) => ({
          filter: (pred: (x: any) => boolean) => ({
            toArray: async () => Array.from(map.values()).filter(x => x[field] === val).filter(pred),
          }),
          toArray: async () => Array.from(map.values()).filter(x => x[field] === val),
        })),
      })),
    }
  }

  return {
    db: {
      activityEvents: makeMockTable(store.activityEvents),
      writingGoals: makeMockTable(store.writingGoals),
      writingSessions: makeMockTable(store.writingSessions),
      dailyStats: makeMockTable(store.dailyStats),
    },
    generateId: () => `id_${Math.random().toString(36).substring(2, 9)}` as EntityId,
    __store: store,
  }
})

import {
  diffWords,
  extractWords,
  countWords,
  computeLCSLength,
} from '@/lib/analytics/word-diff'
import {
  createGoal,
  checkGoalProgress,
  getDateInTimezone,
  getDayBoundaries,
  getActiveGoals,
  saveGoal,
} from '@/lib/analytics/goals'
import {
  calculateStreak,
} from '@/lib/analytics/streaks'
import {
  startSession,
  endSession,
  abandonSession,
  updateSession,
  detectSessionTimeout,
  shouldStartNewSession,
  saveSession,
  getSession,
} from '@/lib/analytics/sessions'
import {
  calculateReportMetrics,
  generateProjectReport,
} from '@/lib/analytics/reports'
import {
  recordEvent,
  getEventsByType,
  isWritingActivity,
  createWordAddedEvent,
  createWordDeletedEvent,
  createSessionStartEvent,
  createSessionEndEvent,
  createGoalMetEvent,
  createMilestoneReachedEvent,
} from '@/lib/analytics/events'

describe('Writing Analytics Engine', () => {
  beforeEach(async () => {
    const { db } = await import('@/lib/db')
    await db.activityEvents.clear()
    await db.writingGoals.clear()
    await db.writingSessions.clear()
    await db.dailyStats.clear()
  })

  // ==========================================================================
  // 1. Word Diff Engine Tests
  // ==========================================================================
  describe('Word Diff Engine (word-diff.ts)', () => {
    it('1. handles empty strings', () => {
      expect(diffWords('', '')).toEqual({ added: 0, deleted: 0, net: 0 })
      expect(diffWords('   ', '')).toEqual({ added: 0, deleted: 0, net: 0 })
      expect(countWords('')).toBe(0)
    })

    it('2. returns zero diff for identical content', () => {
      const text = 'The brown fox jumped over the lazy dog.'
      expect(diffWords(text, text)).toEqual({ added: 0, deleted: 0, net: 0 })
    })

    it('3. detects words added at the end', () => {
      const oldText = 'INT. COFFEE SHOP - DAY'
      const newText = 'INT. COFFEE SHOP - DAY Sarah sits alone.'
      const result = diffWords(oldText, newText)
      expect(result.added).toBe(3) // Sarah sits alone
      expect(result.deleted).toBe(0)
      expect(result.net).toBe(3)
    })

    it('4. detects words deleted from text', () => {
      const oldText = 'One two three four five'
      const newText = 'One five'
      const result = diffWords(oldText, newText)
      expect(result.added).toBe(0)
      expect(result.deleted).toBe(3) // two three four
      expect(result.net).toBe(-3)
    })

    it('5. computes actual words added and deleted on replacements (not just net count)', () => {
      const oldText = 'The brown fox jumped'
      const newText = 'The red fox jumped'
      const result = diffWords(oldText, newText)
      expect(result.added).toBe(1) // "red"
      expect(result.deleted).toBe(1) // "brown"
      expect(result.net).toBe(0)
    })

    it('6. ignores formatting-only changes (HTML tags & extra spaces)', () => {
      const oldText = 'SARAH: Hello world!'
      const newText = '<p data-type="character"><b>SARAH</b></p><p data-type="dialogue">Hello <i>world</i>!</p>'
      const result = diffWords(oldText, newText)
      expect(result.added).toBe(0)
      expect(result.deleted).toBe(0)
      expect(result.net).toBe(0)
    })

    it('7. decodes HTML entities without affecting word counts', () => {
      const oldText = 'Coffee & Tea'
      const newText = 'Coffee &amp; Tea'
      const result = diffWords(oldText, newText)
      expect(result.added).toBe(0)
      expect(result.deleted).toBe(0)
      expect(result.net).toBe(0)
    })

    it('8. handles Unicode accents and special characters', () => {
      const oldText = 'Café au lait and crème brûlée'
      const newText = 'Café noir and croissant'
      const result = diffWords(oldText, newText)
      expect(result.added).toBe(2) // "noir", "croissant"
      expect(result.deleted).toBe(4) // "au", "lait", "crème", "brûlée"
      expect(result.net).toBe(-2)
    })

    it('9. correctly extracts contractions and hyphenated words', () => {
      const words = extractWords("Don't worry, it's a state-of-the-art screenplay.")
      expect(words).toContain("Don't")
      expect(words).toContain("it's")
      expect(words.length).toBeGreaterThanOrEqual(4)
    })

    it('10. calculates LCS length accurately on complex sentences', () => {
      const a = ['A', 'B', 'C', 'D', 'E']
      const b = ['A', 'X', 'C', 'Y', 'E']
      // Common subsequence: A, C, E -> length 3
      expect(computeLCSLength(a, b)).toBe(3)
    })
  })

  // ==========================================================================
  // 2. Goal Tracking Tests
  // ==========================================================================
  describe('Goal Tracking (goals.ts)', () => {
    const projectId = 'proj_123' as EntityId

    it('11. creates a valid goal with defaults', () => {
      const goal = createGoal({
        projectId,
        type: 'daily',
        targetWords: 1000,
      })
      expect(goal.id).toBeDefined()
      expect(goal.projectId).toBe(projectId)
      expect(goal.type).toBe('daily')
      expect(goal.targetWords).toBe(1000)
      expect(goal.isActive).toBe(true)
      expect(goal.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('12. converts dates across timezones accurately', () => {
      // 2026-10-13 02:00:00 UTC is 2026-10-12 22:00:00 in America/New_York (EDT)
      const dateUtc = new Date(Date.UTC(2026, 9, 13, 2, 0, 0))
      expect(getDateInTimezone(dateUtc, 'UTC')).toBe('2026-10-13')
      expect(getDateInTimezone(dateUtc, 'America/New_York')).toBe('2026-10-12')
    })

    it('13. computes day start and end boundaries in a timezone', () => {
      const bounds = getDayBoundaries('2026-10-13', 'America/New_York')
      expect(bounds.start).toBeInstanceOf(Date)
      expect(bounds.end).toBeInstanceOf(Date)
      expect(bounds.end.getTime()).toBeGreaterThan(bounds.start.getTime())
      // Verification that boundaries fall on the expected local date
      expect(getDateInTimezone(bounds.start, 'America/New_York')).toBe('2026-10-13')
      expect(getDateInTimezone(bounds.end, 'America/New_York')).toBe('2026-10-13')
    })

    it('14. evaluates daily goal progress correctly', () => {
      const goal = createGoal({
        projectId,
        type: 'daily',
        targetWords: 500,
        startDate: '2026-10-13',
      })
      const stats: DailyStats[] = [
        {
          date: '2026-10-13',
          projectId,
          wordsAdded: 300,
          wordsDeleted: 50,
          netWords: 250,
          sessionCount: 2,
          totalSessionTime: 3600000,
          goalsMet: [],
          isWritingDay: true,
        },
      ]

      const progress = checkGoalProgress(goal, stats, new Date(Date.UTC(2026, 9, 13, 12, 0, 0)), 'UTC')
      expect(progress.currentWords).toBe(300)
      expect(progress.percentComplete).toBe(60) // 300 / 500 = 60%
      expect(progress.isMet).toBe(false)
    })

    it('15. marks daily goal as met and caps percentage at 100%', () => {
      const goal = createGoal({
        projectId,
        type: 'daily',
        targetWords: 500,
        startDate: '2026-10-13',
      })
      const stats: DailyStats[] = [
        {
          date: '2026-10-13',
          projectId,
          wordsAdded: 600,
          wordsDeleted: 0,
          netWords: 600,
          sessionCount: 1,
          totalSessionTime: 1800000,
          goalsMet: [],
          isWritingDay: true,
        },
      ]

      const progress = checkGoalProgress(goal, stats, new Date(Date.UTC(2026, 9, 13, 12, 0, 0)), 'UTC')
      expect(progress.currentWords).toBe(600)
      expect(progress.percentComplete).toBe(100)
      expect(progress.isMet).toBe(true)
    })

    it('16. calculates daysRemaining when endDate is set', () => {
      const goal = createGoal({
        projectId,
        type: 'weekly',
        targetWords: 5000,
        startDate: '2026-10-10',
        endDate: '2026-10-17',
      })
      const refDate = new Date(Date.UTC(2026, 9, 13, 12, 0, 0)) // 2026-10-13
      const progress = checkGoalProgress(goal, [], refDate, 'UTC')
      expect(progress.daysRemaining).toBe(4) // 17 - 13 = 4
    })

    it('17. queries active goals from database', async () => {
      const goal1 = createGoal({ projectId, type: 'daily', targetWords: 500 })
      const goal2 = createGoal({ projectId, type: 'weekly', targetWords: 3000 })
      goal2.isActive = false

      await saveGoal(goal1)
      await saveGoal(goal2)

      const active = await getActiveGoals(projectId)
      expect(active.length).toBe(1)
      expect(active[0].id).toBe(goal1.id)
    })
  })

  // ==========================================================================
  // 3. Streak Calculation Tests
  // ==========================================================================
  describe('Streak Calculation (streaks.ts)', () => {
    const projectId = 'proj_123' as EntityId
    const refDate = new Date(Date.UTC(2026, 9, 13, 12, 0, 0)) // Today is 2026-10-13

    it('18. returns 0 streaks for empty daily stats', () => {
      const streak = calculateStreak([], 'UTC', refDate)
      expect(streak.current).toBe(0)
      expect(streak.longest).toBe(0)
      expect(streak.isWritingToday).toBe(false)
      expect(streak.atRisk).toBe(false)
      expect(streak.lastWritingDate).toBeUndefined()
    })

    it('19. ignores days with 0 wordsAdded', () => {
      const stats: DailyStats[] = [
        {
          date: '2026-10-13',
          projectId,
          wordsAdded: 0,
          wordsDeleted: 10,
          netWords: -10,
          sessionCount: 1,
          totalSessionTime: 600000,
          goalsMet: [],
          isWritingDay: false,
        },
      ]
      const streak = calculateStreak(stats, 'UTC', refDate)
      expect(streak.current).toBe(0)
      expect(streak.isWritingToday).toBe(false)
    })

    it('20. detects writing today and sets current streak = 1', () => {
      const stats: DailyStats[] = [
        {
          date: '2026-10-13',
          projectId,
          wordsAdded: 150,
          wordsDeleted: 0,
          netWords: 150,
          sessionCount: 1,
          totalSessionTime: 1200000,
          goalsMet: [],
          isWritingDay: true,
        },
      ]
      const streak = calculateStreak(stats, 'UTC', refDate)
      expect(streak.current).toBe(1)
      expect(streak.longest).toBe(1)
      expect(streak.isWritingToday).toBe(true)
      expect(streak.atRisk).toBe(false)
      expect(streak.lastWritingDate).toBe('2026-10-13')
    })

    it('21. detects streak at risk if written yesterday but not today', () => {
      const stats: DailyStats[] = [
        {
          date: '2026-10-11',
          projectId,
          wordsAdded: 200,
          wordsDeleted: 0,
          netWords: 200,
          sessionCount: 1,
          totalSessionTime: 1200000,
          goalsMet: [],
          isWritingDay: true,
        },
        {
          date: '2026-10-12', // Yesterday
          projectId,
          wordsAdded: 300,
          wordsDeleted: 0,
          netWords: 300,
          sessionCount: 1,
          totalSessionTime: 1500000,
          goalsMet: [],
          isWritingDay: true,
        },
      ]
      const streak = calculateStreak(stats, 'UTC', refDate)
      expect(streak.current).toBe(2)
      expect(streak.longest).toBe(2)
      expect(streak.isWritingToday).toBe(false)
      expect(streak.atRisk).toBe(true) // At risk of being lost!
      expect(streak.lastWritingDate).toBe('2026-10-12')
    })

    it('22. breaks streak if yesterday was missed and not writing today', () => {
      const stats: DailyStats[] = [
        {
          date: '2026-10-10',
          projectId,
          wordsAdded: 200,
          wordsDeleted: 0,
          netWords: 200,
          sessionCount: 1,
          totalSessionTime: 1200000,
          goalsMet: [],
          isWritingDay: true,
        },
        {
          date: '2026-10-11',
          projectId,
          wordsAdded: 300,
          wordsDeleted: 0,
          netWords: 300,
          sessionCount: 1,
          totalSessionTime: 1500000,
          goalsMet: [],
          isWritingDay: true,
        },
        // Missed 2026-10-12 and 2026-10-13
      ]
      const streak = calculateStreak(stats, 'UTC', refDate)
      expect(streak.current).toBe(0)
      expect(streak.longest).toBe(2)
      expect(streak.isWritingToday).toBe(false)
      expect(streak.atRisk).toBe(false)
    })

    it('23. maintains longest streak ever after a break', () => {
      const stats: DailyStats[] = [
        // 4-day streak in January
        { date: '2026-01-01', projectId, wordsAdded: 100, wordsDeleted: 0, netWords: 100, sessionCount: 1, totalSessionTime: 1000, goalsMet: [], isWritingDay: true },
        { date: '2026-01-02', projectId, wordsAdded: 100, wordsDeleted: 0, netWords: 100, sessionCount: 1, totalSessionTime: 1000, goalsMet: [], isWritingDay: true },
        { date: '2026-01-03', projectId, wordsAdded: 100, wordsDeleted: 0, netWords: 100, sessionCount: 1, totalSessionTime: 1000, goalsMet: [], isWritingDay: true },
        { date: '2026-01-04', projectId, wordsAdded: 100, wordsDeleted: 0, netWords: 100, sessionCount: 1, totalSessionTime: 1000, goalsMet: [], isWritingDay: true },
        // Today in October (1-day streak)
        { date: '2026-10-13', projectId, wordsAdded: 200, wordsDeleted: 0, netWords: 200, sessionCount: 1, totalSessionTime: 1000, goalsMet: [], isWritingDay: true },
      ]
      const streak = calculateStreak(stats, 'UTC', refDate)
      expect(streak.current).toBe(1)
      expect(streak.longest).toBe(4)
      expect(streak.isWritingToday).toBe(true)
    })
  })

  // ==========================================================================
  // 4. Session Tracking Tests
  // ==========================================================================
  describe('Session Tracking (sessions.ts)', () => {
    const projectId = 'proj_123' as EntityId
    const draftId = 'draft_456' as EntityId

    it('24. starts session in active state with 0 words', () => {
      const session = startSession(projectId, draftId)
      expect(session.id).toBeDefined()
      expect(session.projectId).toBe(projectId)
      expect(session.draftId).toBe(draftId)
      expect(session.state).toBe('active')
      expect(session.wordsAdded).toBe(0)
      expect(session.wordsDeleted).toBe(0)
      expect(session.countsForStreak).toBe(false)
    })

    it('25. ends session and counts for streak only if words were added', () => {
      const session = startSession(projectId, draftId)
      const endedWithWords = endSession(session, 150, 20)
      expect(endedWithWords.state).toBe('completed')
      expect(endedWithWords.wordsAdded).toBe(150)
      expect(endedWithWords.wordsDeleted).toBe(20)
      expect(endedWithWords.netWords).toBe(130)
      expect(endedWithWords.countsForStreak).toBe(true)

      // Session with 0 words added does not count for streak
      const session2 = startSession(projectId, draftId)
      const endedNoWords = endSession(session2, 0, 10)
      expect(endedNoWords.countsForStreak).toBe(false)
    })

    it('26. updates session words incrementally', () => {
      const session = startSession(projectId, draftId)
      const updated = updateSession(session, 100, 20)
      expect(updated.wordsAdded).toBe(100)
      expect(updated.wordsDeleted).toBe(20)
      expect(updated.netWords).toBe(80)
      expect(updated.countsForStreak).toBe(true)
    })

    it('27. handles abandonSession', () => {
      const session = startSession(projectId, draftId)
      const abandoned = abandonSession(session)
      expect(abandoned.state).toBe('abandoned')
      expect(abandoned.endTime).toBeDefined()
    })

    it('27. detects session timeout after 15 minutes of inactivity', () => {
      const now = Date.now()
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000)
      const sixteenMinutesAgo = new Date(now - 16 * 60 * 1000)

      expect(detectSessionTimeout(tenMinutesAgo, 15 * 60 * 1000, now)).toBe(false)
      expect(detectSessionTimeout(sixteenMinutesAgo, 15 * 60 * 1000, now)).toBe(true)
    })

    it('28. shouldStartNewSession triggers after 5 minutes of idle', () => {
      const now = Date.now()
      expect(shouldStartNewSession(null)).toBe(true) // First ever edit

      const fourMinAgo = new Date(now - 4 * 60 * 1000)
      const sixMinAgo = new Date(now - 6 * 60 * 1000)

      expect(shouldStartNewSession(fourMinAgo, 5 * 60 * 1000, now)).toBe(false)
      expect(shouldStartNewSession(sixMinAgo, 5 * 60 * 1000, now)).toBe(true)
    })

    it('29. persists and retrieves writing sessions in db', async () => {
      const session = startSession(projectId, draftId)
      await saveSession(session)

      const retrieved = await getSession(session.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(session.id)
      expect(retrieved?.state).toBe('active')
    })
  })

  // ==========================================================================
  // 5. Report Generation Tests
  // ==========================================================================
  describe('Report Generation (reports.ts)', () => {
    const projectId = 'proj_123' as EntityId

    it('30. computes correct project report aggregates and consistency %', () => {
      const dailyStats: DailyStats[] = [
        { date: '2026-10-10', projectId, wordsAdded: 500, wordsDeleted: 100, netWords: 400, sessionCount: 2, totalSessionTime: 3600000, goalsMet: [], isWritingDay: true },
        { date: '2026-10-11', projectId, wordsAdded: 300, wordsDeleted: 50, netWords: 250, sessionCount: 1, totalSessionTime: 1800000, goalsMet: [], isWritingDay: true },
        { date: '2026-10-12', projectId, wordsAdded: 0, wordsDeleted: 0, netWords: 0, sessionCount: 0, totalSessionTime: 0, goalsMet: [], isWritingDay: false },
        { date: '2026-10-13', projectId, wordsAdded: 700, wordsDeleted: 50, netWords: 650, sessionCount: 2, totalSessionTime: 3600000, goalsMet: [], isWritingDay: true },
      ]

      const report = calculateReportMetrics({
        projectId,
        dateRange: { start: '2026-10-10', end: '2026-10-13' },
        dailyStats,
        timezone: 'UTC',
        referenceDate: new Date(Date.UTC(2026, 9, 13, 12, 0, 0)),
      })

      expect(report.totalWordsWritten).toBe(1500) // 500 + 300 + 0 + 700
      expect(report.totalWordsDeleted).toBe(200) // 100 + 50 + 0 + 50
      expect(report.netWords).toBe(1300)
      expect(report.totalSessions).toBe(5)
      expect(report.avgWordsPerSession).toBe(300) // 1500 / 5
      expect(report.avgWordsPerWritingDay).toBe(500) // 1500 / 3
      // 3 writing days out of 4 calendar days = 75%
      expect(report.consistencyPercent).toBe(75)
      expect(report.milestones.length).toBeGreaterThanOrEqual(1) // >= 1000 words milestone
    })

    it('31. identifies most productive day and hour', () => {
      const sessions: WritingSession[] = [
        // Sunday at 14:00 (2pm)
        {
          id: 's1' as EntityId,
          projectId,
          draftId: 'd1' as EntityId,
          startTime: new Date('2026-10-11T14:00:00Z').getTime() as Timestamp,
          endTime: new Date('2026-10-11T15:00:00Z').getTime() as Timestamp,
          wordsAdded: 1200,
          wordsDeleted: 50,
          netWords: 1150,
          countsForStreak: true,
          state: 'completed',
        },
        // Monday at 09:00 (9am)
        {
          id: 's2' as EntityId,
          projectId,
          draftId: 'd1' as EntityId,
          startTime: new Date('2026-10-12T09:00:00Z').getTime() as Timestamp,
          endTime: new Date('2026-10-12T10:00:00Z').getTime() as Timestamp,
          wordsAdded: 400,
          wordsDeleted: 10,
          netWords: 390,
          countsForStreak: true,
          state: 'completed',
        },
      ]

      const report = calculateReportMetrics({
        projectId,
        dailyStats: [],
        sessions,
        timezone: 'UTC',
      })

      expect(report.mostProductiveDay).toBe(0) // Sunday (1200 words)
      expect(report.mostProductiveHour).toBe(14) // 14:00 UTC
    })

    it('32. queries and generates project report from db', async () => {
      const { db } = await import('@/lib/db')
      await db.dailyStats.add({
        id: 'ds_1',
        projectId,
        date: '2026-10-13',
        wordsAdded: 850,
        wordsDeleted: 50,
        netWords: 800,
        sessionCount: 2,
        totalSessionTime: 3600000,
        goalsMet: [],
        isWritingDay: true,
      })

      const report = await generateProjectReport(projectId, { start: '2026-10-13', end: '2026-10-13' })
      expect(report.totalWordsWritten).toBe(850)
      expect(report.netWords).toBe(800)
      expect(report.totalSessions).toBe(2)
    })
  })

  // ==========================================================================
  // 6. Events & Idempotency Tests
  // ==========================================================================
  describe('Events & Idempotency (events.ts)', () => {
    const projectId = 'proj_123' as EntityId
    const draftId = 'draft_456' as EntityId

    it('33. filters out autosaves and background sync from writing events', () => {
      expect(isWritingActivity('autosave')).toBe(false)
      expect(isWritingActivity('page_view')).toBe(false)
      expect(isWritingActivity('background_sync')).toBe(false)
      expect(isWritingActivity('sync')).toBe(false)

      expect(isWritingActivity('word_added')).toBe(true)
      expect(isWritingActivity('word_deleted')).toBe(true)
      expect(isWritingActivity('session_start')).toBe(true)
      expect(isWritingActivity('session_end')).toBe(true)
      expect(isWritingActivity('goal_met')).toBe(true)
    })

    it('34. does not record non-writing activity events', async () => {
      const event: any = {
        id: 'evt_sync_1',
        type: 'autosave',
        timestamp: Date.now() as Timestamp,
        projectId,
        draftId,
        schemaVersion: 1,
        payload: {},
      }
      await recordEvent(event)
      const events = await getEventsByType(projectId, 'word_added')
      expect(events.length).toBe(0)
    })

    it('35. guarantees idempotency by event ID', async () => {
      const { db } = await import('@/lib/db')
      const event = createWordAddedEvent({
        projectId,
        draftId,
        count: 50,
        id: 'evt_fixed_uuid' as EntityId,
      })

      // Record first time
      await recordEvent(event)
      expect(db.activityEvents.add).toHaveBeenCalledTimes(1)

      // Record second time with identical ID
      await recordEvent(event)
      // add() should NOT be called again because existing event was found
      expect(db.activityEvents.add).toHaveBeenCalledTimes(1)
    })

    it('36. queries events by type and date range', async () => {
      const event1 = createWordAddedEvent({
        projectId,
        draftId,
        count: 100,
        timestamp: new Date('2026-10-10T12:00:00Z').getTime() as Timestamp,
      })
      const event2 = createWordAddedEvent({
        projectId,
        draftId,
        count: 200,
        timestamp: new Date('2026-10-13T12:00:00Z').getTime() as Timestamp,
      })
      const sessionEvent = createSessionStartEvent({
        projectId,
        draftId,
        sessionId: 'sess_1' as EntityId,
        timestamp: new Date('2026-10-13T12:00:00Z').getTime() as Timestamp,
      })

      await recordEvent(event1)
      await recordEvent(event2)
      await recordEvent(sessionEvent)

      // Query word_added in range 2026-10-12 to 2026-10-14
      const filtered = await getEventsByType(projectId, 'word_added', {
        start: '2026-10-12',
        end: '2026-10-14',
      })

      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe(event2.id)
    })

    it('37. creates well-formed session end events', () => {
      const event = createSessionEndEvent({
        projectId,
        draftId,
        sessionId: 'sess_99' as EntityId,
        duration: 1800000,
        wordsAdded: 450,
        wordsDeleted: 30,
      })

      expect(event.type).toBe('session_end')
      expect(event.payload.sessionId).toBe('sess_99' as EntityId)
      expect(event.payload.wordsAdded).toBe(450)
      expect(event.payload.wordsDeleted).toBe(30)
      expect(event.payload.netWords).toBe(420)
      expect(event.payload.countsForStreak).toBe(true)
    })
  })
})
