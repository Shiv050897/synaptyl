// Chat admin actions that need server-side privileges.
// Deploy with JWT verification ON. Every request is re-checked against the
// chat_members table using the caller's own token before anything runs.
//
// Actions:
//   { action: 'set_password', user_id, password }  -> change password + force logout
//   { action: 'delete_messages', message_ids? }    -> delete rows (all if omitted) + encrypted files
//
// Renaming, lock/unlock, force logout and listing are plain database
// functions the admin page calls directly (they enforce admin access too).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, env, json, originAllowed } from '../_shared/http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed.' });
  if (!originAllowed(req)) return json(req, 403, { error: 'Forbidden.' });

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json(req, 401, { error: 'Unauthorized.' });

  const url = env('SUPABASE_URL');
  const asCaller = createClient(url, env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: me, error: meError } = await asCaller.rpc('chat_whoami');
  if (meError || me?.role !== 'admin') return json(req, 403, { error: 'Admin access required.' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'Invalid request.' });
  }

  switch (body.action) {
    case 'set_password': {
      const userId = String(body.user_id ?? '');
      const password = String(body.password ?? '');
      if (!UUID.test(userId)) return json(req, 400, { error: 'Invalid user.' });
      if (password.length < 12 || password.length > 128) {
        return json(req, 400, { error: 'Password must be 12–128 characters.' });
      }
      // Only X1/X2 can be changed here; the overview lists exactly those members.
      const { data: overview, error: ovError } = await asCaller.rpc('chat_admin_overview');
      if (ovError) return json(req, 500, { error: 'Could not load members.' });
      const target = (overview.members as Array<{ user_id: string; role: string }>)
        .find((m) => m.user_id === userId && (m.role === 'x1' || m.role === 'x2'));
      if (!target) return json(req, 404, { error: 'User not found.' });

      const { error: updError } = await service.auth.admin.updateUserById(userId, { password });
      if (updError) return json(req, 500, { error: 'Could not change the password.' });
      const { error: logoutError } = await asCaller.rpc('chat_admin_force_logout', { p_user_id: userId });
      if (logoutError) return json(req, 500, { error: 'Password changed, but logout failed.' });
      return json(req, 200, { ok: true });
    }

    case 'delete_messages': {
      let ids: string[] | null = null;
      if (body.message_ids !== undefined) {
        if (!Array.isArray(body.message_ids) || body.message_ids.length === 0 || body.message_ids.length > 500
          || !body.message_ids.every((id) => typeof id === 'string' && UUID.test(id))) {
          return json(req, 400, { error: 'Invalid message list.' });
        }
        ids = body.message_ids as string[];
      } else if (body.confirm_all !== true) {
        return json(req, 400, { error: 'Set confirm_all to delete the whole history.' });
      }

      const { data: paths, error: delError } = await asCaller.rpc('chat_admin_delete_messages', {
        p_message_ids: ids,
      });
      if (delError) return json(req, 500, { error: 'Could not delete messages.' });

      const files = (paths ?? []) as string[];
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await service.storage.from('chat-media').remove(files.slice(i, i + 100));
        if (error) return json(req, 500, { error: 'Messages deleted, but some files could not be removed.' });
      }
      return json(req, 200, { ok: true, files_removed: files.length });
    }

    default:
      return json(req, 400, { error: 'Unknown action.' });
  }
});
