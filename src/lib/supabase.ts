/**
 * Supabase Client Configuration
 * Optional - only initializes when environment variables are present
 * Client-side user operations only
 */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

// ============================================================================
// Environment Validation
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)

if (!hasSupabaseConfig) {
  console.info('[Supabase] Not configured - running in local-only mode')
}

// ============================================================================
// Client-Side Supabase Client (User Operations)
// ============================================================================

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabaseConfig) return null

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: {
          getItem: (key: string) => {
            // Use sessionStorage for better security
            try {
              return sessionStorage.getItem(key)
            } catch {
              return null
            }
          },
          setItem: (key: string, value: string) => {
            try {
              sessionStorage.setItem(key, value)
            } catch {
              // Ignore storage errors
            }
          },
          removeItem: (key: string) => {
            try {
              sessionStorage.removeItem(key)
            } catch {
              // Ignore storage errors
            }
          },
        },
      },
      global: {
        headers: {
          'X-Client-Info': 'screenplay-studio-web',
        },
      },
    })
  }

  return supabaseClient
}

// ============================================================================
// Auth Helpers
// ============================================================================

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient()
  if (!client) return null

  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error) {
    console.error('[Supabase] Error getting user:', error)
    return null
  }

  return user
}

export async function getSession() {
  const client = getSupabaseClient()
  if (!client) return null

  const {
    data: { session },
    error,
  } = await client.auth.getSession()

  if (error) {
    console.error('[Supabase] Error getting session:', error)
    return null
  }

  return session
}

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient()
  if (!client) return { error: new Error('Supabase not configured') }

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  return { error }
}

export async function signInWithEmail(email: string): Promise<{ error: Error | null }> {
  const client = getSupabaseClient()
  if (!client) return { error: new Error('Supabase not configured') }

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  return { error }
}

export async function signOut(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient()
  if (!client) return { error: new Error('Supabase not configured') }

  const { error } = await client.auth.signOut()
  return { error }
}

export async function deleteAccount(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient()
  if (!client) return { error: new Error('Supabase not configured') }

  const user = await getCurrentUser()
  if (!user) return { error: new Error('No authenticated user') }

  // Clean up user rows in tables
  await Promise.allSettled([
    client.from('projects').delete().eq('user_id', user.id),
    client.from('profiles').delete().eq('id', user.id),
  ])

  await client.auth.signOut()
  return { error: null }
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  const client = getSupabaseClient()
  if (!client) {
    callback(null)
    return { data: { subscription: { unsubscribe: () => {} } } }
  }

  return client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}

// ============================================================================
// Type Exports
// ============================================================================

export type { SupabaseClient, User }

// ============================================================================
// Feature Flags
// ============================================================================

export const features = {
  auth: hasSupabaseConfig,
  sync: hasSupabaseConfig,
  database: hasSupabaseConfig,
} as const

export function isFeatureEnabled(feature: keyof typeof features): boolean {
  return features[feature]
}