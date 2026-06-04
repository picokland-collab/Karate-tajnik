'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import {
  Wallet, TrendingUp, TrendingDown, Euro, Search, X,
  CheckCircle, Clock, XCircle, Check, Ban, Plus,
  AlertTriangle, Loader2, ChevronDown, Edit, Save, User, Lock,
  Upload, FileText, Receipt, ThumbsUp, HelpCircle,
  Settings, Zap, ShieldOff, Users,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  fetchFinancije,
  fetchFinancijeSažetak,
  updateUplataStatus,
  insertUplata,
  updateUplata,
  bookImportedPayments,
  KATEGORIJA_LABEL,
  VRSTA_LABEL,
  STATUS_LABEL,
  buildMjesecniPodaci,
  buildKategorijaStats,
} from '@/lib/queries/financije';
import type {
  FinancijaZapis,
  FinancijeSažetak,
  FinancijeVrsta,
  FinancijeStatus,
  FinancijeKategorija,
  FinancijaInput,
} from '@/lib/queries/financije';
import { parseCamt053, matchTransactions } from '@/lib/utils/bankStatementParser';
import type { MatchResult, MatchableMember } from '@/lib/utils/bankStatementParser';
import { downloadHub3aSlip } from '@/lib/utils/hub3aService';
import type { Hub3aParams } from '@/lib/utils/hub3aService';
import {
  previewBulkGen,
  bulkGenerateMembershipFees,
  CIJENA_1, CIJENA_2, CIJENA_3, IBAN_KLUB, NAZIV_KLUB,
} from '@/lib/queries/financije';
import type { BulkGenMember } from '@/lib/queries/financije';
import { toggleOslobodjenClanarina } from '@/lib/queries/clanovi';
import { createClient } from '@/lib/supabase-browser';
import { useRole } from '@/lib/hooks/useRole';
import { formatDate, cn } from '@/lib/utils';
import DateInput from '@/components/ui/DateInput';

// ── HELPERS ───────────────────────────────────────────────────

function formatEUR(n: number): string {
  return new Intl.NumberFormat('hr-HR', {
    style:                 'currency',
    currency:              'EUR',
    minimumFractionDigits: 2,
  }).format(n);
}

// ── STATUS BADGE ──────────────────────────────────────────────

