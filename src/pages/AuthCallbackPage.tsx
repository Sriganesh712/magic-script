import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router'
import { exchangeCodeForSession, getCurrentUser, getSupabaseClient } from '@/lib/supabase'
import { Clapperboard, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function handleAuth() {
      // 1. Check for explicit error query parameters from Supabase / Google OAuth
      const errorParam = searchParams.get('error') || searchParams.get('error_code')
      const errorDesc = searchParams.get('error_description')

      if (errorParam || errorDesc) {
        if (isMounted) {
          setStatus('error')
          setErrorMessage(errorDesc || errorParam || 'Authentication failed.')
        }
        return
      }

      // 2. Check for PKCE authorization code in query string
      const code = searchParams.get('code')
      if (code) {
        try {
          const { data, error } = await exchangeCodeForSession(code)
          if (error) {
            console.error('[Auth Callback] Error exchanging code for session:', error)
            // Fallback: check if session was auto-detected anyway
            const currentUser = await getCurrentUser()
            if (currentUser) {
              if (isMounted) {
                setUserEmail(currentUser.email || null)
                setStatus('success')
                setTimeout(() => navigate('/settings'), 1200)
              }
              return
            }
            if (isMounted) {
              setStatus('error')
              setErrorMessage(error.message)
            }
            return
          }

          if (isMounted) {
            setUserEmail(data?.user?.email || null)
            setStatus('success')
            setTimeout(() => navigate('/settings'), 1200)
          }
          return
        } catch (err) {
          console.error('[Auth Callback] Unexpected error during code exchange:', err)
          if (isMounted) {
            setStatus('error')
            setErrorMessage((err as Error).message)
          }
          return
        }
      }

      // 3. Check for implicit grant or existing session
      const client = getSupabaseClient()
      if (client) {
        const { data: { session } } = await client.auth.getSession()
        if (session?.user) {
          if (isMounted) {
            setUserEmail(session.user.email || null)
            setStatus('success')
            setTimeout(() => navigate('/settings'), 1200)
          }
          return
        }
      }

      // Fallback: wait a moment for Supabase client auto-detection from hash
      setTimeout(async () => {
        if (!isMounted) return
        const user = await getCurrentUser()
        if (user) {
          setUserEmail(user.email || null)
          setStatus('success')
          setTimeout(() => navigate('/settings'), 1200)
        } else {
          setStatus('error')
          setErrorMessage('No authentication code or active session was detected in the URL callback.')
        }
      }, 1000)
    }

    handleAuth()

    return () => {
      isMounted = false
    }
  }, [searchParams, navigate])

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-12">
      <Card className="w-full max-w-md border-border/80 shadow-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <Clapperboard className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            {status === 'loading' && 'Authenticating...'}
            {status === 'success' && 'Sign In Complete!'}
            {status === 'error' && 'Authentication Error'}
          </CardTitle>
          <CardDescription className="text-xs">
            {status === 'loading' && 'Finalizing your Screenplay Studio cloud session...'}
            {status === 'success' && `Connected as ${userEmail || 'authenticated user'}.`}
            {status === 'error' && 'We could not complete your sign in.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground animate-pulse">
                Exchanging secure credentials with Supabase...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Welcome to Screenplay Studio!</p>
                <p className="text-xs text-muted-foreground mt-0.5">Redirecting to Settings...</p>
              </div>
              <Button asChild size="sm" className="mt-2 gap-1.5 text-xs">
                <Link to="/settings">
                  <span>Continue to Settings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Failed to sign in</span>
                </div>
                <p className="font-mono text-[11px] break-words">
                  {errorMessage || 'Unknown authentication failure.'}
                </p>
              </div>

              <div className="text-xs text-muted-foreground space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                <p className="font-semibold text-foreground text-[11px]">Troubleshooting tips:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Verify that <strong>Google provider</strong> is enabled in your Supabase dashboard (Authentication &gt; Providers &gt; Google).</li>
                  <li>Check that your Supabase <strong>Redirect URLs</strong> include <code className="font-mono text-[10px]">{typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback'}</code>.</li>
                  <li>Ensure your Google Cloud Console Web Client includes your Supabase URL in Authorized Redirect URIs.</li>
                </ul>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                  <Link to="/">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Projects</span>
                  </Link>
                </Button>
                <Button size="sm" asChild className="gap-1.5 text-xs">
                  <Link to="/settings">
                    <span>Back to Settings</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
