import { createClient } from '@/lib/supabase-browser';

export type TrenerStatus = 'aktivan' | 'neaktivan';

export const ULOGA_OPTIONS = [
  { value: 'glavni_trener',       label: 'Glavni trener' },
  { value: 'pomocni_trener',      label: 'Pomoćni trener' },
  { value: 'kondicijski_trener',  label: 'Kondicijski trener' },
  { value: 'sudac',               label: 'Sudac' },
  { value: 'instruktor',          label: 'Instruktor' },
] as const;

export const LICENCA_OPTIONS = [
  { value: 'C_licenca',  label: 'Trenerska C-licenca (HKF)' },
  { value: 'B_licenca',  label: 'Trenerska B-licenca (HKF)' },
  { value: 'A_licenca',  label: 'Trenerska A-licenca (HKF)' },
  { value: 'instruktor', label: 'Instruktorska licenca' },
  { value: 'sudacka',    label: 'Suđačka licenca' },
  { value: 'ostalo',     label: 'Ostalo' },
] as const;

export const ULOGA_LABEL: Record<string, string> = Object.fromEntries(
  ULOGA_OPTIONS.map(o => [o.value, o.label])
);
export const LICENCA_LABEL: Record<string, string> = Object.fromEntries(
  LICENCA_OPTIONS.map(o => [o.value, o.label])
);

export interface Trener {
  id: string;
  ime: string;
  prezime: string;
  oib?: string;
  datRod?: string;
  uloga?: string;
  licenca?: string;
  brLic?: string;
  licVrijedi?: string;  // ISO date "YYYY-MM-DD"
  mob?: string;
  email?: string;
  datZap?: string;
  status: TrenerStatus;
}

export interface TrenerInput {
  ime: string;
  prezime: string;
  oib: string;
  datRod: string;
  uloga: string;
  licenca: string;
  brLic: string;
  licVrijedi: string;
  mob: string;
  email: string;
  datZap: string;
  status: TrenerStatus;
}

function mapRow(r: Record<string, unknown>): Trener {
  return {
    id:         String(r.id ?? ''),
    ime:        String(r.ime ?? ''),
    prezime:    String(r.prezime ?? ''),
    oib:        r.oib    ? String(r.oib)    : undefined,
    datRod:     r.datrod ? String(r.datrod) : undefined,
    uloga:      r.uloga  ? String(r.uloga)  : undefined,
    licenca:    r.licenca ? String(r.licenca) : undefined,
    brLic:      r.brlic  ? String(r.brlic)  : undefined,
    licVrijedi: r.licvrijedi ? String(r.licvrijedi) : undefined,
    mob:        r.mob    ? String(r.mob)    : undefined,
    email:      r.email  ? String(r.email)  : undefined,
    datZap:     r.datzap ? String(r.datzap) : undefined,
    status:     (r.status === 'neaktivan' ? 'neaktivan' : 'aktivan') as TrenerStatus,
  };
}

export async function fetchTreneri(): Promise<Trener[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('treneri')
    .select('*')
    .order('prezime')
    .order('ime');
  if (error) throw error;
  return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
}

export async function insertTrener(input: TrenerInput): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Niste prijavljeni');

  const { data: profil } = await supabase
    .from('profili').select('klub_id').eq('id', user.id).single();
  if (!profil?.klub_id) throw new Error('Klub nije pronađen');

  const { error } = await supabase.from('treneri').insert({
    id:         crypto.randomUUID(),
    klub_id:    profil.klub_id,
    ime:        input.ime.trim(),
    prezime:    input.prezime.trim(),
    oib:        input.oib?.trim()       || null,
    datrod:     input.datRod            || null,
    uloga:      input.uloga             || null,
    licenca:    input.licenca           || null,
    brlic:      input.brLic?.trim()     || null,
    licvrijedi: input.licVrijedi        || null,
    mob:        input.mob?.trim()       || null,
    email:      input.email?.trim()     || null,
    datzap:     input.datZap            || null,
    status:     input.status,
  });
  if (error) throw new Error(error.message);
}

export async function updateTrener(id: string, input: TrenerInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('treneri').update({
    ime:        input.ime.trim(),
    prezime:    input.prezime.trim(),
    oib:        input.oib?.trim()       || null,
    datrod:     input.datRod            || null,
    uloga:      input.uloga             || null,
    licenca:    input.licenca           || null,
    brlic:      input.brLic?.trim()     || null,
    licvrijedi: input.licVrijedi        || null,
    mob:        input.mob?.trim()       || null,
    email:      input.email?.trim()     || null,
    datzap:     input.datZap            || null,
    status:     input.status,
  }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTrener(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('treneri').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
