import { createClient } from '@/lib/supabase-browser';

// ── TYPES ─────────────────────────────────────────────────────

export type FinancijeVrsta    = 'prihod' | 'rashod';
export type FinancijeStatus   = 'placeno' | 'ceka' | 'stornirano';
export type FinancijeKategorija =
  | 'clanarina'
  | 'sufinanciranje'
  | 'natjecanje'
  | 'oprema'
  | 'donacija'
  | 'najam'
  | 'clanarine_savez'
  | 'ostalo';

export const VRSTA_LABEL: Record<FinancijeVrsta, string> = {
  prihod: 'Prihod',
  rashod: 'Rashod',
};

export const STATUS_LABEL: Record<FinancijeStatus, string> = {
  placeno:     'Plaćeno',
  ceka:        'Čeka',
  stornirano:  'Stornirano',
};

export const KATEGORIJA_LABEL: Record<FinancijeKategorija, string> = {
  clanarina:      'Članarina',
  sufinanciranje: 'Sufinanciranje',
  natjecanje:     'Natjecanje',
  oprema:         'Oprema',
  donacija:       'Donacija',
  najam:          'Najam dvorane',
  clanarine_savez:'Članarine savezu',
  ostalo:         'Ostalo',
};

// ── ANALYTICS TYPES ───────────────────────────────────────────

export interface MjesecniPodatak {
  mjesec:  string;   // "Sij", "Velj", ... (Croatian short month name)
  prihod:  number;
  rashod:  number;
}

export interface KategorijaStats {
  kategorija: string;
  label:      string;
  vrsta:      FinancijeVrsta;
  ukupno:     number;
  postotak:   number;   // % of total for that vrsta
}

const MONTHS_HR = ['Sij','Velj','Ožu','Tra','Svi','Lip','Srp','Kol','Ruj','Lis','Stu','Pro'];

/** Builds monthly prihod/rashod aggregates for the given year from an already-loaded records array. */
export function buildMjesecniPodaci(
  records: Pick<FinancijaZapis, 'datum' | 'vrsta' | 'iznos' | 'status'>[],
  year: number,
): MjesecniPodatak[] {
  const months: MjesecniPodatak[] = MONTHS_HR.map(m => ({ mjesec: m, prihod: 0, rashod: 0 }));
  for (const r of records) {
    if (r.status === 'stornirano') continue;
    const parts = r.datum.split('-');
    if (parts.length < 2 || Number(parts[0]) !== year) continue;
    const idx = Number(parts[1]) - 1;
    if (idx < 0 || idx > 11) continue;
    months[idx][r.vrsta] += r.iznos;
  }
  return months;
}

/** Builds category distribution stats from already-loaded records. */
export function buildKategorijaStats(
  records: Pick<FinancijaZapis, 'vrsta' | 'kategorija' | 'iznos' | 'status'>[],
): { prihodi: KategorijaStats[]; rashodi: KategorijaStats[] } {
  const map = new Map<string, { vrsta: FinancijeVrsta; ukupno: number }>();

  for (const r of records) {
    if (r.status === 'stornirano') continue;
    const key = `${r.vrsta}:${r.kategorija}`;
    const entry = map.get(key) ?? { vrsta: r.vrsta, ukupno: 0 };
    entry.ukupno += r.iznos;
    map.set(key, entry);
  }

  const toStats = (vrsta: FinancijeVrsta): KategorijaStats[] => {
    const rows = [...map.entries()]
      .filter(([k]) => k.startsWith(vrsta))
      .map(([k, v]) => ({ kat: k.split(':')[1], ...v }))
      .sort((a, b) => b.ukupno - a.ukupno);
    const total = rows.reduce((s, r) => s + r.ukupno, 0);
    return rows.map(r => ({
      kategorija: r.kat,
      label:      KATEGORIJA_LABEL[r.kat as FinancijeKategorija] ?? r.kat,
      vrsta,
      ukupno:     r.ukupno,
      postotak:   total > 0 ? Math.round((r.ukupno / total) * 100) : 0,
    }));
  };

  return { prihodi: toStats('prihod'), rashodi: toStats('rashod') };
}

