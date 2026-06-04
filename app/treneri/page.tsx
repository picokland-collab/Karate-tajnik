'use client';

import { useState, useEffect, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  GraduationCap, Plus, X, Save, Edit, Trash2,
  AlertTriangle, CheckCircle, Clock, Phone, Mail,
  FileText, Copy, Check, Search, UserCheck,
} from 'lucide-react';
import {
  fetchTreneri, insertTrener, updateTrener, deleteTrener,
  ULOGA_OPTIONS, LICENCA_OPTIONS, ULOGA_LABEL, LICENCA_LABEL,
} from '@/lib/queries/treneri';
import { fetchKlubInfo } from '@/lib/queries/dashboard';
import type { Trener, TrenerInput, TrenerStatus } from '@/lib/queries/treneri';
import { formatDate, isExpired, isExpiringSoon, daysUntil, cn } from '@/lib/utils';
import { useRole } from '@/lib/hooks/useRole';
import DateInput from '@/components/ui/DateInput';

// ── HELPERS ───────────────────────────────────────────────────

function LicencaBadge({ date }: { date?: string }) {
  if (!date)
    return <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">Bez licence</span>;
  if (isExpired(date))
    return <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 border border-red-800/40 px-2.5 py-1 rounded-full"><X className="w-3 h-3" /> Istekla {formatDate(date)}</span>;
  if (isExpiringSoon(date, 90))
    return <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 px-2.5 py-1 rounded-full"><Clock className="w-3 h-3" /> {daysUntil(date)}d do isteka</span>;
  return <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/20 border border-green-800/40 px-2.5 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> Do {formatDate(date)}</span>;
}

