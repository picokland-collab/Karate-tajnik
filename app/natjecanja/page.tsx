'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import {
  Trophy, Plus, X, Check, Copy, Award,
  Sparkles, Loader2, ChevronDown, MapPin,
  Calendar, ArrowRight, Star,
  FileText, Zap, UserPlus, Share2,
} from 'lucide-react';
import { competitions, members } from '@/lib/mock-data';
import { formatDate, cn } from '@/lib/utils';
import type { Competition, CompetitionResult } from '@/lib/types';

/* ── AI REPORTS ────────────────────────────────────────────── */

function buildOfficialReport(form: CompForm): string {
  const medals = form.results.filter(r => r.medal);
  const gold = medals.filter(r => r.medal === 'zlato');
  const silver = medals.filter(r => r.medal === 'srebro');
  const bronze = medals.filter(r => r.medal === 'bronca');

  return `IZVJEŠTAJ O NASTUPU
Karate kluba Rijeka

Natjecanje: ${form.name || '—'}
Datum: ${form.date || '—'}
Mjesto: ${form.location || '—'}
Razina: ${form.level || '—'}

SAŽETAK NASTUPA:

Karate klub Rijeka nastupio je na natjecanju ${form.name || '[naziv]'} održanom ${form.date ? formatDate(form.date) : '[datum]'} u ${form.location || '[mjesto]'} s ukupno ${form.results.length} natjecatelja u disciplinama kata i kumite.

OSVAJAČI MEDALJA:

${gold.length > 0 ? `🥇 ZLATNE MEDALJE (${gold.length}):\n${gold.map(r => `   • ${r.memberName} — ${r.event}, kategorija ${r.category}`).join('\n')}` : ''}

${silver.length > 0 ? `🥈 SREBRNE MEDALJE (${silver.length}):\n${silver.map(r => `   • ${r.memberName} — ${r.event}, kategorija ${r.category}`).join('\n')}` : ''}

${bronze.length > 0 ? `🥉 BRONČANE MEDALJE (${bronze.length}):\n${bronze.map(r => `   • ${r.memberName} — ${r.event}, kategorija ${r.category}`).join('\n')}` : ''}

UKUPAN REZULTAT KLUBA:
${gold.length} zlatnih · ${silver.length} srebrnih · ${bronze.length} brončanih odličja

Ovim nastupom Karate klub Rijeka potvrdio je visoku razinu natjecateljske forme i nastavlja tradiciju izvrsnosti u hrvatskom karateu.

Za Karate klub Rijeka,
Uprava kluba
Datum izvještaja: ${new Date().toLocaleDateString('hr-HR')}`;
}

function buildSocialPost(form: CompForm): string {
  const medals = form.results.filter(r => r.medal);
  const gold = medals.filter(r => r.medal === 'zlato');
  const silver = medals.filter(r => r.medal === 'srebro');
  const bronze = medals.filter(r => r.medal === 'bronca');

  return `🏆 NEVJEROJATAN USPJEH NA ${(form.name || 'NATJECANJU').toUpperCase()}! 🏆

Naši borci su pokazali pravo srce šampiona na ${form.name || 'natjecanju'} u ${form.location || 'gradu'}! 💪🔥

${gold.map(r => `🥇 ${r.memberName} — ZLATO u ${r.event}! BRAVO!!! 🎉`).join('\n')}
${silver.map(r => `🥈 ${r.memberName} — SREBRO u ${r.event}! Fantastično! 👏`).join('\n')}
${bronze.map(r => `🥉 ${r.memberName} — BRONCA u ${r.event}! Svaka čast! 💪`).join('\n')}

Ukupno ${gold.length + silver.length + bronze.length} medalja za KK Rijeka! 🎊

Ovakvi rezultati su plod dugogodišnjeg rada, odricanja i predanosti. Ponosni smo na sve naše sportaše!

Posebne čestitke trenerima koji su sve ovo omogućili! 👨‍🏫

${form.level === 'međunarodno' ? '🌍 Ovo je međunarodni uspjeh koji ide daleko!' : '🇭🇷 Ponosni Riječani!'}

#karaterijeka #karate #kkrijeka #sport #rijeka #karatekid #medalja #prvak
${form.level === 'međunarodno' ? '#internationalkarate #croatia' : '#hrvatska #sport'}`;
}

/* ── TYPES ─────────────────────────────────────────────────── */
interface ResultEntry {
  memberName: string;
  category: string;
  event: string;
  medal: 'zlato' | 'srebro' | 'bronca' | '';
}

