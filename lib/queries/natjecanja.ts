import { createClient } from '@/lib/supabase-browser';

export type NatjecanjeRazina = 'klubsko' | 'zupanijsko' | 'drzavno' | 'medjunarodno';
export type NatjecanjeVrsta = 'kata' | 'kumite' | 'oboje';
export type MedaljaTip = 'zlato' | 'srebro' | 'bronca';

export const RAZINA_LABEL: Record<NatjecanjeRazina, string> = {
  klubsko:     'Klubsko',
  zupanijsko:  'Županijsko',
  drzavno:     'Državno',
  medjunarodno:'Međunarodno',
};

export interface RezultatNatjecanja {
  id: string;
  clanUuid: string;
  imeClana: string;
  kategorija: string;
  disciplina: string;
  plasman: number;
  medalja: MedaljaTip | null;
}

export interface Natjecanje {
  id: string;
  naziv: string;
  datum: string;
  lokacija: string;
  vrsta: NatjecanjeVrsta;
  razina: NatjecanjeRazina;
  rezultati: RezultatNatjecanja[];
}

export interface MemberOption {
  uuid: string;
  name: string;
}

export async function fetchNatjecanja(): Promise<Natjecanje[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('natjecanja')
    .select(`
      id, naziv, datum, lokacija, vrsta, razina,
      rezultati_natjecanja (
        id, clan_uuid, kategorija, disciplina, plasman, medalja,
        clanovi!rezultati_natjecanja_clan_uuid_fkey ( ime, prezime )
      )
    `)
    .order('datum', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(n => {
    const recs = (n.rezultati_natjecanja as unknown as {
      id: string; clan_uuid: string; kategorija: string;
      disciplina: string; plasman: number; medalja: string | null;
      clanovi: { ime: string; prezime: string }[] | { ime: string; prezime: string } | null;
    }[]);

    return {
      id: n.id,
      naziv: n.naziv,
      datum: n.datum,
      lokacija: n.lokacija,
      vrsta: n.vrsta as NatjecanjeVrsta,
      razina: n.razina as NatjecanjeRazina,
      rezultati: recs.map(r => ({
        id: r.id,
        clanUuid: r.clan_uuid,
        imeClana: (() => {
          const c = Array.isArray(r.clanovi) ? r.clanovi[0] : r.clanovi;
          return c ? `${c.ime} ${c.prezime}`.trim() : '—';
        })(),
        kategorija: r.kategorija,
        disciplina: r.disciplina,
        plasman: r.plasman,
        medalja: (r.medalja as MedaljaTip | null),
      })),
    };
  });
}

export async function fetchMemberOptions(): Promise<MemberOption[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('clanovi')
    .select('uuid_id, ime, prezime')
    .eq('status', 'aktivan')
    .order('prezime')
    .order('ime');

  if (error) throw error;

  return (data ?? [])
    .filter(c => c.uuid_id)
    .map(c => ({ uuid: c.uuid_id as string, name: `${c.prezime} ${c.ime}` }));
}

export async function insertNatjecanje(input: {
  naziv: string;
  datum: string;
  lokacija: string;
  vrsta: NatjecanjeVrsta;
  razina: NatjecanjeRazina;
  rezultati: { clanUuid: string; kategorija: string; disciplina: string; plasman: number; medalja: MedaljaTip | '' }[];
}): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('natjecanja')
    .insert({
      naziv: input.naziv,
      datum: input.datum,
      lokacija: input.lokacija,
      vrsta: input.vrsta,
      razina: input.razina,
    })
    .select('id')
    .single();

  if (error) throw error;

  const recs = input.rezultati.filter(r => r.clanUuid);
  if (recs.length > 0) {
    const { error: e2 } = await supabase.from('rezultati_natjecanja').insert(
      recs.map(r => ({
        natjecanje_id: data.id,
        clan_uuid: r.clanUuid,
        kategorija: r.kategorija,
        disciplina: r.disciplina,
        plasman: r.plasman,
        medalja: r.medalja || null,
      }))
    );
    if (e2) throw e2;
  }

  return data.id;
}
