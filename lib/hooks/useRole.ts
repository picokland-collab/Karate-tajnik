import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';

export interface UseRoleResult {
  /** Raw DB value from profili.uloga, null while loading or if unauthenticated. */
  uloga: string | null;
  /** True once the async fetch has settled (success or failure). */
  roleLoaded: boolean;
  /** Strict allowlist: only the 'admin' uloga value. */
  isAdmin: boolean;
  /** Insert permission: admin and trener may add new records. */
  canAdd: boolean;
}

/**
 * Fetches the current user's uloga from profili once on mount.
 * Uses a mounted-flag cleanup so state is never set on an unmounted component.
 */
export function useRole(): UseRoleResult {
  const [uloga, setUloga]           = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return;
      if (!user) {
        setRoleLoaded(true);
        return;
      }
      const { data: profil } = await supabase
        .from('profili')
        .select('uloga')
        .eq('id', user.id)
        .single();
      if (!mounted) return;
      setUloga(profil?.uloga ?? null);
      setRoleLoaded(true);
    });

    return () => { mounted = false; };
  }, []);

  return {
    uloga,
    roleLoaded,
    isAdmin: uloga === 'admin',
    canAdd:  uloga === 'admin' || uloga === 'trener',
  };
}
