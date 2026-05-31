import { createClient } from '@/lib/supabase-browser';

// ── TYPES ─────────────────────────────────────────────────────

/** Full set of values stored in the uloga_korisnika DB enum. */
export type UlogaKorisnikaDB =
  | 'admin'
  | 'predsjednik'
  | 'tajnik'
  | 'trener'
  | 'clan'
  | 'preglednik';

/** Three-tier role set managed by the Korisnici/Permissions module. */
export type UlogaKorisnika = 'admin' | 'trener' | 'preglednik';

export const ULOGA_LABEL: Record<UlogaKorisnika, string> = {
  admin:      'Administrator',
  trener:     'Trener',
  preglednik: 'Preglednik',
};

export interface Korisnik {
  id: string;
  punoIme: string;
  uloga: UlogaKorisnikaDB;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Maps any DB role to the simplified 3-tier app role.
 * Organisational roles (predsjednik, tajnik, clan) are treated as
 * read-only viewers until explicitly promoted.
 */
export function toAppUloga(uloga: UlogaKorisnikaDB): UlogaKorisnika {
  if (uloga === 'admin') return 'admin';
  if (uloga === 'trener') return 'trener';
  return 'preglednik';
}

// ── ROW MAPPER ────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): Korisnik {
  const validUloge: UlogaKorisnikaDB[] = [
    'admin', 'predsjednik', 'tajnik', 'trener', 'clan', 'preglednik',
  ];
  const uloga = validUloge.includes(r.uloga as UlogaKorisnikaDB)
    ? (r.uloga as UlogaKorisnikaDB)
    : 'preglednik';

  return {
    id:        String(r.id ?? ''),
    punoIme:   String(r.puno_ime ?? ''),
    uloga,
    avatarUrl: r.avatar_url ? String(r.avatar_url) : undefined,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ── QUERIES ───────────────────────────────────────────────────

/** Returns all user profiles in the current user's club, ordered by name. */
export async function fetchKorisnici(): Promise<Korisnik[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profili')
    .select('id, puno_ime, uloga, avatar_url, created_at, updated_at')
    .order('puno_ime');
  if (error) throw error;
  return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
}

/**
 * Updates the role of a user in the current club.
 * Requires the caller to be an admin (enforced by RLS policy
 * "profili_admin_uredi_ulogu" on the profili table).
 */
export async function updateKorisnikUloga(
  userId: string,
  uloga: UlogaKorisnika,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('profili')
    .update({ uloga })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}
