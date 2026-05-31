'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Building2, MapPin, Mail, ArrowRight, CheckCircle, Hash } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [naziv, setNaziv]               = useState('');
  const [oib, setOib]                   = useState('');
  const [grad, setGrad]                 = useState('');
  const [kontaktEmail, setKontaktEmail] = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [done, setDone]                 = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naziv.trim() || naziv.trim().length < 3) {
      setError('Naziv kluba mora imati najmanje 3 znaka.');
      return;
    }
    if (oib && !/^\d{11}$/.test(oib)) {
      setError('OIB mora sadržavati točno 11 znamenki.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/registracija', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naziv,
          oib: oib || undefined,
          grad: grad || undefined,
          kontakt_email: kontaktEmail || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Došlo je do greške. Pokušajte ponovo.');
        return;
      }

      setDone(true);
      setTimeout(() => { window.location.href = '/dashboard'; }, 1800);
    } catch {
      setError('Greška pri spajanju s poslužiteljem.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4 fade-in">
          <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-lg font-bold text-slate-100">Klub je uspješno kreiran!</p>
          <p className="text-sm text-slate-500">Preusmjeravamo vas na nadzornu ploču…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">

        {/* Logo / naslov */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Dobrodošli u Digitalni Tajnik</h1>
          <p className="text-sm text-slate-400">
            Kreirajte profil svog kluba kako biste mogli koristiti sve funkcionalnosti.
          </p>
        </div>

        {/* Paket info */}
        <div className="bg-slate-900 border border-violet-600/30 rounded-2xl p-4 text-center">
          <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Besplatni paket</span>
          <p className="text-sm text-slate-300 mt-1">
            Upravljanje članovima · Skupštine · Natjecanja · AI Tajnik
          </p>
          <p className="text-xs text-slate-600 mt-1">Nadogradnja na Standard ili Premium dostupna u Postavkama</p>
        </div>

        {/* Forma */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-100">Podaci o klubu</h2>

          {/* Naziv */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Naziv kluba *
            </label>
            <input
              type="text"
              value={naziv}
              onChange={e => setNaziv(e.target.value)}
              placeholder="npr. Karate klub Rijeka"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* OIB */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" /> OIB kluba
            </label>
            <input
              type="text"
              value={oib}
              onChange={e => setOib(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="11-znamenkasti broj"
              maxLength={11}
              inputMode="numeric"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Grad */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Grad
            </label>
            <input
              type="text"
              value={grad}
              onChange={e => setGrad(e.target.value)}
              placeholder="npr. Rijeka"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Kontakt e-mail */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Kontakt e-mail kluba
            </label>
            <input
              type="email"
              value={kontaktEmail}
              onChange={e => setKontaktEmail(e.target.value)}
              placeholder="tajnik@klub.hr"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !naziv.trim()}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm px-4 py-3 rounded-xl transition-colors mt-2"
          >
            {loading ? 'Kreiranje kluba…' : (
              <><span>Kreiraj klub i nastavi</span><ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600">
          Podaci se mogu urediti u Postavkama · Digitalni Tajnik © 2026
        </p>
      </div>
    </div>
  );
}
