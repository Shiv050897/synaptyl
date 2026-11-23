// Sends a push notification to the other chat member's devices.
// Deploy with JWT verification ON. The caller must be X1 or X2.
//
//   { type: 'message', message_id }      -> "New message" (message must be the caller's, sent in the last 2 minutes)
//   { type: 'call', media: 'audio'|'video' } -> "Incoming voice/video call"
//
// Notifications never contain message content (it is end-to-end encrypted)
// or names, so nothing private shows on a lock screen.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
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
  if (meError || !me || (me.role !== 'x1' && me.role !== 'x2') || !me.peer?.user_id) {
    return json(req, 403, { error: 'Not allowed.' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'Invalid request.' });
  }

  let payload: Record<string, unknown>;
  let ttl = 86400;
  if (body.type === 'message') {
    const id = String(body.message_id ?? '');
    if (!UUID.test(id)) return json(req, 400, { error: 'Invalid message.' });
    // Read through the caller's own permissions: they must be able to see it, and be its sender.
    const { data: msg } = await asCaller.from('chat_messages').select('sender_id, created_at').eq('id', id).maybeSingle();
    if (!msg || msg.sender_id !== me.user_id || Date.now() - new Date(msg.created_at).getTime() > 120_000) {
      return json(req, 400, { error: 'Message not eligible for a notification.' });
    }
    payload = { type: 'message', title: 'Chat', body: 'New message', tag: 'pc-message', url: '/zx' };
  } else if (body.type === 'call') {
    const media = body.media === 'video' ? 'video' : 'audio';
    payload = {
      type: 'call', title: 'Chat', body: media === 'video' ? 'Incoming video call' : 'Incoming voice call',
      tag: 'pc-call', url: '/zx',
    };
    ttl = 45; // a call notification is useless once ringing has stopped
  } else {
    return json(req, 400, { error: 'Unknown type.' });
  }

  const { data: config } = await service.rpc('chat_push_config');
  if (!config?.vapid_public_key || !config?.vapid_private_key) {
    return json(req, 500, { error: 'Notifications are not configured.' });
  }
  webpush.setVapidDetails(config.vapid_subject || 'mailto:admin@synaptyl.com', config.vapid_public_key, config.vapid_private_key);

  const { data: subs } = await service
    .from('chat_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', me.peer.user_id);

  let sent = 0;
  const dead: string[] = [];
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: ttl, urgency: 'high', topic: payload.tag as string },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dead.push(s.id); // device unsubscribed or uninstalled
    }
  }));
  if (dead.length) await service.from('chat_push_subscriptions').delete().in('id', dead);

  return json(req, 200, { ok: true, sent });
});
