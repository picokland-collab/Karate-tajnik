'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import {
  Wallet, TrendingUp, TrendingDown, Euro, Search, X,
  CheckCircle, Clock, XCircle, Check, Ban, Plus,
  AlertTriangle, Loader2, ChevronDown,
} from 'lucide-react';
import {
  fetchFinancije,
  fetchFinancijeSažetak,
  updateUplataStatus,
  KATEGORIJA_LABEL,
} from '@/lib/queries/financije';
import type {
  FinancijaZapis,
  FinancijeSažetak,
  FinancijeVrsta,
  FinancijeStatus,
} from '@/lib/queries/financije';
import { formatDate, cn } from '@/lib/utils';

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

// ── MAIN CONTENT ──────────────────────────────────────────────

type VrstaTabs = 'sve' | FinancijeVrsta;

function FinancijeContent() {
  const [records, setRecords]       = useState<FinancijaZapis[]>([]);
  const [sažetak, setSažetak]       = useState<FinancijeSažetak | null>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [vrstaTab, setVrstaTab]     = useState<VrstaTabs>('sve');
  const [statusFilter, setStatusFilter] = useState<FinancijeStatus | 'sve'>('sve');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const searchParams = useSearchParams();

  const reload = async () => {
    setLoading(true);
    try {
      const [recs, saz] = await Promise.all([
        fetchFinancije(),
        fetchFinancijeSažetak(),
      ]);
      setRecords(recs);
      setSažetak(saz);
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

  return (
    <AppLayout
      title="Financije"
      subtitle={loading
        ? 'Učitavanje...'
        : `${records.length} zapisa · ${formatEUR(sažetak?.saldo ?? 0)} saldo`}
      actions={
        <button
          disabled
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-red-900/30"
          title="Dodavanje novih zapisa — dolazi uskoro"
        >
          <Plus className="w-4 h-4" /> Novi zapis
        </button>
      }
    >
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

                  {r.status !== 'stornirano' && (
                    <div className="flex gap-2 pt-1">
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
