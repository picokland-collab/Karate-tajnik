import { createClient } from '@supabase/supabase-js';

// Service role key bypasses RLS — required for cron jobs that run without a
// user session. Falls back to anon key for local dev (inserts still work via
// the queue_insert RLS policy if triggered from an authenticated context).
function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type QueueVrsta =
  | 'lijecnicki_uskoro_30d'
  | 'licenca_uskoro_90d';

export interface QueueItem {
  id: string;
  vrsta: QueueVrsta;
  referenca_id: string;
  podatci: {
    ime: string;
    prezime: string;
    email?: string;
    kontakt_email?: string;
    datum_isteka: string;
    klub_naziv?: string;
    licenca_vrsta?: string;
  };
  klub_id: string;
}

// ── DATE HELPERS ──────────────────────────────────────────────

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── MAIN PIPELINE ─────────────────────────────────────────────

/**
 * Scans for expiring medical checks (30d) and trainer licenses (90d).
 * Inserts new items into obavijesti_queue with deduplication.
 * Returns the list of newly inserted items for email dispatch.
 */
export async function generateNotificationQueue(): Promise<QueueItem[]> {
  const supabase = makeClient();
  const inserted: QueueItem[] = [];

  // ── 1. Load existing pending references for dedup ───────────
  const { data: existingPending } = await supabase
    .from('obavijesti_queue')
    .select('referenca_id')
    .eq('status', 'pending');

  const pendingRefs = new Set<string>(
    (existingPending ?? []).map(r => r.referenca_id as string)
  );

  // ── 2. Fetch all clubs for notification target email ────────
  const { data: clubs } = await supabase
    .from('klubovi')
    .select('id, naziv, kontakt_email');

  const klubMap = new Map<string, { naziv: string; kontakt_email: string | null }>(
    (clubs ?? []).map(k => [k.id, { naziv: k.naziv, kontakt_email: k.kontakt_email }])
  );

  // ── 3. Liječnički pregledi — istječu za 30 dana ─────────────
  const target30 = isoOffset(30);

  // Get all lijecnicki records and build latest-per-member map
  const { data: allLijek } = await supabase
    .from('lijecnicki')
    .select('clan_id, vrijedi')
    .order('vrijedi', { ascending: false });

  const latestLijek = new Map<number, string>();
  for (const l of allLijek ?? []) {
    const id = Number(l.clan_id);
    if (!latestLijek.has(id)) latestLijek.set(id, String(l.vrijedi));
  }

  // Members whose latest medical expires exactly in 30 days
  const expiringMedIds = [...latestLijek.entries()]
    .filter(([, exp]) => exp === target30)
    .map(([id]) => id);

  if (expiringMedIds.length > 0) {
    const { data: clanovi } = await supabase
      .from('clanovi')
      .select('id, ime, prezime, email, klub_id')
      .in('id', expiringMedIds)
      .eq('status', 'aktivan');

    for (const c of clanovi ?? []) {
      const refId = `lijek_30d_${c.id}_${target30}`;
      if (pendingRefs.has(refId)) continue; // already queued

      const klub = klubMap.get(c.klub_id);
      const item: QueueItem = {
        id:           '', // filled after insert
        vrsta:        'lijecnicki_uskoro_30d',
        referenca_id: refId,
        klub_id:      c.klub_id,
        podatci: {
          ime:           c.ime ?? '',
          prezime:       c.prezime ?? '',
          email:         c.email ?? undefined,
          kontakt_email: klub?.kontakt_email ?? undefined,
          datum_isteka:  target30,
          klub_naziv:    klub?.naziv ?? '',
        },
      };

      const { data: row, error } = await supabase
        .from('obavijesti_queue')
        .insert({
          klub_id:      item.klub_id,
          vrsta:        item.vrsta,
          referenca_id: item.referenca_id,
          podatci:      item.podatci,
          status:       'pending',
        })
        .select('id')
        .single();

      if (!error && row) {
        inserted.push({ ...item, id: row.id });
        pendingRefs.add(refId); // prevent double-insert in same run
      }
    }
  }

  // ── 4. HKF Trenerske licence — istječu za 90 dana ───────────
  const target90 = isoOffset(90);

  const { data: treneri } = await supabase
    .from('treneri')
    .select('id, ime, prezime, email, licenca, licvrijedi, klub_id')
    .eq('status', 'aktivan')
    .eq('licvrijedi', target90);

  for (const t of treneri ?? []) {
    const refId = `licenca_90d_${t.id}_${target90}`;
    if (pendingRefs.has(refId)) continue;

    const klub = klubMap.get(t.klub_id);
    const item: QueueItem = {
      id:           '',
      vrsta:        'licenca_uskoro_90d',
      referenca_id: refId,
      klub_id:      t.klub_id,
      podatci: {
        ime:           t.ime ?? '',
        prezime:       t.prezime ?? '',
        email:         t.email ?? undefined,
        kontakt_email: klub?.kontakt_email ?? undefined,
        datum_isteka:  target90,
        klub_naziv:    klub?.naziv ?? '',
        licenca_vrsta: t.licenca ?? undefined,
      },
    };

    const { data: row, error } = await supabase
      .from('obavijesti_queue')
      .insert({
        klub_id:      item.klub_id,
        vrsta:        item.vrsta,
        referenca_id: item.referenca_id,
        podatci:      item.podatci,
        status:       'pending',
      })
      .select('id')
      .single();

    if (!error && row) {
      inserted.push({ ...item, id: row.id });
      pendingRefs.add(refId);
    }
  }

  return inserted;
}

/**
 * Marks processed queue items as sent or failed.
 */
export async function ackQueueItems(
  ids: string[],
  status: 'sent' | 'failed',
  greska?: string,
): Promise<void> {
  if (ids.length === 0) return;
  const supabase = makeClient();
  await supabase
    .from('obavijesti_queue')
    .update({
      status,
      greska:       greska ?? null,
      processed_at: new Date().toISOString(),
    })
    .in('id', ids);
}
