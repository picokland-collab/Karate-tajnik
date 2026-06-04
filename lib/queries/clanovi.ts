import { createClient } from '@/lib/supabase-browser';
import type { Member, BeltColor, MemberStatus, TipClanstva } from '@/lib/types';

export interface FetchClanoviParams {
  page?:         number;
  limit?:        number;
  search?:       string;
  filterStatus?: 'svi' | 'aktivni' | 'neaktivni';
  filterBelt?:   BeltColor | 'svi';
}

export interface FetchClanoviResult {
  members:    Member[];
  hasMore:    boolean;
  totalCount: number;
}

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
  // HKS registration fields
  oib?: string;
  spol?: 'M' | 'Ž';
  mjestRodjenja?: string;
  drzavaRodjenja?: string;
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
    oib:                c.oib           ?? undefined,
    spol:               (c.spol === 'M' || c.spol === 'Ž') ? c.spol as 'M' | 'Ž' : undefined,
    mjestRodjenja:      c.mjesto_rodjenja  ?? undefined,
    drzavaRodjenja:     c.drzava_rodjenja  ?? undefined,
    oslobodjenClanarina: c.oslobodjen_clanarina ?? false,
  }));
}

export async function fetchClanoviPaginated({
  page         = 0,
  limit        = 30,
  search       = '',
  filterStatus = 'svi',
  filterBelt   = 'svi',
}: FetchClanoviParams = {}): Promise<FetchClanoviResult> {
  const supabase = createClient();
  const from = page * limit;
  const to   = from + limit - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from('clanovi').select('*', { count: 'exact' });

  const s = search.trim();
  if (s) {
    query = query.or(`ime.ilike.%${s}%,prezime.ilike.%${s}%,email.ilike.%${s}%`);
  }
  if (filterStatus === 'aktivni')   query = query.eq('status', 'aktivan');
  if (filterStatus === 'neaktivni') query = query.eq('status', 'neaktivan');
  if (filterBelt !== 'svi')         query = query.eq('pojas', BELT_TO_POJAS[filterBelt as BeltColor]);

  const { data: clanovi, error, count } = await query
    .order('prezime')
    .order('ime')
    .range(from, to);

  if (error) throw new Error((error as { message: string }).message);

  const rows = (clanovi ?? []) as Record<string, unknown>[];
  const memberIds = rows.map(c => Number(c.id));

  const latestLijek = new Map<number, string>();
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from('lijecnicki')
      .select('clan_id, vrijedi')
      .in('clan_id', memberIds)
      .order('vrijedi', { ascending: false });
    for (const l of data ?? []) {
      const id = Number(l.clan_id);
      if (!latestLijek.has(id)) latestLijek.set(id, l.vrijedi as string);
    }
  }

  const members: Member[] = rows.map(c => ({
    id:                  String(c.id),
    firstName:           (c.ime as string)     ?? '',
    lastName:            (c.prezime as string)  ?? '',
    email:               (c.email as string)    ?? '',
    phone:               (c.mobitel as string)  ?? '',
    birthDate:           (c.dat_rod as string)  ?? '',
    memberSince:         (c.dat_uclan as string) ?? '',
    belt:                (POJAS_MAP[(c.pojas as string) ?? ''] ?? 'bijeli') as BeltColor,
    status:              (VALID_STATUSES.includes(c.status as MemberStatus) ? c.status : 'aktivan') as MemberStatus,
    medicalExpiry:       latestLijek.get(Number(c.id)) ?? '',
    consentSigned:       c.gdpr === 'da',
    adresa:              (c.adresa as string)       ?? undefined,
    tipClanstva:         (VALID_TIP_CLANSTVA.includes(c.tip_clanstva as TipClanstva) ? c.tip_clanstva : undefined) as TipClanstva | undefined,
    guardian:            (c.roditelji as string)    ?? undefined,
    notes:               (c.bolest as string)       ?? undefined,
    category:            (VALID_CATEGORIES.includes(c.kategorija as Member['category']) ? c.kategorija : 'senior') as Member['category'],
    oib:                 (c.oib as string)          ?? undefined,
    spol:                (c.spol === 'M' || c.spol === 'Ž') ? c.spol as 'M' | 'Ž' : undefined,
    mjestRodjenja:       (c.mjesto_rodjenja as string) ?? undefined,
    drzavaRodjenja:      (c.drzava_rodjenja as string) ?? undefined,
    oslobodjenClanarina: (c.oslobodjen_clanarina as boolean) ?? false,
  }));

  const total = (count as number) ?? 0;
  return { members, hasMore: from + members.length < total, totalCount: total };
}

