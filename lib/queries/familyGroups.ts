import { createClient } from '@/lib/supabase-browser';

export interface FamilyGroup {
  id: string;
  family_name: string;
}

export async function fetchFamilyGroups(): Promise<FamilyGroup[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('family_groups')
    .select('id, family_name')
    .order('family_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFamilyGroup(rawName: string): Promise<FamilyGroup> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Niste prijavljeni');
  const { data: profil } = await supabase
    .from('profili').select('klub_id').eq('id', user.id).single();
  if (!profil?.klub_id) throw new Error('Klub nije pronađen');

  const familyName = rawName.startsWith('Obitelj ') ? rawName : `Obitelj ${rawName}`;
  const { data, error } = await supabase
    .from('family_groups')
    .insert({ klub_id: profil.klub_id, family_name: familyName })
    .select('id, family_name')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function linkMemberToFamily(
  memberId: number,
  familyGroupId: string,
  relationshipType: 'child' | 'parent' | 'guardian' = 'child',
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('member_families').upsert(
    {
      member_id:          memberId,
      family_group_id:    familyGroupId,
      relationship_type:  relationshipType,
      is_primary_contact: false,
    },
    { onConflict: 'member_id,family_group_id' },
  );
  if (error) throw new Error(error.message);
}

export async function fetchMemberFamilyGroup(memberId: number): Promise<FamilyGroup | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('member_families')
    .select('family_group_id, family_groups(id, family_name)')
    .eq('member_id', memberId)
    .order('is_primary_contact', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const raw = data.family_groups;
  // Supabase may infer the join as array or object depending on schema hints
  const fg = (Array.isArray(raw) ? raw[0] : raw) as { id: string; family_name: string } | null | undefined;
  return fg ?? null;
}
