'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import {
  Calendar, Plus, Sparkles, X, ChevronDown, ChevronUp,
  FileText, Check, Clock, AlertCircle, Copy, Download,
  Loader2, CheckCircle, ArrowRight, Edit3, Users,
} from 'lucide-react';
import { fetchSjednice, insertSjednica } from '@/lib/queries/sjednice';
import { fetchKlubInfo } from '@/lib/queries/dashboard';
import { fetchVotingMemberCount } from '@/lib/queries/clanovi';
import type { Sjednica } from '@/lib/queries/sjednice';
import { formatDate, cn } from '@/lib/utils';
import DateInput from '@/components/ui/DateInput';
import { useRole } from '@/lib/hooks/useRole';

/* ── HELPERS ───────────────────────────────────────────────── */

function quorumNeeded(total: number, termination: boolean): number {
  if (termination) return Math.ceil((total * 2) / 3);
  return Math.floor(total / 2) + 1;
}

function signatureBlock(predsjednikIme: string, date: string, location: string): string {
  const predsj = predsjednikIme || '______________________';
  return `Za točnost ovog Zapisnika potpisuju:

Predsjednik kluba:                    Zapisničar:
______________________________        ______________________________
${predsj.padEnd(30)}        ______________________________


Ovjerovitelj zapisnika:               Ovjerovitelj zapisnika:
______________________________        ______________________________
______________________________        ______________________________

Datum i mjesto: ${date || '___________'}, ${location || '___________'}`;
}

/* ── GENERATED DOCUMENTS ───────────────────────────────────── */

function generateZapisnik(
  meeting: Partial<MeetingForm>,
  klubNaziv: string,
  predsjednikIme: string,
  ukupnoGlasaca: number,
): string {
  const naziv = klubNaziv || 'Karate kluba';
  const predsjednik = predsjednikIme || 'predsjednik/ca kluba';
  const prisutni = meeting.prisutniGlasaci ?? 0;
  const isTermination = (meeting.agenda ?? []).some(a =>
    /prestanak\s+rada|raspuštanje/i.test(a)
  );
  const needed = quorumNeeded(ukupnoGlasaca, isTermination);
  const quorumMet = ukupnoGlasaca > 0 && prisutni > 0 && prisutni >= needed;
  const quorumLabel = isTermination
    ? `2/3 glasača (čl. 40. Statuta) — ${needed} od ${ukupnoGlasaca}`
    : `više od polovice (čl. 24. Statuta) — ${needed} od ${ukupnoGlasaca}`;

  const quorumBlock = ukupnoGlasaca > 0 && prisutni > 0
    ? `Ukupno članova s pravom glasa: ${ukupnoGlasaca}
Prisutno s pravom glasa:       ${prisutni}
Kvorum potreban (${quorumLabel})
Status kvoruma: ${quorumMet
      ? `KVORUM POSTIGNUT ✓  (${prisutni}/${ukupnoGlasaca} prisutnih)`
      : `KVORUM NIJE POSTIGNUT ✗  (${prisutni}/${ukupnoGlasaca}, potrebno ≥ ${needed})`
    }`
    : `Ukupno članova s pravom glasa: ${ukupnoGlasaca || '___'}
Prisutno s pravom glasa:       ${prisutni || '___'}
Kvorum potreban: ___ (unijeti broj prisutnih u obrazac)
Status kvoruma: [izračun dostupan nakon unosa broja prisutnih]`;

  return `ZAPISNIK
s ${meeting.type === 'izvanredna' ? 'Izvanredne' : 'Redovne'} skupštine
${naziv}

Datum i vrijeme: ${meeting.date || '—'} u ${meeting.time || '—'} sati
Mjesto održavanja: ${meeting.location || '—'}

═══════════════════════════════════════════
GLASAČKI KVORUM (čl. 24. Statuta)
═══════════════════════════════════════════
${quorumBlock}

PRISUTNI ČLANOVI: [popis prisutnih]

DNEVNI RED:
${(meeting.agenda ?? []).map((item, i) => `${i + 1}. ${item}`).join('\n')}

═══════════════════════════════════════════
TIJEK SJEDNICE
═══════════════════════════════════════════

Ad. 1) Otvaranje skupštine i provjera kvoruma
Skupštinu je otvorio/la predsjednik/ca ${predsjednik} koji/a je utvrdio/la da je na skupštini prisutno ${prisutni || '____'} od ${ukupnoGlasaca || '____'} članova s pravom glasa${quorumMet ? ', čime je postignut zakonski kvorum za pravovaljano odlučivanje' : '. Kvorum nije postignut.'}.

${meeting.aiNotes ? `NAPOMENE IZ SJEDNICE:\n${meeting.aiNotes}\n` : ''}
ZAKLJUČAK:
Skupština je završila u __:__ sati.

${signatureBlock(predsjednikIme, meeting.date ?? '', meeting.location ?? '')}`;
}

