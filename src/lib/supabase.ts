import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Only a publishable key belongs in browser code. Never use a secret or
// service_role key in a VITE_ environment variable.
export const supabase =
  url && publishableKey ? createClient(url, publishableKey) : null

export const isSupabaseConfigured = supabase !== null
