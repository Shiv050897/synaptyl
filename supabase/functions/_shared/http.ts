// Shared HTTP helpers for the private chat Edge Functions.

const DEFAULT_ORIGINS = ['https://synaptyl.com', 'https://www.synaptyl.com', 'http://localhost:5173'];

function allowedOrigins(): string[] {
  const configured = Deno.env.get('CHAT_ALLOWED_ORIGINS');
  return configured ? configured.split(',').map((o) => o.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow = allowedOrigins().includes(origin) ? origin : allowedOrigins()[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Rejects requests from origins other than the chat site (basic CSRF guard). */
export function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  return origin !== null && allowedOrigins().includes(origin);
}

export function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? (fallback ? Deno.env.get(fallback) : undefined);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