function generateOdluka(
  meeting: Partial<MeetingForm>,
  klubNaziv: string,
  predsjednikIme: string,
  ukupnoGlasaca: number,
): string {
  const naziv = klubNaziv || 'Karate kluba';
  const predsjednik = predsjednikIme || 'predsjednik/ca kluba';
  const prisutni = meeting.prisutniGlasaci ?? 0;
  const isTermination = (meeting.agenda ?? []).some(a =>
    /prestanak\s+rada|raspuštanje/i.test(a)
  );
  const needed = quorumNeeded(ukupnoGlasaca, isTermination);
  const quorumMet = ukupnoGlasaca > 0 && prisutni > 0 && prisutni >= needed;

  const glasanjeOpis = prisutni > 0
    ? `glasanjem ${prisutni} prisutnih članova s pravom glasa (od ukupno ${ukupnoGlasaca} ovlaštenih glasača; kvorum ${quorumMet ? 'postignut ✓' : 'NIJE postignut ✗'})`
    : 'glasanjem prisutnih članova s pravom glasa';

  return `ODLUKA SKUPŠTINE ${naziv.toUpperCase()}

Temeljem članka 24. Statuta ${naziv}, Skupština ${naziv} na sjednici
održanoj dana ${meeting.date || '___'} u ${meeting.location || '___'} donosi sljedeće:

═══════════════════════════════════════════
O D L U K E
═══════════════════════════════════════════

1. Skupština prihvaća Godišnji izvještaj o radu kluba za proteklu godinu.

2. Skupština usvaja Financijsko izvješće za proteklu poslovnu godinu.

3. Skupština odobrava Plan aktivnosti za nadolazeće natjecateljsko razdoblje.

${meeting.aiNotes ? `Napomene iz sjednice:\n${meeting.aiNotes}\n\n` : ''}Odluke su donesene ${glasanjeOpis}.

Za izvršenje ovih Odluka zadužuje se Uprava kluba.

${signatureBlock(predsjednikIme, meeting.date ?? '', meeting.location ?? '')}`;
}

/* ── TYPES ─────────────────────────────────────────────────── */
interface MeetingForm {
  type: 'redovna' | 'izvanredna';
  date: string;
  time: string;
  location: string;
  agenda: string[];
  aiNotes: string;
  prisutniGlasaci: number;
}

type AiState = 'idle' | 'generating' | 'done';

