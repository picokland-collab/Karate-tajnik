'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Building2, Save, Bell, Users, Shield, Check, Loader2, Download, FileArchive, AlertCircle, RefreshCw, Activity } from 'lucide-react';
import { fetchKlubPodaci, updateKlub } from '@/lib/queries/dashboard';
import type { KlubPodaci } from '@/lib/queries/dashboard';
import { formatDate } from '@/lib/utils';

function Field({
  label, value, onChange, type = 'text', placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-red-500 transition-colors placeholder:text-slate-600"
      />
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

export default function PostavkePage() {
  const [klub, setKlub] = useState<KlubPodaci | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState('');
  const [exporting, setExporting]     = useState(false);
  const [exportDone, setExportDone]   = useState(false);
  const [exportError, setExportError] = useState('');
  const [cronRunning, setCronRunning] = useState(false);
  const [cronResult, setCronResult]   = useState<{ newItems: number; emailsSent: number; emailsFailed: number } | null>(null);
  const [cronError, setCronError]     = useState('');

  const [form, setForm] = useState({
    naziv: '',
    oib: '',
    grad: '',
    kontakt_email: '',
    predsjednik: '',
    datum_mandata: '',
    godina_osnivanja: '',
  });

  useEffect(() => {
    fetchKlubPodaci().then(data => {
      if (data) {
        setKlub(data);
        setForm({
          naziv:            data.naziv ?? '',
          oib:              data.oib ?? '',
          grad:             data.grad ?? '',
          kontakt_email:    data.kontakt_email ?? '',
          predsjednik:      data.predsjednik ?? '',
          datum_mandata:    data.datum_mandata ?? '',
          godina_osnivanja: data.godina_osnivanja != null ? String(data.godina_osnivanja) : '',
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCronTrigger = async () => {
    setCronRunning(true);
    setCronResult(null);
    setCronError('');
    try {
      const secret = process.env.NEXT_PUBLIC_WEBHOOK_SECRET_HINT ?? '';
      const res = await fetch('/api/cron/obavijesti', {
        method: 'GET',
        headers: { 'x-cron-secret': secret },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json() as { newItems: number; emailsSent: number; emailsFailed: number };
      setCronResult(data);
      setTimeout(() => setCronResult(null), 10000);
    } catch (e) {
      setCronError(e instanceof Error ? e.message : 'Greška pri pokretanju.');
      setTimeout(() => setCronError(''), 8000);
    } finally {
      setCronRunning(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    setExportDone(false);
    try {
      const res = await fetch('/api/export/inspekcija', { method: 'POST' });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match       = disposition.match(/filename="([^"]+)"/);
      const filename    = match?.[1] ?? 'digitalni-tajnik-arhiva.zip';
      const blob        = await res.blob();
      const url         = URL.createObjectURL(blob);
      const a           = document.createElement('a');
      a.href            = url;
      a.download        = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 5000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Greška pri generiranju.');
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    if (!klub) return;
    if (!form.naziv.trim()) { setError('Naziv kluba je obavezan.'); return; }
    if (form.oib && !/^\d{11}$/.test(form.oib)) { setError('OIB mora imati točno 11 znamenki.'); return; }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateKlub(klub.id, {
        naziv:            form.naziv.trim(),
        oib:              form.oib.trim() || null,
        grad:             form.grad.trim() || null,
        kontakt_email:    form.kontakt_email.trim() || null,
        predsjednik:      form.predsjednik.trim() || null,
        datum_mandata:    form.datum_mandata || null,
        godina_osnivanja: form.godina_osnivanja ? Number(form.godina_osnivanja) : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri spremanju.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Postavke" subtitle="Upravljanje podacima kluba i konfiguracija">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Club info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">Podaci kluba</p>
              <p className="text-xs text-slate-500">Osnovne informacije o udruzi</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
            </div>
          ) : !klub ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Podaci kluba nisu pronađeni. Molimo provjerite vaš račun ili kontaktirajte podršku.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Naziv kluba *" value={form.naziv} onChange={set('naziv')} placeholder="npr. Karate klub Đurđevac" />
                </div>
                <Field label="OIB" value={form.oib} onChange={set('oib')} placeholder="11-znamenkasti broj" />
                <Field label="Grad" value={form.grad} onChange={set('grad')} placeholder="npr. Đurđevac" />
                <Field label="Kontakt e-mail" value={form.kontakt_email} onChange={set('kontakt_email')} type="email" placeholder="tajnik@klub.hr" />
                <Field label="Godina osnivanja" value={form.godina_osnivanja} onChange={set('godina_osnivanja')} type="number" placeholder="npr. 1987" />
                <Field label="Predsjednik" value={form.predsjednik} onChange={set('predsjednik')} placeholder="Ime i prezime" />
                <Field label="Istek mandata predsjednika" value={form.datum_mandata} onChange={set('datum_mandata')} type="date" hint="dd.mm.gggg." />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : saved
                  ? <Check className="w-4 h-4" />
                  : <Save className="w-4 h-4" />}
                {saving ? 'Sprema…' : saved ? 'Spremljeno!' : 'Spremi promjene'}
              </button>
            </>
          )}
        </div>

        {/* Inspector export */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <FileArchive className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">Inspekcijska arhiva</p>
              <p className="text-xs text-slate-500">ZIP s PDF-ovima, CSV-om i SHA-256 manifestom za MO Sporta, HKS i poreznu</p>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4 space-y-1.5 text-xs text-slate-400">
            {[
              '01-clanovi/  — popis-clanova.pdf + .csv',
              '02-privole/  — gdpr-status.pdf + privola-nedostaje.txt',
              '03-skupstine/ — skupstine-pregled.pdf + .txt po skupštini',
              '04-lijecnicki/ — pregledi-status.pdf',
              'MANIFEST.txt — SHA-256 otisci svih datoteka',
            ].map(line => (
              <p key={line} className="font-mono">{line}</p>
            ))}
          </div>

          {exportError && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{exportError}</span>
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={exporting || !klub}
            className="w-full flex items-center justify-center gap-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-colors"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generiranje arhive... (može potrajati ~10s)</span>
              </>
            ) : exportDone ? (
              <>
                <Check className="w-4 h-4 text-green-300" />
                <span className="text-green-300">Arhiva preuzeta!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Preuzmi inspekcijsku arhivu (.zip)</span>
              </>
            )}
          </button>
        </div>

        {/* Obavijesti — automatski email podsjetnici */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
              <Bell className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-100">Automatski email podsjetnici</p>
              <p className="text-xs text-slate-500">Dnevni cron skenira bazu i šalje emailove na kontakt adresu kluba</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-900/20 border border-green-800/40 px-2.5 py-1 rounded-full">
              <Activity className="w-3 h-3" /> AKTIVNO
            </span>
          </div>

          {/* Monitoring rules */}
          <div className="space-y-3">
            {[
              {
                label: 'Liječnički pregledi',
                desc: 'Email kad pregled istječe za točno 30 dana',
                days: '30d',
                color: 'amber',
              },
              {
                label: 'HKF trenerske licence',
                desc: 'Email kad licenca istječe za točno 90 dana',
                days: '90d',
                color: 'blue',
              },
            ].map(({ label, desc, days, color }) => (
              <div key={label} className="flex items-center gap-3 bg-slate-800/60 rounded-xl p-3.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  color === 'amber' ? 'bg-amber-900/30' : 'bg-blue-900/30'
                }`}>
                  <Bell className={`w-4 h-4 ${color === 'amber' ? 'text-amber-400' : 'text-blue-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${
                  color === 'amber'
                    ? 'bg-amber-900/30 text-amber-300'
                    : 'bg-blue-900/30 text-blue-300'
                }`}>
                  {days}
                </span>
                <span className="text-xs text-green-400 font-medium flex-shrink-0">✓ AKTIVNO</span>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="bg-slate-800/40 rounded-xl p-4 space-y-1 text-xs text-slate-500">
            <p className="font-semibold text-slate-400 mb-2">Kako radi:</p>
            <p>1. Dnevni cron poziva <span className="font-mono text-slate-400">/api/cron/obavijesti</span></p>
            <p>2. Skenira bazu za isteke u zadanom roku</p>
            <p>3. Ubacuje nove stavke u <span className="font-mono text-slate-400">obavijesti_queue</span> (dedup zaštita)</p>
            <p>4. Šalje email via Resend na <span className="font-mono text-slate-400">kontakt_email</span> kluba</p>
          </div>

          {/* Cron result */}
          {cronResult !== null && (
            <div className="flex items-start gap-2 bg-green-950/30 border border-green-800/40 rounded-xl px-4 py-3 text-sm">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300">
                Scan završen — {cronResult.newItems} novih stavki,{' '}
                {cronResult.emailsSent} emailova poslano
                {cronResult.emailsFailed > 0 && `, ${cronResult.emailsFailed} neuspješnih`}
              </p>
            </div>
          )}
          {cronError && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{cronError}</span>
            </div>
          )}

          <button
            onClick={handleCronTrigger}
            disabled={cronRunning}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${cronRunning ? 'animate-spin' : ''}`} />
            {cronRunning ? 'Skeniranje...' : 'Ručno pokreni scan'}
          </button>
        </div>

        {/* Section cards */}
        {[
          { icon: Users, title: 'Korisnici i dozvole', desc: 'Upravljanje korisničkim računima i razinama pristupa za administratore i trenere.' },
          { icon: Shield, title: 'Sigurnost i GDPR', desc: 'Postavke privatnosti, izvoz podataka i upravljanje pristancima sukladno GDPR-u.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700 transition-colors cursor-pointer group">
            <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-100">{title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>
            <Shield className="w-4 h-4 text-slate-700 group-hover:text-slate-500 transition-colors" />
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