export async function insertClan(input: ClanMedInput): Promise<number> {
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
    roditelji:       input.roditelji?.trim() || null,
    gdpr:            input.gdpr ? 'da' : 'ne',
    status:          input.status,
    oib:             input.oib?.trim()            || null,
    spol:            input.spol                   || null,
    mjesto_rodjenja: input.mjestRodjenja?.trim()  || null,
    drzava_rodjenja: input.drzavaRodjenja?.trim() || null,
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

  return newId;
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
    roditelji:       input.roditelji?.trim()       || null,
    gdpr:            input.gdpr ? 'da' : 'ne',
    status:          input.status,
    oib:             input.oib?.trim()             || null,
    spol:            input.spol                    || null,
    mjesto_rodjenja: input.mjestRodjenja?.trim()   || null,
    drzava_rodjenja: input.drzavaRodjenja?.trim()  || null,
    updated_at:      new Date().toISOString(),
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

/** Toggles the UO exemption flag for a member. */
export async function toggleOslobodjenClanarina(
  memberId: string,
  oslobodjen: boolean,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('clanovi')
    .update({ oslobodjen_clanarina: oslobodjen })
    .eq('id', Number(memberId));
  if (error) throw new Error(error.message);
}

/** Upserts the latest medical-exam expiry date for a member. */
export async function updateMedicalExpiry(memberId: string, expiry: string): Promise<void> {
  const supabase = createClient();
  const numId = Number(memberId);

  const { data: existing } = await supabase
    .from('lijecnicki')
    .select('id')
    .eq('clan_id', numId)
    .order('vrijedi', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('lijecnicki')
      .update({ vrijedi: expiry })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profil } = user
      ? await supabase.from('profili').select('klub_id').eq('id', user.id).single()
      : { data: null };
    const { error } = await supabase.from('lijecnicki').insert({
      id:      crypto.randomUUID(),
      klub_id: profil?.klub_id ?? null,
      clan_id: numId,
      vrijedi: expiry,
    });
    if (error) throw new Error(error.message);
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

export async function deleteClan(id: string): Promise<void> {
  const supabase = createClient();
  const numId = Number(id);

  // Fetch uuid_id needed for rezultati_natjecanja FK before deleting
  const { data: clan } = await supabase
    .from('clanovi')
    .select('uuid_id')
    .eq('id', numId)
    .single();

  // Remove child records first — lijecnicki and competition results may not
  // have ON DELETE CASCADE in the original schema, so we clean up manually.
  await supabase.from('lijecnicki').delete().eq('clan_id', numId);

  if (clan?.uuid_id) {
    await supabase.from('rezultati_natjecanja').delete().eq('clan_uuid', clan.uuid_id);
  }

  const { error } = await supabase.from('clanovi').delete().eq('id', numId);
  if (error) throw new Error(error.message);
}

export async function fetchMemberCount(): Promise<{ active: number; total: number }> {
  const supabase = createClient();
  const [{ count: total }, { count: active }] = await Promise.all([
    supabase.from('clanovi').select('*', { count: 'exact', head: true }),
    supabase.from('clanovi').select('*', { count: 'exact', head: true }).eq('status', 'aktivan'),
  ]);
  return { active: active ?? 0, total: total ?? 0 };
}
