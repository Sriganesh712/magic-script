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

  useEffect(() => {
    setMounted(true)
    getDBSize().then((res) => setDbStorage(res)).catch(() => {})
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure formatting defaults, autosave preferences, backups, and appearance.
          </p>
        </div>

        {isSavedNotice && (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 gap-1.5 py-1 px-2.5">
            <Check className="w-3.5 h-3.5" />
            <span>Preferences Saved</span>
          </Badge>
        )}
      </div>

      <div className="space-y-6">
        {/* 1. Page Format & Script Standards */}
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>Screenplay Format & Pagination</span>
            </CardTitle>
            <CardDescription className="text-xs">
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
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Right</span>
                  <Input
                    type="number"
                    step="0.1"
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
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Top</span>
                  <Input
                    type="number"
                    step="0.1"
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
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Bottom</span>
                  <Input
                    type="number"
                    step="0.1"
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
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Autosave & Performance */}
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Autosave & Persistence</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Adjust how frequently your work is automatically synchronized to IndexedDB.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Autosave Delay</label>
                <Select
                  value={String(settings.autoSaveInterval)}
                  onValueChange={(val: string) =>
                    saveSettings({
                      ...settings,
                      autoSaveInterval: parseInt(val, 10),
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Autosave Delay" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">1 second (High responsiveness)</SelectItem>
                    <SelectItem value="2000">2 seconds (Standard)</SelectItem>
                    <SelectItem value="5000">5 seconds (Low CPU)</SelectItem>
                    <SelectItem value="10000">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Storage Engine</label>
                <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
                  <HardDrive className="w-3.5 h-3.5 text-primary" />
                  <span>IndexedDB (Dexie 4.x Local Storage)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Theme & Appearance */}
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sun className="w-4 h-4 text-primary" />
              <span>Appearance & Theme</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Switch between light mode, dark mode, or system preferences.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all ${
                  mounted && theme === 'light'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border/80 bg-card hover:bg-muted/60 text-muted-foreground'
                }`}
              >
                <Sun className="w-5 h-5" />
                <span className="text-xs">Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all ${
                  mounted && theme === 'dark'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border/80 bg-card hover:bg-muted/60 text-muted-foreground'
                }`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs">Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all ${
                  mounted && theme === 'system'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border/80 bg-card hover:bg-muted/60 text-muted-foreground'
                }`}
              >
                <Laptop className="w-5 h-5" />
                <span className="text-xs">System</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 4. Backup, Export & Import */}
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span>Backup & Data Migration</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Export all scripts and writing analytics into a single JSON file for safe offline keeping.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/60">
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

        {/* 5. About Screenplay Studio */}
        <Card className="border-border/80 bg-card">
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

        {/* 6. Danger Zone */}
        <Card className="border-destructive/40 bg-destructive/5">
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
