import { useState, useEffect, type ReactNode, type ElementType } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
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
  Clapperboard,
  User as UserIcon,
  CheckCircle,
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
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20 selection:text-primary">
      {/* Desktop / Tablet Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-card/60 backdrop-blur-md transition-all duration-300 z-30 shrink-0 sticky top-0 h-screen',
          isCollapsed ? 'w-18' : 'w-64'
        )}
      >
        {/* Brand / Logo Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <NavLink
            to="/"
            className="flex items-center gap-3 overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-1 px-1.5 -mx-1.5"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
              <Clapperboard className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm tracking-tight text-foreground truncate">
                  Screenplay Studio
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                  Professional Suite
                </span>
              </div>
            )}
          </NavLink>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-muted-foreground hover:text-foreground hidden lg:flex"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
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
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <Icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {item.badge && !isCollapsed && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom Status & User Profile Area */}
        <div className="p-3 border-t border-border space-y-3 bg-muted/20">
          {/* Online / Offline Status */}
          <div
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium',
              isCollapsed && 'justify-center',
              isOnline
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                : 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
            )}
            title={isOnline ? 'Online (Connected)' : 'Offline (Local-only mode)'}
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            )}
            {!isCollapsed && (
              <span className="truncate">
                {isOnline ? 'Online' : 'Offline Mode'}
              </span>
            )}
          </div>

          {/* Theme Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className={cn('w-full flex items-center justify-start gap-2.5 text-xs', isCollapsed && 'justify-center px-0')}
            title={`Current theme: ${theme || 'system'}. Click to toggle.`}
          >
            <ThemeIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
            {!isCollapsed && (
              <span className="capitalize text-muted-foreground">
                Theme: <strong className="text-foreground">{mounted ? theme : 'System'}</strong>
              </span>
            )}
          </Button>

          {/* User Profile Card (Dynamic with Supabase Auth) */}
          <NavLink
            to="/settings"
            title={currentUser ? `Signed in as ${currentUser.email}. Click for Settings.` : 'Local Workspace. Click to sign in.'}
            className={cn(
              'flex items-center gap-2.5 p-1.5 rounded-lg border border-border/60 bg-card hover:bg-muted/50 transition-colors cursor-pointer group',
              isCollapsed && 'justify-center p-1'
            )}
          >
            {currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.picture ? (
              <img
                src={currentUser.user_metadata.avatar_url || currentUser.user_metadata.picture}
                alt="Avatar"
                className="w-7 h-7 rounded-full object-cover shrink-0 border border-primary/20"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                {currentUser ? (
                  <span>{(currentUser.email?.[0] || 'U').toUpperCase()}</span>
                ) : (
                  <UserIcon className="w-3.5 h-3.5" />
                )}
              </div>
            )}
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-foreground truncate">
                    {currentUser
                      ? currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]
                      : 'Guest Writer'}
                  </span>
                  {currentUser && (
                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground truncate">
                  {currentUser ? currentUser.email : 'Local Workspace (Click to sync)'}
                </span>
              </div>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <NavLink to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground">
            <Clapperboard className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">
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
            className="w-8 h-8 p-0"
            aria-label="Toggle theme"
          >
            <ThemeIcon className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-y-auto">
        {children || <Outlet />}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-lg border-t border-border flex items-center justify-around h-14 px-2 safe-area-pb">
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
