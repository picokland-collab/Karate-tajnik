import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidWebhookSecret, unauthorizedResponse } from '@/lib/webhook-auth';

/**
 * POST /api/webhooks/sync
 *
 * Pokreće fn_generiraj_obavijesti() — skenira liječničke preglede i sjednice
 * te ubacuje pending obavijesti u obavijesti_queue.
 *
 * n8n: Schedule Trigger (svaki dan u 08:00) → HTTP Request → ova ruta
 *
 * Header: X-Webhook-Secret: <WEBHOOK_SECRET>
 */
export async function POST(req: NextRequest) {
  if (!isValidWebhookSecret(req)) return unauthorizedResponse();

  if (!process.env.WEBHOOK_SECRET) {
    return Response.json({ error: 'WEBHOOK_SECRET nije konfiguriran.' }, { status: 503 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.rpc('fn_generiraj_obavijesti', {
    p_secret: process.env.WEBHOOK_SECRET,
  });

  if (error) {
    console.error('[webhook/sync] RPC error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, result: data });
}

/** GET /api/webhooks/sync — status provjera (health check) */
export async function GET(req: NextRequest) {
  if (!isValidWebhookSecret(req)) return unauthorizedResponse();
  return Response.json({ ok: true, service: 'digitalni-tajnik-webhooks', ts: new Date().toISOString() });
}
