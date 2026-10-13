import { Link, Routes, Route, BrowserRouter } from 'react-router'
import { Layout } from '@/components/Layout'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { EditorPage } from '@/pages/EditorPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { Button } from '@/components/ui/button'
import { Clapperboard, ArrowLeft } from 'lucide-react'

/**
 * 404 Not Found Page Component
 */
export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
        <Clapperboard className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        Scene Not Found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        FADE IN on a blank screen. The scene you are looking for has been cut from the final draft.
      </p>
      <div className="mt-6">
        <Button asChild className="gap-2">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Projects</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * Main Application Router Component
 * Configures all application routes with Layout wrapper
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main application pages wrapped in the sidebar/bottom-nav Layout */}
        <Route
          path="/"
          element={
            <Layout>
              <ProjectsPage />
            </Layout>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Layout>
              <DashboardPage />
            </Layout>
          }
        />
        <Route
          path="/settings"
          element={
            <Layout>
              <SettingsPage />
            </Layout>
          }
        />

        {/* OAuth Authentication Callback */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Dedicated distraction-free Screenplay Editor */}
        <Route path="/project/:projectId" element={<EditorPage />} />

        {/* 404 Fallback Catch-All */}
        <Route
          path="*"
          element={
            <Layout>
              <NotFoundPage />
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export * from 'react-router'
