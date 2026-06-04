import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Hub3aParams, buildHub3aText, assemblePdf } from '@/lib/utils/hub3aService';

// bwip-js/node resolves to the Node.js build (toBuffer) via the package exports map
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bwipjs = require('bwip-js/node') as typeof import('bwip-js/node');

// In-memory PDF cache keyed by serialised params. Deterministic params → deterministic PDF.
const cache = new Map<string, Uint8Array>();
const CACHE_MAX = 200;

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

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

  const key = JSON.stringify(params);

  const cached = cache.get(key);
  if (cached) {
    return pdfResponse(cached, params.memberId, 'HIT');
  }

  try {
    const text = buildHub3aText(params);

    // Cast to `any` because `columns` is a valid PDF417 option not reflected in the RenderOptions type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pngBuffer: Buffer = await (bwipjs.toBuffer as (o: any) => Promise<Buffer>)({
      bcid:        'pdf417',
      text,
      scale:        2,
      columns:      9,
      eclevel:      4,
      encoding:    'binary',
      includetext:  false,
    });

    const pdfBytes = await assemblePdf(params, pngBuffer);

    if (cache.size >= CACHE_MAX) {
      // Evict oldest (Map preserves insertion order)
      cache.delete(cache.keys().next().value!);
    }
    cache.set(key, pdfBytes);

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
