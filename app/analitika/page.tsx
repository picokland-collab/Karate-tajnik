'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  BarChart3, Users, Trophy, Wallet, Sparkles,
  Euro, Calendar, FileText, Medal, Copy, Save,
  Check, RefreshCw, ChevronDown, TrendingUp,
  Info, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchKategorijaStats,
  fetchPojasStats,
  fetchDobnaDistribucija,
  fetchMedaljeStats,
  fetchFinancijskiPregled,
  fetchGodisnjIzvjestajPodaci,
  buildIzvjestajPrompt,
  type KategorijaStats,
  type PojasStats,
  type DobnaSkupina,
  type MedaljeStats,
  type NatjecanjeRazinaStats,
  type FinancijskiPregled,
  type GodisnjIzvjestajPodaci,
} from '@/lib/queries/analitika';

// ─── Belt colours ────────────────────────────────────────────────────────────
const POJAS_BAR: Record<string, string> = {
  'Bijeli pojas':     'bg-slate-100',
  'Žuti pojas':       'bg-yellow-400',
  'Narančasti pojas': 'bg-orange-500',
  'Zeleni pojas':     'bg-green-500',
  'Plavi pojas':      'bg-blue-500',
  'Smeđi pojas':      'bg-amber-700',
  '1. DAN':           'bg-slate-700 border border-slate-500',
  '2. DAN':           'bg-slate-700 border border-slate-400',
  '3. DAN':           'bg-slate-600 border border-slate-300',
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function BarRow({
  label, count, max, barClass, sub,
}: {
  label: string; count: number; max: number; barClass?: string; sub?: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-300">{label}</span>
        <span className="text-xs text-slate-400 font-medium tabular-nums">{count}{sub && <span className="text-slate-600 ml-1">({pct}%)</span>}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barClass ?? 'bg-violet-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className }: {
  title: string; icon: React.FC<{ className?: string }>;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('bg-slate-900 border border-slate-800 rounded-2xl p-5', className)}>
      <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function KpiCard({ icon: Icon, value, label, sub, colorClass, bgClass }: {
  icon: React.FC<{ className?: string }>; value: string | number;
  label: string; sub?: string; colorClass: string; bgClass: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-4">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-2', bgClass)}>
        <Icon className={cn('w-4 h-4', colorClass)} />
      </div>
      <p className="text-xl md:text-2xl font-bold text-slate-50 tabular-nums">{value}</p>
      <p className="text-xs font-medium text-slate-300 mt-0.5 leading-tight">{label}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5 hidden sm:block">{sub}</p>}
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'pregled',    label: 'Pregled',    icon: BarChart3  },
  { id: 'clanovi',    label: 'Članovi',    icon: Users      },
  { id: 'natjecanja', label: 'Natjecanja', icon: Trophy     },
  { id: 'financije',  label: 'Financije',  icon: Wallet     },
  { id: 'izvjestaj',  label: 'AI Izvještaj', icon: Sparkles },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalitikaPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pregled');

  // Data state
  const [kategorije, setKategorije]     = useState<KategorijaStats[]>([]);
  const [pojasevi, setPojasevi]         = useState<PojasStats[]>([]);
  const [dobna, setDobna]               = useState<DobnaSkupina[]>([]);
  const [medaljeStats, setMedaljeStats] = useState<{ medalje: MedaljeStats; poRazini: NatjecanjeRazinaStats[] } | null>(null);
  const [financije, setFinancije]       = useState<FinancijskiPregled | null>(null);
  const [loading, setLoading]           = useState(true);

  // Financial fee input
  const [fee, setFee] = useState(600);
  const feeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI izvještaj state
  const [izvjestajGodina, setIzvjestajGodina]       = useState(new Date().getFullYear());
  const [izvjestajPodaci, setIzvjestajPodaci]       = useState<GodisnjIzvjestajPodaci | null>(null);
  const [izvjestajLoading, setIzvjestajLoading]     = useState(false);
  const [generiranje, setGeneriranje]               = useState(false);
  const [output, setOutput]                         = useState('');
  const [copied, setCopied]                         = useState(false);
  const [savedOk, setSavedOk]                       = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    Promise.all([
      fetchKategorijaStats(),
      fetchPojasStats(),
      fetchDobnaDistribucija(),
      fetchMedaljeStats(),
      fetchFinancijskiPregled(fee),
    ]).then(([kat, poj, dob, med, fin]) => {
      setKategorije(kat);
      setPojasevi(poj);
      setDobna(dob);
      setMedaljeStats(med);
      setFinancije(fin);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalc finances when fee changes
  const handleFeeChange = useCallback((val: number) => {
    setFee(val);
    if (feeTimer.current) clearTimeout(feeTimer.current);
    feeTimer.current = setTimeout(async () => {
      const fin = await fetchFinancijskiPregled(val);
      setFinancije(fin);
    }, 400);
  }, []);

  // Load godišnji izvještaj data when switching to that tab or changing year
  useEffect(() => {
    if (activeTab !== 'izvjestaj') return;
    setIzvjestajLoading(true);
    setOutput('');
    fetchGodisnjIzvjestajPodaci(izvjestajGodina)
      .then(setIzvjestajPodaci)
      .finally(() => setIzvjestajLoading(false));
  }, [activeTab, izvjestajGodina]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // AI streaming generation
  async function generiraj() {
    if (!izvjestajPodaci) return;
    setGeneriranje(true);
    setOutput('');
    setCopied(false);
    setSavedOk(false);

    try {
      const prompt = buildIzvjestajPrompt(izvjestajPodaci);
      const res = await fetch('/api/ai-tajnik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok || !res.body) { setOutput('Greška pri generiranju. Pokušajte ponovo.'); return; }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setOutput(text);
      }
    } catch {
      setOutput('Greška pri spajanju s AI servisom.');
    } finally {
      setGeneriranje(false);
    }
  }

  async function kopiraj() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function spremi() {
    const res = await fetch('/api/dokumenti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        naziv: `Godišnji izvještaj o radu ${izvjestajGodina}.`,
        vrsta: 'izvjestaj',
        sadrzaj: output,
      }),
    });
    if (res.ok) { setSavedOk(true); setTimeout(() => setSavedOk(false), 2500); }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const totalClanovi   = (finansijeTotal: FinancijskiPregled) =>
    finansijeTotal.aktivniClanovi + finansijeTotal.neaktivniClanovi + finansijeTotal.suspendirani;

  const maxKat  = Math.max(...kategorije.map(k => k.count), 1);
  const maxPoj  = Math.max(...pojasevi.map(p => p.count), 1);
  const maxDob  = Math.max(...dobna.map(d => d.count), 1);
  const maxRaz  = Math.max(...(medaljeStats?.poRazini.map(r => r.count) ?? []), 1);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Analitika" subtitle="Statistike, financijska projekcija i AI godišnji izvještaj">

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
              activeTab === tab.id
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PREGLED ─────────────────────────────────────────────────────── */}
      {activeTab === 'pregled' && (
        <div className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
            <KpiCard icon={Users}    value={loading ? '…' : finansijeTotal(financije!)} label="Ukupno članova" sub={`${financije?.aktivniClanovi ?? 0} aktivnih`} colorClass="text-blue-400"   bgClass="bg-blue-500/10" />
            <KpiCard icon={Trophy}   value={loading ? '…' : medaljeStats?.medalje.ukupno ?? 0} label="Medalje ukupno" sub={`zlato: ${medaljeStats?.medalje.zlato ?? 0}`} colorClass="text-amber-400"  bgClass="bg-amber-500/10" />
            <KpiCard icon={BarChart3} value={loading ? '…' : medaljeStats?.poRazini.reduce((s, r) => s + r.count, 0) ?? 0} label="Natjecanja" sub="sva natjecanja" colorClass="text-violet-400" bgClass="bg-violet-500/10" />
            <KpiCard icon={Euro}      value={loading ? '…' : `${((financije?.procijenjeniGodisnji ?? 0) / 1000).toFixed(1)}k €`} label="Proj. godišnji prihod" sub={`${fee} €/čl. godišnje`} colorClass="text-green-400"  bgClass="bg-green-500/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="Kategorije članova (aktivni)" icon={Users}>
              {loading ? <SkeletonBars n={4} /> : kategorije.length === 0
                ? <Empty text="Nema podataka o kategorijama." />
                : <div className="space-y-3">{kategorije.map(k => (
                    <BarRow key={k.kategorija} label={k.label} count={k.count} max={maxKat} barClass="bg-blue-500" sub="%" />
                  ))}</div>
              }
            </SectionCard>

            <SectionCard title="Medalje po razini natjecanja" icon={Trophy}>
              {loading ? <SkeletonBars n={3} /> : (medaljeStats?.poRazini.length ?? 0) === 0
                ? <Empty text="Nema evidentiranih natjecanja." />
                : <>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { tip: 'Zlato',   count: medaljeStats!.medalje.zlato,  bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-300' },
                        { tip: 'Srebro',  count: medaljeStats!.medalje.srebro, bg: 'bg-slate-500/15 border-slate-400/30', text: 'text-slate-300' },
                        { tip: 'Bronca',  count: medaljeStats!.medalje.bronca, bg: 'bg-orange-800/20 border-orange-700/30', text: 'text-orange-300' },
                      ].map(m => (
                        <div key={m.tip} className={cn('rounded-xl border px-2 py-2.5 text-center', m.bg)}>
                          <p className={cn('text-xl font-bold tabular-nums', m.text)}>{m.count}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{m.tip}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">{medaljeStats!.poRazini.map(r => (
                      <BarRow key={r.razina} label={r.label} count={r.count} max={maxRaz} barClass="bg-amber-500" sub="%" />
                    ))}</div>
                  </>
              }
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── TAB: ČLANOVI ─────────────────────────────────────────────────────── */}
      {activeTab === 'clanovi' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <SectionCard title="Kategorije (aktivni)" icon={Users}>
            {loading ? <SkeletonBars n={5} /> : kategorije.length === 0
              ? <Empty text="Nema podataka." />
              : <div className="space-y-3">{kategorije.map(k => (
                  <BarRow key={k.kategorija} label={k.label} count={k.count} max={maxKat} barClass="bg-blue-500" sub="%" />
                ))}</div>
            }
          </SectionCard>

          <SectionCard title="Dobna distribucija (aktivni)" icon={Calendar}>
            {loading ? <SkeletonBars n={5} /> : dobna.length === 0
              ? <Empty text="Nema podataka o datumima rođenja." />
              : <div className="space-y-3">{dobna.map(d => (
                  <BarRow key={d.skupina} label={d.skupina} count={d.count} max={maxDob} barClass="bg-teal-500" sub="%" />
                ))}</div>
            }
          </SectionCard>

          <SectionCard title="Raspodjela po pojasevima (aktivni)" icon={Star} className="md:col-span-2 xl:col-span-1">
            {loading ? <SkeletonBars n={6} /> : pojasevi.length === 0
              ? <Empty text="Nema podataka o pojasevima." />
              : <div className="space-y-3">{pojasevi.map(p => (
                  <div key={p.pojas}>
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-block w-3 h-3 rounded-sm flex-shrink-0', POJAS_BAR[p.pojas] ?? 'bg-slate-500')} />
                        <span className="text-xs text-slate-300">{p.pojas}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium tabular-nums">
                        {p.count} <span className="text-slate-600">({Math.round((p.count / maxPoj) * 100)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', POJAS_BAR[p.pojas] ?? 'bg-slate-500')}
                        style={{ width: `${(p.count / maxPoj) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}</div>
            }
          </SectionCard>

          {/* Status breakdown */}
          {financije && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:col-span-2 xl:col-span-3">
              <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-500" />
                Status članstva
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Aktivni',      count: financije.aktivniClanovi,   bg: 'bg-green-500/10  border-green-500/20',  text: 'text-green-400'  },
                  { label: 'Neaktivni',    count: financije.neaktivniClanovi, bg: 'bg-slate-500/10  border-slate-500/20',  text: 'text-slate-400'  },
                  { label: 'Suspendirani', count: financije.suspendirani,     bg: 'bg-red-500/10    border-red-500/20',    text: 'text-red-400'    },
                ].map(s => (
                  <div key={s.label} className={cn('rounded-xl border px-3 py-4 text-center', s.bg)}>
                    <p className={cn('text-2xl font-bold tabular-nums', s.text)}>{s.count}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: NATJECANJA ──────────────────────────────────────────────────── */}
      {activeTab === 'natjecanja' && (
        <div className="space-y-4">
          {/* Medal row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { tip: 'Zlato',   count: medaljeStats?.medalje.zlato  ?? 0, emoji: '🥇', bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-300', sub: 'zlatnih medalja' },
              { tip: 'Srebro',  count: medaljeStats?.medalje.srebro ?? 0, emoji: '🥈', bg: 'bg-slate-600/20 border-slate-500/20', text: 'text-slate-300', sub: 'srebrnih medalja' },
              { tip: 'Bronca',  count: medaljeStats?.medalje.bronca ?? 0, emoji: '🥉', bg: 'bg-orange-800/15 border-orange-700/20', text: 'text-orange-300', sub: 'brončanih medalja' },
            ].map(m => (
              <div key={m.tip} className={cn('rounded-2xl border p-4 md:p-6 text-center', m.bg)}>
                <div className="text-3xl md:text-4xl mb-2">{m.emoji}</div>
                <p className={cn('text-3xl md:text-4xl font-bold tabular-nums', m.text)}>{loading ? '…' : m.count}</p>
                <p className="text-xs text-slate-500 mt-1">{m.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="Natjecanja po razini" icon={BarChart3}>
              {loading ? <SkeletonBars n={4} /> : (medaljeStats?.poRazini.length ?? 0) === 0
                ? <Empty text="Nema evidentiranih natjecanja." />
                : <div className="space-y-4">
                    {medaljeStats!.poRazini.map(r => (
                      <div key={r.razina}>
                        <div className="flex justify-between items-baseline mb-1.5">
                          <span className="text-xs font-semibold text-slate-200">{r.label}</span>
                          <span className="text-xs text-slate-500">{r.count} natjecanja · {r.medalje} medalja</span>
                        </div>
                        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-violet-500 transition-all duration-700"
                            style={{ width: `${(r.count / maxRaz) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </SectionCard>

            <SectionCard title="Sažetak rezultata" icon={Medal}>
              {loading ? <SkeletonBars n={3} /> : !medaljeStats
                ? <Empty text="Nema podataka." />
                : <div className="space-y-3">
                    {[
                      { label: 'Ukupno medalja',        value: medaljeStats.medalje.ukupno,                           color: 'text-amber-400' },
                      { label: 'Ukupno natjecanja',      value: medaljeStats.poRazini.reduce((s, r) => s + r.count, 0), color: 'text-violet-400' },
                      { label: 'Medalja po natjecanju', value: medaljeStats.poRazini.reduce((s, r) => s + r.count, 0) > 0
                          ? (medaljeStats.medalje.ukupno / medaljeStats.poRazini.reduce((s, r) => s + r.count, 0)).toFixed(1)
                          : '—', color: 'text-teal-400' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                        <span className="text-xs text-slate-400">{row.label}</span>
                        <span className={cn('text-sm font-bold tabular-nums', row.color)}>{row.value}</span>
                      </div>
                    ))}
                  </div>
              }
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── TAB: FINANCIJE ───────────────────────────────────────────────────── */}
      {activeTab === 'financije' && (
        <div className="space-y-4">
          {/* Fee configurator */}
          <div className="bg-slate-900 border border-violet-600/20 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
                  <Euro className="w-4 h-4 text-violet-400" />
                  Godišnja članarina po članu
                </h3>
                <p className="text-xs text-slate-500">Promijenite iznos za ažuriranje projekcije</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={fee}
                  onChange={e => handleFeeChange(Number(e.target.value))}
                  className="w-28 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 text-right outline-none focus:border-violet-500 transition-colors tabular-nums"
                />
                <span className="text-sm text-slate-400 font-medium">€ / god.</span>
              </div>
            </div>
          </div>

          {/* Projection cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Euro,     value: financije ? `${financije.procijenjeniGodisnji.toLocaleString('hr-HR')} €` : '…', label: 'Proj. godišnji prihod', sub: `${fee} €/čl.`, color: 'text-green-400',  bg: 'bg-green-500/10'  },
              { icon: Euro,     value: financije ? `${financije.procijenjeniMjesecni.toLocaleString('hr-HR')} €` : '…', label: 'Proj. mjesečni prihod', sub: 'prosjek',      color: 'text-teal-400',  bg: 'bg-teal-500/10'   },
              { icon: Users,    value: financije?.aktivniClanovi ?? '…', label: 'Aktivnih članova',    sub: 'plaćaju članarinu',     color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
              { icon: TrendingUp, value: financije?.noviClanovi ?? '…', label: `Novi ove godine`,      sub: 'od 1. siječnja',        color: 'text-violet-400', bg: 'bg-violet-500/10' },
            ].map((c, i) => (
              <KpiCard key={i} icon={c.icon} value={c.value} label={c.label} sub={c.sub} colorClass={c.color} bgClass={c.bg} />
            ))}
          </div>

          {/* Status distribution */}
          {financije && (
            <SectionCard title="Raspodjela statusa članstva" icon={Users}>
              {(() => {
                const total = financije.aktivniClanovi + financije.neaktivniClanovi + financije.suspendirani;
                return (
                  <div className="space-y-3">
                    <BarRow label={`Aktivni (${financije.aktivniClanovi})`}      count={financije.aktivniClanovi}   max={total} barClass="bg-green-500" sub="%" />
                    <BarRow label={`Neaktivni (${financije.neaktivniClanovi})`}  count={financije.neaktivniClanovi} max={total} barClass="bg-slate-500" sub="%" />
                    {financije.suspendirani > 0 && (
                      <BarRow label={`Suspendirani (${financije.suspendirani})`} count={financije.suspendirani}     max={total} barClass="bg-red-500"   sub="%" />
                    )}
                  </div>
                );
              })()}
            </SectionCard>
          )}

          {/* Upsell notice */}
          <div className="bg-slate-900 border border-amber-700/20 rounded-2xl p-4">
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Info className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-300">Projekcija prihoda</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Prikazani iznosi su projekcija temeljena na broju aktivnih članova i unesenom iznosu godišnje članarine.
                  Za praćenje stvarnih uplata, stanja dugova i automatskih podsjetnika aktivirajte modul
                  <span className="text-amber-400 font-medium"> Financije</span> dostupan u planu Standard.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: AI IZVJEŠTAJ ────────────────────────────────────────────────── */}
      {activeTab === 'izvjestaj' && (
        <div className="space-y-4 max-w-3xl">
          {/* Year selector + generate */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              AI Generator godišnjeg izvještaja
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Odaberite godinu, pregledajte prikupljene podatke i generirajte formalni izvještaj za Zajednicu sportskih udruga.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <select
                  value={izvjestajGodina}
                  onChange={e => setIzvjestajGodina(Number(e.target.value))}
                  className="appearance-none bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 pr-8 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors cursor-pointer"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}. godina</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>

              <button
                onClick={generiraj}
                disabled={generiranje || izvjestajLoading || !izvjestajPodaci}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
              >
                {generiranje
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generiram…</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Generiraj izvještaj</>
                }
              </button>
            </div>
          </div>

          {/* Data preview */}
          {izvjestajPodaci && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                Podaci za {izvjestajGodina}.
              </h4>
              {izvjestajLoading
                ? <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse"/>)}</div>
                : <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: 'Aktivnih članova', value: izvjestajPodaci.clanstvo.aktivni  },
                      { label: 'Novih članova',    value: izvjestajPodaci.clanstvo.novi     },
                      { label: 'Natjecanja',        value: izvjestajPodaci.natjecanja.ukupno },
                      { label: 'Medalje',           value: izvjestajPodaci.natjecanja.medalje.ukupno },
                      { label: 'Natjecatelji',      value: izvjestajPodaci.natjecanja.natjecatelji },
                      { label: 'Skupštine',         value: izvjestajPodaci.sjednice.ukupno  },
                      { label: 'Dokumenti',         value: izvjestajPodaci.dokumenti.ukupno },
                      { label: 'Klub',              value: izvjestajPodaci.klub?.naziv ?? '—' },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-800 rounded-xl px-3 py-2.5">
                        <p className="text-xs text-slate-500">{item.label}</p>
                        <p className="text-sm font-bold text-slate-200 mt-0.5 truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}

          {/* Streaming output */}
          {(output || generiranje) && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-semibold text-slate-300">Godišnji izvještaj {izvjestajGodina}.</span>
                  {generiranje && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />}
                </div>
                {output && !generiranje && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={kopiraj}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
                    >
                      {copied ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Kopirano</span></> : <><Copy className="w-3 h-3" />Kopiraj</>}
                    </button>
                    <button
                      onClick={spremi}
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
                    >
                      {savedOk ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Spremljeno</span></> : <><Save className="w-3 h-3" />Spremi u arhivu</>}
                    </button>
                  </div>
                )}
              </div>
              <div
                ref={outputRef}
                className="p-5 max-h-[60vh] overflow-y-auto text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-mono"
              >
                {output}
                {generiranje && <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />}
              </div>
            </div>
          )}
        </div>
      )}

    </AppLayout>
  );
}

// ─── Skeleton & empty helpers ─────────────────────────────────────────────────

function SkeletonBars({ n }: { n: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="space-y-1.5 animate-pulse">
          <div className="flex justify-between">
            <div className="h-3 bg-slate-800 rounded w-24" />
            <div className="h-3 bg-slate-800 rounded w-8" />
          </div>
          <div className="h-2 bg-slate-800 rounded-full" style={{ width: `${60 + (i * 13) % 40}%` }} />
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-slate-600 text-center py-4">{text}</p>;
}

// Helper to compute total members safely
function finansijeTotal(f: FinancijskiPregled | null): number | string {
  if (!f) return '…';
  return f.aktivniClanovi + f.neaktivniClanovi + f.suspendirani;
}
