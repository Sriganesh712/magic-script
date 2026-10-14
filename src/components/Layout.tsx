import { useState, useEffect, type ReactNode, type ElementType } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useTheme } from 'next-themes'
import { useOnlineStatus } from '@/hooks'
import { Button } from '@/components/ui/button'
import {
  FolderKanban,
  BarChart3,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
  Wifi,
  WifiOff,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  User as UserIcon,
  CheckCircle,
  Sparkles,
} from 'lucide-react'
import { getCurrentUser, onAuthStateChange, type User as SupabaseUser } from '@/lib/supabase'
import { cn } from 'cn'

export interface LayoutProps {
  children?: ReactNode
}

interface NavItem {
  label: string
  path: string
  icon: ElementType
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Projects', path: '/', icon: FolderKanban },
  { label: 'Dashboard', path: '/dashboard', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: SettingsIcon },
]

export function Layout({ children }: LayoutProps) {
  const { theme, setTheme } = useTheme()
  const { isOnline } = useOnlineStatus()
  const location = useLocation()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)

  // Fetch initial user and subscribe to auth changes
  useEffect(() => {
    setMounted(true)
    getCurrentUser().then(setCurrentUser).catch(() => {})
    const sub = onAuthStateChange((user) => {
      setCurrentUser(user)
    })
    return () => {
      sub?.data?.subscription?.unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsCollapsed((collapsed) => !collapsed)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const toggleTheme = () => {
    if (!mounted) return
    if (theme === 'dark') {
      setTheme('light')
    } else if (theme === 'light') {
      setTheme('system')
    } else {
      setTheme('dark')
    }
  }

  const getThemeIcon = () => {
    if (!mounted) return Sun
    if (theme === 'dark') return Moon
    if (theme === 'light') return Sun
    return Laptop
  }

  const ThemeIcon = getThemeIcon()

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20 selection:text-primary font-sans">
      {/* Desktop / Tablet Sidebar (Apple & Square Design Inspired) */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border/70 bg-card/90 backdrop-blur-xl transition-all duration-300 z-30 shrink-0 sticky top-0 h-screen',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Brand / Logo Area */}
        <div
          className={cn(
            'h-16 flex items-center border-b border-border/60',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'
          )}
        >
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="group flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#7E4A8E] to-[#5b3566] text-white font-bold text-xs shadow-xs hover:scale-105 transition-transform cursor-pointer relative"
              title="Expand sidebar (Click to open)"
              aria-label="Expand sidebar"
            >
              <span className="group-hover:hidden">SS</span>
              <PanelLeftOpen className="w-4 h-4 hidden group-hover:block text-white" />
            </button>
          ) : (
            <>
              <NavLink
                to="/"
                className="flex items-center gap-2.5 overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl py-1 px-1 -mx-1"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#7E4A8E] to-[#5b3566] text-white font-bold text-xs shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  SS
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm tracking-tight text-foreground truncate">
                    Screenplay Studio
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium tracking-wide truncate">
                    Professional Suite
                  </span>
                </div>
              </NavLink>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsCollapsed(true)}
                className="text-muted-foreground hover:text-foreground hidden lg:flex rounded-full w-7 h-7 p-0 cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* Quick Search Bar */}
        {!isCollapsed ? (
          <div className="px-3 pt-3">
            <button
              onClick={() => {
                if (location.pathname !== '/') navigate('/')
                setTimeout(() => {
                  const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
                  input?.focus()
                }, 50)
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground rounded-full bg-neutral-100/80 dark:bg-neutral-800/60 border border-border/70 hover:border-foreground/20 hover:text-foreground transition-all duration-200 cursor-pointer group shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 shrink-0 group-hover:text-primary transition-colors" />
              <span className="flex-1 text-left truncate">Search screenplays...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono font-medium rounded bg-background border border-border text-muted-foreground shadow-2xs">
                ⌘K
              </kbd>
            </button>
          </div>
        ) : (
          <div className="pt-3 flex justify-center">
            <button
              onClick={() => {
                setIsCollapsed(false)
                if (location.pathname !== '/') navigate('/')
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Search screenplays (⌘K)"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Progress / Status Bar (Matching Square/Apple design) */}
        {!isCollapsed && (
          <div className="px-3 pt-3">
            <div className="p-3 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/50 border border-border/70 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="text-foreground text-[11px] font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#7E4A8E] dark:text-[#9A6AA8]" />
                  Workspace Active
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">100%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#7E4A8E] to-[#9A6AA8] w-full transition-all duration-500" />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Section */}
        <div className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
          <div>
            {!isCollapsed ? (
              <div className="flex items-center px-2 pb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                  Pages
                </span>
                <div className="ml-2 h-px flex-1 bg-border/60" />
              </div>
            ) : (
              <div className="my-1.5 h-px w-6 mx-auto bg-border/60" />
            )}
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path)

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl text-xs font-medium transition-all duration-200 active:scale-[0.98]',
                      isCollapsed ? 'w-10 h-10 mx-auto justify-center p-0' : 'px-3 py-2',
                      isActive
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                    {item.badge && !isCollapsed && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[#eee7f0] dark:bg-[#272136] text-[#5b3566] dark:text-[#f2ecf4] font-semibold border border-[#7E4A8E]/20">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Sidebar Action & Profile Dock */}
        <div className="p-2.5 border-t border-border/70 space-y-2.5 bg-card">
          {/* Quick Action Pill Button */}
          {!isCollapsed ? (
            <Button
              onClick={() => navigate('/')}
              className="btn-sarvam-dark w-full text-xs h-9 gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Start Writing</span>
            </Button>
          ) : (
            <Button
              onClick={() => navigate('/')}
              size="icon-sm"
              className="btn-sarvam-dark w-10 h-10 mx-auto rounded-xl flex items-center justify-center cursor-pointer shadow-xs"
              title="Start Writing"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}

          {/* Quick Utility Row */}
          {!isCollapsed ? (
            <div className="flex items-center gap-1.5">
              {/* Online / Offline Status Pill */}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border flex-1',
                  isOnline
                    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                )}
                title={isOnline ? 'Online (Connected)' : 'Offline (Local-only mode)'}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  )}
                />
                <span className="truncate">{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              {/* Theme Toggle Button */}
              <Button
                variant="outline"
                size="xs"
                onClick={toggleTheme}
                className="rounded-full h-7 w-7 p-0 border-border/80 shrink-0 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                title={`Current theme: ${theme || 'system'}. Click to toggle.`}
              >
                <ThemeIcon className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={toggleTheme}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title={`Current theme: ${theme || 'system'}. Click to toggle.`}
              >
                <ThemeIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* User Profile Card */}
          {!isCollapsed ? (
            <NavLink
              to="/settings"
              title={
                currentUser
                  ? `Signed in as ${currentUser.email}. Click for Settings.`
                  : 'Local Workspace. Click to sign in.'
              }
              className="flex items-center gap-2.5 p-2 rounded-xl border border-border/70 bg-neutral-50/70 dark:bg-neutral-900/40 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/70 transition-colors cursor-pointer group shadow-2xs"
            >
              {currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.picture ? (
                <img
                  src={currentUser.user_metadata.avatar_url || currentUser.user_metadata.picture}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-primary/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7E4A8E] to-[#5b3566] text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-2xs">
                  {currentUser ? (
                    <span>{(currentUser.email?.[0] || 'U').toUpperCase()}</span>
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" />
                  )}
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {currentUser
                      ? currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]
                      : 'Screenwriter'}
                  </span>
                  {currentUser && (
                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground truncate">
                  {currentUser ? currentUser.email : 'Local Workspace'}
                </span>
              </div>
            </NavLink>
          ) : (
            <NavLink
              to="/settings"
              title={
                currentUser
                  ? `Signed in as ${currentUser.email}. Click for Settings.`
                  : 'Local Workspace. Click to sign in.'
              }
              className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors relative cursor-pointer"
            >
              {currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.picture ? (
                <img
                  src={currentUser.user_metadata.avatar_url || currentUser.user_metadata.picture}
                  alt="Avatar"
                  className="w-7 h-7 rounded-full object-cover border border-primary/20"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7E4A8E] to-[#5b3566] text-white flex items-center justify-center font-semibold text-[11px] shadow-2xs">
                  {currentUser ? (
                    <span>{(currentUser.email?.[0] || 'U').toUpperCase()}</span>
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" />
                  )}
                </div>
              )}
              <span
                className={cn(
                  'absolute bottom-1 right-1 w-2 h-2 rounded-full ring-2 ring-card',
                  isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                )}
              />
            </NavLink>
          )}
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-black/[0.06] dark:border-white/[0.08] bg-card/85 backdrop-blur-xl sticky top-0 z-40">
        <NavLink to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold text-xs">
            SS
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">
            Screenplay Studio
          </span>
        </NavLink>

        <div className="flex items-center gap-2">
          {/* Online badge */}
          <div
            className={cn(
              'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium',
              isOnline
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                : 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
            )}
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Theme button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={toggleTheme}
            className="w-8 h-8 p-0 rounded-full"
            aria-label="Toggle theme"
          >
            <ThemeIcon className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-y-auto">
        {/* Signature Announcement / Status Ticker Bar */}
        <div className="relative flex shrink-0 justify-center items-center border-b border-border/70 h-9 px-4 overflow-hidden bg-gradient-to-r from-background via-secondary/40 to-background">
          <div className="flex items-center gap-3 text-xs font-matter">
            <span className="px-2 py-0.5 border rounded-full font-semibold text-[11px] leading-none bg-background border-border text-[#7E4A8E] dark:text-[#9A6AA8] shadow-2xs">
              Live
            </span>
            <span className="text-muted-foreground text-[12px] font-medium tracking-wide truncate">
              Screenplay Studio v2.0 • Offline-first studio with real-time Google Drive & Supabase sync
            </span>
          </div>
        </div>

        {children || <Outlet />}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-xl border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-around h-14 px-2 safe-area-pb">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4 mb-0.5', isActive && 'text-primary')} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
