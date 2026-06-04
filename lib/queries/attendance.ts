import { createClient } from '@/lib/supabase-browser';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export interface Trening {
  id:         string;   // TEXT in DB (no UUID default)
  datum:      string;   // ISO date
  opis:       string | null;  // maps to DB column `naslov`
  created_at: string;
}

export type AttendanceStatus = 'nazocan' | 'odsutan' | 'opravdano';

export interface AttendanceRecord {
  memberId: number;
  status:   AttendanceStatus;
}

export interface AttendanceMember {
  id:            number;
  firstName:     string;
  lastName:      string;
  medicalExpiry: string;
}

// ── TRAINING SESSION QUERIES ────────────────────────────────────────────────────

/** Returns the training session for a given ISO date, or null if none exists. */
export async function fetchTreninziByDate(date: string): Promise<Trening | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('treninzi')
    .select('id, datum, naslov, created_at')
    .eq('datum', date)
    .maybeSingle();
  if (!data) return null;
  return {
    id:         data.id as string,
    datum:      data.datum as string,
    opis:       (data.naslov as string | null) ?? null,
    created_at: data.created_at as string,
  };
}

/** Creates a new training session for the given date. */
export async function createTrainingSession(
  date: string,
  opis?: string,
): Promise<Trening> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Niste prijavljeni');

  const { data: profil } = await supabase
    .from('profili')
    .select('klub_id')
    .eq('id', user.id)
    .single();
  if (!profil?.klub_id) throw new Error('Klub nije pronađen');

  // treninzi.id has no DB default; we supply a UUID from the browser
  const newId = crypto.randomUUID();
  const { data, error } = await supabase
    .from('treninzi')
    .insert({
      id:      newId,
      klub_id: profil.klub_id,
      datum:   date,
      naslov:  opis ?? null,
    })
    .select('id, datum, naslov, created_at')
    .single();
  if (error) throw new Error(error.message);
  return {
    id:         data.id as string,
    datum:      data.datum as string,
    opis:       (data.naslov as string | null) ?? null,
    created_at: data.created_at as string,
  };
}

// ── ATTENDANCE QUERIES ──────────────────────────────────────────────────────────

/** Fetches all recorded attendance rows for a given training session. */
export async function fetchAttendanceForTraining(
  trainingId: string,
): Promise<AttendanceRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('prisustvo_clanovi')
    .select('member_id, status')
    .eq('trening_id', trainingId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    memberId: Number(r.member_id),
    status:   r.status as AttendanceStatus,
  }));
}

/** Batch-upserts attendance records for a training session. */
export async function saveAttendance(
  trainingId: string,
  records: AttendanceRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from('prisustvo_clanovi')
    .upsert(
      records.map(r => ({
        trening_id: trainingId,
        member_id:  r.memberId,
        status:     r.status,
      })),
      { onConflict: 'trening_id,member_id' },
    );
  if (error) throw new Error(error.message);
}

// ── MEMBER LIST ─────────────────────────────────────────────────────────────────

/** Fetches all active members for the attendance sheet (lightweight — id/name/medical only). */
export async function fetchActiveMembersForAttendance(): Promise<AttendanceMember[]> {
  const supabase = createClient();
  const [clanRes, ljecRes] = await Promise.all([
    supabase
      .from('clanovi')
      .select('id, ime, prezime')
      .eq('status', 'aktivan')
      .order('prezime')
      .order('ime'),
    supabase
      .from('lijecnicki')
      .select('clan_id, vrijedi')
      .order('vrijedi', { ascending: false }),
  ]);
  if (clanRes.error) throw new Error(clanRes.error.message);

  const latestLijek = new Map<number, string>();
  for (const l of ljecRes.data ?? []) {
    const id = Number(l.clan_id);
    if (!latestLijek.has(id)) latestLijek.set(id, l.vrijedi as string);
  }

  return (clanRes.data ?? []).map(c => ({
    id:            Number(c.id),
    firstName:     (c.ime as string)    ?? '',
    lastName:      (c.prezime as string) ?? '',
    medicalExpiry: latestLijek.get(Number(c.id)) ?? '',
  }));
}
