import { createClient } from '@/lib/supabase-browser';
import type { Member, BeltColor, MemberStatus, TipClanstva } from '@/lib/types';

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

export const BELT_TO_POJAS: Record<BeltColor, string> = {
  bijeli:     'Bijeli pojas',
  žuti:       'Žuti pojas',
  narančasti: 'Narančasti pojas',
  zeleni:     'Zeleni pojas',
  plavi:      'Plavi pojas',
  smeđi:      'Smeđi pojas',
  'crni-1':   '1. DAN',
  'crni-2':   '2. DAN',
  'crni-3':   '3. DAN',
};

const VALID_STATUSES: MemberStatus[] = ['aktivan', 'neaktivan', 'suspendiran'];
const VALID_CATEGORIES: Member['category'][] = ['kadet', 'junior', 'senior', 'veteran', 'mali_karatist'];
const VALID_TIP_CLANSTVA: TipClanstva[] = ['redovni', 'podupiruci', 'pocasni'];

export interface ClanMedInput {
  ime: string;
  prezime: string;
  dat_rod?: string;
  email?: string;
  mobitel?: string;
  adresa?: string;
  tip_clanstva?: TipClanstva;
  pojas: BeltColor;
  kategorija: Member['category'];
  dat_uclan?: string;
  roditelji?: string;
  gdpr: boolean;
  status: MemberStatus;
  medicalExpiry?: string;
}

export async function fetchClanovi(): Promise<Member[]> {
  const supabase = createClient();
  const [{ data: clanovi, error }, { data: lijecnicki }] = await Promise.all([
    supabase.from('clanovi').select('*').order('prezime').order('ime'),
    supabase.from('lijecnicki').select('clan_id, vrijedi').order('vrijedi', { ascending: false }),
  ]);

  if (error) throw error;

  const latestLijek = new Map<number, string>();
  for (const l of lijecnicki ?? []) {
    if (l.clan_id != null && !latestLijek.has(Number(l.clan_id))) {
      latestLijek.set(Number(l.clan_id), l.vrijedi);
    }
  }

  return (clanovi ?? []).map(c => ({
    id: String(c.id),
    firstName: c.ime ?? '',
    lastName: c.prezime ?? '',
    email: c.email ?? '',
    phone: c.mobitel ?? '',
    birthDate: c.dat_rod ?? '',
    memberSince: c.dat_uclan ?? '',
    belt: (POJAS_MAP[c.pojas ?? ''] ?? 'bijeli') as BeltColor,
    status: (VALID_STATUSES.includes(c.status as MemberStatus) ? c.status : 'aktivan') as MemberStatus,
    medicalExpiry: latestLijek.get(Number(c.id)) ?? '',
    consentSigned: c.gdpr === 'da',
    adresa: c.adresa ?? undefined,
    tipClanstva: (VALID_TIP_CLANSTVA.includes(c.tip_clanstva as TipClanstva) ? c.tip_clanstva : undefined) as TipClanstva | undefined,
    guardian: c.roditelji ?? undefined,
    notes: c.bolest ?? undefined,
    category: (VALID_CATEGORIES.includes(c.kategorija as Member['category']) ? c.kategorija : 'senior') as Member['category'],
  }));
}

export async function insertClan(input: ClanMedInput): Promise<void> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Niste prijavljeni');

  const { data: profil } = await supabase
    .from('profili')
    .select('klub_id')
    .eq('id', user.id)
    .single();
  if (!profil?.klub_id) throw new Error('Klub nije pronađen');

  // Crypto-random 15-digit integer: timestamp prefix (13 digits) × 100 + random suffix (0-99)
  // Stays within JS Number.MAX_SAFE_INTEGER, unique under parallel inserts
  const rnd = crypto.getRandomValues(new Uint8Array(1))[0] % 100;
  const newId = Date.now() * 100 + rnd;

  const { error } = await supabase.from('clanovi').insert({
    id:           newId,
    klub_id:      profil.klub_id,
    ime:          input.ime.trim(),
    prezime:      input.prezime.trim(),
    dat_rod:      input.dat_rod || null,
    email:        input.email?.trim() || null,
    mobitel:      input.mobitel?.trim() || null,
    adresa:       input.adresa?.trim() || null,
    tip_clanstva: input.tip_clanstva || 'redovni',
    pojas:        BELT_TO_POJAS[input.pojas],
    kategorija:   input.kategorija,
    dat_uclan:    input.dat_uclan || null,
    roditelji:    input.roditelji?.trim() || null,
    gdpr:         input.gdpr ? 'da' : 'ne',
    status:       input.status,
  });
  if (error) throw new Error(error.message);

  if (input.medicalExpiry) {
    const { error: lErr } = await supabase.from('lijecnicki').insert({
      id:      crypto.randomUUID(),
      klub_id: profil.klub_id,
      clan_id: newId,
      vrijedi: input.medicalExpiry,
    });
    if (lErr) throw new Error(`Član je spremenjen, ali liječnički pregled nije upisan: ${lErr.message}`);
  }
}

export async function updateClan(id: string, input: ClanMedInput): Promise<void> {
  const supabase = createClient();
  const numId = Number(id);

  const { error } = await supabase.from('clanovi').update({
    ime:          input.ime.trim(),
    prezime:      input.prezime.trim(),
    dat_rod:      input.dat_rod || null,
    email:        input.email?.trim() || null,
    mobitel:      input.mobitel?.trim() || null,
    adresa:       input.adresa?.trim() || null,
    tip_clanstva: input.tip_clanstva || 'redovni',
    pojas:        BELT_TO_POJAS[input.pojas],
    kategorija:   input.kategorija,
    dat_uclan:    input.dat_uclan || null,
    roditelji:    input.roditelji?.trim() || null,
    gdpr:         input.gdpr ? 'da' : 'ne',
    status:       input.status,
    updated_at:   new Date().toISOString(),
  }).eq('id', numId);
  if (error) throw new Error(error.message);

  if (input.medicalExpiry) {
    const { data: existing } = await supabase
      .from('lijecnicki')
      .select('id')
      .eq('clan_id', numId)
      .order('vrijedi', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase.from('lijecnicki')
        .update({ vrijedi: input.medicalExpiry })
        .eq('id', existing.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profil } = user
        ? await supabase.from('profili').select('klub_id').eq('id', user.id).single()
        : { data: null };
      await supabase.from('lijecnicki').insert({
        id:      crypto.randomUUID(),
        klub_id: profil?.klub_id ?? null,
        clan_id: numId,
        vrijedi: input.medicalExpiry,
      });
    }
  }
}

export async function fetchVotingMemberCount(): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase
    .from('clanovi')
    .select('dat_rod')
    .eq('status', 'aktivan')
    .eq('tip_clanstva', 'redovni');

  if (!data) return 0;
  const today = new Date();
  return data.filter(c => {
    if (!c.dat_rod) return false;
    const birth = new Date(c.dat_rod);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 18;
  }).length;
}

export async function fetchMemberCount(): Promise<{ active: number; total: number }> {
  const supabase = createClient();
  const [{ count: total }, { count: active }] = await Promise.all([
    supabase.from('clanovi').select('*', { count: 'exact', head: true }),
    supabase.from('clanovi').select('*', { count: 'exact', head: true }).eq('status', 'aktivan'),
  ]);
  return { active: active ?? 0, total: total ?? 0 };
}