/* ── AI GENERATION PANEL ───────────────────────────────────── */
function AIGeneratorPanel({
  form, klubNaziv, predsjednikIme, ukupnoGlasaca,
}: {
  form: MeetingForm;
  klubNaziv: string;
  predsjednikIme: string;
  ukupnoGlasaca: number;
}) {
  const [aiState, setAiState] = useState<AiState>('idle');
  const [activeDoc, setActiveDoc] = useState<'zapisnik' | 'odluka'>('zapisnik');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    setAiState('generating');
    setTimeout(() => setAiState('done'), 3000);
  };

  const copy = () => {
    const text = activeDoc === 'zapisnik'
      ? generateZapisnik(form, klubNaziv, predsjednikIme, ukupnoGlasaca)
      : generateOdluka(form, klubNaziv, predsjednikIme, ukupnoGlasaca);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressMessages = [
    'Analizira dnevni red...',
    'Primjenjuje pravnu terminologiju...',
    'Izračunava kvorum sukladno Statutu...',
    'Dodaje zakonske odrednice...',
    'Finalizira dokumente...',
  ];
  const [progressMsg, setProgressMsg] = useState(0);

  useEffect(() => {
    if (aiState !== 'generating') return;
    const interval = setInterval(() => {
      setProgressMsg(p => (p + 1) % progressMessages.length);
    }, 600);
    return () => clearInterval(interval);
  }, [aiState]);

  const prisutni = form.prisutniGlasaci;
  const isTermination = form.agenda.some(a => /prestanak\s+rada|raspuštanje/i.test(a));
  const needed = ukupnoGlasaca > 0 ? quorumNeeded(ukupnoGlasaca, isTermination) : null;
  const quorumMet = needed !== null && prisutni >= needed;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* AI section header */}
      <div className="bg-gradient-to-r from-violet-950/60 to-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">AI Asistent — Generiranje dokumenata</p>
          <p className="text-xs text-slate-500">Unesi natuknice iz sjednice i prepusti AI-ju pisanje</p>
        </div>
      </div>

      {/* Quorum status panel */}
      {ukupnoGlasaca > 0 && (
        <div className={cn(
          'mx-6 mt-5 flex items-center gap-3 px-4 py-3 rounded-xl border text-xs',
          prisutni === 0
            ? 'bg-slate-800/60 border-slate-700 text-slate-400'
            : quorumMet
            ? 'bg-green-900/20 border-green-700/40 text-green-300'
            : 'bg-red-900/20 border-red-700/40 text-red-300',
        )}>
          <Users className="w-4 h-4 flex-shrink-0" />
          <span>
            {prisutni === 0
              ? `Ukupno glasača: ${ukupnoGlasaca} — unesi broj prisutnih u obrascu`
              : quorumMet
              ? `Kvorum postignut ✓ — ${prisutni}/${ukupnoGlasaca} prisutnih (potrebno ≥ ${needed})`
              : `Kvorum nije postignut ✗ — ${prisutni}/${ukupnoGlasaca} prisutnih (potrebno ≥ ${needed})`}
          </span>
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* Notes textarea */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Što se raspravljalo? (slobodan tekst, natuknice)
          </label>
          <textarea
            value={form.aiNotes}
            readOnly
            placeholder={`Primjer:\n- Usvojen godišnji izvještaj predsjednika, jednoglasno\n- Financijsko izvješće prihvaćeno s 15 glasova za, 2 suzdržana\n- Dogovoreno natjecanje u Splitu u rujnu\n- Novi trening raspored od rujna...`}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors h-36 resize-none"
          />
        </div>

        {/* Generate button */}
        {aiState === 'idle' && (
          <button
            onClick={generate}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white font-bold py-4 rounded-xl text-sm transition-all shadow-lg shadow-violet-900/30 group"
          >
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Neka AI napiše službene dokumente
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {/* Generating state */}
        {aiState === 'generating' && (
          <div className="bg-violet-950/30 border border-violet-800/40 rounded-xl p-5 text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-violet-800" />
                <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full bg-violet-900/50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-400 spin-slow" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-violet-300">AI generira dokumente...</p>
              <p className="text-xs text-slate-500 mt-1 h-4 transition-all">{progressMessages[progressMsg]}</p>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full animate-pulse shimmer" style={{ width: '70%' }} />
            </div>
          </div>
        )}

        {/* Result */}
        {aiState === 'done' && (
          <div className="space-y-4 fade-in">
            {/* Success banner */}
            <div className="flex items-center gap-2 bg-green-900/20 border border-green-800/40 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-300 font-medium">Dokumenti generirani! Pregledaj i prilagodi po potrebi.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              {(['zapisnik', 'odluka'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setActiveDoc(d)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    activeDoc === d
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-600/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                  )}
                >
                  <FileText className="w-4 h-4" />
                  {d === 'zapisnik' ? 'Zapisnik' : 'Odluke'}
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full', activeDoc === d ? 'bg-violet-500/30 text-violet-200' : 'bg-slate-700 text-slate-500')}>
                    Nacrt
                  </span>
                </button>
              ))}
            </div>

            {/* Document preview */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 max-h-64 overflow-y-auto">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                {activeDoc === 'zapisnik'
                  ? generateZapisnik(form, klubNaziv, predsjednikIme, ukupnoGlasaca)
                  : generateOdluka(form, klubNaziv, predsjednikIme, ukupnoGlasaca)}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Kopirano!' : 'Kopiraj tekst'}
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                <Download className="w-4 h-4" /> Preuzmi .docx
              </button>
            </div>

            <button
              onClick={() => setAiState('idle')}
              className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
            >
              Regeneriraj s novim natuknicama
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── NEW MEETING FORM ──────────────────────────────────────── */
function NewMeetingPanel({
  onClose, onSaved, klubNaziv, predsjednikIme, ukupnoGlasaca,
}: {
  onClose: () => void;
  onSaved: () => void;
  klubNaziv: string;
  predsjednikIme: string;
  ukupnoGlasaca: number;
}) {
  const [form, setForm] = useState<MeetingForm>({
    type: 'redovna',
    date: '',
    time: '18:00',
    location: '',
    agenda: ['Otvaranje skupštine i provjera kvoruma', 'Usvajanje dnevnog reda', ''],
    aiNotes: '',
    prisutniGlasaci: 0,
  });

  const [saving, setSaving] = useState(false);
  const set = (k: keyof MeetingForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const addAgendaItem = () => setForm(f => ({ ...f, agenda: [...f.agenda, ''] }));
  const updateAgenda = (i: number, v: string) =>
    setForm(f => ({ ...f, agenda: f.agenda.map((a, idx) => (idx === i ? v : a)) }));
  const removeAgenda = (i: number) =>
    setForm(f => ({ ...f, agenda: f.agenda.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.date || !form.location) return;
    setSaving(true);
    try {
      await insertSjednica({
        vrsta: form.type,
        datum: form.date,
        vrijeme: form.time,
        lokacija: form.location,
        dnevni_red: form.agenda.filter(a => a.trim()),
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error('Greška pri spremi sjednice:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left: Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-100">Pripremi skupštinu</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Type */}
        <div className="flex gap-2">
          {(['redovna', 'izvanredna'] as const).map(t => (
            <button
              key={t}
              onClick={() => set('type', t)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize',
                form.type === t ? 'bg-red-600/20 text-red-300 border border-red-600/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Datum *</label>
            <DateInput value={form.date} onChange={iso => set('date', iso)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-red-500 transition-colors placeholder:text-slate-600" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Vrijeme</label>
            <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-red-500 transition-colors" />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Mjesto *</label>
          <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
            placeholder="npr. Sportska dvorana Kantrida, Rijeka"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-red-500 transition-colors" />
        </div>

        {/* Voting count */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Prisutni s pravom glasa
            {ukupnoGlasaca > 0 && (
              <span className="ml-1.5 normal-case font-normal text-slate-600">
                (od ukupno {ukupnoGlasaca} ovlaštenih)
              </span>
            )}
          </label>
          <input
            type="number"
            min={0}
            max={ukupnoGlasaca || 9999}
            value={form.prisutniGlasaci || ''}
            onChange={e => setForm(f => ({ ...f, prisutniGlasaci: Math.max(0, Number(e.target.value)) }))}
            placeholder="0"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-red-500 transition-colors"
          />
        </div>

        {/* Agenda */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Dnevni red</label>
          <div className="space-y-2">
            {form.agenda.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-5 text-right flex-shrink-0">{i + 1}.</span>
                <input
                  value={item}
                  onChange={e => updateAgenda(i, e.target.value)}
                  placeholder="Točka dnevnog reda..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-red-500 transition-colors"
                />
                {form.agenda.length > 1 && (
                  <button onClick={() => removeAgenda(i)} className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-red-900/40 hover:text-red-400 text-slate-600 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addAgendaItem} className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Dodaj točku
          </button>
        </div>

        {/* AI Notes */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Natuknice sa sjednice (za AI)
          </label>
          <textarea
            value={form.aiNotes}
            onChange={e => set('aiNotes', e.target.value)}
            placeholder="Slobodan tekst: što je rečeno, kakve su bile odluke, tko je govorio..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors h-24 resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !form.date || !form.location}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Sprema se...' : 'Spremi skupštinu'}
        </button>
      </div>

      {/* Right: AI Generator */}
      <AIGeneratorPanel
        form={form}
        klubNaziv={klubNaziv}
        predsjednikIme={predsjednikIme}
        ukupnoGlasaca={ukupnoGlasaca}
      />
    </div>
  );
}

/* ── MAIN PAGE ─────────────────────────────────────────────── */
function SkupstineContent() {
  // ── ROLE GATE ─────────────────────────────────────────────────
  const { isAdmin, roleLoaded } = useRole();
  const canEdit = isAdmin;

  // ── DATA STATE ────────────────────────────────────────────────
  const [showNew, setShowNew] = useState(false);
  const [sjednice, setSjednice] = useState<Sjednica[]>([]);
  const [loading, setLoading] = useState(true);
  const [klubNaziv, setKlubNaziv] = useState('');
  const [predsjednikIme, setPredsjednikIme] = useState('');
  const [ukupnoGlasaca, setUkupnoGlasaca] = useState(0);
  const searchParams = useSearchParams();

  const loadSjednice = () => {
    setLoading(true);
    fetchSjednice()
      .then(setSjednice)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (searchParams.get('action') === 'new') setShowNew(true);
  }, [searchParams]);

  useEffect(() => {
    loadSjednice();
    fetchKlubInfo().then(info => {
      if (info) {
        setKlubNaziv(info.naziv);
        setPredsjednikIme(info.predsjednik ?? '');
      }
    });
    fetchVotingMemberCount().then(setUkupnoGlasaca);
  }, []);

  const statusConfig = {
    planirana: { label: 'Planirana', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800/40' },
    zavrsena:  { label: 'Završena', color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/40' },
    otkazana:  { label: 'Otkazana', color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/40' },
  };

  return (
    <AppLayout
      title="Skupštine i dokumenti"
      subtitle={ukupnoGlasaca > 0
        ? `${ukupnoGlasaca} članova s pravom glasa · Organiziraj sjednice uz pomoć AI-ja`
        : 'Organiziraj sjednice i generiraj dokumente uz pomoć AI-ja'}
      actions={
        roleLoaded && canEdit ? (
          <button
            onClick={() => setShowNew(!showNew)}
            className={cn(
              'flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg',
              showNew
                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30'
            )}
          >
            {showNew ? <><X className="w-4 h-4" /> Zatvori</> : <><Plus className="w-4 h-4" /> Nova skupština</>}
          </button>
        ) : undefined
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* New meeting form — admin only */}
        {showNew && canEdit && (
          <div className="fade-in">
            <NewMeetingPanel
              onClose={() => setShowNew(false)}
              onSaved={() => { loadSjednice(); setShowNew(false); }}
              klubNaziv={klubNaziv}
              predsjednikIme={predsjednikIme}
              ukupnoGlasaca={ukupnoGlasaca}
            />
          </div>
        )}

        {/* Meetings list */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Skupštine</h2>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
            </div>
          ) : sjednice.length === 0 ? (
            <div className="text-center py-16 text-slate-600 text-sm">Nema zabilježenih skupština.</div>
          ) : (
            <div className="space-y-3">
              {sjednice.map(sjednica => {
                const status = statusConfig[sjednica.status];
                return (
                  <div key={sjednica.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-violet-900/30 border border-violet-800/40 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-violet-300 leading-none">
                            {new Date(sjednica.datum).getDate()}
                          </span>
                          <span className="text-xs text-violet-500 leading-none mt-0.5 capitalize">
                            {new Date(sjednica.datum).toLocaleDateString('hr-HR', { month: 'short' })}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-100 capitalize">
                              {sjednica.vrsta} skupština
                            </p>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', status.color, status.bg)}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDate(sjednica.datum)} u {sjednica.vrijeme}h · {sjednica.lokacija}
                          </p>
                          {sjednica.dnevni_red.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {sjednica.dnevni_red.slice(0, 3).map((item, i) => (
                                <span key={i} className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                                  {item.length > 30 ? item.slice(0, 30) + '...' : item}
                                </span>
                              ))}
                              {sjednica.dnevni_red.length > 3 && (
                                <span className="text-xs bg-slate-800 text-slate-600 px-2 py-0.5 rounded-full">
                                  +{sjednica.dnevni_red.length - 3} više
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {sjednica.broj_dokumenata > 0 && (
                          <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                            <FileText className="w-3.5 h-3.5" /> {sjednica.broj_dokumenata} dok.
                          </span>
                        )}
                        <button className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}

export default function SkupstinePage() {
  return (
    <Suspense fallback={null}>
      <SkupstineContent />
    </Suspense>
  );
}
