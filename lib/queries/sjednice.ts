import { createClient } from '@/lib/supabase-browser';

export type SjednicaStatus = 'planirana' | 'zavrsena' | 'otkazana';
export type SjednicaVrsta = 'redovna' | 'izvanredna' | 'osnivacka';

export interface Sjednica {
  id: string;
  vrsta: SjednicaVrsta;
  datum: string;   // ISO date string, e.g. "2026-06-15"
  vrijeme: string; // "HH:MM"
  lokacija: string;
  status: SjednicaStatus;
  napomena: string | null;
  dnevni_red: string[];
  broj_dokumenata: number;
}

export async function fetchSjednice(): Promise<Sjednica[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('sjednice')
    .select(`
      id, vrsta, zakazano_za, lokacija, status, napomena,
      tocke_dnevnog_reda ( redni_broj, tekst )
    `)
    .order('zakazano_za', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(s => {
    const dt = new Date(s.zakazano_za);
    const tocke: { redni_broj: number; tekst: string }[] = Array.isArray(s.tocke_dnevnog_reda)
      ? (s.tocke_dnevnog_reda as { redni_broj: number; tekst: string }[])
      : [];
    tocke.sort((a, b) => a.redni_broj - b.redni_broj);

    return {
      id: s.id,
      vrsta: s.vrsta as SjednicaVrsta,
      datum: dt.toISOString().slice(0, 10),
      vrijeme: dt.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      lokacija: s.lokacija ?? '',
      status: s.status as SjednicaStatus,
      napomena: s.napomena ?? null,
      dnevni_red: tocke.map(t => t.tekst),
      broj_dokumenata: 0,
    };
  });
}

export async function insertSjednica(input: {
  vrsta: SjednicaVrsta;
  datum: string;
  vrijeme: string;
  lokacija: string;
  dnevni_red: string[];
}): Promise<string> {
  const supabase = createClient();

  const zakazano_za = `${input.datum}T${input.vrijeme}:00`;

  const { data, error } = await supabase
    .from('sjednice')
    .insert({
      vrsta: input.vrsta,
      zakazano_za,
      lokacija: input.lokacija,
      status: 'planirana',
    })
    .select('id')
    .single();

  if (error) throw error;

  const tocke = input.dnevni_red
    .filter(t => t.trim())
    .map((tekst, i) => ({ sjednica_id: data.id, redni_broj: i + 1, tekst }));

  if (tocke.length > 0) {
    const { error: e2 } = await supabase.from('tocke_dnevnog_reda').insert(tocke);
    if (e2) throw e2;
  }

  return data.id;
}
