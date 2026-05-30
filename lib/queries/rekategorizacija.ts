import { createClient } from '@/lib/supabase-browser';
import { computeHksCategory, HKS_CAT_LABEL } from '@/lib/utils/hksAge';
import type { HksCategory } from '@/lib/utils/hksAge';

export interface RecategorizationChange {
  id: number;
  ime: string;
  prezime: string;
  staraKat: HksCategory;
  novaKat: HksCategory;
}

/**
 * Fetches all active members with a known birth date, computes correct HKF
 * category for each, and writes updates for any that have changed.
 * Logs every transition to dnevnik_aktivnosti (fire-and-forget — never blocks).
 * Returns the list of members that were actually updated.
 */
export async function runAutoRecategorization(): Promise<RecategorizationChange[]> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Niste prijavljeni');

  const { data: profil } = await supabase
    .from('profili').select('klub_id').eq('id', user.id).single();
  if (!profil?.klub_id) throw new Error('Klub nije pronađen');

  const klubId: string = profil.klub_id;

  // Fetch only fields needed for re-categorization
  const { data: rows, error } = await supabase
    .from('clanovi')
    .select('id, ime, prezime, dat_rod, kategorija')
    .eq('status', 'aktivan')
    .not('dat_rod', 'is', null);

  if (error) throw new Error(`Greška pri dohvatu članova: ${error.message}`);

  // Determine which members need a new category
  const changes: RecategorizationChange[] = [];
  for (const c of rows ?? []) {
    if (!c.dat_rod) continue;
    const novaKat = computeHksCategory(String(c.dat_rod));
    if (!novaKat) continue;

    const validCategories: HksCategory[] = ['mali_karatist', 'kadet', 'junior', 'senior', 'veteran'];
    const staraKat = validCategories.includes(c.kategorija as HksCategory)
      ? (c.kategorija as HksCategory)
      : 'senior';

    if (novaKat === staraKat) continue;

    changes.push({
      id:       Number(c.id),
      ime:      String(c.ime ?? ''),
      prezime:  String(c.prezime ?? ''),
      staraKat,
      novaKat,
    });
  }

  if (changes.length === 0) return [];

  // Apply updates in parallel — each is a targeted single-row update
  const updateResults = await Promise.allSettled(
    changes.map(ch =>
      supabase.from('clanovi')
        .update({ kategorija: ch.novaKat })
        .eq('id', ch.id)
    )
  );

  // Keep only the changes that actually succeeded
  const succeeded = changes.filter((_, i) => updateResults[i].status === 'fulfilled');
  if (succeeded.length === 0) return [];

  // Log each transition to dnevnik_aktivnosti — non-critical, swallow any failure
  try {
    await supabase.from('dnevnik_aktivnosti').insert(
      succeeded.map(ch => ({
        klub_id:        klubId,
        korisnik_id:    user.id,
        radnja:         `Auto HKF rekategorizacija: ${ch.ime} ${ch.prezime} → ${HKS_CAT_LABEL[ch.novaKat]}`,
        vrsta_entiteta: 'clan',
      }))
    );
  } catch {
    // Log failure must never prevent the function from returning results
  }

  return succeeded;
}
