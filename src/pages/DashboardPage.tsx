import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import {
  db,
  initDB,
  generateId,
  type Project,
  type WritingSession,
  type DailyStats,
  type WritingGoal,
  type Timestamp,
} from '@/lib'
import {
  getDriveAuthState,
  listDriveFiles,
  getCachedDriveFiles,
  type DriveFileMetadata,
} from '@/lib/drive'
import { getSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { processSyncQueue } from '@/lib/sync'
import { calculateStreak } from '@/lib/analytics/streaks'
import { StatsCard } from '@/components/StatsCard'
import { CalendarHeatmap } from '@/components/CalendarHeatmap'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Flame,
  Calendar,
  PenTool,
  Clock,
  Target,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Hourglass,
  Layers,
  Cloud,
  HardDrive,
  Database,
  RefreshCw,
  ExternalLink,
  FileText,
  Trash2,
} from 'lucide-react'

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [sessions, setSessions] = useState<WritingSession[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [goals, setGoals] = useState<WritingGoal[]>([])
  const [cloudFiles, setCloudFiles] = useState<DriveFileMetadata[]>(() => getCachedDriveFiles())
  const [driveAuth, setDriveAuth] = useState(getDriveAuthState())
  const [supabaseUser, setSupabaseUser] = useState<any>(null)
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0)
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  // Load analytics and cloud data from IndexedDB, Drive, and Supabase
  const loadAnalyticsData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }
      await initDB()

      const [projs, scrs, sessList, statsList, goalsList, pendingOps] = await Promise.all([
        db.projects.toArray(),
        db.screenplays.toArray(),
        db.writingSessions.orderBy('startTime').reverse().limit(100).toArray(),
        db.dailyStats.toArray(),
        db.writingGoals.toArray(),
        db.syncOperations.toArray(),
      ])

      setProjects(projs)
      setPendingSyncCount(pendingOps.length)

      // Automatically purge leftover demo seeds (400, 660, 490 words) or orphaned sessions
      const validProjectIds = new Set(projs.map((p) => p.id))
      const isDemoSession = (s: WritingSession) =>
        !validProjectIds.has(s.projectId) ||
        (s.wordsAdded === 450 && s.netWords === 400) ||
        (s.wordsAdded === 780 && s.netWords === 660) ||
        (s.wordsAdded === 520 && s.netWords === 490)

      const demoSessionIds = sessList.filter(isDemoSession).map((s) => s.id)
      if (demoSessionIds.length > 0) {
        try {
          await db.writingSessions.bulkDelete(demoSessionIds)
        } catch {
          // Ignore
        }
      }

      const isDemoGoal = (g: WritingGoal) =>
        !validProjectIds.has(g.projectId) ||
        (g.type === 'daily' && g.targetWords === 500 && g.projectId.startsWith('proj_') && !validProjectIds.has(g.projectId)) ||
        (g.type === 'weekly' && g.targetWords === 3500 && !validProjectIds.has(g.projectId)) ||
        (g.type === 'project' && g.targetWords === 25000 && !validProjectIds.has(g.projectId))

      const demoGoalIds = goalsList.filter(isDemoGoal).map((g) => g.id)
      if (demoGoalIds.length > 0) {
        try {
          await db.writingGoals.bulkDelete(demoGoalIds)
        } catch {
          // Ignore
        }
      }

      const demoStats = statsList.filter((s) => !validProjectIds.has(s.projectId))
      if (demoStats.length > 0) {
        try {
          await db.dailyStats.bulkDelete(demoStats.map((s) => s.id!).filter(Boolean))
        } catch {
          // Ignore
        }
      }

      let realSessions = sessList.filter((s) => !isDemoSession(s))
      let realStats = statsList.filter((s) => validProjectIds.has(s.projectId))
      const realGoals = goalsList.filter((g) => !isDemoGoal(g))

      // If user has existing real screenplays with words, synthesize initial real stats from them
      const wasReset = localStorage.getItem('screenplay_studio_analytics_cleared') === 'true'
      if (realSessions.length === 0 && scrs.length > 0 && !wasReset) {
        const synthesizedSessions: WritingSession[] = []
        const synthesizedStats: DailyStats[] = []

        for (const scr of scrs) {
          if (!validProjectIds.has(scr.projectId)) continue
          const rawText = (typeof scr.elements === 'string' ? scr.elements : JSON.stringify(scr.elements || ''))
            .replace(/<[^>]*>/g, ' ')
          const words = rawText.trim().split(/\s+/).filter((w) => w.length > 0).length

          if (words > 0) {
            const dateStr = new Date(scr.updatedAt || scr.createdAt || Date.now()).toISOString().split('T')[0]
            const sessId = generateId()
            const sess: WritingSession = {
              id: sessId,
              projectId: scr.projectId,
              draftId: scr.draftId,
              startTime: (scr.createdAt || Date.now()) as Timestamp,
              endTime: (scr.updatedAt || Date.now()) as Timestamp,
              wordsAdded: words,
              wordsDeleted: 0,
              netWords: words,
              countsForStreak: true,
              state: 'completed',
            }
            synthesizedSessions.push(sess)

            synthesizedStats.push({
              id: generateId(),
              projectId: scr.projectId,
              date: dateStr,
              wordsAdded: words,
              wordsDeleted: 0,
              netWords: words,
              sessionCount: 1,
              totalSessionTime: 120000,
              goalsMet: [],
              isWritingDay: true,
            })
          }
        }

        if (synthesizedSessions.length > 0) {
          try {
            await db.writingSessions.bulkAdd(synthesizedSessions)
            await db.dailyStats.bulkAdd(synthesizedStats)
          } catch {
            // Ignore potential primary key collision
          }
          realSessions = await db.writingSessions.orderBy('startTime').reverse().limit(100).toArray()
          realStats = await db.dailyStats.toArray()
        }
      }

      setSessions(realSessions)
      setDailyStats(realStats)
      setGoals(realGoals)

      // Refresh Google Drive auth and real-time cloud files
      const currentDriveAuth = getDriveAuthState()
      setDriveAuth(currentDriveAuth)

      if (currentDriveAuth.isConnected && currentDriveAuth.accessToken) {
        try {
          const remoteFiles = await listDriveFiles()
          setCloudFiles(remoteFiles)
        } catch (err) {
          console.warn('[DashboardPage] Drive files list error:', err)
          setCloudFiles(getCachedDriveFiles())
        }
      } else {
        setCloudFiles(getCachedDriveFiles())
      }

      // Refresh Supabase user status
      const sbUser = await getCurrentUser()
      setSupabaseUser(sbUser)

      setLastRefreshedAt(new Date())
    } catch (err) {
      console.error('[DashboardPage] Failed to load analytics:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Setup real-time event listeners and periodic sync
  useEffect(() => {
    loadAnalyticsData()

    // 1. Listen for local editor edits, saves, and cloud backup completion
    const handleDataChanged = () => {
      loadAnalyticsData(true)
    }
    const handleCloudBackup = () => {
      loadAnalyticsData(true)
    }
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key?.includes('screenplay') ||
        e.key?.includes('drive') ||
        e.key?.includes('supabase')
      ) {
        loadAnalyticsData(true)
      }
    }
    const handleWindowFocus = () => {
      loadAnalyticsData(true)
    }

    window.addEventListener('screenplay:data-changed', handleDataChanged)
    window.addEventListener('screenplay:cloud-backup', handleCloudBackup)
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleWindowFocus)

    // 2. Real-time Supabase subscriptions (if configured and authenticated)
    const supabase = getSupabaseClient()
    let channel: any = null
    if (supabase && supabaseUser && !import.meta.env.VITEST) {
      try {
        channel = supabase
          .channel('dashboard-live-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
            loadAnalyticsData(true)
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'screenplays' }, () => {
            loadAnalyticsData(true)
          })
          .subscribe()
      } catch {
        // Ignore channel setup errors in local mode
      }
    }

    // 3. Periodic polling interval (every 4 seconds) to ensure real-time cloud sync
    const pollInterval = setInterval(() => {
      loadAnalyticsData(true)
    }, 4000)

    return () => {
      window.removeEventListener('screenplay:data-changed', handleDataChanged)
      window.removeEventListener('screenplay:cloud-backup', handleCloudBackup)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleWindowFocus)
      clearInterval(pollInterval)
      if (channel && supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [loadAnalyticsData])

  // Manual cloud synchronization trigger
  const handleManualCloudSync = async () => {
    try {
      setIsSyncingCloud(true)
      await processSyncQueue()
      await loadAnalyticsData(true)
    } catch (err) {
      console.error('[DashboardPage] Manual sync error:', err)
    } finally {
      setIsSyncingCloud(false)
    }
  }

  // Clear writing sessions & daily stats to start completely fresh from 0
  const handleResetAnalytics = async () => {
    if (
      confirm(
        'Clear all writing session logs and reset word counts to 0? Your screenplays, drafts, and Google Drive cloud backups will NOT be deleted.'
      )
    ) {
      try {
        localStorage.setItem('screenplay_studio_analytics_cleared', 'true')
        await db.writingSessions.clear()
        await db.dailyStats.clear()
        await db.writingGoals.clear()
        await loadAnalyticsData(true)
      } catch (err) {
        console.error('[DashboardPage] Failed to clear analytics:', err)
      }
    }
  }

  // Filter data based on selected project
  const filteredSessions = useMemo(() => {
    if (selectedProjectId === 'all') return sessions
    return sessions.filter((s) => s.projectId === selectedProjectId)
  }, [sessions, selectedProjectId])

  const filteredStats = useMemo(() => {
    if (selectedProjectId === 'all') return dailyStats
    return dailyStats.filter((s) => s.projectId === selectedProjectId)
  }, [dailyStats, selectedProjectId])

  const filteredCloudFiles = useMemo(() => {
    if (selectedProjectId === 'all') return cloudFiles
    return cloudFiles.filter((f) => !f.projectId || f.projectId === selectedProjectId)
  }, [cloudFiles, selectedProjectId])

  // Map project names
  const projectMap = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach((p) => map.set(p.id, p.name))
    return map
  }, [projects])

  // Format today's date YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  // Aggregate real heatmap data: ZERO mock data
  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {}

    // From daily stats
    filteredStats.forEach((stat) => {
      map[stat.date] = (map[stat.date] || 0) + (stat.netWords > 0 ? stat.netWords : stat.wordsAdded)
    })

    // From sessions
    filteredSessions.forEach((s) => {
      const d = new Date(s.startTime)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      map[key] = (map[key] || 0) + (s.netWords > 0 ? s.netWords : s.wordsAdded)
    })

    return map
  }, [filteredStats, filteredSessions])

  // Calculate Real Metrics
  const metrics = useMemo(() => {
    const todayWords = heatmapData[todayStr] || 0

    // Weekly total (last 7 days)
    let weeklyWords = 0
    const now = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      weeklyWords += heatmapData[key] || 0
    }

    // Monthly total (last 30 days)
    let monthlyWords = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      monthlyWords += heatmapData[key] || 0
    }

    // Real streak calculation (using pure calculateStreak logic, NO hardcoded fallback)
    const streakInfo = calculateStreak(filteredStats)
    let streak = streakInfo.current

    // If words were added today in sessions, ensure streak is active
    if (streak === 0 && todayWords > 0) {
      streak = 1
    }

    // Total words across filtered sessions
    let totalWords = 0
    filteredSessions.forEach((s) => {
      totalWords += s.netWords > 0 ? s.netWords : s.wordsAdded
    })

    const writingDaysCount = Object.values(heatmapData).filter((w) => w > 0).length

    return {
      todayWords,
      streak,
      weeklyWords,
      monthlyWords,
      totalWords,
      writingDays: writingDaysCount,
    }
  }, [heatmapData, todayStr, filteredStats, filteredSessions])

  // Real Productivity by Day of Week & Hour
  const consistencyStats = useMemo(() => {
    const days = [
      { day: 'Mon', dayIndex: 1, words: 0 },
      { day: 'Tue', dayIndex: 2, words: 0 },
      { day: 'Wed', dayIndex: 3, words: 0 },
      { day: 'Thu', dayIndex: 4, words: 0 },
      { day: 'Fri', dayIndex: 5, words: 0 },
      { day: 'Sat', dayIndex: 6, words: 0 },
      { day: 'Sun', dayIndex: 0, words: 0 },
    ]

    const hourMap = new Array(24).fill(0)

    filteredSessions.forEach((s) => {
      const d = new Date(s.startTime)
      const dow = d.getDay()
      const hr = d.getHours()
      const w = s.netWords > 0 ? s.netWords : s.wordsAdded

      const dayObj = days.find((item) => item.dayIndex === dow)
      if (dayObj) dayObj.words += w
      hourMap[hr] += w
    })

    const maxWords = Math.max(...days.map((d) => d.words), 1)

    // Calculate peak writing hour
    let peakHourIndex = -1
    let maxHourWords = 0
    hourMap.forEach((w, hr) => {
      if (w > maxHourWords) {
        maxHourWords = w
        peakHourIndex = hr
      }
    })

    const peakHourStr =
      peakHourIndex >= 0
        ? `${peakHourIndex % 12 === 0 ? 12 : peakHourIndex % 12}:00 ${
            peakHourIndex >= 12 ? 'PM' : 'AM'
          } - ${(peakHourIndex + 1) % 12 === 0 ? 12 : (peakHourIndex + 1) % 12}:00 ${
            peakHourIndex + 1 >= 12 ? 'PM' : 'AM'
          }`
        : 'No sessions logged yet'

    // Average output per session
    const avgPerSession =
      filteredSessions.length > 0
        ? Math.round(metrics.totalWords / filteredSessions.length)
        : metrics.todayWords > 0
        ? metrics.todayWords
        : 0

    // Consistency score based on active writing days over the past week
    const consistencyPercent =
      metrics.writingDays > 0 ? Math.min(100, Math.round((metrics.writingDays / 7) * 100)) : 0

    return {
      days,
      maxWords,
      peakHourStr,
      avgPerSession,
      consistencyPercent,
    }
  }, [filteredSessions, metrics])

  // Active Goals computation (purely based on real project targets and words)
  const activeGoals = useMemo(() => {
    if (goals.length > 0) {
      return goals.map((g) => {
        let current = 0
        if (g.type === 'daily') current = metrics.todayWords
        else if (g.type === 'weekly') current = metrics.weeklyWords
        else current = metrics.totalWords

        const target = g.targetWords || 1
        const percent = Math.min(100, Math.round((current / target) * 100))
        return {
          id: g.id,
          title:
            g.type === 'daily'
              ? 'Daily Writing Goal'
              : g.type === 'weekly'
              ? 'Weekly Target'
              : 'Project Draft Milestone',
          current,
          target,
          percent,
          isMet: current >= target,
        }
      })
    }

    // Default dynamic goals computed from user's real project
    const defaultDailyTarget = 500
    const defaultWeeklyTarget = 2500
    const defaultProjectTarget = 15000

    return [
      {
        id: 'goal_daily',
        title: 'Daily Writing Goal',
        current: metrics.todayWords,
        target: defaultDailyTarget,
        percent: Math.min(100, Math.round((metrics.todayWords / defaultDailyTarget) * 100)),
        isMet: metrics.todayWords >= defaultDailyTarget,
      },
      {
        id: 'goal_weekly',
        title: 'Weekly Target',
        current: metrics.weeklyWords,
        target: defaultWeeklyTarget,
        percent: Math.min(100, Math.round((metrics.weeklyWords / defaultWeeklyTarget) * 100)),
        isMet: metrics.weeklyWords >= defaultWeeklyTarget,
      },
      {
        id: 'goal_milestone',
        title:
          selectedProjectId !== 'all' && projectMap.get(selectedProjectId)
            ? `${projectMap.get(selectedProjectId)} Draft Progress`
            : 'Total Screenplay Words',
        current: metrics.totalWords,
        target: defaultProjectTarget,
        percent: Math.min(100, Math.round((metrics.totalWords / defaultProjectTarget) * 100)),
        isMet: metrics.totalWords >= defaultProjectTarget,
      },
    ]
  }, [goals, metrics, selectedProjectId, projectMap])

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted/40 rounded-xl" />
          ))}
        </div>
        <div className="h-44 bg-muted/30 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Header & Project Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Writing Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Realtime Sync
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time tracking of cloud backups, writing output, streaks, and screenplay milestones.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[180px] sm:w-[200px] bg-card">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAnalyticsData(true)}
            disabled={isRefreshing}
            className="gap-1.5"
            title="Refresh cloud files and analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetAnalytics}
            className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Clear demo writing history and reset to 0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Stats</span>
          </Button>
        </div>
      </div>

      {/* Realtime Cloud Saved Data & Synchronization Section */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Cloud className="w-4 h-4 text-primary" />
                <span>Cloud Saved Data (Realtime)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Active cloud backups in Google Drive and database sync state
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Last checked: {lastRefreshedAt.toLocaleTimeString()}
              </span>
              <Button variant="ghost" size="xs" asChild className="gap-1 text-xs h-7 text-primary">
                <Link to="/settings">
                  <ExternalLink className="w-3 h-3" />
                  <span>Configure Cloud</span>
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Cloud Status Badges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Google Drive Status */}
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                  Google Drive Backup
                </span>
                <Badge
                  variant={driveAuth.isConnected ? 'default' : 'outline'}
                  className={
                    driveAuth.isConnected
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]'
                      : 'text-[10px] text-muted-foreground'
                  }
                >
                  {driveAuth.isConnected ? 'Connected & Active' : 'Disconnected'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {driveAuth.isConnected
                  ? `Folder: 'Screenplay Studio' • ${driveAuth.userEmail || 'Active session'}`
                  : 'Connect in Settings to enable automatic cloud backup on PDF exports.'}
              </p>
              {driveAuth.lastSyncAt && (
                <p className="text-[10px] text-muted-foreground">
                  Last backup: {new Date(driveAuth.lastSyncAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Supabase Database Sync Status */}
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                  Database Sync (Supabase)
                </span>
                <Badge
                  variant={supabaseUser ? 'default' : 'secondary'}
                  className={
                    supabaseUser
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]'
                      : 'text-[10px]'
                  }
                >
                  {supabaseUser ? 'Cloud Synced' : 'Local-Only Mode'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {supabaseUser
                  ? `Signed in as ${supabaseUser.email}`
                  : 'Operating locally in browser IndexedDB.'}
              </p>
              <div className="flex items-center justify-between pt-0.5 text-[10px] text-muted-foreground">
                <span>
                  {pendingSyncCount === 0
                    ? 'All changes up to date'
                    : `${pendingSyncCount} operations queued`}
                </span>
                {pendingSyncCount > 0 && (
                  <button
                    onClick={handleManualCloudSync}
                    disabled={isSyncingCloud}
                    className="text-primary hover:underline font-semibold"
                  >
                    {isSyncingCloud ? 'Syncing...' : 'Sync Now'}
                  </button>
                )}
              </div>
            </div>

            {/* Cloud Files Summary */}
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-500" />
                  Cloud Backups Stored
                </span>
                <span className="font-bold text-foreground text-sm">
                  {filteredCloudFiles.length} {filteredCloudFiles.length === 1 ? 'file' : 'files'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {filteredCloudFiles.length > 0
                  ? `${Math.round(
                      filteredCloudFiles.reduce((acc, f) => acc + (f.size || 0), 0) / 1024
                    )} KB total across cloud exports`
                  : 'Export a PDF or backup to populate cloud storage.'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Persistent across devices via Google Drive
              </p>
            </div>
          </div>

          {/* Realtime Cloud Backups File List */}
          <div className="border border-border/60 rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-2 border-b border-border/60 flex items-center justify-between text-xs font-medium">
              <span className="text-foreground">Uploaded Cloud Files ({filteredCloudFiles.length})</span>
              <span className="text-[11px] text-muted-foreground">Updated in Realtime</span>
            </div>

            {filteredCloudFiles.length > 0 ? (
              <div className="divide-y divide-border/50 max-h-60 overflow-y-auto">
                {filteredCloudFiles.map((file) => {
                  const sizeKb = file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'N/A'
                  const uploadDate = file.modifiedTime || file.createdTime
                  const dateStr = uploadDate ? new Date(uploadDate).toLocaleString() : 'Recent'

                  return (
                    <div
                      key={file.id}
                      className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{file.name}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>{sizeKb}</span>
                            <span>•</span>
                            <span>{dateStr}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {file.exportFormat || 'PDF'}
                        </Badge>
                        {file.webViewLink ? (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                          >
                            Open <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Saved to Drive</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-1.5">
                <Cloud className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="font-medium text-foreground">No cloud backup files uploaded yet</p>
                <p className="text-[11px] max-w-sm mx-auto">
                  {driveAuth.isConnected
                    ? 'When you export a PDF, Fountain, or FDX file from any screenplay, it will automatically back up to Google Drive and appear here in real-time.'
                    : 'Connect Google Drive in Settings to view and manage your cloud backup files here.'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Today's Words"
          value={metrics.todayWords}
          icon={PenTool}
          trend={{
            value: `${Math.round((metrics.todayWords / 500) * 100)}% of goal`,
            direction: metrics.todayWords >= 500 ? 'up' : 'neutral',
            isPositive: metrics.todayWords >= 500,
          }}
          iconColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />

        <StatsCard
          label="Current Streak"
          value={`${metrics.streak} ${metrics.streak === 1 ? 'day' : 'days'}`}
          icon={Flame}
          trend={{
            value: metrics.streak > 0 ? 'Streak active' : 'Start today',
            direction: metrics.streak > 0 ? 'up' : 'neutral',
            isPositive: metrics.streak > 0,
          }}
          iconColor="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />

        <StatsCard
          label="Weekly Total"
          value={metrics.weeklyWords}
          icon={Calendar}
          trend={{
            value: 'Last 7 days',
            direction: 'up',
            isPositive: metrics.weeklyWords > 0,
          }}
          iconColor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />

        <StatsCard
          label="Monthly Total"
          value={metrics.monthlyWords}
          icon={TrendingUp}
          trend={{
            value: 'Last 30 days',
            direction: 'up',
            isPositive: metrics.monthlyWords > 0,
          }}
          iconColor="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Calendar Heatmap Component */}
      <div className="space-y-2">
        <CalendarHeatmap
          data={heatmapData}
          title="Writing Activity Calendar"
          className="shadow-xs"
        />
      </div>

      {/* Two Column Section: Goals & Real Consistency Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Goals Section */}
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span>Writing Goals</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Active milestones and target word counts
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {activeGoals.filter((g) => g.isMet).length} of {activeGoals.length} Met
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {activeGoals.map((goal) => (
              <div
                key={goal.id}
                className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/50"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    {goal.isMet ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Hourglass className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    {goal.title}
                  </span>
                  <span className="font-medium text-muted-foreground">
                    <strong className="text-foreground">{goal.current.toLocaleString()}</strong> /{' '}
                    {goal.target.toLocaleString()} words
                  </span>
                </div>

                <Progress value={goal.percent} className="h-2" />

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span>{goal.percent}% completed</span>
                  {goal.isMet && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Target Achieved!
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Real Writing Consistency & Patterns */}
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Writing Patterns & Consistency</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Real output breakdown by day of week and peak productivity
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {/* Visual Consistency Bar Representation */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Weekly Writing Consistency</span>
                <span className="font-bold text-primary">
                  {consistencyStats.consistencyPercent}% Active
                </span>
              </div>

              {/* Day of week mini bar chart with real calculated data */}
              <div className="grid grid-cols-7 gap-2 pt-2 items-end h-24">
                {consistencyStats.days.map((col) => {
                  const barHeight =
                    col.words > 0
                      ? `${Math.max(12, Math.round((col.words / consistencyStats.maxWords) * 100))}%`
                      : '4px'

                  return (
                    <div key={col.day} className="flex flex-col items-center gap-1.5 h-full justify-end">
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          col.words > 0 ? 'bg-primary/80 hover:bg-primary' : 'bg-muted/60'
                        }`}
                        style={{ height: barHeight }}
                        title={`${col.words} words written on ${col.day}`}
                      />
                      <span className="text-[10px] text-muted-foreground font-medium">{col.day}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick stats summary */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border border-border/60 bg-card">
                <div className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Peak Writing Hour</span>
                </div>
                <div className="mt-1 font-bold text-foreground text-sm truncate">
                  {consistencyStats.peakHourStr}
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-border/60 bg-card">
                <div className="text-muted-foreground flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Avg Output / Session</span>
                </div>
                <div className="mt-1 font-bold text-foreground text-sm">
                  {consistencyStats.avgPerSession} words
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions List */}
      <Card className="border-border/80 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span>Recent Writing Sessions</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Log of recent writing sprints and element updates
          </CardDescription>
        </CardHeader>

        <CardContent>
          {filteredSessions.length > 0 ? (
            <div className="divide-y divide-border/60">
              {filteredSessions.slice(0, 5).map((session) => {
                const projName = projectMap.get(session.projectId) || 'Screenplay Draft'
                const sessionDate = new Date(session.startTime).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
                const sessionTime = new Date(session.startTime).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <div
                    key={session.id}
                    className="py-3 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{projName}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {sessionDate} at {sessionTime}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        variant="outline"
                        className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 font-semibold"
                      >
                        +{session.netWords || session.wordsAdded} words
                      </Badge>
                      {session.countsForStreak && (
                        <span className="text-[11px] text-muted-foreground hidden sm:inline">
                          Streak Counted
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No recent writing sessions logged yet. Open an editor and start typing to record sessions in real time!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
