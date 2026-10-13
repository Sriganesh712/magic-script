import { useState, useEffect, type ChangeEvent } from 'react'
import { useTheme } from 'next-themes'
import {
  exportAllData,
  importAllData,
  clearAllData,
  getDBSize,
  DEFAULT_PAGE_FORMAT,
  type PageFormatSettings,
} from '@/lib'
import {
  getCurrentUser,
  signInWithGoogle,
  signInWithEmail,
  signOut,
  deleteAccount,
  getSupabaseClient,
  onAuthStateChange,
  type User,
} from '@/lib/supabase'
import { processSyncQueue } from '@/lib/sync'
import {
  getDriveAuthState,
  requestGoogleDriveAccess,
  disconnectGoogleDrive,
  getResolvedGoogleClientId,
  saveCustomGoogleClientId,
  type DriveAuthState,
} from '@/lib/drive'
import {
  getGroqApiKey,
  setGroqApiKey,
  getAiBudget,
  type AiUsageBudget,
} from '@/lib/ai'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sun,
  Moon,
  Laptop,
  Download,
  Upload,
  Trash2,
  HardDrive,
  FileText,
  Clock,
  ShieldAlert,
  Info,
  Check,
  Cloud,
  RefreshCw,
  LogOut,
  FolderSync,
  Bot,
  Key,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

const SETTINGS_STORAGE_KEY = 'screenplay_studio_global_settings'

interface AppSettings {
  pageFormat: PageFormatSettings
  autoSaveInterval: number // ms
}