function StatusBadge({ status }: { status: FinancijeStatus }) {
  const cfg = {
    placeno:    { label: 'Plaćeno',     icon: CheckCircle, cls: 'text-green-400 bg-green-900/20 border-green-800/40' },
    ceka:       { label: 'Na čekanju',  icon: Clock,       cls: 'text-amber-400 bg-amber-900/20 border-amber-800/40' },
    stornirano: { label: 'Stornirano',  icon: XCircle,     cls: 'text-slate-500 bg-slate-800    border-slate-700'    },
  } as const;
  const { label, icon: Icon, cls } = cfg[status] ?? cfg.placeno;
  return (
    <span className={cn('flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap', cls)}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

// ── KATEGORIJA BADGE ──────────────────────────────────────────

const KAT_COLORS: Record<string, string> = {
  clanarina:      'text-blue-300   bg-blue-900/20   border-blue-800/40',
  sufinanciranje: 'text-violet-300 bg-violet-900/20 border-violet-800/40',
  natjecanje:     'text-amber-300  bg-amber-900/20  border-amber-800/40',
  oprema:         'text-orange-300 bg-orange-900/20 border-orange-800/40',
  donacija:       'text-green-300  bg-green-900/20  border-green-800/40',
  ostalo:         'text-slate-400  bg-slate-800     border-slate-700',
};

function KatBadge({ kat }: { kat: string }) {
  const cls = KAT_COLORS[kat] ?? KAT_COLORS.ostalo;
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', cls)}>
      {KATEGORIJA_LABEL[kat as keyof typeof KATEGORIJA_LABEL] ?? kat}
    </span>
  );
}

// ── STAT CARD ─────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string;
  value: string;
  icon: React.FC<{ className?: string }>;
  color: 'green' | 'red' | 'amber' | 'slate';
  sub?: string;
}) {
  const clrMap = {
    green: { text: 'text-green-400', bg: 'bg-green-500/10' },
    red:   { text: 'text-red-400',   bg: 'bg-red-500/10'   },
    amber: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
    slate: { text: 'text-slate-300', bg: 'bg-slate-800'    },
  };
  const { text, bg } = clrMap[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
          <Icon className={cn('w-4 h-4', text)} />
        </div>
      </div>
      <p className={cn('text-2xl font-bold', text)}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

// ── INLINE ACTION BUTTON ──────────────────────────────────────

function ActionBtn({
  onClick, disabled, loading, icon: Icon, label, variant,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.FC<{ className?: string }>;
  label: string;
  variant: 'green' | 'red';
}) {
  const cls = variant === 'green'
    ? 'text-green-400 hover:bg-green-900/30 hover:border-green-800/40'
    : 'text-red-400   hover:bg-red-900/30   hover:border-red-800/40';
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={label}
      className={cn(
        'flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-transparent transition-all disabled:opacity-40 disabled:cursor-not-allowed',
        cls,
      )}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Icon className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ── MEMBER OPTION ─────────────────────────────────────────────

interface MemberOption { id: number; label: string; }

async function fetchMemberOptions(): Promise<MemberOption[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('clanovi')
    .select('id, ime, prezime')
    .eq('status', 'aktivan')
    .order('prezime').order('ime');
  return (data ?? []).map(c => ({
    id:    Number(c.id),
    label: `${c.prezime ?? ''} ${c.ime ?? ''}`.trim(),
  }));
}

// ── KATEGORIJA OPTIONS PER VRSTA ──────────────────────────────

const KAT_BY_VRSTA: Record<FinancijeVrsta, FinancijeKategorija[]> = {
  prihod: ['clanarina', 'sufinanciranje', 'donacija', 'ostalo'],
  rashod: ['natjecanje', 'oprema', 'najam', 'clanarine_savez', 'ostalo'],
};

// ── CHART COLORS ──────────────────────────────────────────────

const KAT_CHART_COLORS: Record<string, string> = {
  clanarina:      '#3b82f6', // blue-500
  sufinanciranje: '#8b5cf6', // violet-500
  donacija:       '#22c55e', // green-500
  natjecanje:     '#f59e0b', // amber-500
  oprema:         '#f97316', // orange-500
  najam:          '#ec4899', // pink-500
  clanarine_savez:'#6366f1', // indigo-500
  ostalo:         '#64748b', // slate-500
};

// ── CUSTOM RECHARTS TOOLTIP ───────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs shadow-xl">
      <p className="font-bold text-slate-200 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name === 'prihod' ? 'Prihodi' : 'Rashodi'}</span>
          <span className="font-bold">{formatEUR(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ── ZAPIS MODAL ───────────────────────────────────────────────

type FormState = {
  vrsta:      FinancijeVrsta;
  kategorija: FinancijeKategorija;
  opis:       string;
  iznos:      string;
  datum:      string;
  napomena:   string;
  status:     FinancijeStatus;
  clanId:     string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function makeEmptyForm(): FormState {
  return {
    vrsta:      'prihod',
    kategorija: 'clanarina',
    opis:       '',
    iznos:      '',
    datum:      todayIso(),
    napomena:   '',
    status:     'placeno',
    clanId:     '',
  };
}

function recordToForm(r: FinancijaZapis): FormState {
  return {
    vrsta:      r.vrsta,
    kategorija: r.kategorija,
    opis:       r.opis,
    iznos:      String(r.iznos),
    datum:      r.datum,
    napomena:   r.napomena ?? '',
    status:     r.status,
    clanId:     r.clanId ? String(r.clanId) : '',
  };
}

function ZapisModal({
  record,
  memberOptions,
  onClose,
  onSaved,
}: {
  record: FinancijaZapis | null;
  memberOptions: MemberOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = record !== null;
  const [form, setForm]     = useState<FormState>(editing ? recordToForm(record!) : makeEmptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // When vrsta changes, reset kategorija to first valid option
  const handleVrsta = (v: FinancijeVrsta) => {
    const kats = KAT_BY_VRSTA[v];
    setForm(f => ({
      ...f,
      vrsta:      v,
      kategorija: kats.includes(f.kategorija) ? f.kategorija : kats[0],
    }));
  };

  const handleSave = async () => {
    if (!form.opis.trim())          { setError('Opis je obavezan.');          return; }
    if (!form.iznos || isNaN(parseFloat(form.iznos)) || parseFloat(form.iznos) <= 0)
                                    { setError('Iznos mora biti pozitivan broj.'); return; }
    if (!form.datum)                { setError('Datum je obavezan.');          return; }

    setSaving(true);
    setError('');
    try {
      const input: FinancijaInput = {
        vrsta:      form.vrsta,
        kategorija: form.kategorija,
        opis:       form.opis,
        iznos:      parseFloat(parseFloat(form.iznos).toFixed(2)),
        datum:      form.datum,
        napomena:   form.napomena || undefined,
        status:     form.status,
        clanId:     form.clanId ? Number(form.clanId) : undefined,
      };

      if (editing) {
        await updateUplata(record!.id, input);
      } else {
        await insertUplata(input);
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri spremanju.');
    } finally {
      setSaving(false);
    }
  };

  const katOptions = KAT_BY_VRSTA[form.vrsta];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-end md:items-center md:justify-center md:p-6">
      <div className="bg-slate-900 border-t md:border border-slate-700 rounded-t-3xl md:rounded-3xl w-full md:max-w-xl shadow-2xl max-h-[92dvh] md:max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 md:px-8 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-50">
              {editing ? 'Uredi zapis' : 'Novi financijski zapis'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {editing ? record!.opis : 'Unesi prihod ili rashod kluba'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 md:py-6 min-h-0 space-y-4">

          {/* Vrsta toggle */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Vrsta
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['prihod', 'rashod'] as FinancijeVrsta[]).map(v => (
                <button key={v} type="button" onClick={() => handleVrsta(v)}
                  className={cn(
                    'py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    form.vrsta === v
                      ? v === 'prihod'
                        ? 'bg-green-900/30 text-green-300 border-green-700/50'
                        : 'bg-red-900/30 text-red-300 border-red-700/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700',
                  )}>
                  {v === 'prihod' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {VRSTA_LABEL[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Kategorija */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Kategorija
            </label>
            <div className="grid grid-cols-2 gap-2">
              {katOptions.map(k => (
                <button key={k} type="button" onClick={() => set('kategorija', k)}
                  className={cn(
                    'py-2 px-3 rounded-xl border text-sm font-medium transition-all text-left',
                    form.kategorija === k
                      ? 'bg-red-600/20 text-red-300 border-red-600/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700',
                  )}>
                  {KATEGORIJA_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Iznos + Datum */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Iznos (€) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.iznos}
                onChange={e => set('iznos', e.target.value)}
                placeholder="0,00"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Datum *
              </label>
              <DateInput value={form.datum} onChange={iso => set('datum', iso)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors" />
            </div>
          </div>

          {/* Opis */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Opis *
            </label>
            <textarea
              value={form.opis}
              onChange={e => set('opis', e.target.value)}
              placeholder="npr. Naplata članarina — lipanj 2026."
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors resize-none"
            />
          </div>

          {/* Vezano uz člana */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Veži za člana
              <span className="font-normal text-slate-600 normal-case tracking-normal">(opcionalno)</span>
            </label>
            <div className="relative">
              <select
                value={form.clanId}
                onChange={e => set('clanId', e.target.value)}
                className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition-colors cursor-pointer pr-9"
              >
                <option value="">— ne vezuj za člana —</option>
                {memberOptions.map(m => (
                  <option key={m.id} value={String(m.id)}>{m.label}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['placeno', 'ceka', 'stornirano'] as FinancijeStatus[]).map(s => (
                <button key={s} type="button" onClick={() => set('status', s)}
                  className={cn(
                    'py-2 rounded-xl border text-sm font-medium transition-all',
                    form.status === s
                      ? 'bg-red-600/20 text-red-300 border-red-600/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700',
                  )}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Napomena */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Napomena
            </label>
            <textarea
              value={form.napomena}
              onChange={e => set('napomena', e.target.value)}
              placeholder="Broj računa, bilješka, referenca..."
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 md:px-8 border-t border-slate-800 bg-slate-900 flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl transition-colors">
            Odustani
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Sprema...' : editing ? 'Spremi promjene' : 'Dodaj zapis'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN CONTENT ──────────────────────────────────────────────

type VrstaTabs = 'sve' | FinancijeVrsta;

// ── HUB 3A UPLATNICA MODAL ────────────────────────────────────────

const IBAN_KEY = 'hub3a_iban';
const CLUB_KEY = 'hub3a_club';

function UplatnicaModal({
  record,
  onClose,
}: {
  record: FinancijaZapis;
  onClose: () => void;
}) {
  const [iban,      setIban]      = useState(() => localStorage.getItem(IBAN_KEY) || IBAN_KLUB);
  const [clubName,  setClubName]  = useState(() => localStorage.getItem(CLUB_KEY) || NAZIV_KLUB);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  async function handleGenerate() {
    if (!iban.trim())     { setError('Unesite IBAN kluba.'); return; }
    if (!clubName.trim()) { setError('Unesite naziv kluba.'); return; }
    setLoading(true);
    setError('');
    try {
      localStorage.setItem(IBAN_KEY, iban.trim());
      localStorage.setItem(CLUB_KEY, clubName.trim());
      const params: Hub3aParams = {
        payerName:     record.clanIme ?? 'Član kluba',
        recipientName: clubName.trim().slice(0, 25),
        recipientIban: iban.trim().replace(/\s/g, ''),
        amountEur:     record.iznos,
        description:   record.opis.slice(0, 35),
        memberId:      record.clanId ?? 0,
        purposeCode:   'NTRN',
      };
      await downloadHub3aSlip(params, `uplatnica_${record.clanId ?? 'unknown'}.pdf`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri generiranju uplatnice.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <p className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-green-400" /> Generiraj HUB 3A uplatnicu
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{record.clanIme} · EUR {record.iznos.toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">IBAN kluba (primatelj)</label>
            <input value={iban} onChange={e => setIban(e.target.value)} placeholder="HR12 1234 5678 9012 3456 7"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors font-mono" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Naziv kluba (primatelj)</label>
            <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="KK Đurđevac"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors" />
          </div>
          <div className="bg-slate-800/60 rounded-xl px-4 py-3 text-xs text-slate-400 space-y-1">
            <p><span className="text-slate-500">Poziv na broj:</span> HR67{String(record.clanId ?? 0).padStart(6, '0')}</p>
            <p><span className="text-slate-500">Opis (max 35):</span> {record.opis.slice(0, 35)}</p>
            <p><span className="text-slate-500">Iznos:</span> EUR {record.iznos.toFixed(2)}</p>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg">Odustani</button>
          <button onClick={handleGenerate} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-green-700 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Preuzmi PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CJENOVNIK CONSTANTS (UI) ──────────────────────────────────────

const MONTHS_HR_LONG = [
  'Siječanj','Veljača','Ožujak','Travanj','Svibanj','Lipanj',
  'Srpanj','Kolovoz','Rujan','Listopad','Studeni','Prosinac',
];

// ── POSTAVKE ČLANARINA MODAL ──────────────────────────────────────

function CjenovnikModal({ onClose }: { onClose: () => void }) {
  const [members,  setMembers]  = useState<BulkGenMember[]>([]);
  const [loadingM, setLoadingM] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    previewBulkGen({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })
      .then(setMembers)
      .catch(console.error)
      .finally(() => setLoadingM(false));
  }, []);

  async function handleToggle(m: BulkGenMember) {
    setToggling(m.id);
    try {
      await toggleOslobodjenClanarina(String(m.id), !m.oslobodjen);
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, oslobodjen: !x.oslobodjen } : x));
    } catch (e) { console.error(e); }
    finally { setToggling(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <p className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" /> Postavke članarina
          </p>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500 hover:text-slate-300" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Fixed pricing rules — read-only info */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cjenik KK Đurđevac (fiksno)</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: '1. dijete', price: CIJENA_1, color: 'text-green-400' },
                { label: '2. dijete', price: CIJENA_2, color: 'text-amber-400' },
                { label: '3.+ dijete', price: CIJENA_3, color: 'text-slate-400' },
              ].map(row => (
                <div key={row.label} className="bg-slate-900/60 rounded-lg py-2.5 px-1">
                  <p className={`text-base font-bold ${row.color}`}>{row.price.toFixed(2)} €</p>
                  <p className="text-xs text-slate-500 mt-0.5">{row.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 pt-1">
              Novi član (1. mjesec): <span className="text-slate-400">0.00 € — gratis</span> ·
              IBAN: <span className="text-slate-400 font-mono text-[10px]">{IBAN_KLUB}</span>
            </p>
          </div>

          {/* Member exemption list */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldOff className="w-3.5 h-3.5" /> Izuzeci od plaćanja (Odluka UO)
            </p>
            {loadingM ? (
              <div className="flex items-center gap-2 text-xs text-slate-600 py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Učitavanje članova...
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {members.map(m => (
                  <div key={m.id} className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-xl border transition-all',
                    m.oslobodjen
                      ? 'bg-amber-950/20 border-amber-800/40'
                      : 'bg-slate-800/40 border-slate-700/50',
                  )}>
                    <div className="min-w-0">
                      <span className="text-sm text-slate-200">{m.label}</span>
                      {m.guardian && (
                        <span className="text-xs text-slate-600 ml-2 truncate hidden sm:inline">{m.guardian}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn(
                        'text-xs font-mono font-semibold',
                        m.cijena === 0 ? 'text-slate-500' : m.siblingOrder === 0 ? 'text-green-400' : 'text-amber-400',
                      )}>
                        {m.cijena.toFixed(2)} €
                      </span>
                      <button
                        onClick={() => handleToggle(m)}
                        disabled={toggling === m.id}
                        title={m.oslobodjen ? 'Ukini izuzeće' : 'Oslobodi od plaćanja (Odluka UO)'}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all flex items-center gap-1',
                          m.oslobodjen
                            ? 'bg-amber-700 border-amber-600 text-white hover:bg-amber-600'
                            : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-amber-600 hover:text-amber-400',
                        )}
                      >
                        {toggling === m.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <ShieldOff className="w-3 h-3" />}
                        {m.oslobodjen ? 'Oslobođen' : 'Oslobodi'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-slate-800 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl transition-colors">
            Zatvori
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BULK GENERATION MODAL ─────────────────────────────────────────

function BulkGeneracijaModal({
  onClose,
  onGenerated,
}: {
  onClose:     () => void;
  onGenerated: () => void;
}) {
  const now          = new Date();
  const [month,      setMonth]      = useState(now.getMonth() + 1);
  const [year,       setYear]       = useState(now.getFullYear());
  const [members,    setMembers]    = useState<BulkGenMember[] | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result,     setResult]     = useState<{ generated: number; skipped: number; duplicates: number; errors: number } | null>(null);
  const [loadErr,    setLoadErr]    = useState('');

  async function loadPreview() {
    setLoading(true);
    setMembers(null);
    setLoadErr('');
    try {
      const m = await previewBulkGen({ month, year });
      setMembers(m);
    } catch (e) {
      console.error('previewBulkGen error:', e);
      setLoadErr(e instanceof Error ? e.message : 'Greška pri dohvatu članova.');
    } finally { setLoading(false); }
  }

  useEffect(() => { loadPreview(); }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    if (!members) return;
    setGenerating(true);
    try {
      const res = await bulkGenerateMembershipFees({ month, year }, members);
      setResult(res);
      if (res.generated > 0) onGenerated();
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  }

  const toGenerate = (members ?? []).filter(m => !m.oslobodjen && !m.alreadyExists);
  const exempted   = (members ?? []).filter(m => m.oslobodjen);
  const duplicates = (members ?? []).filter(m => !m.oslobodjen && m.alreadyExists);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <p className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" /> Generiraj mjesečne članarine
          </p>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500 hover:text-slate-300" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Month/Year picker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Mjesec</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition-colors">
                {MONTHS_HR_LONG.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Godina</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition-colors">
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl px-4 py-2.5 text-xs text-slate-400 flex items-center gap-4 flex-wrap">
            <span>1. dijete: <span className="text-green-400 font-semibold">{CIJENA_1.toFixed(2)} €</span></span>
            <span>2. dijete: <span className="text-amber-400 font-semibold">{CIJENA_2.toFixed(2)} €</span></span>
            <span>3.+ dijete: <span className="text-slate-400 font-semibold">{CIJENA_3.toFixed(2)} €</span></span>
            <span>Novi član: <span className="text-slate-400 font-semibold">0.00 € gratis</span></span>
          </div>

          {/* Preview */}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Učitavanje pregleda...
            </div>
          )}
          {loadErr && (
            <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-300">
              {loadErr}
            </div>
          )}

          {members && !loading && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-green-950/30 border border-green-800/30 rounded-xl py-2">
                  <p className="text-lg font-bold text-green-400">{toGenerate.length}</p>
                  <p className="text-xs text-slate-500">Za generiranje</p>
                </div>
                <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl py-2">
                  <p className="text-lg font-bold text-amber-400">{exempted.length}</p>
                  <p className="text-xs text-slate-500">Oslobođenih</p>
                </div>
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl py-2">
                  <p className="text-lg font-bold text-slate-400">{duplicates.length}</p>
                  <p className="text-xs text-slate-500">Već postoji</p>
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                {toGenerate.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-slate-800/30 px-3 py-2 rounded-lg gap-2">
                    <div className="min-w-0">
                      <span className="text-sm text-slate-200">{m.label}</span>
                      {m.isNewMember && (
                        <span className="ml-2 text-[10px] bg-blue-900/40 text-blue-300 border border-blue-800/40 px-1.5 py-0.5 rounded-full">novi</span>
                      )}
                      {!m.isNewMember && m.siblingOrder === 1 && (
                        <span className="ml-2 text-[10px] bg-amber-900/30 text-amber-400 border border-amber-800/30 px-1.5 py-0.5 rounded-full">2. dijete</span>
                      )}
                      {!m.isNewMember && m.siblingOrder >= 2 && (
                        <span className="ml-2 text-[10px] bg-slate-700 text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded-full">gratis</span>
                      )}
                    </div>
                    <span className={cn(
                      'text-sm font-semibold flex-shrink-0',
                      m.cijena === 0 ? 'text-slate-500' : m.siblingOrder === 0 ? 'text-green-400' : 'text-amber-400',
                    )}>
                      {m.cijena.toFixed(2)} €
                    </span>
                  </div>
                ))}
                {exempted.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-amber-950/10 px-3 py-2 rounded-lg opacity-50">
                    <span className="text-sm text-amber-300 line-through">{m.label}</span>
                    <span className="text-xs text-amber-500">Oslobođen</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {result && (
            <div className="bg-green-950/40 border border-green-800/40 rounded-xl px-4 py-4 text-center">
              <CheckCircle className="w-7 h-7 text-green-400 mx-auto mb-2" />
              <p className="font-bold text-green-300 text-sm">
                Generirano {result.generated} zaduženja — {MONTHS_HR_LONG[month - 1]} {year}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {result.skipped > 0 && `${result.skipped} oslobođenih preskočeno · `}
                {result.duplicates > 0 && `${result.duplicates} već postoji · `}
                {result.errors > 0 && <span className="text-red-400">{result.errors} grešaka</span>}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-800 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg transition-colors">
            {result ? 'Zatvori' : 'Odustani'}
          </button>
          {!result && (
            <button
              onClick={handleGenerate}
              disabled={generating || loading || toGenerate.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Generiraj {toGenerate.length > 0 ? toGenerate.length : ''} zaduženja
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BANK IMPORT MODAL ────────────────────────────────────────────

type ImportTab = 'auto' | 'review' | 'unmatched';

function BankImportModal({
  memberOptions,
  onClose,
  onBooked,
}: {
  memberOptions: MemberOption[];
  onClose:  () => void;
  onBooked: () => void;
}) {
  const [results,    setResults]    = useState<MatchResult[] | null>(null);
  const [tab,        setTab]        = useState<ImportTab>('auto');
  const [booking,    setBooking]    = useState(false);
  const [bookResult, setBookResult] = useState<{ booked: number; errors: number } | null>(null);
  const [parseErr,   setParseErr]   = useState('');
  const [dragging,   setDragging]   = useState(false);
  // Track which tier-2 items have been confirmed
  const [confirmed,  setConfirmed]  = useState<Set<number>>(new Set());

  const matchable: MatchableMember[] = memberOptions.map(m => ({ id: m.id, label: m.label }));

  function processFile(file: File) {
    setParseErr('');
    setResults(null);
    setBookResult(null);
    setConfirmed(new Set());
    const reader = new FileReader();
    reader.onload = e => {
      const xml = e.target?.result as string;
      try {
        const txns = parseCamt053(xml);
        if (txns.length === 0) { setParseErr('Datoteka ne sadrži kreditne transakcije (CRDT entries).'); return; }
        setResults(matchTransactions(txns, matchable));
        setTab('auto');
      } catch (err) {
        setParseErr(err instanceof Error ? err.message : 'Neuspješno parsiranje XML datoteke.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  async function handleBook() {
    if (!results) return;
    setBooking(true);
    try {
      const toBook = results.filter(r =>
        r.tier === 1 || (r.tier === 2 && confirmed.has(results.indexOf(r)))
      );
      const payments = toBook.map(r => ({
        memberId:    r.memberId!,
        amount:      r.transaction.amount,
        date:        r.transaction.date,
        description: r.transaction.description || 'Uvezena uplata',
        rawRef:      r.transaction.rawRef,
      }));
      const res = await bookImportedPayments(payments);
      setBookResult(res);
      if (res.booked > 0) onBooked();
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : 'Greška pri proknjižavanju.');
    } finally {
      setBooking(false);
    }
  }

  const tier1 = results?.filter(r => r.tier === 1) ?? [];
  const tier2 = results?.filter(r => r.tier === 2) ?? [];
  const tier3 = results?.filter(r => r.tier === 3) ?? [];
  const confirmedCount = confirmed.size;
  const readyToBook    = tier1.length + confirmedCount;

  const tabCls = (t: ImportTab) => cn(
    'px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5',
    tab === t ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300',
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-400" /> Uvezi izvod banke (CAMT.053)
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Podržani format: SEPA CAMT.053 XML</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Drop zone */}
          {!results && !bookResult && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer',
                dragging ? 'border-blue-500 bg-blue-900/10' : 'border-slate-700 hover:border-slate-500',
              )}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-slate-600" />
              <p className="text-sm text-slate-400 font-medium mb-1">Povuci CAMT.053 XML datoteku ovdje</p>
              <p className="text-xs text-slate-600 mb-3">ili klikni za odabir</p>
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition-colors">
                  Odaberi datoteku
                </span>
                <input type="file" accept=".xml,.txt" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
              </label>
            </div>
          )}

          {parseErr && (
            <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-300">
              {parseErr}
            </div>
          )}

          {/* Booking success */}
          {bookResult && (
            <div className="bg-green-950/40 border border-green-800/40 rounded-xl px-4 py-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="font-bold text-green-300 text-sm">Proknjižavanje završeno</p>
              <p className="text-xs text-slate-400 mt-1">
                Uspješno proknjiženo <span className="text-green-400 font-semibold">{bookResult.booked}</span> uplata
                {bookResult.errors > 0 && <>, <span className="text-red-400 font-semibold">{bookResult.errors}</span> grešaka</>}
              </p>
              <button onClick={onClose} className="mt-3 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition-colors">Zatvori</button>
            </div>
          )}

          {/* Results tabs */}
          {results && !bookResult && (
            <>
              <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
                <button className={tabCls('auto')} onClick={() => setTab('auto')}>
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  Automatski upareno
                  <span className="font-bold text-green-400">{tier1.length}</span>
                </button>
                <button className={tabCls('review')} onClick={() => setTab('review')}>
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  Predloženo za pregled
                  <span className="font-bold text-amber-400">{tier2.length}</span>
                </button>
                <button className={tabCls('unmatched')} onClick={() => setTab('unmatched')}>
                  <XCircle className="w-3.5 h-3.5 text-slate-500" />
                  Neprepoznato
                  <span className="font-bold text-slate-500">{tier3.length}</span>
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {tab === 'auto' && tier1.map((r, i) => (
                  <div key={i} className="bg-green-950/20 border border-green-800/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{r.memberLabel}</p>
                      <p className="text-xs text-slate-500 truncate">{r.transaction.description} · {r.transaction.reference}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-green-400">EUR {r.transaction.amount.toFixed(2)}</span>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                  </div>
                ))}

                {tab === 'review' && tier2.map((r, idx) => {
                  const isConfirmed = confirmed.has(results.indexOf(r));
                  return (
                    <div key={idx} className={cn(
                      'border rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all',
                      isConfirmed
                        ? 'bg-green-950/20 border-green-800/30'
                        : 'bg-amber-950/10 border-amber-800/30',
                    )}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">{r.memberLabel}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {r.transaction.debtorName && <span>Platitelj: {r.transaction.debtorName} · </span>}
                          {r.transaction.description}
                        </p>
                        <p className="text-xs text-amber-500/70 mt-0.5">Podudaranje {Math.round(r.confidence * 100)}%</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-amber-400">EUR {r.transaction.amount.toFixed(2)}</span>
                        <button
                          onClick={() => setConfirmed(prev => {
                            const next = new Set(prev);
                            const globalIdx = results.indexOf(r);
                            if (next.has(globalIdx)) next.delete(globalIdx); else next.add(globalIdx);
                            return next;
                          })}
                          className={cn(
                            'p-1.5 rounded-lg border transition-all text-xs font-semibold',
                            isConfirmed
                              ? 'bg-green-700 border-green-600 text-white'
                              : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-amber-500',
                          )}
                        >
                          {isConfirmed ? <CheckCircle className="w-3.5 h-3.5" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {tab === 'unmatched' && tier3.map((r, i) => (
                  <div key={i} className="bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-400 truncate">{r.transaction.debtorName ?? '(nepoznat platitelj)'}</p>
                      <p className="text-xs text-slate-600 truncate">{r.transaction.description || r.transaction.reference}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-400 flex-shrink-0">EUR {r.transaction.amount.toFixed(2)}</span>
                  </div>
                ))}

                {tab === 'auto'      && tier1.length === 0 && <p className="text-center text-slate-600 py-6 text-sm">Nema automatski uparenih transakcija.</p>}
                {tab === 'review'    && tier2.length === 0 && <p className="text-center text-slate-600 py-6 text-sm">Nema transakcija za ručni pregled.</p>}
                {tab === 'unmatched' && tier3.length === 0 && <p className="text-center text-slate-600 py-6 text-sm">Sve transakcije su uparene.</p>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {results && !bookResult && (
          <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-slate-500">
              {readyToBook} uplata spremno za knjiženje
              {confirmedCount > 0 && ` (${tier1.length} auto + ${confirmedCount} ručno)`}
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg">Odustani</button>
              <button
                onClick={handleBook}
                disabled={booking || readyToBook === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors"
              >
                {booking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Proknjiži {readyToBook > 0 ? readyToBook : ''} uplata
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FinancijeContent() {
  // ── ROLE GATE ─────────────────────────────────────────────────
  const { isAdmin, roleLoaded: roleChecked } = useRole();
  const accessDenied = roleChecked && !isAdmin;

  // ── DATA STATE ────────────────────────────────────────────────
  const [records, setRecords]       = useState<FinancijaZapis[]>([]);
  const [sažetak, setSažetak]       = useState<FinancijeSažetak | null>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [vrstaTab, setVrstaTab]     = useState<VrstaTabs>('sve');
  const [statusFilter, setStatusFilter] = useState<FinancijeStatus | 'sve'>('sve');
  const [actionLoading, setActionLoading]   = useState<string | null>(null);
  const [actionError, setActionError]       = useState('');
  const [showModal, setShowModal]           = useState(false);
  const [editingRecord, setEditingRecord]   = useState<FinancijaZapis | null>(null);
  const [memberOptions, setMemberOptions]   = useState<MemberOption[]>([]);
  const [uplatnicaRecord, setUplatnicaRecord] = useState<FinancijaZapis | null>(null);
  const [showImport,      setShowImport]      = useState(false);
  const [showCjenovnik,   setShowCjenovnik]   = useState(false);
  const [showBulkGen,     setShowBulkGen]     = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'new') setShowModal(true);
  }, [searchParams]);

  const reload = async () => {
    setLoading(true);
    try {
      const [recs, saz, members] = await Promise.all([
        fetchFinancije(),
        fetchFinancijeSažetak(),
        fetchMemberOptions(),
      ]);
      setRecords(recs);
      setSažetak(saz);
      setMemberOptions(members);
    } catch (e) {
      console.error('fetchFinancije:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  // ── FILTERS ────────────────────────────────────────────────

  const filtered = records.filter(r => {
    if (vrstaTab !== 'sve' && r.vrsta !== vrstaTab) return false;
    if (statusFilter !== 'sve' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = [r.opis, r.clanIme, r.napomena].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const naČekanju = records.filter(r => r.status === 'ceka').length;

  // ── CHART DATA (derived from loaded records) ────────────────

  const currentYear = new Date().getFullYear();

  const monthlyData = useMemo(
    () => buildMjesecniPodaci(records, currentYear),
    [records, currentYear],
  );

  const { prihodi: katPrihodi, rashodi: katRashodi } = useMemo(
    () => buildKategorijaStats(records),
    [records],
  );

  const maxMonthly = useMemo(
    () => Math.max(...monthlyData.flatMap(m => [m.prihod, m.rashod]), 1),
    [monthlyData],
  );

  // ── ACTIONS ────────────────────────────────────────────────

  const handleStatusChange = async (id: string, status: FinancijeStatus) => {
    setActionLoading(id);
    setActionError('');
    try {
      await updateUplataStatus(id, status);
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Greška.');
      setTimeout(() => setActionError(''), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  // ── SALDO SIGN ─────────────────────────────────────────────

  const saldoPositive = (sažetak?.saldo ?? 0) >= 0;

  // ── ROLE GUARD RENDERS ───────────────────────────────────────

  if (!roleChecked) {
    return (
      <AppLayout title="Financije" subtitle="Provjera pristupa...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (accessDenied) {
    return (
      <AppLayout title="Financije" subtitle="Pristup ograničen">
        <div className="max-w-md mx-auto mt-16 px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-800/30 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-red-400">Pristup odbijen</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Nemate ovlasti za pregled financijskih podataka kluba.
                Kontaktirajte administratora.
              </p>
            </div>
            <div className="pt-1 border-t border-slate-800 text-xs text-slate-600">
              Uloga: <span className="font-mono text-slate-500">trener / preglednik</span>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── MAIN CONTENT (admin only beyond this point) ───────────────

  return (
    <AppLayout
      title="Financije"
      subtitle={loading
        ? 'Učitavanje...'
        : `${records.length} zapisa · ${formatEUR(sažetak?.saldo ?? 0)} saldo`}
      actions={
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => setShowCjenovnik(true)}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold px-3 py-2 rounded-xl transition-colors border border-slate-600"
            title="Postavke članarina i izuzeci">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Cjenik</span>
          </button>
          <button onClick={() => setShowBulkGen(true)}
            className="flex items-center gap-1.5 bg-yellow-700 hover:bg-yellow-600 text-yellow-100 text-sm font-semibold px-3 py-2 rounded-xl transition-colors">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Generiraj</span>
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold px-3 py-2 rounded-xl transition-colors border border-slate-600">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Uvezi izvod</span>
          </button>
          <button onClick={() => { setEditingRecord(null); setShowModal(true); }}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors shadow-lg shadow-red-900/30">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novi zapis</span>
          </button>
        </div>
      }
    >
      {showModal && (
        <ZapisModal
          record={editingRecord}
          memberOptions={memberOptions}
          onClose={() => { setShowModal(false); setEditingRecord(null); }}
          onSaved={() => { reload(); setShowModal(false); setEditingRecord(null); }}
        />
      )}
      {uplatnicaRecord && (
        <UplatnicaModal record={uplatnicaRecord} onClose={() => setUplatnicaRecord(null)} />
      )}
      {showImport && (
        <BankImportModal
          memberOptions={memberOptions}
          onClose={() => setShowImport(false)}
          onBooked={() => { reload(); setShowImport(false); }}
        />
      )}
      {showCjenovnik && (
        <CjenovnikModal onClose={() => setShowCjenovnik(false)} />
      )}
      {showBulkGen && (
        <BulkGeneracijaModal
          onClose={() => setShowBulkGen(false)}
          onGenerated={() => { reload(); }}
        />
      )}

      <div className="max-w-7xl mx-auto space-y-5">

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Saldo"
            value={sažetak ? formatEUR(sažetak.saldo) : '…'}
            icon={Wallet}
            color={saldoPositive ? 'green' : 'red'}
            sub={sažetak ? `${sažetak.ukupnoZapisa} zapisa ukupno` : undefined}
          />
          <StatCard
            label="Ukupno prihodi"
            value={sažetak ? formatEUR(sažetak.ukupnoProhodi) : '…'}
            icon={TrendingUp}
            color="green"
            sub="Bez storniranih"
          />
          <StatCard
            label="Na čekanju"
            value={loading ? '…' : String(naČekanju)}
            icon={Clock}
            color={naČekanju > 0 ? 'amber' : 'slate'}
            sub={naČekanju > 0 ? 'Zahtijeva akciju' : 'Sve plaćeno'}
          />
        </div>

        {/* Analytics section */}
        {!loading && records.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

            {/* ── Monthly bar chart ── */}
            <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-slate-100">Trendovi {currentYear}</p>
                  <p className="text-xs text-slate-500">Prihodi vs. Rashodi po mjesecu</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Prihodi</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Rashodi</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={monthlyData}
                  barGap={2}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="mjesec"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${v / 1000}k` : String(v)}
                    width={36}
                    domain={[0, maxMonthly * 1.1]}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="prihod" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="rashod"  fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Category distribution ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div>
                <p className="text-sm font-bold text-slate-100 mb-1">Raspodjela</p>
                <p className="text-xs text-slate-500">Kategorije (bez storniranih)</p>
              </div>

              {/* Prihodi */}
              {katPrihodi.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Prihodi</p>
                  {katPrihodi.map(k => (
                    <div key={k.kategorija}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-300 truncate flex-1">{k.label}</span>
                        <span className="text-xs font-bold text-slate-200 ml-2 flex-shrink-0">{k.postotak}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${k.postotak}%`,
                            backgroundColor: KAT_CHART_COLORS[k.kategorija] ?? '#64748b',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Rashodi */}
              {katRashodi.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Rashodi</p>
                  {katRashodi.map(k => (
                    <div key={k.kategorija}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-300 truncate flex-1">{k.label}</span>
                        <span className="text-xs font-bold text-slate-200 ml-2 flex-shrink-0">{k.postotak}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${k.postotak}%`,
                            backgroundColor: KAT_CHART_COLORS[k.kategorija] ?? '#64748b',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Action error */}
        {actionError && (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {actionError}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          {/* Vrsta toggle */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {(['sve', 'prihod', 'rashod'] as VrstaTabs[]).map(t => (
              <button
                key={t}
                onClick={() => setVrstaTab(t)}
                className={cn(
                  'text-sm px-3.5 py-1.5 rounded-lg font-medium transition-all capitalize',
                  vrstaTab === t
                    ? 'bg-red-600/20 text-red-300 border border-red-600/30'
                    : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {t === 'sve' ? 'Sve' : t === 'prihod' ? 'Prihodi' : 'Rashodi'}
              </button>
            ))}
          </div>

          {/* Status dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as FinancijeStatus | 'sve')}
              className="appearance-none bg-slate-900 border border-slate-800 text-slate-400 text-sm rounded-xl px-3.5 py-2 pr-8 outline-none focus:border-slate-600 cursor-pointer"
            >
              <option value="sve">Svi statusi</option>
              <option value="placeno">Plaćeno</option>
              <option value="ceka">Na čekanju</option>
              <option value="stornirano">Stornirano</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 flex-1 min-w-0 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pretraži po opisu ili članu..."
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-full"
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>

          <span className="text-xs text-slate-600 ml-auto hidden sm:block">
            {filtered.length} / {records.length} zapisa
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-3" />
            Učitavanje financijskih zapisa...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Euro className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nema zapisa koji odgovaraju filteru.</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80">
                    {['Datum', 'Opis / Član', 'Kategorija', 'Vrsta', 'Iznos (€)', 'Status', 'Akcije'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map(r => (
                    <tr
                      key={r.id}
                      className={cn(
                        'hover:bg-slate-800/30 transition-colors',
                        r.status === 'stornirano' && 'opacity-50',
                      )}
                    >
                      {/* Datum */}
                      <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap font-mono text-xs">
                        {formatDate(r.datum)}
                      </td>

                      {/* Opis / Član */}
                      <td className="px-5 py-3.5 max-w-xs">
                        {r.clanIme ? (
                          <div>
                            <p className="font-semibold text-slate-100">{r.clanIme}</p>
                            <p className="text-xs text-slate-500 truncate">{r.opis}</p>
                          </div>
                        ) : (
                          <p className="text-slate-200 truncate">{r.opis}</p>
                        )}
                      </td>

                      {/* Kategorija */}
                      <td className="px-5 py-3.5">
                        <KatBadge kat={r.kategorija} />
                      </td>

                      {/* Vrsta */}
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'flex items-center gap-1 text-xs font-semibold w-fit',
                          r.vrsta === 'prihod' ? 'text-green-400' : 'text-red-400',
                        )}>
                          {r.vrsta === 'prihod'
                            ? <TrendingUp  className="w-3.5 h-3.5" />
                            : <TrendingDown className="w-3.5 h-3.5" />}
                          {r.vrsta === 'prihod' ? 'Prihod' : 'Rashod'}
                        </span>
                      </td>

                      {/* Iznos */}
                      <td className={cn(
                        'px-5 py-3.5 font-bold text-right whitespace-nowrap',
                        r.vrsta === 'prihod' ? 'text-green-400' : 'text-red-400',
                      )}>
                        {r.vrsta === 'rashod' ? '−' : '+'}{formatEUR(r.iznos)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <StatusBadge status={r.status} />
                      </td>

                      {/* Akcije */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingRecord(r); setShowModal(true); }}
                            title="Uredi"
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-transparent hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Uredi</span>
                          </button>
                          {r.kategorija === 'clanarina' && r.vrsta === 'prihod' && r.clanId && (
                            <button
                              onClick={() => setUplatnicaRecord(r)}
                              title="Generiraj HUB 3A uplatnicu"
                              className="flex items-center gap-1 text-xs text-green-500 hover:text-green-300 hover:bg-green-900/20 border border-transparent hover:border-green-700 px-2.5 py-1.5 rounded-lg transition-all"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Uplatnica</span>
                            </button>
                          )}
                          {r.status === 'ceka' && (
                            <ActionBtn
                              onClick={() => handleStatusChange(r.id, 'placeno')}
                              loading={actionLoading === r.id}
                              icon={Check}
                              label="Plaćeno"
                              variant="green"
                            />
                          )}
                          {r.status !== 'stornirano' && (
                            <ActionBtn
                              onClick={() => handleStatusChange(r.id, 'stornirano')}
                              loading={actionLoading === r.id}
                              icon={Ban}
                              label="Storniraj"
                              variant="red"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Table footer — totals for visible rows */}
                <tfoot>
                  <tr className="border-t-2 border-slate-700 bg-slate-900/80">
                    <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Prikazano {filtered.length} zapisa
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-200 whitespace-nowrap">
                      {formatEUR(
                        filtered.reduce((s, r) =>
                          r.status !== 'stornirano'
                            ? s + (r.vrsta === 'prihod' ? r.iznos : -r.iznos)
                            : s,
                          0,
                        )
                      )}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-800">
              {filtered.map(r => (
                <div
                  key={r.id}
                  className={cn('p-4 space-y-3', r.status === 'stornirano' && 'opacity-50')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {r.clanIme
                        ? <p className="font-semibold text-slate-100 truncate">{r.clanIme}</p>
                        : <p className="text-slate-200 truncate">{r.opis}</p>}
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(r.datum)}</p>
                    </div>
                    <p className={cn(
                      'font-bold text-lg flex-shrink-0',
                      r.vrsta === 'prihod' ? 'text-green-400' : 'text-red-400',
                    )}>
                      {r.vrsta === 'rashod' ? '−' : '+'}{formatEUR(r.iznos)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <KatBadge kat={r.kategorija} />
                    <StatusBadge status={r.status} />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setEditingRecord(r); setShowModal(true); }}
                      className="flex items-center gap-1.5 text-xs text-slate-400 border border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-700 hover:text-slate-200 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" /> Uredi
                    </button>
                  </div>

                  {r.status !== 'stornirano' && (
                    <div className="flex gap-2">
                      {r.status === 'ceka' && (
                        <button
                          onClick={() => handleStatusChange(r.id, 'placeno')}
                          disabled={actionLoading === r.id}
                          className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-900/20 border border-green-800/40 px-3 py-1.5 rounded-lg transition-colors hover:bg-green-900/30"
                        >
                          {actionLoading === r.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Check className="w-3.5 h-3.5" />}
                          Označi kao plaćeno
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(r.id, 'stornirano')}
                        disabled={actionLoading === r.id}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors hover:text-red-400 hover:border-red-800/40 hover:bg-red-900/20"
                      >
                        <Ban className="w-3.5 h-3.5" /> Storniraj
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary below table for filtered set */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              {
                label: 'Prihodi (filter)',
                value: formatEUR(filtered.filter(r => r.vrsta === 'prihod' && r.status !== 'stornirano').reduce((s, r) => s + r.iznos, 0)),
                color: 'text-green-400',
              },
              {
                label: 'Rashodi (filter)',
                value: formatEUR(filtered.filter(r => r.vrsta === 'rashod' && r.status !== 'stornirano').reduce((s, r) => s + r.iznos, 0)),
                color: 'text-red-400',
              },
              {
                label: 'Neto (filter)',
                value: formatEUR(filtered.filter(r => r.status !== 'stornirano').reduce((s, r) => s + (r.vrsta === 'prihod' ? r.iznos : -r.iznos), 0)),
                color: 'text-slate-200',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl py-3 px-4">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={cn('text-base font-bold', color)}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function FinancijePage() {
  return (
    <Suspense fallback={null}>
      <FinancijeContent />
    </Suspense>
  );
}
