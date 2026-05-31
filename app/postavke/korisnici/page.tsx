'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { Users, Shield, ChevronLeft, ChevronDown, Loader2, AlertCircle, Lock } from 'lucide-react';
import {
  fetchKorisnici, updateKorisnikUloga, toAppUloga,
} from '@/lib/queries/korisnici';
import type { Korisnik, UlogaKorisnika, UlogaKorisnikaDB } from '@/lib/queries/korisnici';
import { createClient } from '@/lib/supabase-browser';
import { formatDate } from '@/lib/utils';

// ── BADGE & LABEL MAPS ────────────────────────────────────────

const BADGE_CLS: Record<UlogaKorisnika, string> = {
  admin:      'bg-red-950/60 text-red-300 border border-red-800/50',
  trener:     'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50',
  preglednik: 'bg-slate-800 text-slate-400 border border-slate-700',
};

const DB_LABEL: Record<UlogaKorisnikaDB, string> = {
  admin:       'Administrator',
  predsjednik: 'Predsjednik',
  tajnik:      'Tajnik',
  trener:      'Trener',
  clan:        'Član',
  preglednik:  'Preglednik',
};

const ROLE_OPTIONS: { value: UlogaKorisnika; label: string }[] = [
  { value: 'admin',      label: 'Administrator' },
  { value: 'trener',     label: 'Trener' },
  { value: 'preglednik', label: 'Preglednik' },
];

const LEGEND_ITEMS: { role: UlogaKorisnika; desc: string }[] = [
  { role: 'admin',      desc: 'Puno pravo — podešavanja i upravljanje korisnicima' },
  { role: 'trener',     desc: 'Uređivanje članova, treninga i natjecanja' },
  { role: 'preglednik', desc: 'Samo pregled — ne može mijenjati podatke' },
];

// ── SUB-COMPONENTS ────────────────────────────────────────────

function RoleBadge({ uloga }: { uloga: UlogaKorisnikaDB }) {
  const appRole = toAppUloga(uloga);
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg ${BADGE_CLS[appRole]}`}>
      {DB_LABEL[uloga]}
    </span>
  );
}

function RoleSelector({
  korisnik,
  busy,
  onSelect,
}: {
  korisnik: Korisnik;
  busy: boolean;
  onSelect: (uloga: UlogaKorisnika) => void;
}) {
  if (busy) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400 w-28 justify-end">
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        <span>Ažurira…</span>
      </div>
    );
  }

  return (
    <div className="relative w-28">
      <select
        value={toAppUloga(korisnik.uloga)}
        onChange={e => onSelect(e.target.value as UlogaKorisnika)}
        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg pl-2.5 pr-7 py-1.5 outline-none focus:border-red-500 transition-colors cursor-pointer appearance-none"
      >
        {ROLE_OPTIONS.map(o => (
          <option key={o.value} value={o.value} className="bg-slate-800 text-slate-100">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────

export default function KorisniciPage() {
  const [korisnici, setKorisnici]     = useState<Korisnik[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [myId, setMyId]               = useState<string | null>(null);
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [updateError, setUpdateError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const [data, authResp] = await Promise.all([
        fetchKorisnici(),
        supabase.auth.getUser(),
      ]);
      setMyId(authResp.data.user?.id ?? null);
      setKorisnici(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri dohvaćanju korisnika.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (korisnik: Korisnik, newRole: UlogaKorisnika) => {
    if (toAppUloga(korisnik.uloga) === newRole) return;
    setUpdatingId(korisnik.id);
    setUpdateError('');
    try {
      await updateKorisnikUloga(korisnik.id, newRole);
      // Optimistic update — newRole is a subset of UlogaKorisnikaDB so the cast is safe
      setKorisnici(prev =>
        prev.map(k => k.id === korisnik.id ? { ...k, uloga: newRole as UlogaKorisnikaDB } : k)
      );
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : 'Greška pri promjeni uloge.');
      setTimeout(() => setUpdateError(''), 6000);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AppLayout title="Korisnici i dozvole" subtitle="Upravljanje pristupom aplikaciji">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Breadcrumb */}
        <Link
          href="/postavke"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Postavke
        </Link>

        {/* Main card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">

          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">Korisnički računi kluba</p>
              <p className="text-xs text-slate-500">
                Svi profili koji imaju pristup aplikaciji za ovaj klub
              </p>
            </div>
          </div>

          {/* Role legend */}
          <div className="grid grid-cols-3 gap-3">
            {LEGEND_ITEMS.map(({ role, desc }) => (
              <div key={role} className="bg-slate-800/50 rounded-xl p-3 space-y-2">
                <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg ${BADGE_CLS[role]}`}>
                  {DB_LABEL[role]}
                </span>
                <p className="text-xs text-slate-500 leading-snug">{desc}</p>
              </div>
            ))}
          </div>

          {/* Update error */}
          {updateError && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{updateError}</span>
            </div>
          )}

          {/* User list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : korisnici.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500">Nema korisnika za ovaj klub.</p>
              <p className="text-xs text-slate-600 max-w-xs">
                Pozovite kolege putem Supabase Auth → Authentication → Users → Invite user.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {korisnici.map(k => {
                const isSelf   = k.id === myId;
                const isBusy   = updatingId === k.id;
                const initials = (k.punoIme || '?')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(w => w[0])
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={k.id}
                    className={`flex items-center gap-3 py-4 first:pt-1 last:pb-1 transition-opacity ${isBusy ? 'opacity-50' : ''}`}
                  >
                    {/* Initials avatar */}
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-slate-400">{initials}</span>
                    </div>

                    {/* Name + date */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-100 truncate">
                          {k.punoIme || <span className="text-slate-500 italic">Nepoznat</span>}
                        </p>
                        {isSelf && (
                          <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md leading-none flex-shrink-0">
                            vi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Pristup od {formatDate(k.createdAt)}
                      </p>
                    </div>

                    {/* Role badge (hidden on mobile to save space) */}
                    <div className="hidden sm:block flex-shrink-0">
                      <RoleBadge uloga={k.uloga} />
                    </div>

                    {/* Action column */}
                    <div className="flex-shrink-0">
                      {isSelf ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 w-28 justify-end">
                          <Lock className="w-3 h-3 flex-shrink-0" />
                          <span>vaš račun</span>
                        </div>
                      ) : (
                        <RoleSelector
                          korisnik={k}
                          busy={isBusy}
                          onSelect={newRole => { void handleRoleChange(k, newRole); }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Email / invite note */}
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4 flex items-start gap-3">
          <Shield className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-500">
            <p className="font-semibold text-slate-400">Email adrese i pozivnice</p>
            <p>
              Email adrese upravljaju se putem Supabase Auth. Nove korisnike pozovite na:{' '}
              <span className="font-mono text-slate-400">Authentication → Users → Invite user</span>.
            </p>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
