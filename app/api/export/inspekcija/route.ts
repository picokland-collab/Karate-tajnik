import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { buildInspekcijskiZip } from '@/lib/export/buildZip';
import type { Member, BeltColor, MemberStatus, TipClanstva } from '@/lib/types';
import type { Sjednica, SjednicaStatus, SjednicaVrsta } from '@/lib/queries/sjednice';
import type { Trener, TrenerStatus } from '@/lib/queries/treneri';

export const maxDuration = 60;

const POJAS_MAP: Record<string, BeltColor> = {
  'Bijeli pojas':     'bijeli',
  'Žuti pojas':       'žuti',
  'Narančasti pojas': 'narančasti',
  'Zeleni pojas':     'zeleni',
  'Plavi pojas':      'plavi',
  'Smeđi pojas':      'smeđi',
  '1. DAN':           'crni-1',
  '2. DAN':           'crni-2',
  '3. DAN':           'crni-3',
};

const VALID_STATUSES: MemberStatus[]       = ['aktivan', 'neaktivan', 'suspendiran'];
const VALID_CATEGORIES: Member['category'][] = ['kadet', 'junior', 'senior', 'veteran', 'mali_karatist'];
const VALID_TIP: TipClanstva[]             = ['redovni', 'podupiruci', 'pocasni'];

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
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Fetch everything in parallel
  const [klubRes, clanoviRes, lijecnickiRes, sjedniceRes, treneriRes] = await Promise.all([
    supabase.from('klubovi').select('naziv').maybeSingle(),
    supabase.from('clanovi').select('*').order('prezime').order('ime'),
    supabase.from('lijecnicki')
      .select('clan_id, vrijedi')
      .order('vrijedi', { ascending: false }),
    supabase.from('sjednice')
      .select('id, vrsta, zakazano_za, lokacija, status, napomena, tocke_dnevnog_reda(redni_broj, tekst)')
      .order('zakazano_za', { ascending: false }),
    supabase.from('treneri')
      .select('id, ime, prezime, uloga, licenca, brlic, licvrijedi, mob, email, status')
      .order('prezime').order('ime'),
  ]);

  if (clanoviRes.error) {
    return new Response(`Greška dohvata članova: ${clanoviRes.error.message}`, { status: 500 });
  }

  const klubNaziv = klubRes.data?.naziv ?? 'Sportski klub';

  // Build latest-medical map (first row per member = most recent)
  const latestLijek = new Map<number, string>();
  for (const l of lijecnickiRes.data ?? []) {
    if (l.clan_id != null && !latestLijek.has(Number(l.clan_id))) {
      latestLijek.set(Number(l.clan_id), l.vrijedi);
    }
  }

  const clanovi: Member[] = (clanoviRes.data ?? []).map(c => ({
    id:            String(c.id),
    firstName:     c.ime ?? '',
    lastName:      c.prezime ?? '',
    email:         c.email ?? '',
    phone:         c.mobitel ?? '',
    birthDate:     c.dat_rod ?? '',
    memberSince:   c.dat_uclan ?? '',
    belt:          (POJAS_MAP[c.pojas ?? ''] ?? 'bijeli') as BeltColor,
    status:        (VALID_STATUSES.includes(c.status as MemberStatus) ? c.status : 'aktivan') as MemberStatus,
    medicalExpiry: latestLijek.get(Number(c.id)) ?? '',
    consentSigned: c.gdpr === 'da',
    adresa:        c.adresa ?? undefined,
    tipClanstva:   (VALID_TIP.includes(c.tip_clanstva as TipClanstva) ? c.tip_clanstva : undefined) as TipClanstva | undefined,
    guardian:      c.roditelji ?? undefined,
    notes:         c.bolest ?? undefined,
    category:      (VALID_CATEGORIES.includes(c.kategorija as Member['category']) ? c.kategorija : 'senior') as Member['category'],
  }));

  const sjednice: Sjednica[] = (sjedniceRes.data ?? []).map(s => {
    const dt    = new Date(s.zakazano_za);
    const tocke = (Array.isArray(s.tocke_dnevnog_reda)
      ? (s.tocke_dnevnog_reda as { redni_broj: number; tekst: string }[])
      : []
    ).sort((a, b) => a.redni_broj - b.redni_broj);

    return {
      id:               s.id,
      vrsta:            s.vrsta as SjednicaVrsta,
      datum:            dt.toISOString().slice(0, 10),
      vrijeme:          dt.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      lokacija:         s.lokacija ?? '',
      status:           s.status as SjednicaStatus,
      napomena:         s.napomena ?? null,
      dnevni_red:       tocke.map(t => t.tekst),
      broj_dokumenata:  0,
    };
  });

  const treneri: Trener[] = (treneriRes.data ?? []).map(t => ({
    id:         String(t.id ?? ''),
    ime:        String(t.ime ?? ''),
    prezime:    String(t.prezime ?? ''),
    uloga:      t.uloga      ? String(t.uloga)      : undefined,
    licenca:    t.licenca    ? String(t.licenca)    : undefined,
    brLic:      t.brlic      ? String(t.brlic)      : undefined,
    licVrijedi: t.licvrijedi ? String(t.licvrijedi) : undefined,
    mob:        t.mob        ? String(t.mob)        : undefined,
    email:      t.email      ? String(t.email)      : undefined,
    status:     (t.status === 'neaktivan' ? 'neaktivan' : 'aktivan') as TrenerStatus,
  }));

  try {
    const { zip, filename } = await buildInspekcijskiZip({ klubNaziv, clanovi, sjednice, treneri });

    return new Response(Buffer.from(zip), {
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(zip.byteLength),
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    console.error('[export/inspekcija]', err);
    const msg = err instanceof Error ? err.message : 'Nepoznata greška';
    return new Response(`Greška pri generiranju arhive: ${msg}`, { status: 500 });
  }
}
