import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// A separate client with its own storage key, so a chat login never shares a
// session with the learning site (and vice versa) in the same browser.
export const chatClient: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          storageKey: 'syn-pc-auth',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null

export const LOGIN_PATH = '/k7m2q'

export type ChatRole = 'x1' | 'x2' | 'admin'

export type WhoAmI = {
  user_id: string
  role: ChatRole
  username: string
  peer: { user_id: string; username: string } | null
}

/** Calls a chat Edge Function and returns its JSON body, throwing its error message. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!chatClient) throw new Error('The site is not configured.')
  const { data, error } = await chatClient.functions.invoke(name, { body })
  if (error) {
    let message = 'Something went wrong. Please try again.'
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const parsed = await context.json()
        if (parsed && typeof parsed.error === 'string') message = parsed.error
      } catch {
        // keep the generic message
      }
    }
    throw new Error(message)
  }
  return data as T
}

export function go(path: string, replace = false) {
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
