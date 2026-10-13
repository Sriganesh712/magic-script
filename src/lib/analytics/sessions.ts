/**
 * Session Detection & Tracking for Screenplay Studio (ANA-004)
 * Framework-independent session lifecycle management.
 */

import type { EntityId, Timestamp } from '@/types/screenplay'
import type { WritingSession } from '@/types/analytics'
import { db, generateId } from '@/lib/db'

/** Timeout after which an idle period triggers a new session on next edit (5 minutes) */
export const IDLE_START_TIMEOUT_MS = 5 * 60 * 1000

/** Timeout after which an idle session is considered closed / abandoned (15 minutes) */
export const IDLE_SESSION_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Starts a new writing session.
 * Sessions begin in an 'active' state with 0 words.
 *
 * @param projectId - Project ID
 * @param draftId - Draft ID
 * @param startTime - Optional start timestamp or Date (defaults to now)
 * @returns Initialized WritingSession
 */
export function startSession(
  projectId: EntityId,
  draftId: EntityId,
  startTime: Date | number = Date.now()
): WritingSession {
  const startTs = (typeof startTime === 'number' ? startTime : startTime.getTime()) as Timestamp
  const id = ((typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateId())) as EntityId

  return {
    id,
    projectId,
    draftId,
    startTime: startTs,
    wordsAdded: 0,
    wordsDeleted: 0,
    netWords: 0,
    countsForStreak: false,
    state: 'active',
  }
}

/**
 * Updates an ongoing session with additional words added and deleted.
 *
 * @param session - Existing WritingSession
 * @param wordsAdded - Words added to add to total
 * @param wordsDeleted - Words deleted to add to total
 * @returns Updated WritingSession
 */
export function updateSession(
  session: WritingSession,
  wordsAdded: number,
  wordsDeleted: number
): WritingSession {
  const totalAdded = (session.wordsAdded || 0) + wordsAdded
  const totalDeleted = (session.wordsDeleted || 0) + wordsDeleted
  const netWords = totalAdded - totalDeleted
  const countsForStreak = totalAdded > 0

  return {
    ...session,
    wordsAdded: totalAdded,
    wordsDeleted: totalDeleted,
    netWords,
    countsForStreak,
  }
}

/**
 * Ends a writing session.
 * Marks the session as 'completed' and sets endTime.
 * A session counts for streaks only if words were added (wordsAdded > 0).
 *
 * @param session - Existing WritingSession
 * @param wordsAdded - Words added during session (if not already accumulated)
 * @param wordsDeleted - Words deleted during session (if not already accumulated)
 * @param endTime - Optional end timestamp or Date (defaults to now)
 * @returns Completed WritingSession
 */
export function endSession(
  session: WritingSession,
  wordsAdded: number = 0,
  wordsDeleted: number = 0,
  endTime: Date | number = Date.now()
): WritingSession {
  const endTs = (typeof endTime === 'number' ? endTime : endTime.getTime()) as Timestamp

  // If words were already tracked on session, accumulate; otherwise use provided counts
  let totalAdded = session.wordsAdded || 0
  let totalDeleted = session.wordsDeleted || 0

  if (session.wordsAdded === 0 && wordsAdded > 0) {
    totalAdded = wordsAdded
  } else if (wordsAdded !== session.wordsAdded) {
    totalAdded += wordsAdded
  }

  if (session.wordsDeleted === 0 && wordsDeleted > 0) {
    totalDeleted = wordsDeleted
  } else if (wordsDeleted !== session.wordsDeleted) {
    totalDeleted += wordsDeleted
  }

  const netWords = totalAdded - totalDeleted
  const countsForStreak = totalAdded > 0

  return {
    ...session,
    endTime: endTs,
    wordsAdded: totalAdded,
    wordsDeleted: totalDeleted,
    netWords,
    countsForStreak,
    state: 'completed',
  }
}

/**
 * Abandons an active session (e.g. timeout without save or user cancellation).
 *
 * @param session - Existing WritingSession
 * @param endTime - Optional end timestamp or Date (defaults to now)
 * @returns Abandoned WritingSession
 */
export function abandonSession(
  session: WritingSession,
  endTime: Date | number = Date.now()
): WritingSession {
  const endTs = (typeof endTime === 'number' ? endTime : endTime.getTime()) as Timestamp
  return {
    ...session,
    endTime: endTs,
    state: 'abandoned',
  }
}

/**
 * Detects whether a session has timed out due to inactivity.
 *
 * @param lastActivity - Timestamp or Date of the last user edit / interaction
 * @param timeoutMs - Idle threshold in ms (defaults to 15 minutes)
 * @param currentTime - Current timestamp or Date (defaults to now)
 * @returns True if elapsed idle time meets or exceeds timeoutMs
 */
export function detectSessionTimeout(
  lastActivity: Date | number,
  timeoutMs: number = IDLE_SESSION_TIMEOUT_MS,
  currentTime: Date | number = Date.now()
): boolean {
  const lastTime = typeof lastActivity === 'number' ? lastActivity : lastActivity.getTime()
  const now = typeof currentTime === 'number' ? currentTime : currentTime.getTime()
  return (now - lastTime) >= timeoutMs
}

/**
 * Determines if a new session should start on the next user edit.
 * Starts on first edit after idle > 5 minutes (or if no previous activity).
 *
 * @param lastActivity - Timestamp or Date of previous activity, or null if first activity
 * @param idleThresholdMs - Idle threshold in ms (defaults to 5 minutes)
 * @param currentTime - Current timestamp or Date (defaults to now)
 * @returns True if a new session should begin
 */
export function shouldStartNewSession(
  lastActivity: Date | number | null,
  idleThresholdMs: number = IDLE_START_TIMEOUT_MS,
  currentTime: Date | number = Date.now()
): boolean {
  if (lastActivity === null) return true
  const lastTime = typeof lastActivity === 'number' ? lastActivity : lastActivity.getTime()
  const now = typeof currentTime === 'number' ? currentTime : currentTime.getTime()
  return (now - lastTime) >= idleThresholdMs
}

/**
 * Persists a writing session to the database.
 */
export async function saveSession(session: WritingSession): Promise<void> {
  await db.writingSessions.put(session as any)
}

/**
 * Retrieves a session by ID from the database.
 */
export async function getSession(sessionId: EntityId): Promise<WritingSession | undefined> {
  return (await db.writingSessions.get(sessionId)) as unknown as WritingSession | undefined
}

/**
 * Gets currently active session for a project.
 */
export async function getActiveSession(
  projectId: EntityId,
  draftId?: EntityId
): Promise<WritingSession | undefined> {
  const sessions = (await db.writingSessions
    .where('projectId')
    .equals(projectId)
    .toArray()) as unknown as WritingSession[]
  const activeSessions = sessions.filter(s => s.state === 'active')
  if (draftId) {
    return activeSessions.find(s => s.draftId === draftId)
  }
  return activeSessions[0]
}

/**
 * Retrieves all sessions for a project.
 */
export async function getProjectSessions(projectId: EntityId): Promise<WritingSession[]> {
  return (await db.writingSessions
    .where('projectId')
    .equals(projectId)
    .toArray()) as unknown as WritingSession[]
}
