import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Hub3aParams, buildHub3aText, assemblePdf } from '@/lib/utils/hub3aService';

const BUCKET = 'billing-cache';

/**
 * Deterministic SHA-256 cache key over the fields that make a payment slip unique:
 * member ID, amount, target IBAN, and description (which carries month/year).
 * Truncated to 32 hex chars (128 bits) — collision probability negligible.
 */
function cacheHash(p: Hub3aParams): string {
  return createHash('sha256')
    .update(
      `${p.memberId}|${p.amountEur.toFixed(2)}|${p.recipientIban.replace(/\s/g, '')}|${p.description}`,
    )
    .digest('hex')
    .slice(0, 32);
}

export async function POST(req: NextRequest) {
  // ── AUTH ────────────────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // ── PARSE & VALIDATE ─────────────────────────────────────────────
  let params: Hub3aParams;
  try {
    params = await req.json() as Hub3aParams;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (
    !params.payerName || !params.recipientName || !params.recipientIban ||
    typeof params.amountEur !== 'number' || !params.description ||
    typeof params.memberId !== 'number'
  ) {
    return new Response('Missing required fields', { status: 400 });
  }

  // ── CLUB SECURITY GATE ───────────────────────────────────────────
  // For linked members (memberId > 0) verify the member belongs to the
  // caller's club.  The clanovi RLS already scopes to the caller's klub_id
  // via dohvati_moj_klub_id(), so a missing row means cross-club attempt.
  if (params.memberId > 0) {
    const { data: member } = await supabase
      .from('clanovi')
      .select('id')
      .eq('id', params.memberId)
      .maybeSingle();

    if (!member) return new Response('Forbidden', { status: 403 });
  }

  // ── STORAGE CACHE CHECK ──────────────────────────────────────────
  const hash        = cacheHash(params);
  const storagePath = `hub3a_cache/${hash}.pdf`;

  const { data: cachedBlob } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (cachedBlob) {
    const bytes = new Uint8Array(await cachedBlob.arrayBuffer());
    return pdfResponse(bytes, params.memberId, 'HIT');
  }

  // ── GENERATE ─────────────────────────────────────────────────────
  try {
    const text = buildHub3aText(params);

    // Dynamic import keeps bwip-js out of the static bundle (serverExternalPackages
    // in next.config.ts handles Vercel; this import resolves to bwip-js-node.mjs
    // which exports toBuffer as a named export).
    // `columns` is a valid PDF417 option absent from the RenderOptions types.
    const { toBuffer } = await import('bwip-js/node');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pngBuffer: Buffer = await (toBuffer as (o: any) => Promise<Buffer>)({
      bcid:        'pdf417',
      text,
      scale:        2,
      columns:      9,
      eclevel:      4,
      encoding:    'binary',
      includetext:  false,
    });

    const pdfBytes = await assemblePdf(params, pngBuffer);

    // ── CACHE WRITE ───────────────────────────────────────────────
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert:      false,   // first writer wins; ignore duplicate-key races
      });

    if (uploadError && !uploadError.message.includes('already exists')) {
      console.warn('[hub3a/barcode] cache upload failed:', uploadError.message);
    }

    return pdfResponse(pdfBytes, params.memberId, 'MISS');
  } catch (err) {
    console.error('[hub3a/barcode]', err);
    const msg = err instanceof Error ? err.message : 'Nepoznata greška';
    return new Response(`Greška pri generiranju uplatnice: ${msg}`, { status: 500 });
  }
}

function pdfResponse(bytes: Uint8Array, memberId: number, cacheStatus: 'HIT' | 'MISS') {
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="uplatnica_${memberId}.pdf"`,
      'Content-Length':      String(bytes.byteLength),
      'Cache-Control':       'no-store',
      'X-Cache':             cacheStatus,
    },
  });
}