export interface FinancijaZapis {
  id: string;
  klubId: string;
  vrsta: FinancijeVrsta;
  kategorija: FinancijeKategorija;
  opis: string;
  iznos: number;            // EUR, 2 decimale
  datum: string;            // ISO "YYYY-MM-DD"
  napomena?: string;
  status: FinancijeStatus;
  clanId?: number;          // nullable FK → clanovi.id
  clanIme?: string;         // joined: "Ime Prezime" (null kada aggregate)
  createdAt: string;
}

export interface FinancijaInput {
  vrsta:       FinancijeVrsta;
  kategorija:  FinancijeKategorija;
  opis:        string;
  iznos:       number;
  datum:       string;
  napomena?:   string;
  status?:     FinancijeStatus;
  clanId?:     number;
}

export interface FinancijeSažetak {
  ukupnoProhodi: number;
  ukupnoRashodi: number;
  saldo:         number;
  ukupnoZapisa:  number;
}

// ── ID GENERATOR ──────────────────────────────────────────────

function generateFinId(): string {
  const year = new Date().getFullYear();
  const rnd  = crypto.getRandomValues(new Uint16Array(1))[0]
    .toString(16).toUpperCase().padStart(4, '0');
  return `FIN-${year}-${rnd}`;
}

// ── ROW MAPPER ────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): FinancijaZapis {
  const vrsta = (r.vrsta === 'rashod' ? 'rashod' : 'prihod') as FinancijeVrsta;

  const validStatuses: FinancijeStatus[] = ['placeno', 'ceka', 'stornirano'];
  const status = validStatuses.includes(r.status as FinancijeStatus)
    ? (r.status as FinancijeStatus)
    : 'placeno';

  const validKat: FinancijeKategorija[] = [
    'clanarina', 'sufinanciranje', 'natjecanje', 'oprema', 'donacija', 'ostalo',
  ];
  const kategorija = validKat.includes(r.kategorija as FinancijeKategorija)
    ? (r.kategorija as FinancijeKategorija)
    : 'ostalo';

  // Joined member name comes from the clanovi alias in SELECT
  const clanIme = r.clanovi
    ? (() => {
        const c = r.clanovi as { ime?: string; prezime?: string } | null;
        return c ? `${c.ime ?? ''} ${c.prezime ?? ''}`.trim() || undefined : undefined;
      })()
    : undefined;

  return {
    id:         String(r.id ?? ''),
    klubId:     String(r.klub_id ?? ''),
    vrsta,
    kategorija,
    opis:       String(r.opis ?? ''),
    iznos:      Number(r.iznos ?? 0),
    datum:      String(r.datum ?? ''),
    napomena:   r.napomena ? String(r.napomena) : undefined,
    status,
    clanId:     r.clan_id != null ? Number(r.clan_id) : undefined,
    clanIme,
    createdAt:  String(r.created_at ?? ''),
  };
}

// ── QUERIES ───────────────────────────────────────────────────

export interface FetchFinancijeOptions {
  vrsta?:      FinancijeVrsta;
  kategorija?: FinancijeKategorija;
  status?:     FinancijeStatus;
  /** ISO date range, inclusive */
  datumOd?:    string;
  datumDo?:    string;
  clanId?:     number;
  limit?:      number;
}

