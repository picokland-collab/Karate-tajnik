'use client';

import { useState, useEffect, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import DateInput from '@/components/ui/DateInput';
import { useRole } from '@/lib/hooks/useRole';
import { isExpired } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  fetchTreninziByDate,
  createTrainingSession,
  fetchAttendanceForTraining,
  saveAttendance,
  fetchActiveMembersForAttendance,
} from '@/lib/queries/attendance';
import type { Trening, AttendanceMember, AttendanceStatus } from '@/lib/queries/attendance';
import {
  ClipboardList, Plus, Save, AlertTriangle,
  Check, Loader2, Users, ShieldAlert,
} from 'lucide-react';

// ── HELPERS ────────────────────────────────────────────────────────────────────

const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STATUS_CFG = {
  nazocan:   { label: 'Nazocan',   active: 'bg-green-600/25 text-green-300 border-green-600/50' },
  odsutan:   { label: 'Odsutan',   active: 'bg-red-600/25   text-red-300   border-red-600/50'   },
  opravdano: { label: 'Opravdano', active: 'bg-amber-600/25 text-amber-300 border-amber-600/50' },
} as const;

// ── MAIN CONTENT ───────────────────────────────────────────────────────────────

function PrisustvoContent() {
  const { uloga, roleLoaded } = useRole();
  const canAccess = uloga === 'admin' || uloga === 'trener';

  // ── Date & session ──────────────────────────────────────────────────────────
  const [date,       setDate]       = useState(todayISO);
  const [opisInput,  setOpisInput]  = useState('');
  const [training,   setTraining]   = useState<Trening | null>(null);

  // ── Members & attendance ────────────────────────────────────────────────────
  const [members,    setMembers]    = useState<AttendanceMember[]>([]);
  const [attendance, setAttendance] = useState<Map<number, AttendanceStatus>>(new Map());

  // ── Loading / saving ────────────────────────────────────────────────────────
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [savedOk,        setSavedOk]        = useState(false);
  const [error,          setError]          = useState('');

  // Fetch active members once on mount
  useEffect(() => {
    fetchActiveMembersForAttendance()
      .then(setMembers)
      .catch(e => console.error('[prisustvo] members:', e))
      .finally(() => setLoadingMembers(false));
  }, []);

  // Fetch (or clear) session whenever selected date changes
  useEffect(() => {
    let cancelled = false;
    setLoadingSession(true);
    setTraining(null);
    setAttendance(new Map());
    setSavedOk(false);
    setError('');

    fetchTreninziByDate(date)
      .then(async t => {
        if (cancelled) return;
        setTraining(t);
        if (t) {
          const records = await fetchAttendanceForTraining(t.id);
          if (!cancelled) {
            setAttendance(new Map(records.map(r => [r.memberId, r.status])));
          }
        }
      })
      .catch(e => { if (!cancelled) console.error('[prisustvo] session:', e); })
      .finally(() => { if (!cancelled) setLoadingSession(false); });

    return () => { cancelled = true; };
  }, [date]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const t = await createTrainingSession(date, opisInput.trim() || undefined);
      setTraining(t);
      setOpisInput('');
      // Default every active member to 'odsutan' so coach only needs to tap present ones
      setAttendance(new Map(members.map(m => [m.id, 'odsutan'])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri kreiranju treninga');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (memberId: number, status: AttendanceStatus) => {
    setAttendance(prev => new Map(prev).set(memberId, status));
    setSavedOk(false);
  };

  const handleSave = async () => {
    if (!training) return;
    setSaving(true);
    setError('');
    setSavedOk(false);
    try {
      await saveAttendance(
        training.id,
        Array.from(attendance.entries()).map(([memberId, status]) => ({ memberId, status })),
      );
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri spremanju');
    } finally {
      setSaving(false);
    }
  };

  // ── Access gate ──────────────────────────────────────────────────────────────

  if (roleLoaded && !canAccess) {
    return (
      <AppLayout title="Prisustvo" subtitle="Evidencija treninga">
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <ShieldAlert className="w-12 h-12 text-red-500/50" />
          <p className="text-sm font-semibold text-slate-300">Ograničen pristup</p>
          <p className="text-xs text-slate-500 max-w-xs">
            Evidenciju prisustva mogu unositi isključivo treneri i administratori.
          </p>
        </div>
      </AppLayout>
    );
  }

  const nazocniCount = Array.from(attendance.values()).filter(s => s === 'nazocan').length;
  const expiredCount = members.filter(m => !m.medicalExpiry || isExpired(m.medicalExpiry)).length;

  return (
    <AppLayout
      title="Prisustvo"
      subtitle={
        training
          ? `${nazocniCount} / ${members.length} nazočno`
          : 'Evidencija treninga'
      }
    >
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ── Date picker ──────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Datum treninga
          </label>
          <DateInput
            value={date}
            onChange={d => { setDate(d); setSavedOk(false); }}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 w-full focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        {/* ── Session area ─────────────────────────────────────────── */}
        {loadingSession ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Provjera treninga...
          </div>
        ) : !training ? (

          /* No session for selected date */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-slate-400">
              <ClipboardList className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <p className="text-sm">Nema evidentiranog treninga za odabrani datum.</p>
            </div>
            <input
              value={opisInput}
              onChange={e => setOpisInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !saving) handleCreate(); }}
              placeholder="Naslov treninga (npr. Tehnika, Sparing)..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={saving || loadingMembers}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Plus className="w-4 h-4" />}
              Započni novi trening
            </button>
          </div>

        ) : (
          /* Active session */
          <>
            {/* Session header */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-600/15 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {training.opis ?? 'Trening'}
                </p>
                <p className="text-xs text-slate-500">
                  {nazocniCount} / {members.length} nazočno
                  {expiredCount > 0 && (
                    <span className="text-red-400 ml-2">· {expiredCount} bez liječničkog</span>
                  )}
                </p>
              </div>
            </div>

            {/* Member list */}
            {loadingMembers ? (
              <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Učitavanje članova...
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-12 text-slate-600">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nema aktivnih članova</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map(member => {
                  const currentStatus = attendance.get(member.id) ?? 'odsutan';
                  const medBad = !member.medicalExpiry || isExpired(member.medicalExpiry);

                  return (
                    <div
                      key={member.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5"
                    >
                      {/* Name row */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <p className="flex-1 text-sm font-semibold text-slate-100 truncate">
                          {member.lastName} {member.firstName}
                        </p>
                        {medBad && (
                          <div className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 border border-red-800/40 px-2 py-1 rounded-lg flex-shrink-0" title="Liječnički pregled istekao ili nedostaje">
                            <AlertTriangle className="w-3 h-3" />
                            <span className="hidden sm:inline">Liječnički</span>
                          </div>
                        )}
                      </div>

                      {/* Status buttons */}
                      <div className="flex gap-2">
                        {(Object.keys(STATUS_CFG) as AttendanceStatus[]).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleStatus(member.id, s)}
                            className={cn(
                              'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                              currentStatus === s
                                ? STATUS_CFG[s].active
                                : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300',
                            )}
                          >
                            {STATUS_CFG[s].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            {/* Sticky save button */}
            <div className="sticky bottom-4 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || members.length === 0}
                className={cn(
                  'w-full flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3.5 rounded-2xl transition-all shadow-lg',
                  savedOk
                    ? 'bg-green-700 text-white shadow-green-900/30'
                    : 'bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white shadow-red-900/30',
                )}
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Spremanje...</>
                  : savedOk
                    ? <><Check className="w-4 h-4" /> Prisustvo spremljeno!</>
                    : <><Save className="w-4 h-4" /> Spremi prisustvo</>}
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function PrisustvoPage() {
  return (
    <Suspense fallback={null}>
      <PrisustvoContent />
    </Suspense>
  );
}
