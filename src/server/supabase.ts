/**
 * Supabase Server Client
 * Server-side only - for Vercel API routes and admin operations
 * NEVER import this in client-side code!
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// This file should only be used in server-side contexts (Vercel API routes)
// The build will fail if imported in client code due to process.env usage

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let serverClient: SupabaseClient | null = null

export function getServerClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[Supabase] Server client not configured - missing service role key or URL')
    return null
  }

  if (!serverClient) {
    serverClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return serverClient
}

export function createServerClient(): SupabaseClient | null {
  return getServerClient()
}