function FormField({ label, value, onChange, type = 'text', placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">{label}</label>
      {type === 'date' ? (
        <DateInput value={value} onChange={onChange}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors" />
      )}
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: readonly { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition-colors cursor-pointer">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── RENEWAL GENERATOR ─────────────────────────────────────────

function generateZahtjev(t: Trener, klubNaziv: string, predsjednikIme: string): string {
  const danas = formatDate(new Date().toISOString());
  const licLabel = t.licenca ? (LICENCA_LABEL[t.licenca] ?? t.licenca) : '[vrsta licence]';
  const ulogaLabel = t.uloga ? (ULOGA_LABEL[t.uloga] ?? t.uloga) : '[uloga]';

  return `${klubNaziv.toUpperCase()}
${danas}

Hrvatska karate federacija (HKF)
Trg Krešimira Ćosića 11
10 000 Zagreb

PREDMET: Zahtjev za obnovu HKF trenerske licence

Poštovani,

${klubNaziv} ovim putem podnosi zahtjev za obnovu trenerske licence sukladno
Pravilniku o trenerima Hrvatske karate federacije za sljedećeg trenera:

  Ime i prezime:  ${t.ime} ${t.prezime}
  Uloga u klubu:  ${ulogaLabel}
  Vrsta licence:  ${licLabel}
  Broj licence:   ${t.brLic || '[broj licence]'}
  Istek licence:  ${t.licVrijedi ? formatDate(t.licVrijedi) : '[datum isteka]'}
  Kontakt:        ${t.mob || t.email || '[kontakt]'}

Navedeni trener aktivno radi s natjecateljima ${klubNaziv} te je nastavak
njegova/njezina rada ključan za normalno odvijanje trenažnog procesa.

Uz zahtjev prilažemo:
  □ Dokaz o uplati pristojbe za obnovu licence
  □ Potvrda o pohađanju obveznog edukacijskog seminara HKF-a
  □ Fotografija (1 kom., ne starija od 6 mjeseci)
  □ Preslika osobne iskaznice

Molimo pravovremenu obradu zahtjeva.

S poštovanjem,

${predsjednikIme || 'Predsjednik/ca kluba'}
${klubNaziv}

Datum: ${danas}`;
}

// ── TRENER MODAL (dodaj/uredi) ────────────────────────────────

const EMPTY_FORM: TrenerInput = {
  ime: '', prezime: '', oib: '', datRod: '', uloga: 'glavni_trener',
  licenca: 'C_licenca', brLic: '', licVrijedi: '', mob: '', email: '',
  datZap: '', status: 'aktivan',
};

function TrenerModal({
  trener, onClose, onSaved,
}: {
  trener?: Trener;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!trener;
  const [form, setForm] = useState<TrenerInput>(
    trener ? {
      ime: trener.ime, prezime: trener.prezime,
      oib: trener.oib ?? '', datRod: trener.datRod ?? '',
      uloga: trener.uloga ?? 'glavni_trener',
      licenca: trener.licenca ?? 'C_licenca',
      brLic: trener.brLic ?? '', licVrijedi: trener.licVrijedi ?? '',
      mob: trener.mob ?? '', email: trener.email ?? '',
      datZap: trener.datZap ?? '', status: trener.status,
    } : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof TrenerInput) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.ime.trim() || !form.prezime.trim()) {
      setError('Ime i prezime su obavezni.');
      return;
    }
    setSaving(true); setError('');
    try {
      if (editing) await updateTrener(trener!.id, form);
      else await insertTrener(form);
      onSaved(); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri spremanju.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-end md:items-center md:justify-center md:p-6">
      <div className="bg-slate-900 border-t md:border border-slate-700 rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl shadow-2xl max-h-[92dvh] md:max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 pt-6 pb-4 md:px-8 md:pt-8 md:pb-6 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-50">{editing ? 'Uredi trenera' : 'Novi trener'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{editing ? `${trener!.ime} ${trener!.prezime}` : 'Unesi podatke i licencu'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 md:py-7 min-h-0">
          <div className="space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ime *" value={form.ime} onChange={set('ime')} placeholder="Ivan" />
              <FormField label="Prezime *" value={form.prezime} onChange={set('prezime')} placeholder="Horvat" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="E-mail" value={form.email} onChange={set('email')} type="email" placeholder="ivan@klub.hr" />
              <FormField label="Mobitel" value={form.mob} onChange={set('mob')} placeholder="+385 91 ..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Datum rođenja" value={form.datRod} onChange={set('datRod')} type="date" />
              <FormField label="Datum zaposlenja" value={form.datZap} onChange={set('datZap')} type="date" />
            </div>

            <SelectField label="Uloga" value={form.uloga} onChange={set('uloga')} options={ULOGA_OPTIONS} />

            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">HKF Licenca</p>
              <div className="space-y-3">
                <SelectField label="Vrsta licence" value={form.licenca} onChange={set('licenca')} options={LICENCA_OPTIONS} placeholder="— bez licence —" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Broj licence" value={form.brLic} onChange={set('brLic')} placeholder="npr. HKF-2024-1234" />
                  <FormField label="Licenca vrijedi do" value={form.licVrijedi} onChange={set('licVrijedi')} type="date" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {(['aktivan', 'neaktivan'] as TrenerStatus[]).map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={cn('py-2.5 rounded-xl border text-sm font-medium transition-all capitalize',
                    form.status === s ? 'bg-red-600/20 text-red-300 border-red-600/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700')}>
                  {s === 'aktivan' ? 'Aktivan' : 'Neaktivan'}
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2">{error}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 md:px-8 md:py-5 border-t border-slate-800 bg-slate-900 flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl transition-colors">
            Odustani
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all">
            {saving ? <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Sprema...' : editing ? 'Spremi promjene' : 'Dodaj trenera'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RENEWAL MODAL ─────────────────────────────────────────────

function ZahtjevModal({ trener, klubNaziv, predsjednikIme, onClose }: {
  trener: Trener; klubNaziv: string; predsjednikIme: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = generateZahtjev(trener, klubNaziv, predsjednikIme);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-end md:items-center md:justify-center md:p-6">
      <div className="bg-slate-900 border-t md:border border-slate-700 rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl shadow-2xl max-h-[92dvh] md:max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 pt-6 pb-4 md:px-8 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-50">Zahtjev za obnovu licence</h2>
            <p className="text-xs text-slate-500 mt-0.5">{trener.ime} {trener.prezime} — gotov za slanje HKF-u</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 md:py-6 min-h-0">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            {text}
          </pre>
        </div>

        <div className="flex gap-3 px-6 py-4 md:px-8 md:py-5 border-t border-slate-800 bg-slate-900 flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl transition-colors">
            Zatvori
          </button>
          <button onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
            {copied ? <><Check className="w-4 h-4 text-green-300" /> <span className="text-green-300">Kopirano!</span></> : <><Copy className="w-4 h-4" /> Kopiraj zahtjev</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TRENER CARD ───────────────────────────────────────────────

function TrenerCard({ t, onEdit, onDelete, onZahtjev, canEdit = false }: {
  t: Trener;
  onEdit: () => void;
  onDelete: () => void;
  onZahtjev: () => void;
  canEdit?: boolean;
}) {
  const expired     = isExpired(t.licVrijedi ?? '');
  const expiringSoon = isExpiringSoon(t.licVrijedi ?? '', 90);

  return (
    <div className={cn(
      'bg-slate-900 rounded-2xl border p-5 flex flex-col gap-4 transition-colors',
      expired ? 'border-red-900/60' : expiringSoon ? 'border-amber-900/60' : 'border-slate-800 hover:border-slate-700'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">
            {t.ime[0]}{t.prezime[0]}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">{t.ime} {t.prezime}</p>
            <p className="text-xs text-slate-500">{t.uloga ? (ULOGA_LABEL[t.uloga] ?? t.uloga) : 'Trener'}</p>
          </div>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0',
          t.status === 'aktivan' ? 'text-green-400 bg-green-900/20 border border-green-800/40' : 'text-slate-500 bg-slate-800 border border-slate-700'
        )}>
          {t.status === 'aktivan' ? 'Aktivan' : 'Neaktivan'}
        </span>
      </div>

      {/* Licenca */}
      <div className="bg-slate-800/60 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">HKF licenca</p>
            <p className="text-sm font-semibold text-slate-200">
              {t.licenca ? (LICENCA_LABEL[t.licenca] ?? t.licenca) : '—'}
            </p>
            {t.brLic && <p className="text-xs text-slate-600 font-mono mt-0.5">{t.brLic}</p>}
          </div>
          <LicencaBadge date={t.licVrijedi} />
        </div>
      </div>

      {/* Kontakt */}
      {(t.mob || t.email) && (
        <div className="flex flex-col gap-1">
          {t.mob  && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Phone className="w-3 h-3" /> {t.mob}</span>}
          {t.email && <span className="flex items-center gap-1.5 text-xs text-slate-500 truncate"><Mail className="w-3 h-3" /> {t.email}</span>}
        </div>
      )}

      {/* Actions — Zahtjev HKF visible to all; Edit + Delete admin only */}
      <div className="flex gap-2 pt-1 border-t border-slate-800">
        <button onClick={onZahtjev}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs text-violet-400 bg-violet-900/20 border border-violet-800/40 hover:bg-violet-900/30 px-3 py-2 rounded-xl transition-colors font-medium">
          <FileText className="w-3.5 h-3.5" /> Zahtjev HKF
        </button>
        {canEdit && (
          <>
            <button onClick={onEdit}
              className="flex items-center justify-center gap-1.5 text-xs text-slate-400 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-2 rounded-xl transition-colors">
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete}
              className="flex items-center justify-center gap-1.5 text-xs text-red-400 bg-red-900/20 border border-red-800/40 hover:bg-red-900/30 px-3 py-2 rounded-xl transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────

function TrenerContent() {
  // ── ROLE GATE ─────────────────────────────────────────────────
  const { isAdmin, roleLoaded } = useRole();
  const canEdit = isAdmin;

  // ── DATA STATE ────────────────────────────────────────────────
  const [treneri, setTreneri]           = useState<Trener[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editingTrener, setEditingTrener] = useState<Trener | undefined>(undefined);
  const [zahtjevTrener, setZahtjevTrener] = useState<Trener | undefined>(undefined);
  const [klubNaziv, setKlubNaziv]       = useState('');
  const [predsjednikIme, setPredsjednikIme] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    fetchTreneri()
      .then(setTreneri)
      .catch(e => console.error('fetchTreneri:', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    fetchKlubInfo().then(info => {
      if (info) { setKlubNaziv(info.naziv); setPredsjednikIme(info.predsjednik ?? ''); }
    });
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteTrener(id);
      setTreneri(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error('deleteTrener:', e);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const aktivni   = treneri.filter(t => t.status === 'aktivan');
  const istekle   = aktivni.filter(t => isExpired(t.licVrijedi ?? ''));
  const uskoro    = aktivni.filter(t => !isExpired(t.licVrijedi ?? '') && isExpiringSoon(t.licVrijedi ?? '', 90));
  const valjane   = aktivni.filter(t => t.licVrijedi && !isExpired(t.licVrijedi) && !isExpiringSoon(t.licVrijedi, 90));

  const filtered = treneri.filter(t =>
    `${t.ime} ${t.prezime} ${t.uloga ?? ''} ${t.licenca ?? ''}`.toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <AppLayout
      title="Treneri i licence"
      subtitle={loading ? 'Učitavanje...' : `${aktivni.length} aktivnih · ${treneri.length} ukupno`}
      actions={
        roleLoaded && canEdit ? (
          <button
            onClick={() => { setEditingTrener(undefined); setShowModal(true); }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-red-900/30"
          >
            <Plus className="w-4 h-4" /> Novi trener
          </button>
        ) : undefined
      }
    >
      {showModal && (
        <TrenerModal
          trener={editingTrener}
          onClose={() => setShowModal(false)}
          onSaved={reload}
        />
      )}

      {zahtjevTrener && (
        <ZahtjevModal
          trener={zahtjevTrener}
          klubNaziv={klubNaziv}
          predsjednikIme={predsjednikIme}
          onClose={() => setZahtjevTrener(undefined)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-sm font-bold text-slate-100 mb-2">Obriši trenera?</p>
            <p className="text-xs text-slate-400 mb-5">Ova radnja se ne može poništiti.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl transition-colors">
                Odustani
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 text-sm text-white bg-red-600 hover:bg-red-500 font-semibold px-4 py-2.5 rounded-xl transition-colors">
                Obriši
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-5">

        {/* Alerts */}
        {(istekle.length > 0 || uskoro.length > 0) && (
          <div className="space-y-2">
            {istekle.length > 0 && (
              <div className="flex items-start gap-3 bg-red-950/40 border border-red-800/40 rounded-2xl px-4 py-3.5">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-300">
                    {istekle.length === 1 ? '1 trener ima isteklu HKS licencu' : `${istekle.length} trenera imaju istekle HKS licence`}
                  </p>
                  <p className="text-xs text-red-400/70 mt-0.5">
                    {istekle.map(t => `${t.ime} ${t.prezime}`).join(', ')}
                  </p>
                </div>
              </div>
            )}
            {uskoro.length > 0 && (
              <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-800/40 rounded-2xl px-4 py-3.5">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-300">
                    {uskoro.length === 1 ? '1 trener ima licencu koja uskoro istječe (90d)' : `${uskoro.length} trenera imaju licencu koja uskoro istječe (90d)`}
                  </p>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    {uskoro.map(t => `${t.ime} ${t.prezime} (${daysUntil(t.licVrijedi!)}d)`).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: treneri.length,   label: 'Ukupno trenera',     color: 'text-slate-200' },
            { value: valjane.length,   label: 'Valjana licenca',     color: 'text-green-400' },
            { value: uskoro.length,    label: 'Uskoro istječe (90d)', color: 'text-amber-400' },
            { value: istekle.length,   label: 'Istekla licenca',     color: 'text-red-400' },
          ].map(({ value, label, color }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 max-w-xs">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pretraži trenere..."
            className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-full" />
          {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-slate-500" /></button>}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-red-500 rounded-full animate-spin mr-3" />
            Učitavanje trenera...
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(t => (
              <TrenerCard
                key={t.id}
                t={t}
                onEdit={() => { setEditingTrener(t); setShowModal(true); }}
                onDelete={() => setDeleteConfirm(t.id)}
                onZahtjev={() => setZahtjevTrener(t)}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && !search && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-400 mb-1">Nema unesenih trenera</p>
            <p className="text-xs text-slate-600 mb-5">Dodaj trenera i prati istek HKF licence</p>
            {canEdit && (
              <button
                onClick={() => { setEditingTrener(undefined); setShowModal(true); }}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" /> Dodaj prvog trenera
              </button>
            )}
          </div>
        )}

        {!loading && filtered.length === 0 && search && (
          <div className="text-center py-16 text-slate-600 text-sm">
            Nema trenera koji odgovaraju pretrazi.
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function TrenerPage() {
  return (
    <Suspense fallback={null}>
      <TrenerContent />
    </Suspense>
  );
}