const DEFAULT_SETTINGS: AppSettings = {
  pageFormat: DEFAULT_PAGE_FORMAT,
  autoSaveInterval: 2000,
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const [dbStorage, setDbStorage] = useState<{ used: number; quota: number }>({ used: 0, quota: 0 })
  const [isSavedNotice, setIsSavedNotice] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isClearOpen, setIsClearOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  // Cloud & Sync state (SYNC-001, SYNC-004, SYNC-007)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null)
  const isSupabaseConfigured = Boolean(getSupabaseClient())

  // Google Drive state (DRV-001, DRV-005)
  const [driveAuth, setDriveAuth] = useState<DriveAuthState>(getDriveAuthState())
  const [driveClientId, setDriveClientId] = useState(getResolvedGoogleClientId())
  const [isDriveConnecting, setIsDriveConnecting] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)

  // Groq AI state (AI-006, AI-007)
  const [groqKeyInput, setGroqKeyInput] = useState(getGroqApiKey() || '')
  const [aiBudget, setAiBudget] = useState<AiUsageBudget>(getAiBudget())
  const [isKeySaved, setIsKeySaved] = useState(false)

  useEffect(() => {
    setMounted(true)
    getDBSize().then((res) => setDbStorage(res)).catch(() => {})
    getCurrentUser().then(setCurrentUser).catch(() => {})
    const sub = onAuthStateChange((user) => {
      setCurrentUser(user)
    })
    setDriveAuth(getDriveAuthState())
    setDriveClientId(getResolvedGoogleClientId())
    setAiBudget(getAiBudget())
    return () => {
      sub?.data?.subscription?.unsubscribe?.()
    }
  }, [])

  const saveSettings = (updated: AppSettings) => {
    setSettings(updated)
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
    setIsSavedNotice(true)
    setTimeout(() => setIsSavedNotice(false), 2500)
  }

  // Handle Export All Data
  const handleExportAll = async () => {
    try {
      setIsExporting(true)
      const dataStr = await exportAllData()
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `screenplay-studio-full-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export all data error:', err)
      alert('Failed to export data: ' + (err as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  // Handle Import All Data
  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string
        await importAllData(json)
        alert('Data imported successfully! The page will now reload.')
        window.location.reload()
      } catch (err) {
        console.error('Import error:', err)
        alert('Failed to import backup: ' + (err as Error).message)
      } finally {
        setIsImporting(false)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Handle Clear All Data
  const handleClearAll = async () => {
    try {
      setIsClearing(true)
      await clearAllData()
      localStorage.clear()
      setIsClearOpen(false)
      alert('All local database records have been cleared.')
      window.location.href = '/'
    } catch (err) {
      console.error('Clear error:', err)
      alert('Failed to clear data: ' + (err as Error).message)
    } finally {
      setIsClearing(false)
    }
  }

  // Supabase Auth Handlers
  const handleSignInEmail = async () => {
    if (!authEmail.trim()) return
    const { error } = await signInWithEmail(authEmail)
    if (error) {
      alert(`Sign in error: ${error.message}`)
    } else {
      alert(`Magic sign-in link sent to ${authEmail}! Please check your email.`)
      setAuthEmail('')
    }
  }

  const handleSignInGoogle = async () => {
    const { error } = await signInWithGoogle()
    if (error) {
      alert(`Google sign in error: ${error.message}`)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setCurrentUser(null)
  }

  const handleDeleteAccount = async () => {
    if (confirm('Permanently delete your cloud account and all synced remote screenplays?')) {
      const { error } = await deleteAccount()
      if (error) {
        alert('Delete account error: ' + error.message)
      } else {
        alert('Account deleted successfully.')
        setCurrentUser(null)
      }
    }
  }

  const handleSyncNow = async () => {
    try {
      setIsSyncing(true)
      setSyncStatusMsg('Syncing changes to cloud...')
      const res = await processSyncQueue()
      if (res.conflicts.length > 0) {
        setSyncStatusMsg(`Sync completed with ${res.conflicts.length} conflict(s).`)
      } else {
        setSyncStatusMsg(`All local changes successfully synced! (${res.processedCount} items processed)`)
      }
      setTimeout(() => setSyncStatusMsg(null), 4000)
    } catch (err) {
      setSyncStatusMsg(`Sync error: ${(err as Error).message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // Google Drive Connect / Disconnect
  const handleConnectDrive = async () => {
    try {
      setIsDriveConnecting(true)
      setDriveError(null)
      saveCustomGoogleClientId(driveClientId)
      const res = await requestGoogleDriveAccess(driveClientId)
      if (res.success) {
        setDriveAuth(getDriveAuthState())
        setDriveError(null)
      } else {
        setDriveError(res.error || 'Failed to connect Google Drive.')
      }
    } catch (err) {
      setDriveError((err as Error).message)
    } finally {
      setIsDriveConnecting(false)
    }
  }

  const handleDisconnectDrive = () => {
    disconnectGoogleDrive()
    setDriveAuth(getDriveAuthState())
    setDriveError(null)
  }

  // Save Groq Key
  const handleSaveGroqKey = () => {
    setGroqApiKey(groqKeyInput)
    setIsKeySaved(true)
    setTimeout(() => setIsKeySaved(false), 2500)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="relative p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-8 font-matter overflow-hidden">
      {/* Sarvam Signature Radiant Hero Glow */}
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
          Studio Preferences & Configurations
        </p>
        <div className="w-full h-px" style={{ background: 'radial-gradient(circle, #6a88e2 0%, transparent 100%)' }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-season-mix text-2xl sm:text-4xl font-medium text-tx tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-tx-secondary mt-1 font-matter">
            Configure formatting defaults, autosave preferences, backups, and cloud integrations.
          </p>
        </div>

        {isSavedNotice && (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 gap-1.5 py-1 px-2.5 rounded-full font-matter">
            <Check className="w-3.5 h-3.5" />
            <span>Preferences Saved</span>
          </Badge>
        )}
      </div>

      <div className="space-y-6">
        {/* 1. Page Format & Script Standards */}
        <Card className="rounded-2xl border border-st bg-white/95 dark:bg-[#141728]/95 backdrop-blur-xl shadow-xs overflow-hidden transition-all duration-350 ease-[cubic-bezier(0.2,0,0,1)] font-matter">
          <CardHeader className="border-b border-st-secondary pb-3">
            <CardTitle className="font-season-mix text-lg font-medium text-tx flex items-center gap-2">
              <FileText className="w-4 h-4 text-sr-indigo-600 dark:text-sr-indigo-400" />
              <span>Screenplay Format & Pagination</span>
            </CardTitle>
            <CardDescription className="text-xs text-tx-tertiary font-matter">
              Industry standard screenplay margins, typography, and page sizes.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Paper Size</label>
                <Select
                  value={settings.pageFormat.paperSize}
                  onValueChange={(val: 'US_LETTER' | 'A4') =>
                    saveSettings({
                      ...settings,
                      pageFormat: { ...settings.pageFormat, paperSize: val },
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Paper Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US_LETTER">US Letter (8.5 × 11 in) - Standard</SelectItem>
                    <SelectItem value="A4">A4 (210 × 297 mm) - International</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Typeface</label>
                <Select
                  value={settings.pageFormat.fontFamily}
                  onValueChange={(val: string) =>
                    saveSettings({
                      ...settings,
                      pageFormat: { ...settings.pageFormat, fontFamily: val },
                    })
                  }
                >
                  <SelectTrigger className="w-full font-mono text-xs">
                    <SelectValue placeholder="Font Family" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Courier Prime, Courier New, Courier, monospace">
                      Courier Prime (Recommended)
                    </SelectItem>
                    <SelectItem value="Courier New, Courier, monospace">
                      Courier New
                    </SelectItem>
                    <SelectItem value="monospace">Standard Monospace</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Standard Margins (Inches) */}
            <div className="pt-2">
              <label className="text-xs font-semibold text-foreground block mb-2">
                Standard Margins (Inches)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Left (Gutter)</span>
                  <Input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="2.0"
                    value={settings.pageFormat.margins.left}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        pageFormat: {
                          ...settings.pageFormat,
                          margins: {
                            ...settings.pageFormat.margins,
                            left: parseFloat(e.target.value) || 1.5,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Right</span>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="1.5"
                    value={settings.pageFormat.margins.right}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        pageFormat: {
                          ...settings.pageFormat,
                          margins: {
                            ...settings.pageFormat.margins,
                            right: parseFloat(e.target.value) || 1.0,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Top</span>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="1.5"
                    value={settings.pageFormat.margins.top}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        pageFormat: {
                          ...settings.pageFormat,
                          margins: {
                            ...settings.pageFormat.margins,
                            top: parseFloat(e.target.value) || 1.0,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Bottom</span>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="1.5"
                    value={settings.pageFormat.margins.bottom}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        pageFormat: {
                          ...settings.pageFormat,
                          margins: {
                            ...settings.pageFormat.margins,
                            bottom: parseFloat(e.target.value) || 1.0,
                          },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Autosave & Local Persistence */}
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card shadow-xs overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Autosave & Local Persistence</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Automatic debouncing delays and offline recovery safeguards.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="text-xs font-semibold text-foreground block">
                  Autosave Delay (Debounce)
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Time of inactivity before automatically saving edits to IndexedDB.
                </p>
              </div>

              <Select
                value={String(settings.autoSaveInterval)}
                onValueChange={(val: string) =>
                  saveSettings({ ...settings, autoSaveInterval: parseInt(val, 10) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1 second (Aggressive)</SelectItem>
                  <SelectItem value="2000">2 seconds (Recommended)</SelectItem>
                  <SelectItem value="5000">5 seconds (Relaxed)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 3. Appearance */}
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card shadow-xs overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sun className="w-4 h-4 text-primary" />
              <span>Appearance</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Customize the editor theme and lighting.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {mounted && (
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="gap-2 text-xs"
                >
                  <Sun className="w-4 h-4" />
                  <span>Light</span>
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="gap-2 text-xs"
                >
                  <Moon className="w-4 h-4" />
                  <span>Dark</span>
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('system')}
                  className="gap-2 text-xs"
                >
                  <Laptop className="w-4 h-4" />
                  <span>System</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Cloud Account & Supabase Sync (SYNC-001, SYNC-004, SYNC-007) */}
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card shadow-xs overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-primary" />
                <span>Cloud Account & Sync (Supabase)</span>
              </div>
              <Badge
                variant={isSupabaseConfigured ? (currentUser ? 'default' : 'secondary') : 'outline'}
                className="text-[10px] font-mono"
              >
                {isSupabaseConfigured ? (currentUser ? 'Connected & Synced' : 'Configured') : 'Local-Only Mode'}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Optional cloud synchronization. Screenplay Studio is 100% functional without an account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {currentUser ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    {currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture ? (
                      <img
                        src={currentUser.user_metadata.avatar_url || currentUser.user_metadata.picture}
                        alt="User"
                        className="w-10 h-10 rounded-full object-cover border border-primary/20 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {(currentUser.email?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {currentUser.user_metadata?.full_name || currentUser.email}
                        </span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          {currentUser.app_metadata?.provider === 'google' ? 'Google' : 'Cloud'}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {currentUser.email}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 font-mono block truncate">
                        User ID: {currentUser.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={handleSyncNow}
                      disabled={isSyncing}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sync Now</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleSignOut}
                      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </Button>
                  </div>
                </div>

                {syncStatusMsg && (
                  <p className="text-xs text-primary font-medium">{syncStatusMsg}</p>
                )}

                <div className="pt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleDeleteAccount}
                    className="text-[11px] text-destructive hover:bg-destructive/10"
                  >
                    Delete Cloud Account & Sync Data
                  </Button>
                </div>
              </div>
            ) : isSupabaseConfigured ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Sign in with Google or Email to seamlessly backup and sync your screenplays across devices.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSignInGoogle}
                    className="gap-2 text-xs font-medium"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    <span>Sign in with Google</span>
                  </Button>

                  <div className="flex-1 flex gap-2">
                    <Input
                      placeholder="name@example.com"
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="text-xs h-9"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSignInEmail}
                      disabled={!authEmail.trim()}
                      className="text-xs shrink-0 h-9"
                    >
                      Send Magic Link
                    </Button>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground/80 space-y-1 pt-1">
                  <p>
                    OAuth redirect route: <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">http://localhost:5173/auth/callback</code>
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground">
                <p>
                  No Supabase credentials detected in environment (<code className="font-mono">VITE_SUPABASE_URL</code>).
                </p>
                <p className="mt-1">
                  All work is safely stored in your browser&apos;s IndexedDB database. You can export JSON backups at any time.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Google Drive Integration (DRV-001, DRV-005) */}
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card shadow-xs overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-primary" />
                <span>Google Drive Backups (drive.file scope)</span>
              </div>
              <Badge
                variant={driveAuth.isConnected ? 'default' : 'outline'}
                className="text-[10px] font-mono"
              >
                {driveAuth.isConnected ? 'Connected & Active' : 'Disconnected'}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Automated exports directly to your own Google Drive. Only accesses files created by this app.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {driveAuth.isConnected ? (
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/30">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Target Folder: &quot;Screenplay Studio&quot;
                    </span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="w-3 h-3 mr-1 inline" />
                      Active
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    Connected with restricted <code className="font-mono text-[10px]">drive.file</code> scope.
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleDisconnectDrive}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Disconnect Drive
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Connect your Google Drive to upload PDF, Fountain, and FDX backups directly to your private &quot;Screenplay Studio&quot; folder.
                </p>

                {driveError && (
                  <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Google Drive Connection Notice</span>
                    </div>
                    <p className="text-[11px] font-mono break-words">{driveError}</p>
                    <div className="text-[11px] text-foreground/80 space-y-1.5 pt-1">
                      <p className="font-medium text-foreground">Setup Checklist in Google Cloud Console:</p>
                      <ul className="list-disc pl-4 space-y-1 text-[10px]">
                        <li>
                          <strong>Fix Error 403 (access_denied)</strong>: Go to <strong>APIs & Services &gt; OAuth consent screen</strong> &gt; scroll to <strong>Test users</strong> &gt; click <strong>+ ADD USERS</strong> &gt; enter your email (<code className="font-mono bg-muted px-1">sriganeshravi9095@gmail.com</code>) &gt; click <strong>SAVE</strong>.
                        </li>
                        <li>In <strong>APIs & Services &gt; Credentials &gt; OAuth 2.0 Web Client</strong>:</li>
                        <li>Add <strong>Authorized JavaScript origins</strong>: <code className="font-mono bg-muted px-1">http://localhost:5173</code> and <code className="font-mono bg-muted px-1">http://localhost</code></li>
                        <li>In <strong>APIs & Services &gt; Library</strong>: Ensure <strong>Google Drive API</strong> is enabled.</li>
                      </ul>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Google Client ID</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                      value={driveClientId}
                      onChange={(e) => {
                        setDriveClientId(e.target.value)
                        saveCustomGoogleClientId(e.target.value)
                      }}
                      className="text-xs h-9 font-mono"
                    />
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleConnectDrive}
                      disabled={isDriveConnecting || !driveClientId.trim()}
                      className="text-xs shrink-0 h-9 gap-1.5"
                    >
                      {isDriveConnecting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isDriveConnecting ? 'Connecting...' : 'Connect Google Drive'}</span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Populated automatically from <code className="font-mono text-[10px]">VITE_GOOGLE_CLIENT_ID</code> or <code className="font-mono text-[10px]">GOOGLE_DRIVE_CLIENT_ID</code>.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. Groq AI Script Doctor (AI-006, AI-007) */}
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card shadow-xs overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <span>AI Script Doctor (Groq Gateway)</span>
              </div>
              <Badge
                variant={groqKeyInput ? 'secondary' : 'outline'}
                className="text-[10px] font-mono"
              >
                {groqKeyInput ? 'Key Configured' : 'Optional'}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Optional AI dialogue punch-up, scene feedback, and continuity checks. Strictly requires explicit user clicks.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Groq API Key (gsk_...)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={groqKeyInput}
                  onChange={(e) => setGroqKeyInput(e.target.value)}
                  className="text-xs font-mono h-8 flex-1"
                />
                <Button size="xs" onClick={handleSaveGroqKey} className="h-8 text-xs shrink-0">
                  {isKeySaved ? 'Saved!' : 'Save Key'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your key is stored strictly on this device and never shared. Leave blank to disable AI assistance.
              </p>
            </div>

            {groqKeyInput && (
              <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Tokens used today:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {aiBudget.tokensUsedToday.toLocaleString()} / {aiBudget.maxDailyTokens.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Estimated cost:</span>
                  <span className="font-mono text-foreground font-semibold">
                    ${aiBudget.estimatedCostUsd.toFixed(4)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7. Data & Storage Backups */}
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card shadow-xs overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              <span>Workspace Data & JSON Backups</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Download complete database backups or restore an existing archive.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Full Workspace Backup</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Contains all screenplays, drafts, scene cards, characters, and daily statistics.
                </p>
                {dbStorage.used > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Estimated storage usage: {formatBytes(dbStorage.used)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAll}
                  disabled={isExporting}
                  className="gap-1.5 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Exporting...' : 'Export Backup'}</span>
                </Button>

                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                  id="settings-import-file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('settings-import-file')?.click()}
                  disabled={isImporting}
                  className="gap-1.5 text-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isImporting ? 'Importing...' : 'Import Data'}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 8. About Screenplay Studio */}
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card shadow-xs overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              <span>About Screenplay Studio</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Application version and architecture overview.
            </CardDescription>
          </CardHeader>

          <CardContent className="text-xs text-muted-foreground space-y-2">
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="font-medium text-foreground">Version</span>
              <span className="font-mono text-foreground font-semibold">v1.0.0 (Production Suite)</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="font-medium text-foreground">Stack</span>
              <span>React 19, TypeScript, Vite, Tailwind CSS v4</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="font-medium text-foreground">Editor Engine</span>
              <span>Tiptap & ProseMirror Screenplay Nodes</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="font-medium text-foreground">Storage Model</span>
              <span>Local-First Offline IndexedDB (Dexie.js)</span>
            </div>
          </CardContent>
        </Card>

        {/* 9. Danger Zone */}
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-xs overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Danger Zone</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Actions here are irreversible. Please ensure you have exported a backup first.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Wipe All Local Data</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Permanently purge all screenplays, revision histories, drafts, and analytics from this browser.
              </p>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsClearOpen(true)}
              className="gap-1.5 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Data</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Clear Confirmation Dialog */}
      <Dialog open={isClearOpen} onOpenChange={setIsClearOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>Wipe Entire Database?</span>
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All screenplay projects, drafts, writing sessions, and
              settings stored in this browser will be completely erased.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsClearOpen(false)}
              disabled={isClearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={isClearing}
            >
              {isClearing ? 'Clearing...' : 'Yes, Delete Everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