/** Fetches financial records with optional LEFT JOIN on member name. */
export async function fetchFinancije(
  opts: FetchFinancijeOptions = {},
): Promise<FinancijaZapis[]> {
  const supabase = createClient();

  let q = supabase
    .from('financije')
    .select('*, clanovi(ime, prezime)')
    .order('datum', { ascending: false })
    .order('created_at', { ascending: false });

  if (opts.vrsta)      q = q.eq('vrsta', opts.vrsta);
  if (opts.kategorija) q = q.eq('kategorija', opts.kategorija);
  if (opts.status)     q = q.eq('status', opts.status);
  if (opts.datumOd)    q = q.gte('datum', opts.datumOd);
  if (opts.datumDo)    q = q.lte('datum', opts.datumDo);
  if (opts.clanId)     q = q.eq('clan_id', opts.clanId);
  if (opts.limit)      q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
}

/** Convenience alias for income records (prihodi). */
export const fetchUplate = (opts?: Omit<FetchFinancijeOptions, 'vrsta'>) =>
  fetchFinancije({ ...opts, vrsta: 'prihod' });

/** Convenience alias for expense records (rashodi). */
export const fetchRashodi = (opts?: Omit<FetchFinancijeOptions, 'vrsta'>) =>
  fetchFinancije({ ...opts, vrsta: 'rashod' });

/** Returns aggregated summary totals for the club's financials. */
export async function fetchFinancijeSažetak(
  datumOd?: string,
  datumDo?: string,
): Promise<FinancijeSažetak> {
  const supabase = createClient();

  let q = supabase
    .from('financije')
    .select('vrsta, iznos')
    .neq('status', 'stornirano'); // exclude cancelled

  if (datumOd) q = q.gte('datum', datumOd);
  if (datumDo) q = q.lte('datum', datumDo);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as { vrsta: string; iznos: unknown }[];
  const prihodi = rows.filter(r => r.vrsta === 'prihod').reduce((s, r) => s + Number(r.iznos), 0);
  const rashodi = rows.filter(r => r.vrsta === 'rashod').reduce((s, r) => s + Number(r.iznos), 0);

  return {
    ukupnoProhodi: prihodi,
    ukupnoRashodi: rashodi,
    saldo:         prihodi - rashodi,
    ukupnoZapisa:  rows.length,
  };
}

/** Inserts a new financial record. */
export async function insertUplata(input: FinancijaInput): Promise<void> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Niste prijavljeni');

  const { data: profil } = await supabase
    .from('profili').select('klub_id').eq('id', user.id).single();
  if (!profil?.klub_id) throw new Error('Klub nije pronađen');

  const { error } = await supabase.from('financije').insert({
    id:         generateFinId(),
    klub_id:    profil.klub_id,
    vrsta:      input.vrsta,
    kategorija: input.kategorija,
    opis:       input.opis.trim(),
    iznos:      input.iznos,
    datum:      input.datum,
    napomena:   input.napomena?.trim() || null,
    status:     input.status ?? 'placeno',
    clan_id:    input.clanId ?? null,
  });

  if (error) throw new Error(error.message);
}

/** Updates only the status of an existing record (placeno → ceka → stornirano). */
export async function updateUplataStatus(
  id: string,
  status: FinancijeStatus,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('financije')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Full update for editing an existing record. */
export async function updateUplata(
  id: string,
  input: Partial<FinancijaInput>,
): Promise<void> {
  const supabase = createClient();

  const patch: Record<string, unknown> = {};
  if (input.vrsta       !== undefined) patch.vrsta       = input.vrsta;
  if (input.kategorija  !== undefined) patch.kategorija  = input.kategorija;
  if (input.opis        !== undefined) patch.opis        = input.opis.trim();
  if (input.iznos       !== undefined) patch.iznos       = input.iznos;
  if (input.datum       !== undefined) patch.datum       = input.datum;
  if (input.napomena    !== undefined) patch.napomena    = input.napomena?.trim() || null;
  if (input.status      !== undefined) patch.status      = input.status;
  if (input.clanId      !== undefined) patch.clan_id     = input.clanId ?? null;

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from('financije')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Soft-delete: marks record as stornirano (no hard DELETE). */
export async function stornirajUplatu(id: string): Promise<void> {
  return updateUplataStatus(id, 'stornirano');
}
