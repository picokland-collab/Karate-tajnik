import { createClient } from '@/lib/supabase-browser';
import type { Alert } from '@/lib/types';

export interface DnevnikEntry {
  id: string;
  radnja: string;
  vrsta_entiteta: string;
  created_at: string;
}

const OZBILJNOST_MAP: Record<string, Alert['type']> = {
  kriticno:   'critical',
  upozorenje: 'warning',
  info:       'info',
};

const ACTION_LABEL: Record<string, string> = {
  istek_mandata:          'Zakaži skupštinu',
  istekao_lijecnicki:     'Pregledaj članove',
  lijecnicki_uskoro:      'Pregledaj članove',
  nepotpisana_gdpr:       'Pregledaj privole',
  'predstojeća_sjednica': 'Detalji',
};

export async function fetchUpozorenja(): Promise<Alert[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('upozorenja')
    .select('kljuc, ozbiljnost, naslov, opis, broj, url_akcije');
  if (error) return [];

  return (data ?? []).map((u, i) => ({
    id: `u-${i}`,
    type: OZBILJNOST_MAP[u.ozbiljnost] ?? 'info',
    title: u.naslov,
    description: u.opis,
    action: ACTION_LABEL[u.kljuc],
    actionUrl: u.url_akcije,
    count: u.broj ?? undefined,
  }));
}

export async function fetchMedaljeCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from('rezultati_natjecanja')
    .select('*', { count: 'exact', head: true })
    .not('medalja', 'is', null);
  return count ?? 0;
}

export async function fetchKlubInfo(): Promise<{
  naziv: string;
  predsjednik: string | null;
  datumMandata: string | null;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('klubovi')
    .select('naziv, predsjednik, datum_mandata')
    .maybeSingle();
  if (!data) return null;
  return {
    naziv: data.naziv,
    predsjednik: data.predsjednik,
    datumMandata: data.datum_mandata,
  };
}

export interface KlubPodaci {
  id: string;
  naziv: string;
  oib: string | null;
  grad: string | null;
  kontakt_email: string | null;
  predsjednik: string | null;
  datum_mandata: string | null;
  godina_osnivanja: number | null;
}

export async function fetchKlubPodaci(): Promise<KlubPodaci | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('klubovi')
    .select('id, naziv, oib, grad, kontakt_email, predsjednik, datum_mandata, godina_osnivanja')
    .maybeSingle();
  if (error || !data) return null;
  return data as KlubPodaci;
}

export async function updateKlub(
  id: string,
  patch: Partial<Omit<KlubPodaci, 'id'>>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('klubovi')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchDnevnikAktivnosti(): Promise<DnevnikEntry[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('dnevnik_aktivnosti')
    .select('id, radnja, vrsta_entiteta, created_at')
    .order('created_at', { ascending: false })
    .limit(8);
  return data ?? [];
}

export async function fetchCurrentUserName(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '';
  const { data } = await supabase
    .from('profili')
    .select('puno_ime')
    .eq('id', user.id)
    .maybeSingle();
  return data?.puno_ime ?? '';
}
