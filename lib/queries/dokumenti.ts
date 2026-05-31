import { createClient } from '@/lib/supabase-browser';

export type VrstaDokumenta = 'zapisnik' | 'odluka' | 'izvjestaj' | 'ugovor' | 'ostalo';
export type StatusDokumenta = 'nacrt' | 'na_odobrenju' | 'usvojeno';

export interface Dokument {
  id: string;
  naziv: string;
  vrsta: VrstaDokumenta;
  status: StatusDokumenta;
  sadrzaj: string | null;
  autor_id: string | null;
  sjednica_id: string | null;
  created_at: string;
  updated_at: string;
}

export const VRSTA_LABEL: Record<VrstaDokumenta, string> = {
  zapisnik:  'Zapisnik',
  odluka:    'Odluka',
  izvjestaj: 'Izvještaj',
  ugovor:    'Ugovor',
  ostalo:    'Ostalo',
};

export const STATUS_LABEL: Record<StatusDokumenta, string> = {
  nacrt:        'Nacrt',
  na_odobrenju: 'Na odobrenju',
  usvojeno:     'Usvojeno',
};

export async function fetchDokumenti(): Promise<Dokument[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('dokumenti')
    .select('id, naziv, vrsta, status, sadrzaj, autor_id, sjednica_id, created_at, updated_at')
    .order('created_at', { ascending: false });
  return (data ?? []) as Dokument[];
}

export async function insertDokument(input: {
  naziv: string;
  vrsta: VrstaDokumenta;
  sadrzaj: string;
  sjednica_id?: string | null;
}): Promise<string> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Niste prijavljeni');

  const { data: profil } = await supabase
    .from('profili')
    .select('klub_id')
    .eq('id', user.id)
    .single();
  if (!profil) throw new Error('Profil nije pronađen');

  const { data, error } = await supabase
    .from('dokumenti')
    .insert({
      naziv:       input.naziv,
      vrsta:       input.vrsta,
      sadrzaj:     input.sadrzaj,
      sjednica_id: input.sjednica_id ?? null,
      autor_id:    user.id,
      klub_id:     profil.klub_id,
      status:      'nacrt',
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateDokumentStatus(id: string, status: StatusDokumenta): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('dokumenti')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteDokument(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('dokumenti')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
