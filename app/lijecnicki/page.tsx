'use client';

import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  Stethoscope, Search, X, Loader2,
  CheckCircle, XCircle, Clock, ChevronRight, Save,
} from 'lucide-react';
import { fetchClanovi, updateMedicalExpiry } from '@/lib/queries/clanovi';
import { useRole } from '@/lib/hooks/useRole';
import { beltLabels } from '@/lib/mock-data';
import { formatDate, daysUntil, cn } from '@/lib/utils';
import type { Member } from '@/lib/types';
import DateInput from '@/components/ui/DateInput';

// ── STATUS LOGIC ──────────────────────────────────────────────

type StatusPregleda = 'neispravan' | 'istjece_uskoro' | 'vazeci';

function getStatus(medicalExpiry: string): StatusPregleda {
  if (!medicalExpiry) return 'neispravan';
  const days = daysUntil(medicalExpiry);
  if (isNaN(days) || days < 0) return 'neispravan';
  if (days <= 15) return 'istjece_uskoro';
  return 'vazeci';
}

// Sort order: most urgent first
const STATUS_ORDER: Record<StatusPregleda, number> = {
  neispravan:     0,
  istjece_uskoro: 1,
  vazeci:         2,
};

function sortMembers(members: Member[]): Member[] {
  return [...members].sort((a, b) => {
    const sa = STATUS_ORDER[getStatus(a.medicalExpiry)];
    const sb = STATUS_ORDER[getStatus(b.medicalExpiry)];
    if (sa !== sb) return sa - sb;
    const da = a.medicalExpiry ? daysUntil(a.medicalExpiry) : -99999;
    const db = b.medicalExpiry ? daysUntil(b.medicalExpiry) : -99999;
    return da - db;
  });
}

// ── STATUS BADGE ──────────────────────────────────────────────

function StatusBadge({ medicalExpiry }: { medicalExpiry: string }) {
  const status = getStatus(medicalExpiry);

  if (status === 'neispravan') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-950/60 text-red-300 border border-red-800/50 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
        {medicalExpiry ? 'Istekao' : 'Neispravan'}
      </span>
    );
  }

  if (status === 'istjece_uskoro') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/50 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        Istječe za {daysUntil(medicalExpiry)}d
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-950/60 text-green-300 border border-green-800/50 whitespace-nowrap">
      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
      Važeći
    </span>
  );
}

// ── STAT CARD ─────────────────────────────────────────────────

type StatColor = 'red' | 'amber' | 'green' | 'slate';

const STAT_CLS: Record<StatColor, { text: string; bg: string; border: string }> = {
  red:   { text: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-800/30'   },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-800/30' },
  green: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-800/30' },
  slate: { text: 'text-slate-300', bg: 'bg-slate-800',    border: 'border-slate-700'    },
};

