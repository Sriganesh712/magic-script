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

      const [projs, scrs, sessList, statsList, goalsList, allOps] = await Promise.all([
        db.projects.toArray(),
        db.screenplays.toArray(),
        db.writingSessions.orderBy('startTime').reverse().limit(100).toArray(),
        db.dailyStats.toArray(),
        db.writingGoals.toArray(),
        db.syncOperations.toArray(),
      ])

      setProjects(projs)
      setPendingSyncCount(allOps.length)

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
        (g.type === 'daily' && g.targetWords === 500 && !validProjectIds.has(g.projectId)) ||
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
      console.error('[DashboardPage] Analytics load error:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial load and real-time event listeners
  useEffect(() => {
    loadAnalyticsData(false)

    // 1. Listen for local events dispatched by Editor autosave or Drive exports
    const handleDataChanged = () => {
      loadAnalyticsData(true)
    }

    const handleCloudBackup = () => {
      loadAnalyticsData(true)
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'screenplay_studio_drive_auth' ||
        e.key === 'screenplay_studio_drive_files_cache' ||
        e.key === 'supabase_auth_token'
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

    // Real streak calculation (using pure calculateStreak logic)
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
        : '6:00 PM - 7:00 PM'

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
      peakHourIndex,
      maxHourWords,
      peakHourStr,
      avgPerSession,
      consistencyPercent,
      hourMap,
    }
  }, [filteredSessions, metrics])

  // Active Goals computation
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
            : 'Project Draft Milestone',
        current: metrics.totalWords,
        target: defaultProjectTarget,
        percent: Math.min(100, Math.round((metrics.totalWords / defaultProjectTarget) * 100)),
        isMet: metrics.totalWords >= defaultProjectTarget,
      },
    ]
  }, [goals, metrics, selectedProjectId, projectMap])

  // Compute smooth curve points for Square/Apple Area Chart (image.png style)
  const chartPoints = useMemo(() => {
    // 8 major time interval buckets: 12 AM, 3 AM, 6 AM, 9 AM, 12 PM, 3 PM, 6 PM, 9 PM
    const buckets = [
      { label: '12 AM', hours: [0, 1, 2] },
      { label: '3 AM', hours: [3, 4, 5] },
      { label: '6 AM', hours: [6, 7, 8] },
      { label: '9 AM', hours: [9, 10, 11] },
      { label: '12 PM', hours: [12, 13, 14] },
      { label: '3 PM', hours: [15, 16, 17] },
      { label: '6 PM', hours: [18, 19, 20] },
      { label: '9 PM', hours: [21, 22, 23] },
    ]

    const values = buckets.map((b) => {
      let sum = 0
      b.hours.forEach((h) => {
        sum += consistencyStats.hourMap[h] || 0
      })
      return sum
    })

    const maxVal = Math.max(...values, 10)
    const width = 800
    const height = 180
    const paddingX = 40
    const paddingY = 25
    const chartW = width - paddingX * 2
    const chartH = height - paddingY * 2

    const coords = values.map((val, idx) => {
      const x = paddingX + (idx / (values.length - 1)) * chartW
      const y = height - paddingY - (val / maxVal) * chartH
      return { x, y, val, label: buckets[idx].label }
    })

    // Construct smooth bezier curve path
    let pathD = `M ${coords[0].x} ${coords[0].y}`
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i]
      const p1 = coords[i + 1]
      const cpX = (p0.x + p1.x) / 2
      pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`
    }

    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`

    // Peak point
    let peakIndex = 0
    let peakValue = 0
    values.forEach((v, i) => {
      if (v > peakValue) {
        peakValue = v
        peakIndex = i
      }
    })
    const peakCoord = coords[peakIndex]

    return {
      width,
      height,
      coords,
      pathD,
      areaD,
      peakCoord,
      peakValue,
    }
  }, [consistencyStats])

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-pulse font-sans">
        <div className="h-8 bg-muted rounded-2xl w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted/40 rounded-2xl" />
          ))}
        </div>
        <div className="h-44 bg-muted/30 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 font-matter overflow-hidden">
      {/* Sarvam Signature Radiant Hero Glow (from image.png) */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 -z-10 w-[95%] max-w-5xl h-80 pointer-events-none opacity-35 dark:opacity-15 blur-[90px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, #FF8A34 0%, #FFA24C 25%, #C7D2FE 55%, transparent 75%)',
        }}
        aria-hidden="true"
      />

      {/* Decorative hairline motif */}
      <div className="flex flex-col items-center gap-2 max-w-md mx-auto pt-1">
        <div className="w-full h-px" style={{ background: 'radial-gradient(circle, #6a88e2 0%, transparent 100%)' }} />
        <p className="px-6 font-matter text-sr-indigo-900 dark:text-sr-indigo-300 text-xs sm:text-sm font-semibold tracking-wider uppercase">
          Real-Time Screenwriting Analytics
        </p>
        <div className="w-full h-px" style={{ background: 'radial-gradient(circle, #6a88e2 0%, transparent 100%)' }} />
      </div>

      {/* Top Header & Project Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-season-mix text-2xl sm:text-4xl font-medium text-tx tracking-tight">
              Writing Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-matter">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Realtime Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-tx-secondary mt-1 font-matter">
            Real-time tracking of cloud backups, writing output, streaks, and screenplay milestones.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[180px] sm:w-[200px] bg-white dark:bg-[#141728] rounded-full border-st text-xs h-9 font-matter shadow-2xs">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-st font-matter">
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
            className="btn-sarvam-light gap-1.5 h-9 px-3.5 text-xs cursor-pointer"
            title="Refresh cloud files and analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetAnalytics}
            className="rounded-full gap-1.5 text-xs text-tx-tertiary hover:text-destructive hover:bg-destructive/10 h-9 px-3 cursor-pointer"
            title="Clear demo writing history and reset to 0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Stats</span>
          </Button>
        </div>
      </div>

      {/* Realtime Cloud Saved Data & Synchronization Section */}
      <Card className="rounded-2xl border border-st bg-white/95 dark:bg-[#141728]/95 backdrop-blur-xl shadow-xs transition-all duration-350 ease-[cubic-bezier(0.2,0,0,1)]">
        <CardHeader className="pb-3 border-b border-st-secondary">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="font-season-mix text-lg font-medium text-tx flex items-center gap-2">
                <Cloud className="w-4 h-4 text-sr-indigo-600 dark:text-sr-indigo-400" />
                <span>Cloud Saved Data (Realtime)</span>
              </CardTitle>
              <CardDescription className="text-xs text-tx-tertiary font-matter">
                Active cloud backups in Google Drive and database sync state
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] text-tx-tertiary font-matter hidden sm:inline">
                Last checked: {lastRefreshedAt.toLocaleTimeString()}
              </span>
              <Button variant="ghost" size="xs" asChild className="gap-1 text-xs h-7 text-sr-indigo-600 hover:text-sr-indigo-700 dark:text-sr-indigo-400 rounded-full font-matter">
                <Link to="/settings">
                  <ExternalLink className="w-3 h-3" />
                  <span>Configure Cloud</span>
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Cloud Status Badges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Google Drive Status */}
            <div className="p-3.5 rounded-xl border border-border/70 bg-neutral-50/80 dark:bg-neutral-900/50 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[#7E4A8E] dark:text-[#9A6AA8]" />
                  Google Drive Backup
                </span>
                <Badge
                  variant={driveAuth.isConnected ? 'default' : 'outline'}
                  className={
                    driveAuth.isConnected
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] rounded-full'
                      : 'text-[10px] text-muted-foreground rounded-full'
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
            <div className="p-3.5 rounded-xl border border-border/70 bg-neutral-50/80 dark:bg-neutral-900/50 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                  Database Sync (Supabase)
                </span>
                <Badge
                  variant={supabaseUser ? 'default' : 'secondary'}
                  className={
                    supabaseUser
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] rounded-full'
                      : 'text-[10px] rounded-full'
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
            <div className="p-3.5 rounded-xl border border-border/70 bg-neutral-50/80 dark:bg-neutral-900/50 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#7E4A8E] dark:text-[#9A6AA8]" />
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
          <div className="border border-black/[0.05] dark:border-white/[0.06] rounded-xl overflow-hidden bg-card">
            <div className="bg-neutral-100/60 dark:bg-neutral-800/40 px-3.5 py-2 border-b border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-xs font-semibold">
              <span className="text-foreground">Uploaded Cloud Files ({filteredCloudFiles.length})</span>
              <span className="text-[11px] text-muted-foreground">Updated in Realtime</span>
            </div>

            {filteredCloudFiles.length > 0 ? (
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05] max-h-60 overflow-y-auto">
                {filteredCloudFiles.map((file) => {
                  const sizeKb = file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'N/A'
                  const uploadDate = file.modifiedTime || file.createdTime
                  const dateStr = uploadDate ? new Date(uploadDate).toLocaleString() : 'Recent'

                  return (
                    <div
                      key={file.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{file.name}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>{sizeKb}</span>
                            <span>•</span>
                            <span>{dateStr}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] font-semibold rounded-full">
                          {file.exportFormat || 'PDF'}
                        </Badge>
                        {file.webViewLink ? (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 px-3 py-1 rounded-full transition-colors"
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
                    ? 'When you export a PDF from any screenplay, it will automatically back up to Google Drive and appear here in real-time.'
                    : 'Connect Google Drive in Settings to view and manage your cloud backup files here.'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4 Stat Cards (Square / Apple Style with circular badges) */}
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

      {/* Main Analytics Line Chart (Square & Sarvam curve aesthetics) */}
      <Card className="rounded-2xl border border-st bg-white/95 dark:bg-[#141728]/95 backdrop-blur-xl shadow-xs overflow-hidden transition-all duration-350 ease-[cubic-bezier(0.2,0,0,1)]">
        <CardHeader className="pb-2 border-b border-st-secondary">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="font-season-mix text-lg font-medium text-tx flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sr-indigo-600 dark:text-sr-indigo-400" />
                <span>Writing Sprints & Output</span>
              </CardTitle>
              <CardDescription className="text-xs text-tx-tertiary font-matter">
                Intraday session output velocity and peak productivity timeline
              </CardDescription>
            </div>

            <div className="flex items-center gap-4 text-xs font-matter">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">▲</span>
                <span className="text-tx-tertiary font-medium">Net Output:</span>
                <span className="font-bold text-tx">
                  {metrics.todayWords > 0 ? metrics.todayWords : metrics.weeklyWords} words
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">▲</span>
                <span className="text-tx-tertiary font-medium">Sprints:</span>
                <span className="font-bold text-tx">
                  {filteredSessions.length}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2 pb-4">
          {/* Smooth SVG Curve Chart */}
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
              className="w-full h-48 sm:h-56 select-none"
            >
              <defs>
                <linearGradient id="sarvamChartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
                  <stop offset="60%" stopColor="#818cf8" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Guidelines */}
              <line
                x1="40"
                y1="35"
                x2="760"
                y2="35"
                className="stroke-black/[0.05] dark:stroke-white/[0.06]"
                strokeDasharray="4 4"
              />
              <line
                x1="40"
                y1="90"
                x2="760"
                y2="90"
                className="stroke-black/[0.05] dark:stroke-white/[0.06]"
                strokeDasharray="4 4"
              />
              <line
                x1="40"
                y1="155"
                x2="760"
                y2="155"
                className="stroke-black/[0.08] dark:stroke-white/[0.1]"
              />

              {/* Gradient Area under curve */}
              <path d={chartPoints.areaD} fill="url(#sarvamChartGradient)" />

              {/* Smooth Bezier Line */}
              <path
                d={chartPoints.pathD}
                fill="none"
                className="stroke-[#4f46e5] dark:stroke-[#818cf8]"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Peak Point Tooltip Indicator (Square style) */}
              {chartPoints.peakCoord && (
                <g>
                  {/* Vertical dashed line */}
                  <line
                    x1={chartPoints.peakCoord.x}
                    y1={chartPoints.peakCoord.y}
                    x2={chartPoints.peakCoord.x}
                    y2="155"
                    className="stroke-neutral-400 dark:stroke-neutral-600"
                    strokeDasharray="2 2"
                  />
                  {/* Outer circle */}
                  <circle
                    cx={chartPoints.peakCoord.x}
                    cy={chartPoints.peakCoord.y}
                    r="5"
                    className="fill-neutral-900 dark:fill-white"
                  />
                  {/* Tooltip text pill */}
                  <g transform={`translate(${chartPoints.peakCoord.x}, ${Math.max(25, chartPoints.peakCoord.y - 18)})`}>
                    <rect
                      x="-70"
                      y="-12"
                      width="140"
                      height="20"
                      rx="10"
                      className="fill-neutral-900 dark:fill-white"
                    />
                    <text
                      x="0"
                      y="2"
                      textAnchor="middle"
                      className="fill-white dark:fill-neutral-900 text-[10px] font-semibold"
                    >
                      {consistencyStats.peakHourStr.split('-')[0].trim()} • Peak Sprint
                    </text>
                  </g>
                </g>
              )}

              {/* X Axis Timeline Labels */}
              {chartPoints.coords.map((c, i) => (
                <text
                  key={i}
                  x={c.x}
                  y="172"
                  textAnchor="middle"
                  className="fill-neutral-400 dark:fill-neutral-500 text-[10px] font-medium"
                >
                  {c.label}
                </text>
              ))}
            </svg>
          </div>

          {/* Bottom Breakdown Table (like image.png Gross Sales / Net Sales) */}
          <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50/70 dark:bg-neutral-800/40">
              <span className="text-muted-foreground font-medium">Gross Words Added</span>
              <span className="font-bold text-foreground">
                {metrics.totalWords.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50/70 dark:bg-neutral-800/40">
              <span className="text-muted-foreground font-medium">Avg Output / Session</span>
              <span className="font-bold text-foreground">
                {consistencyStats.avgPerSession} words
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50/70 dark:bg-neutral-800/40">
              <span className="text-muted-foreground font-medium">Weekly Writing Consistency</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {consistencyStats.consistencyPercent}% Active
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Heatmap Component */}
      <div className="space-y-2">
        <CalendarHeatmap
          data={heatmapData}
          title="Writing Activity Calendar"
          className="rounded-2xl border border-st bg-white/95 dark:bg-[#141728]/95 shadow-xs font-matter"
        />
      </div>

      {/* Two Column Section: Goals & Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Goals Section */}
        <Card className="rounded-2xl border border-st bg-white/95 dark:bg-[#141728]/95 backdrop-blur-xl shadow-xs transition-all duration-350 ease-[cubic-bezier(0.2,0,0,1)]">
          <CardHeader className="pb-3 border-b border-st-secondary">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-season-mix text-lg font-medium text-tx flex items-center gap-2">
                  <Target className="w-4 h-4 text-sr-indigo-600 dark:text-sr-indigo-400" />
                  <span>Writing Goals</span>
                </CardTitle>
                <CardDescription className="text-xs text-tx-tertiary font-matter">
                  Active milestones and target word counts
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs rounded-full font-semibold font-matter bg-sf-secondary text-tx-secondary border border-st-secondary">
                {activeGoals.filter((g) => g.isMet).length} of {activeGoals.length} Met
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4 font-matter">
            {activeGoals.map((goal) => (
              <div
                key={goal.id}
                className="space-y-2 p-3.5 rounded-xl bg-sf-secondary/70 border border-st-secondary"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-tx flex items-center gap-1.5">
                    {goal.isMet ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Hourglass className="w-3.5 h-3.5 text-tx-tertiary shrink-0" />
                    )}
                    {goal.title}
                  </span>
                  <span className="font-medium text-tx-secondary">
                    <strong className="text-tx">{goal.current.toLocaleString()}</strong> /{' '}
                    {goal.target.toLocaleString()} words
                  </span>
                </div>

                {/* Dual-Tone Rounded Progress Bar */}
                <div className="w-full h-3 rounded-full bg-neutral-200/70 dark:bg-neutral-800 overflow-hidden p-0.5 border border-border/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7E4A8E] to-[#9A6AA8] transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                    style={{ width: `${Math.min(100, goal.percent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-tx-tertiary pt-0.5">
                  <span>{goal.percent}% completed</span>
                  {goal.isMet && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Target Achieved!
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Real Writing Consistency & Patterns */}
        <Card className="rounded-2xl border border-st bg-white/95 dark:bg-[#141728]/95 backdrop-blur-xl shadow-xs transition-all duration-350 ease-[cubic-bezier(0.2,0,0,1)]">
          <CardHeader className="pb-3 border-b border-st-secondary">
            <CardTitle className="font-season-mix text-lg font-medium text-tx flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sr-indigo-600 dark:text-sr-indigo-400" />
              <span>Writing Patterns & Consistency</span>
            </CardTitle>
            <CardDescription className="text-xs text-tx-tertiary font-matter">
              Real output breakdown by day of week and peak productivity
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {/* Visual Consistency Bar Representation */}
            <div className="space-y-2 p-3.5 rounded-xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-black/[0.04] dark:border-white/[0.05]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Weekly Writing Consistency</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {consistencyStats.consistencyPercent}% Active
                </span>
              </div>

              {/* Day of week mini bar chart with real calculated data */}
              <div className="grid grid-cols-7 gap-2 pt-2 items-end h-24">
                {consistencyStats.days.map((col) => {
                  const barHeight =
                    col.words > 0
                      ? `${Math.max(16, Math.round((col.words / consistencyStats.maxWords) * 100))}%`
                      : '4px'

                  return (
                    <div key={col.day} className="flex flex-col items-center gap-1.5 h-full justify-end">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          col.words > 0 ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-700'
                        }`}
                        style={{ height: barHeight }}
                        title={`${col.words} words written on ${col.day}`}
                      />
                      <span className="text-[10px] text-muted-foreground font-semibold">{col.day}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick stats summary cards */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-black/[0.05] dark:border-white/[0.06] bg-card">
                <div className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Peak Writing Hour</span>
                </div>
                <div className="mt-1 font-bold text-foreground text-sm truncate">
                  {consistencyStats.peakHourStr}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-black/[0.05] dark:border-white/[0.06] bg-card">
                <div className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Layers className="w-3.5 h-3.5 text-primary" />
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
      <Card className="rounded-2xl border border-st bg-white/95 dark:bg-[#141728]/95 backdrop-blur-xl shadow-xs transition-all duration-350 ease-[cubic-bezier(0.2,0,0,1)] font-matter">
        <CardHeader className="pb-3 border-b border-st-secondary">
          <CardTitle className="font-season-mix text-lg font-medium text-tx flex items-center gap-2">
            <Clock className="w-4 h-4 text-sr-indigo-600 dark:text-sr-indigo-400" />
            <span>Recent Writing Sessions</span>
          </CardTitle>
          <CardDescription className="text-xs text-tx-tertiary font-matter">
            Log of recent writing sprints and element updates
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          {filteredSessions.length > 0 ? (
            <div className="divide-y divide-st-secondary">
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
                    className="py-3.5 flex items-center justify-between gap-4 text-xs hover:bg-sf-secondary/50 rounded-xl px-2 transition-colors duration-200"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-tx truncate">{projName}</p>
                      <p className="text-[11px] text-tx-tertiary mt-0.5">
                        {sessionDate} at {sessionTime}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs">
                        +{session.netWords || session.wordsAdded} words
                      </span>
                      {session.countsForStreak && (
                        <span className="text-[11px] text-tx-tertiary hidden sm:inline">
                          Streak Counted
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-tx-tertiary text-xs">
              No recent writing sessions logged yet. Open an editor and start typing to record sessions in real time!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
