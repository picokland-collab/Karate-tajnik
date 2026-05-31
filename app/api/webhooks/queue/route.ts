import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidWebhookSecret, unauthorizedResponse } from '@/lib/webhook-auth';

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * GET /api/webhooks/queue
 *
 * Vraća sve pending obavijesti iz obavijesti_queue.
 * n8n čita ovaj endpoint, obradi svaku obavijest (email/WhatsApp),
 * pa pozove POST s listom ID-ova na potvrdu.
 *
 * Header: X-Webhook-Secret: <WEBHOOK_SECRET>
 *
 * Response:
 * {
 *   "items": [
 *     {
 *       "id": "uuid",
 *       "vrsta": "lijecnicki_istekao" | "lijecnicki_uskoro" | "sjednica_najava",
 *       "podatci": { ... },
 *       "created_at": "ISO timestamp"
 *     }
 *   ]
 * }
 */
export async function GET(req: NextRequest) {
  if (!isValidWebhookSecret(req)) return unauthorizedResponse();

  const { data, error } = await makeClient().rpc('fn_webhook_dohvati_queue', {
    p_secret: process.env.WEBHOOK_SECRET,
  });

  if (error) {
    console.error('[webhook/queue GET] RPC error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ items: data ?? [] });
}

/**
 * POST /api/webhooks/queue
 *
 * n8n potvrđuje obradu obavijesti (ACK).
 * Poziva se nakon uspješnog slanja emaila/WhatsAppa.
 *
 * Body:
 * {
 *   "ids": ["uuid1", "uuid2"],
 *   "status": "sent" | "failed" | "skipped",  // default: "sent"
 *   "error": "opis greške"                      // samo uz status: "failed"
 * }
 *
 * Response:
 * { "ok": true, "updated": 2 }
 */
export async function POST(req: NextRequest) {
  if (!isValidWebhookSecret(req)) return unauthorizedResponse();

  let body: { ids?: unknown; status?: unknown; error?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Neispravan JSON body.' }, { status: 400 });
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return Response.json({ error: 'Polje "ids" mora biti neprazan niz UUID-ova.' }, { status: 400 });
  }

  const allowedStatuses = ['sent', 'failed', 'skipped'] as const;
  const status = typeof body.status === 'string' && allowedStatuses.includes(body.status as never)
    ? body.status
    : 'sent';

  const { data, error } = await makeClient().rpc('fn_webhook_ack_queue', {
    p_secret: process.env.WEBHOOK_SECRET,
    p_ids:    body.ids as string[],
    p_status: status,
    p_greska: typeof body.error === 'string' ? body.error : null,
  });

  if (error) {
    console.error('[webhook/queue POST] RPC error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, updated: data });
}