function StatCard({
  label, count, color, icon: Icon,
}: {
  label: string;
  count: number;
  color: StatColor;
  icon: React.FC<{ className?: string }>;
}) {
  const { text, bg, border } = STAT_CLS[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border', bg, border)}>
        <Icon className={cn('w-5 h-5', text)} />
      </div>
      <div>
        <p className={cn('text-xl font-bold leading-none', text)}>{count}</p>
        <p className="text-xs text-slate-500 mt-1 leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ── FILTER TABS ───────────────────────────────────────────────

type FilterTab = 'svi' | StatusPregleda;

const FILTER_TABS: { key: FilterTab; label: string; countColor: string }[] = [
  { key: 'svi',           label: 'Svi',                   countColor: 'text-slate-500'  },
  { key: 'neispravan',    label: 'Istekli / Neispravni',  countColor: 'text-red-400'    },
  { key: 'istjece_uskoro',label: 'Istječu uskoro',        countColor: 'text-amber-400'  },
  { key: 'vazeci',        label: 'Važeći',                countColor: 'text-green-400'  },
];

// ── MAIN PAGE ─────────────────────────────────────────────────

export default function LijecnickiPage() {
  // ── ROLE GATE ───────────────────────────────────────────────
  const { isAdmin, roleLoaded } = useRole();
  const canEdit = isAdmin;

  // ── DATA ────────────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  function loadMembers() {
    return fetchClanovi()
      .then(data => setMembers(sortMembers(data)))
      .catch(err => console.error('fetchClanovi:', err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMembers(); }, []);

  // ── EDIT MODAL STATE ─────────────────────────────────────────
  const [editMember, setEditMember]   = useState<Member | null>(null);
  const [editExpiry, setEditExpiry]   = useState('');
  const [saving,     setSaving]       = useState(false);
  const [saveError,  setSaveError]    = useState('');

  function openEdit(m: Member) {
    setEditMember(m);
    setEditExpiry(m.medicalExpiry ?? '');
    setSaveError('');
  }

  function closeEdit() {
    setEditMember(null);
    setEditExpiry('');
    setSaveError('');
  }

  async function handleSave() {
    if (!editMember || !editExpiry) return;
    setSaving(true);
    setSaveError('');
    try {
      await updateMedicalExpiry(editMember.id, editExpiry);
      // Update local state immediately so table reflects change
      setMembers(prev => sortMembers(prev.map(m =>
        m.id === editMember.id ? { ...m, medicalExpiry: editExpiry } : m
      )));
      closeEdit();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Greška pri spremanju.');
    } finally {
      setSaving(false);
    }
  }

  // ── FILTERS ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<FilterTab>('svi');
  const [search, setSearch]       = useState('');

  const counts = useMemo(() => ({
    neispravan:     members.filter(m => getStatus(m.medicalExpiry) === 'neispravan').length,
    istjece_uskoro: members.filter(m => getStatus(m.medicalExpiry) === 'istjece_uskoro').length,
    vazeci:         members.filter(m => getStatus(m.medicalExpiry) === 'vazeci').length,
  }), [members]);

  const filtered = useMemo(() => members.filter(m => {
    if (activeTab !== 'svi' && getStatus(m.medicalExpiry) !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${m.firstName} ${m.lastName}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [members, activeTab, search]);

  const subtitle = loading
    ? 'Učitavanje...'
    : `${counts.neispravan} isteklih · ${counts.istjece_uskoro} uskoro · ${counts.vazeci} važećih`;

  return (
    <AppLayout title="Liječnički pregledi" subtitle={subtitle}>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Stats row ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Svi članovi"          count={members.length}          color="slate" icon={Stethoscope} />
          <StatCard label="Istekli / Neispravni" count={counts.neispravan}       color="red"   icon={XCircle}     />
          <StatCard label="Istječu uskoro (≤15d)" count={counts.istjece_uskoro}  color="amber" icon={Clock}       />
          <StatCard label="Važeći pregledi"       count={counts.vazeci}          color="green" icon={CheckCircle} />
        </div>

        {/* ── Filter bar ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">

          {/* Tab pills */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 flex-wrap">
            {FILTER_TABS.map(tab => {
              const tabCount =
                tab.key === 'svi'            ? members.length        :
                tab.key === 'neispravan'     ? counts.neispravan     :
                tab.key === 'istjece_uskoro' ? counts.istjece_uskoro :
                counts.vazeci;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5',
                    activeTab === tab.key
                      ? 'bg-red-600/20 text-red-300 border border-red-600/30'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {tab.label}
                  <span className={cn('font-bold tabular-nums', tab.countColor)}>
                    {tabCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 flex-1 min-w-0 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pretraži po imenu..."
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-full"
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>

          <span className="text-xs text-slate-600 sm:ml-auto flex-shrink-0">
            {filtered.length} / {members.length} članova
          </span>
        </div>

        {/* ── Table / list ──────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-3" />
            Učitavanje pregleda...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nema članova koji odgovaraju odabranom filteru.</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Ime i Prezime</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Pojas</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Kategorija</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Datum pregleda</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Status</th>
                    {canEdit && (
                      <th className="px-5 py-3.5" />
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map(m => {
                    const belt   = beltLabels[m.belt];
                    const status = getStatus(m.medicalExpiry);
                    return (
                      <tr
                        key={m.id}
                        className={cn(
                          'transition-colors hover:bg-slate-800/30',
                          status === 'neispravan'     && 'bg-red-950/[0.08]',
                          status === 'istjece_uskoro' && 'bg-amber-950/[0.05]',
                        )}
                      >
                        {/* Name */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                              {m.firstName[0]}{m.lastName[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-100 leading-snug">
                                {m.firstName} {m.lastName}
                              </p>
                              <p className="text-xs text-slate-500 capitalize leading-none mt-0.5">
                                {m.status}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Belt */}
                        <td className="px-5 py-3.5">
                          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', belt.bg, belt.color)}>
                            {belt.label}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="px-5 py-3.5 text-sm text-slate-400 capitalize">
                          {m.category.replace(/_/g, ' ')}
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums">
                          {m.medicalExpiry
                            ? <span className={cn(
                                status === 'neispravan'     ? 'text-red-400'   :
                                status === 'istjece_uskoro' ? 'text-amber-400' :
                                'text-slate-300'
                              )}>{formatDate(m.medicalExpiry)}</span>
                            : <span className="text-slate-600">Bez pregleda</span>
                          }
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-3.5">
                          <StatusBadge medicalExpiry={m.medicalExpiry} />
                        </td>

                        {/* Edit action — opens inline modal */}
                        {canEdit && (
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => openEdit(m)}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 hover:bg-slate-700 border border-transparent hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
                            >
                              Uredi <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer */}
                <tfoot>
                  <tr className="border-t-2 border-slate-700 bg-slate-900/80">
                    <td colSpan={canEdit ? 6 : 5} className="px-5 py-3">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-500">{filtered.length} prikazano</span>
                        {filtered.filter(m => getStatus(m.medicalExpiry) === 'neispravan').length > 0 && (
                          <span className="text-red-400 font-semibold">
                            {filtered.filter(m => getStatus(m.medicalExpiry) === 'neispravan').length} isteklih
                          </span>
                        )}
                        {filtered.filter(m => getStatus(m.medicalExpiry) === 'istjece_uskoro').length > 0 && (
                          <span className="text-amber-400 font-semibold">
                            {filtered.filter(m => getStatus(m.medicalExpiry) === 'istjece_uskoro').length} uskoro istječe
                          </span>
                        )}
                        {filtered.filter(m => getStatus(m.medicalExpiry) === 'vazeci').length > 0 && (
                          <span className="text-green-400 font-semibold">
                            {filtered.filter(m => getStatus(m.medicalExpiry) === 'vazeci').length} važećih
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-800">
              {filtered.map(m => {
                const belt   = beltLabels[m.belt];
                const status = getStatus(m.medicalExpiry);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'p-4 flex items-center gap-3',
                      status === 'neispravan'     && 'bg-red-950/[0.08]',
                      status === 'istjece_uskoro' && 'bg-amber-950/[0.05]',
                    )}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                      {m.firstName[0]}{m.lastName[0]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {m.firstName} {m.lastName}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', belt.bg, belt.color)}>
                          {belt.label}
                        </span>
                        <span className={cn(
                          'text-xs font-mono',
                          status === 'neispravan'     ? 'text-red-400'   :
                          status === 'istjece_uskoro' ? 'text-amber-400' :
                          'text-slate-500'
                        )}>
                          {m.medicalExpiry ? formatDate(m.medicalExpiry) : 'Bez pregleda'}
                        </span>
                      </div>
                    </div>

                    {/* Badge + edit */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <StatusBadge medicalExpiry={m.medicalExpiry} />
                      {canEdit && (
                        <button
                          onClick={() => openEdit(m)}
                          className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2"
                        >
                          Uredi
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Read-only note for trener / preglednik */}
        {roleLoaded && !canEdit && (
          <p className="text-xs text-slate-600 text-center pb-2">
            Pregled podataka — ažuriranje liječničkih pregleda dostupno je isključivo administratorima.
          </p>
        )}

      </div>

      {/* ── Edit modal ────────────────────────────────────────── */}
      {editMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeEdit(); }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div>
                <p className="text-sm font-bold text-slate-100">Uredi liječnički pregled</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editMember.firstName} {editMember.lastName}
                </p>
              </div>
              <button onClick={closeEdit} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Istek liječničkog pregleda
                </label>
                <DateInput
                  value={editExpiry}
                  onChange={setEditExpiry}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                />
                <p className="text-xs text-slate-600 mt-1">Format: dd.mm.gggg.</p>
              </div>

              {saveError && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800">
              <button
                onClick={closeEdit}
                disabled={saving}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg"
              >
                Odustani
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editExpiry}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Spremi
              </button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