interface CompForm {
  name: string;
  date: string;
  location: string;
  level: string;
  type: string;
  results: ResultEntry[];
}

type AiTab = 'official' | 'social';

/* ── MEDAL REPORT TABS ─────────────────────────────────────── */
function MediaReportTabs({ form }: { form: CompForm }) {
  const [activeTab, setActiveTab] = useState<AiTab>('official');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = () => {
    setIsGenerating(true);
    setTimeout(() => { setIsGenerating(false); setGenerated(true); }, 2200);
  };

  const copy = () => {
    const text = activeTab === 'official' ? buildOfficialReport(form) : buildSocialPost(form);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-950/50 to-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">AI Medijski izvještaj</p>
          <p className="text-xs text-slate-500">Generiraj službeni izvještaj i objavu za društvene mreže</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {!generated && !isGenerating && (
          <button
            onClick={generate}
            disabled={!form.name || form.results.filter(r => r.memberName && r.medal).length === 0}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-sm transition-all shadow-lg shadow-amber-900/20 group"
          >
            <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Generiraj medijski izvještaj
          </button>
        )}

        {isGenerating && (
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-6 text-center space-y-3">
            <div className="flex justify-center gap-2">
              {['🥇', '🥈', '🥉'].map((emoji, i) => (
                <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>
                  {emoji}
                </span>
              ))}
            </div>
            <p className="text-sm font-bold text-amber-300">AI piše izvještaj...</p>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 rounded-full shimmer" style={{ width: '65%' }} />
            </div>
          </div>
        )}

        {generated && (
          <div className="space-y-4 fade-in">
            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('official')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  activeTab === 'official'
                    ? 'bg-amber-600/20 text-amber-300 border border-amber-600/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                )}
              >
                <FileText className="w-4 h-4" /> Službeni izvještaj
              </button>
              <button
                onClick={() => setActiveTab('social')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  activeTab === 'social'
                    ? 'bg-pink-600/20 text-pink-300 border border-pink-600/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                )}
              >
                <Share2 className="w-4 h-4" /> Fejs & Instagram
              </button>
            </div>

            {/* Preview */}
            <div className={cn(
              'border rounded-xl p-4 max-h-72 overflow-y-auto',
              activeTab === 'social'
                ? 'bg-gradient-to-b from-pink-950/20 to-slate-800/60 border-pink-900/40'
                : 'bg-slate-800/60 border-slate-700'
            )}>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                {activeTab === 'official' ? buildOfficialReport(form) : buildSocialPost(form)}
              </pre>
            </div>

            {/* Copy button */}
            <button
              onClick={copy}
              className={cn(
                'w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl transition-all',
                copied
                  ? 'bg-green-600 text-white'
                  : activeTab === 'social'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-pink-900/20'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20'
              )}
            >
              {copied ? <><Check className="w-4 h-4" /> Kopirano!</> : activeTab === 'social'
                ? <><Copy className="w-4 h-4" /> Kopiraj za društvene mreže</>
                : <><Copy className="w-4 h-4" /> Kopiraj tekst</>
              }
            </button>

            <button onClick={() => setGenerated(false)} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1">
              Regeneriraj
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── NEW COMPETITION FORM ──────────────────────────────────── */
function NewCompetitionPanel({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<CompForm>({
    name: '',
    date: '',
    location: '',
    level: 'državno',
    type: 'oboje',
    results: [{ memberName: '', category: '', event: 'Kumite', medal: '' }],
  });

  const setField = (k: keyof CompForm, v: string) => setForm(f => ({ ...f, [k]: v }));
  const addResult = () => setForm(f => ({
    ...f,
    results: [...f.results, { memberName: '', category: '', event: 'Kumite', medal: '' }],
  }));
  const updateResult = (i: number, k: keyof ResultEntry, v: string) =>
    setForm(f => ({ ...f, results: f.results.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const removeResult = (i: number) =>
    setForm(f => ({ ...f, results: f.results.filter((_, idx) => idx !== i) }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left: Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-100">Unesi rezultate natjecanja</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Competition name */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Naziv natjecanja *</label>
          <input value={form.name} onChange={e => setField('name', e.target.value)}
            placeholder="npr. Zagreb Open 2025"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors" />
        </div>

        {/* Date + Location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Datum</label>
            <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Razina</label>
            <select value={form.level} onChange={e => setField('level', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500 cursor-pointer">
              {['klubsko', 'županijsko', 'državno', 'međunarodno'].map(l => (
                <option key={l} value={l} className="capitalize">{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Mjesto održavanja</label>
          <input value={form.location} onChange={e => setField('location', e.target.value)}
            placeholder="npr. Sportska dvorana Zagreb"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors" />
        </div>

        {/* Results */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Osvajači medalja
          </label>
          <div className="space-y-3">
            {form.results.map((result, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3 space-y-2 border border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold">Sportaš {i + 1}</span>
                  {form.results.length > 1 && (
                    <button onClick={() => removeResult(i)} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input
                  value={result.memberName}
                  onChange={e => updateResult(i, 'memberName', e.target.value)}
                  placeholder="Ime i prezime"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-500 transition-colors"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={result.category}
                    onChange={e => updateResult(i, 'category', e.target.value)}
                    placeholder="Kategorija (npr. Junior -68kg)"
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 outline-none focus:border-amber-500 transition-colors"
                  />
                  <select
                    value={result.event}
                    onChange={e => updateResult(i, 'event', e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option>Kumite</option>
                    <option>Kata</option>
                  </select>
                </div>
                {/* Medal picker */}
                <div className="flex gap-2">
                  {([
                    { value: 'zlato', emoji: '🥇', label: 'Zlato' },
                    { value: 'srebro', emoji: '🥈', label: 'Srebro' },
                    { value: 'bronca', emoji: '🥉', label: 'Bronca' },
                    { value: '', emoji: '4️⃣', label: '4. mj.' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateResult(i, 'medal', opt.value)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all',
                        result.medal === opt.value
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-600/40'
                          : 'bg-slate-600 text-slate-400 border border-transparent hover:border-slate-500'
                      )}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button onClick={addResult} className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Dodaj sportaša
          </button>
        </div>
      </div>

      {/* Right: Media report */}
      <MediaReportTabs form={form} />
    </div>
  );
}

/* ── MAIN PAGE ─────────────────────────────────────────────── */
function NatjecanjaContent() {
  const [showNew, setShowNew] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'new') setShowNew(true);
  }, [searchParams]);

  const medalColors = {
    zlato:  { bg: 'bg-yellow-900/30', border: 'border-yellow-700/40', text: 'text-yellow-300', emoji: '🥇' },
    srebro: { bg: 'bg-slate-700/40',  border: 'border-slate-600/40',  text: 'text-slate-300',  emoji: '🥈' },
    bronca: { bg: 'bg-amber-900/30',  border: 'border-amber-700/40',  text: 'text-amber-400',  emoji: '🥉' },
  };

  return (
    <AppLayout
      title="Natjecanja"
      subtitle="Unesi rezultate i generiraj medijske objave u jednom kliku"
      actions={
        <button
          onClick={() => setShowNew(!showNew)}
          className={cn(
            'flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors',
            showNew
              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30'
          )}
        >
          {showNew ? <><X className="w-4 h-4" /> Zatvori</> : <><Plus className="w-4 h-4" /> Unesi rezultate</>}
        </button>
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {showNew && (
          <div className="fade-in">
            <NewCompetitionPanel onClose={() => setShowNew(false)} />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { emoji: '🥇', value: '1', label: 'Zlatnih medalja', color: 'text-yellow-300' },
            { emoji: '🥈', value: '1', label: 'Srebrnih medalja', color: 'text-slate-300' },
            { emoji: '🥉', value: '1', label: 'Brončanih medalja', color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-3xl mb-1">{s.emoji}</p>
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Competitions list */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Nedavna natjecanja</h2>
          <div className="space-y-4">
            {competitions.map(comp => (
              <div key={comp.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-bold text-slate-100">{comp.name}</h3>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                        comp.level === 'međunarodno' ? 'bg-amber-900/30 text-amber-300 border border-amber-800/40' : 'bg-blue-900/20 text-blue-300 border border-blue-800/30'
                      )}>
                        {comp.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(comp.date)}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {comp.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
                      {comp.results.filter(r => r.medal).length} medalja
                    </span>
                  </div>
                </div>

                {/* Results */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {comp.results.filter(r => r.medal).map((result, i) => {
                    const mc = medalColors[result.medal as keyof typeof medalColors];
                    return (
                      <div key={i} className={cn('flex items-center gap-2.5 rounded-xl p-2.5 border', mc.bg, mc.border)}>
                        <span className="text-xl">{mc.emoji}</span>
                        <div className="min-w-0">
                          <p className={cn('text-xs font-bold truncate', mc.text)}>{result.memberName}</p>
                          <p className="text-xs text-slate-500 truncate">{result.event} · {result.category}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

export default function NatjecanjaPage() {
  return (
    <Suspense fallback={null}>
      <NatjecanjaContent />
    </Suspense>
  );
}
