import { useProfile } from '@/lib/context/ProfileContext';

export interface UseRoleResult {
  /** Raw DB value from profili.uloga, null while loading or if unauthenticated. */
  uloga: string | null;
  /** True once the profile fetch has settled (success or failure). */
  roleLoaded: boolean;
  /** Strict allowlist: only the 'admin' uloga value. */
  isAdmin: boolean;
  /** Insert permission: admin and trener may add new records. */
  canAdd: boolean;
}

/**
 * Derives role flags from the shared ProfileContext.
 * Zero DB calls — reads data that was already fetched once by ProfileProvider.
 */
export function useRole(): UseRoleResult {
  const { profile, profileLoaded } = useProfile();
  const uloga = profile?.uloga ?? null;

  return {
    uloga,
    roleLoaded: profileLoaded,
    isAdmin:    uloga === 'admin',
    canAdd:     uloga === 'admin' || uloga === 'trener',
  };
}
