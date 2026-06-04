'use client';

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase-browser';

// ── TYPES ─────────────────────────────────────────────────────

export interface ProfileData {
  id: string;
  punoIme: string;
  uloga: string;
  klubId: string | null;
  klubNaziv: string | null;
  avatarUrl: string | null;
}

interface ProfileContextValue {
  profile: ProfileData | null;
  profileLoaded: boolean;
}

// ── CONTEXT ───────────────────────────────────────────────────

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  profileLoaded: false,
});

// ── PROVIDER ──────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile]           = useState<ProfileData | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return;
      if (!user) { setProfileLoaded(true); return; }

      const { data } = await supabase
        .from('profili')
        .select('puno_ime, uloga, klub_id, avatar_url, klubovi(naziv)')
        .eq('id', user.id)
        .single();

      if (!mounted) return;

      if (data) {
        const raw = data as {
          puno_ime:  string | null;
          uloga:     string;
          klub_id:   string | null;
          avatar_url: string | null;
          klubovi:   { naziv: string }[] | { naziv: string } | null;
        };
        const klubNaziv = Array.isArray(raw.klubovi)
          ? (raw.klubovi[0]?.naziv ?? null)
          : (raw.klubovi?.naziv ?? null);

        setProfile({
          id:        user.id,
          punoIme:   raw.puno_ime ?? '',
          uloga:     raw.uloga,
          klubId:    raw.klub_id,
          klubNaziv,
          avatarUrl: raw.avatar_url,
        });
      }

      setProfileLoaded(true);
    });

    return () => { mounted = false; };
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, profileLoaded }}>
      {children}
    </ProfileContext.Provider>
  );
}

// ── HOOK ──────────────────────────────────────────────────────

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
