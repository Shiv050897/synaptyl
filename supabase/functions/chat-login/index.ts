// Username + password sign-in for the private chat.
// Deploy with JWT verification OFF (visitors are not signed in yet); this
// function does its own checks:
//   * only requests from the chat site's origin are accepted
//   * 5 failed attempts per IP and per username per 15 minutes
//   * the same generic error for unknown usernames and wrong passwords
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, env, json, originAllowed } from '../_shared/http.ts';

const GENERIC_ERROR = 'Invalid username or password.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed.' });
  if (!originAllowed(req)) return json(req, 403, { error: 'Forbidden.' });

  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = typeof body.username === 'string' ? body.username.trim() : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return json(req, 400, { error: 'Invalid request.' });
  }
  if (!username || !password || username.length > 32 || password.length > 128) {
    return json(req, 400, { error: GENERIC_ERROR });
  }

  const url = env('SUPABASE_URL');
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  const keys = [`ip:${ip}`, `user:${username.toLowerCase()}`];

  for (const key of keys) {
    const { data: allowed, error } = await admin.rpc('chat_login_allowed', { p_throttle_key: key });
    if (error) return json(req, 500, { error: 'Sign-in is unavailable.' });
    if (!allowed) return json(req, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
  }

  const recordAll = (succeeded: boolean) =>
    Promise.all(keys.map((key) => admin.rpc('chat_record_login', { p_throttle_key: key, p_succeeded: succeeded })));

  const { data: account } = await admin.rpc('chat_resolve_login', { p_username: username });
  if (!account?.email) {
    await recordAll(false);
    return json(req, 401, { error: GENERIC_ERROR });
  }

  const anon = createClient(url, env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: account.email,
    password,
  });
  if (signInError || !signIn.session) {
    await recordAll(false);
    return json(req, 401, { error: GENERIC_ERROR });
  }
  await recordAll(true);

  if (account.locked && account.role !== 'admin') {
    await admin.auth.admin.signOut(signIn.session.access_token, 'global');
    return json(req, 423, { error: 'Access is currently disabled.' });
  }

  return json(req, 200, {
    role: account.role,
    session: {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      expires_at: signIn.session.expires_at,
    },
  });
});
