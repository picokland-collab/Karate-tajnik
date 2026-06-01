'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import {
  UserPlus, Search, X, Check, Copy,
  AlertTriangle, Shield, Phone, Mail, Calendar,
  Edit, Trash2, Loader2, ArrowLeft, ArrowRight, User, Star, Users,
  CheckCircle, XCircle, Save, MapPin, Vote, RefreshCw, FileDown,
} from 'lucide-react';
import { beltLabels } from '@/lib/mock-data';
import { fetchClanovi, insertClan, updateClan, deleteClan } from '@/lib/queries/clanovi';
import type { ClanMedInput } from '@/lib/queries/clanovi';
import { useRole } from '@/lib/hooks/useRole';
import { runAutoRecategorization } from '@/lib/queries/rekategorizacija';
import type { RecategorizationChange } from '@/lib/queries/rekategorizacija';
import { HKS_CAT_LABEL } from '@/lib/utils/hksAge';
import { downloadHksZahtjev } from '@/lib/utils/hksPdfService';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { formatDate, isExpired, isExpiringSoon, daysUntil, getAge, cn } from '@/lib/utils';
import type { Member, BeltColor, MemberStatus, TipClanstva } from '@/lib/types';

/* ── helpers ─────────────────────────────────────────────── */
function FormField({
  label, value, onChange, type = 'text', placeholder, required, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
      />
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

function MedicalBadge({ date }: { date: string }) {
  if (!date)
    return <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">Bez pregleda</span>;
  if (isExpired(date))
    return <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 border border-red-800/40 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Isteklo</span>;
  if (isExpiringSoon(date, 60))
    return <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> {daysUntil(date)}d</span>;
  return <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/20 border border-green-800/40 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> {formatDate(date)}</span>;
}

/* ── NEW MEMBER MODAL ─────────────────────────────────────── */
type Step = 'osobni' | 'sportska' | 'medicinska';
const STEPS: { key: Step; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'osobni',     label: 'Osobni podaci',       icon: User },
  { key: 'sportska',   label: 'Sportska karta',       icon: Star },
  { key: 'medicinska', label: 'Liječnički & privole', icon: Shield },
];

function NewMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<Step>('osobni');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', birthDate: '',
    adresa: '',
    tipClanstva: 'redovni' as TipClanstva,
    belt: 'bijeli' as BeltColor,
    category: 'kadet' as Member['category'],
    memberSince: new Date().toISOString().slice(0, 10),
    medicalExpiry: '', guardian: '', consentSigned: false,
    // HKS polja
    oib: '', spol: '' as 'M' | 'Ž' | '', mjestRodjenja: '', drzavaRodjenja: 'Hrvatska',
  });

  const stepIdx = STEPS.findIndex(s => s.key === step);
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const canProceed = () => {
    if (step === 'osobni')   return !!(form.firstName && form.lastName && form.birthDate);
    if (step === 'sportska') return !!(form.belt && form.category);
    return true; // medical is optional
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const input: ClanMedInput = {
        ime:           form.firstName,
        prezime:       form.lastName,
        dat_rod:       form.birthDate || undefined,
        email:         form.email || undefined,
        mobitel:       form.phone || undefined,
        adresa:        form.adresa || undefined,
        tip_clanstva:  form.tipClanstva,
        pojas:         form.belt,
        kategorija:    form.category,
        dat_uclan:     form.memberSince || undefined,
        roditelji:     form.guardian || undefined,
        gdpr:          form.consentSigned,
        status:        'aktivan',
        medicalExpiry:  form.medicalExpiry || undefined,
        oib:            form.oib || undefined,
        spol:           (form.spol === 'M' || form.spol === 'Ž') ? form.spol : undefined,
        mjestRodjenja:  form.mjestRodjenja || undefined,
        drzavaRodjenja: form.drzavaRodjenja || undefined,
      };
      await insertClan(input);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri spremanju.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-end md:items-center md:justify-center md:p-6">
      <div className="bg-slate-900 border-t md:border border-slate-700 rounded-t-3xl md:rounded-3xl w-full md:max-w-3xl shadow-2xl max-h-[92dvh] md:max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 md:px-8 md:pt-8 md:pb-6 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-50">Novi član</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">Ispuni u 3 jednostavna koraka</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-6 pt-5 md:px-8 md:pt-7 flex-shrink-0">
          {STEPS.map((s, i) => {
            const done = stepIdx > i;
            const active = s.key === step;
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className={cn(
                    'w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center border-2 transition-all',
                    done ? 'bg-green-600 border-green-600' : active ? 'bg-red-600 border-red-600' : 'bg-slate-800 border-slate-700',
                  )}>
                    {done
                      ? <Check className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      : <Icon className={cn('w-4 h-4 md:w-5 md:h-5', active ? 'text-white' : 'text-slate-500')} />}
                  </div>
                  <span className={cn(
                    'text-xs md:text-sm font-medium whitespace-nowrap',
                    active ? 'text-slate-100' : done ? 'text-green-400' : 'text-slate-600',
                  )}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    'h-0.5 flex-1 mx-2 md:mx-4 mb-4 md:mb-5 rounded-full transition-colors',
                    done ? 'bg-green-600' : 'bg-slate-800',
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 md:py-7 min-h-0">

          {step === 'osobni' && (
            <div className="space-y-4 md:space-y-5 fade-in">
              {/* Name — 2 cols always */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <FormField label="Ime *" value={form.firstName} onChange={v => set('firstName', v)} placeholder="npr. Luka" />
                <FormField label="Prezime *" value={form.lastName} onChange={v => set('lastName', v)} placeholder="npr. Perić" />
              </div>
              {/* Birth date + E-mail — stacked mobile, side-by-side desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <FormField label="Datum rođenja *" value={form.birthDate} onChange={v => set('birthDate', v)} type="date" hint="dd.mm.gggg." />
                <FormField label="E-mail" value={form.email} onChange={v => set('email', v)} type="email" placeholder="luka@email.com" />
              </div>
              <FormField label="Telefon" value={form.phone} onChange={v => set('phone', v)} placeholder="+385 91 ..." />
              <FormField label="Adresa stanovanja" value={form.adresa} onChange={v => set('adresa', v)} placeholder="Ulica i broj, grad" />

              {/* HKS polja */}
              <div className="border-t border-slate-800/60 pt-4 space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
                  Podaci za HKS registraciju
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="OIB" value={form.oib} onChange={v => set('oib', v)} placeholder="11-znamenkasti broj" />
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Spol</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['M', 'Ž'] as const).map(s => (
                        <button key={s} type="button" onClick={() => set('spol', s)}
                          className={cn('py-2.5 rounded-xl border text-sm font-semibold transition-all',
                            form.spol === s ? 'bg-red-600/20 text-red-300 border-red-600/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700')}>
                          {s === 'M' ? 'Muško' : 'Žensko'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Mjesto rođenja" value={form.mjestRodjenja} onChange={v => set('mjestRodjenja', v)} placeholder="npr. Đurđevac" />
                  <FormField label="Država rođenja" value={form.drzavaRodjenja} onChange={v => set('drzavaRodjenja', v)} placeholder="npr. Hrvatska" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 md:mb-3">Tip članstva</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['redovni', 'podupiruci', 'pocasni'] as TipClanstva[]).map(tip => (
                    <button key={tip} type="button" onClick={() => set('tipClanstva', tip)}
                      className={cn('text-sm py-2.5 px-3 rounded-xl border transition-all font-medium capitalize',
                        form.tipClanstva === tip ? 'bg-red-600/20 text-red-300 border-red-600/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700')}>
                      {tip === 'podupiruci' ? 'Podupirući' : tip === 'pocasni' ? 'Počasni' : 'Redovni'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'sportska' && (
            <div className="space-y-5 fade-in">
              {/* Belt picker — 3 cols mobile, 3 cols desktop (wider buttons) */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 md:mb-3">Pojas *</label>
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {(Object.keys(beltLabels) as BeltColor[]).map(belt => {
                    const b = beltLabels[belt];
                    return (
                      <button key={belt} type="button" onClick={() => set('belt', belt)}
                        className={cn(
                          'text-xs py-2 md:py-3 px-3 rounded-xl border transition-all font-medium',
                          form.belt === belt ? `${b.bg} ${b.color} border-current` : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700',
                        )}>
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Category + member-since — stacked mobile, side-by-side desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 md:mb-3">Kategorija *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['mali_karatist', 'kadet', 'junior', 'senior', 'veteran'] as Member['category'][]).map(cat => (
                      <button key={cat} type="button" onClick={() => set('category', cat)}
                        className={cn(
                          'text-sm py-2.5 px-3 rounded-xl border transition-all font-medium capitalize',
                          form.category === cat ? 'bg-red-600/20 text-red-300 border-red-600/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700',
                        )}>
                        {cat.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <FormField label="Datum učlanjenja" value={form.memberSince} onChange={v => set('memberSince', v)} type="date" hint="dd.mm.gggg." />
                </div>
              </div>
            </div>
          )}

          {step === 'medicinska' && (
            <div className="space-y-4 md:space-y-5 fade-in">
              {/* Medical expiry + guardian — stacked mobile, side-by-side desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <FormField label="Istek liječničkog pregleda" value={form.medicalExpiry} onChange={v => set('medicalExpiry', v)} type="date" hint="dd.mm.gggg." />
                <FormField label="Skrbnik (za maloljetne)" value={form.guardian} onChange={v => set('guardian', v)} placeholder="Ime i prezime roditelja" />
              </div>
              <div onClick={() => set('consentSigned', !form.consentSigned)}
                className={cn(
                  'flex items-start gap-3 p-4 md:p-5 rounded-xl border cursor-pointer transition-all',
                  form.consentSigned ? 'bg-green-900/20 border-green-600/30' : 'bg-slate-800 border-slate-700 hover:border-slate-600',
                )}>
                <div className={cn(
                  'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                  form.consentSigned ? 'bg-green-600 border-green-600' : 'border-slate-600',
                )}>
                  {form.consentSigned && <Check className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <p className="text-sm md:text-base font-semibold text-slate-200">Privola za obradu podataka</p>
                  <p className="text-xs md:text-sm text-slate-500 mt-0.5">Član ili roditelj potpisao privolu sukladno GDPR-u.</p>
                </div>
              </div>
              {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 md:px-8 md:py-5 border-t border-slate-800 bg-slate-900 flex-shrink-0">
          <button
            onClick={() => stepIdx > 0 && setStep(STEPS[stepIdx - 1].key)}
            disabled={stepIdx === 0}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ArrowLeft className="w-4 h-4" /> Natrag
          </button>
          {stepIdx < STEPS.length - 1 ? (
            <button
              onClick={() => canProceed() && setStep(STEPS[stepIdx + 1].key)}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-5 py-2.5 md:px-7 md:py-3 rounded-xl transition-all">
              Dalje <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-5 py-2.5 md:px-7 md:py-3 rounded-xl transition-all">
              {saving
                ? <div className="w-4 h-4 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
                : <Check className="w-4 h-4" />}
              {saving ? 'Sprema...' : 'Spremi člana'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── EDIT MEMBER MODAL ────────────────────────────────────── */
function EditMemberModal({
  member, onClose, onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: (updated: Member) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName:     member.firstName,
    lastName:      member.lastName,
    email:         member.email,
    phone:         member.phone,
    birthDate:     member.birthDate,
    adresa:        member.adresa ?? '',
    tipClanstva:   (member.tipClanstva ?? 'redovni') as TipClanstva,
    belt:          member.belt,
    category:      member.category,
    memberSince:   member.memberSince,
    medicalExpiry: member.medicalExpiry,
    guardian:      member.guardian ?? '',
    consentSigned: member.consentSigned,
    status:        member.status,
    // HKS polja
    oib:           member.oib            ?? '',
    spol:          member.spol           ?? '' as 'M' | 'Ž' | '',
    mjestRodjenja: member.mjestRodjenja  ?? '',
    drzavaRodjenja: member.drzavaRodjenja ?? '',
  });

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Ime i prezime su obavezni.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateClan(member.id, {
        ime:            form.firstName,
        prezime:        form.lastName,
        dat_rod:        form.birthDate || undefined,
        email:          form.email || undefined,
        mobitel:        form.phone || undefined,
        adresa:         form.adresa || undefined,
        tip_clanstva:   form.tipClanstva,
        pojas:          form.belt,
        kategorija:     form.category,
        dat_uclan:      form.memberSince || undefined,
        roditelji:       form.guardian || undefined,
        gdpr:           form.consentSigned,
        status:         form.status,
        medicalExpiry:  form.medicalExpiry || undefined,
        oib:            form.oib || undefined,
        spol:           (form.spol === 'M' || form.spol === 'Ž') ? form.spol : undefined,
        mjestRodjenja:  form.mjestRodjenja || undefined,
        drzavaRodjenja: form.drzavaRodjenja || undefined,
      });
      onSaved({
        ...member,
        firstName:      form.firstName,
        lastName:       form.lastName,
        email:          form.email,
        phone:          form.phone,
        birthDate:      form.birthDate,
        adresa:         form.adresa || undefined,
        tipClanstva:    form.tipClanstva,
        belt:           form.belt,
        category:       form.category,
        memberSince:    form.memberSince,
        medicalExpiry:  form.medicalExpiry,
        guardian:       form.guardian || undefined,
        consentSigned:  form.consentSigned,
        status:         form.status,
        oib:            form.oib || undefined,
        spol:           (form.spol === 'M' || form.spol === 'Ž') ? form.spol : undefined,
        mjestRodjenja:  form.mjestRodjenja || undefined,
        drzavaRodjenja: form.drzavaRodjenja || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri ažuriranju.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-end md:items-center md:justify-center md:p-6">
      <div className="bg-slate-900 border-t md:border border-slate-700 rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl shadow-2xl max-h-[92dvh] md:max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 md:px-8 md:pt-8 md:pb-6 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-50">Uredi člana</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">{member.firstName} {member.lastName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Form body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 md:py-7 min-h-0">
          <div className="space-y-4 md:space-y-5">

            {/* Ime + Prezime */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <FormField label="Ime *" value={form.firstName} onChange={v => set('firstName', v)} />
              <FormField label="Prezime *" value={form.lastName} onChange={v => set('lastName', v)} />
            </div>

            {/* Datum rođenja + E-mail */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <FormField label="Datum rođenja" value={form.birthDate} onChange={v => set('birthDate', v)} type="date" hint="dd.mm.gggg." />
              <FormField label="E-mail" value={form.email} onChange={v => set('email', v)} type="email" />
            </div>

            {/* Telefon + Datum učlanjenja */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <FormField label="Telefon" value={form.phone} onChange={v => set('phone', v)} />
              <FormField label="Datum učlanjenja" value={form.memberSince} onChange={v => set('memberSince', v)} type="date" hint="dd.mm.gggg." />
            </div>

            {/* Istek liječničkog + Skrbnik */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <FormField label="Istek liječničkog pregleda" value={form.medicalExpiry} onChange={v => set('medicalExpiry', v)} type="date" hint="dd.mm.gggg." />
              <FormField label="Skrbnik (za maloljetne)" value={form.guardian} onChange={v => set('guardian', v)} />
            </div>

            {/* Adresa stanovanja */}
            <FormField label="Adresa stanovanja" value={form.adresa} onChange={v => set('adresa', v)} placeholder="Ulica i broj, grad" />

            {/* HKS polja */}
            <div className="border-t border-slate-800/60 pt-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
                Podaci za HKS registraciju
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="OIB" value={form.oib} onChange={v => set('oib', v)} placeholder="11-znamenkasti broj" />
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Spol</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['M', 'Ž'] as const).map(s => (
                      <button key={s} type="button" onClick={() => set('spol', s)}
                        className={cn('py-2.5 rounded-xl border text-sm font-semibold transition-all',
                          form.spol === s ? 'bg-red-600/20 text-red-300 border-red-600/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700')}>
                        {s === 'M' ? 'Muško' : 'Žensko'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Mjesto rođenja" value={form.mjestRodjenja} onChange={v => set('mjestRodjenja', v)} placeholder="npr. Đurđevac" />
                <FormField label="Država rođenja" value={form.drzavaRodjenja} onChange={v => set('drzavaRodjenja', v)} placeholder="npr. Hrvatska" />
              </div>
            </div>

            {/* Tip članstva */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 md:mb-3">Tip članstva</label>
              <div className="grid grid-cols-3 gap-2">
                {(['redovni', 'podupiruci', 'pocasni'] as TipClanstva[]).map(tip => (
                  <button key={tip} type="button" onClick={() => set('tipClanstva', tip)}
                    className={cn('text-sm py-2.5 px-3 rounded-xl border transition-all font-medium',
                      form.tipClanstva === tip ? 'bg-red-600/20 text-red-300 border-red-600/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700')}>
                    {tip === 'podupiruci' ? 'Podupirući' : tip === 'pocasni' ? 'Počasni' : 'Redovni'}
                  </button>
                ))}
              </div>
            </div>

            {/* Belt picker */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 md:mb-3">Pojas</label>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {(Object.keys(beltLabels) as BeltColor[]).map(belt => {
                  const b = beltLabels[belt];
                  return (
                    <button key={belt} type="button" onClick={() => set('belt', belt)}
                      className={cn('text-xs py-2 md:py-3 px-3 rounded-xl border transition-all font-medium',
                        form.belt === belt ? `${b.bg} ${b.color} border-current` : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700')}>
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category + Status — side-by-side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 md:mb-3">Kategorija</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['mali_karatist', 'kadet', 'junior', 'senior', 'veteran'] as Member['category'][]).map(cat => (
                    <button key={cat} type="button" onClick={() => set('category', cat)}
                      className={cn('text-sm py-2.5 px-3 rounded-xl border transition-all font-medium capitalize',
                        form.category === cat ? 'bg-red-600/20 text-red-300 border-red-600/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700')}>
                      {cat.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 md:mb-3">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['aktivan', 'neaktivan', 'suspendiran'] as MemberStatus[]).map(s => (
                    <button key={s} type="button" onClick={() => set('status', s)}
                      className={cn('text-sm py-2.5 px-3 rounded-xl border transition-all font-medium capitalize',
                        form.status === s ? 'bg-red-600/20 text-red-300 border-red-600/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700')}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Consent */}
            <div onClick={() => set('consentSigned', !form.consentSigned)}
              className={cn('flex items-start gap-3 p-4 md:p-5 rounded-xl border cursor-pointer transition-all',
                form.consentSigned ? 'bg-green-900/20 border-green-600/30' : 'bg-slate-800 border-slate-700 hover:border-slate-600')}>
              <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                form.consentSigned ? 'bg-green-600 border-green-600' : 'border-slate-600')}>
                {form.consentSigned && <Check className="w-3 h-3 text-white" />}
              </div>
              <div>
                <p className="text-sm md:text-base font-semibold text-slate-200">Privola za obradu podataka</p>
                <p className="text-xs md:text-sm text-slate-500 mt-0.5">Potpisana GDPR privola</p>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-2">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 pt-4 pb-4 md:px-8 md:pt-5 border-t border-slate-800 bg-slate-900 flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl transition-colors">
            Odustani
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-5 py-2.5 md:px-7 md:py-3 rounded-xl transition-all">
            {saving
              ? <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
              : <Save className="w-4 h-4" />}
            {saving ? 'Sprema...' : 'Spremi promjene'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── MEMBER DETAIL DRAWER ─────────────────────────────────── */
function MemberDetailDrawer({
  member, onClose, onEdit, onDelete, canEdit = false,
}: {
  member: Member;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit?: boolean;
}) {
  const belt = beltLabels[member.belt];
  const hasVotingRights = getAge(member.birthDate) >= 18 && member.tipClanstva === 'redovni';

  // ── HKS copy ─────────────────────────────────────────────────
  const [hksCopied, setHksCopied] = useState(false);

  // ── HKS zahtjev PDF ──────────────────────────────────────────
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError]     = useState('');

  const handleGenerirajZahtjev = async () => {
    setPdfLoading(true);
    setPdfError('');
    try {
      await downloadHksZahtjev(createSupabaseBrowserClient(), member);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'Greška pri generiranju PDF-a.');
      setTimeout(() => setPdfError(''), 6000);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCopyHKS = async () => {
    // ISO "YYYY-MM-DD" → "DD.MM.YYYY" (HKS format)
    const fmtDate = (iso: string) => {
      const p = iso.split('-');
      return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
    };
    const payload = {
      ime:     member.firstName,
      prezime: member.lastName,
      oib:     member.oib     ?? '',
      spol:    member.spol    ?? '',
      rodjen:  fmtDate(member.birthDate),
      mjesto:  member.mjestRodjenja  ?? '',
      drzava:  member.drzavaRodjenja ?? 'Hrvatska',
    };
    // UTF-8 safe Base64
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    await navigator.clipboard.writeText(b64);
    setHksCopied(true);
    setTimeout(() => setHksCopied(false), 3000);
  };
  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-40 flex items-end md:items-center md:justify-center md:p-6">
      <div className="bg-slate-900 border-t md:border border-slate-700 rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl shadow-2xl max-h-[92dvh] md:max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 md:px-8 md:pt-7 md:pb-5 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-lg md:text-xl font-bold text-slate-50">Profil člana</h2>
          <button onClick={onClose} className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 md:py-7 min-h-0">

          {/* Avatar hero */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl md:text-3xl font-bold text-slate-200 mx-auto mb-3">
              {member.firstName[0]}{member.lastName[0]}
            </div>
            <p className="text-xl md:text-2xl font-bold text-slate-50">{member.firstName} {member.lastName}</p>
            <p className="text-sm text-slate-400 mt-0.5">{member.category.replace('_', ' ')} · član od {formatDate(member.memberSince)}</p>
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <span className={cn('text-xs px-3 py-1 rounded-full font-semibold', belt.bg, belt.color)}>
                {belt.label}
              </span>
              {member.tipClanstva && (
                <span className="text-xs px-3 py-1 rounded-full font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {member.tipClanstva === 'podupiruci' ? 'Podupirući' : member.tipClanstva === 'pocasni' ? 'Počasni' : 'Redovni'} član
                </span>
              )}
            </div>
          </div>

          {/* Details — stacked mobile, 2-col desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

            {/* Left: contact */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kontakt</p>
              {[
                { icon: Calendar, label: 'Datum rođenja', value: `${formatDate(member.birthDate)} (${getAge(member.birthDate)} god.)` },
                { icon: Mail,     label: 'E-mail',        value: member.email || '—' },
                { icon: Phone,    label: 'Telefon',       value: member.phone || '—' },
                ...(member.adresa ? [{ icon: MapPin, label: 'Adresa', value: member.adresa }] : []),
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-sm text-slate-200 font-medium">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: medical */}
            <div className="bg-slate-800 rounded-2xl p-4 space-y-3 self-start">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Liječnički pregled</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Istek</span>
                <MedicalBadge date={member.medicalExpiry} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Privola</span>
                {member.consentSigned
                  ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Potpisano</span>
                  : <span className="text-xs text-orange-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Nedostaje</span>}
              </div>
              {member.guardian && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Skrbnik</span>
                  <span className="text-sm text-slate-200 font-medium">{member.guardian}</span>
                </div>
              )}
            </div>
          </div>

          {/* Voting rights badge */}
          <div className={cn(
            'mt-5 flex items-center gap-3 px-4 py-3 rounded-2xl border',
            hasVotingRights
              ? 'bg-blue-900/20 border-blue-700/40'
              : 'bg-slate-800/60 border-slate-700',
          )}>
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
              hasVotingRights ? 'bg-blue-700/30' : 'bg-slate-700')}>
              <Vote className={cn('w-4 h-4', hasVotingRights ? 'text-blue-400' : 'text-slate-500')} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pravo glasa na Skupštini</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasVotingRights
                  ? 'Ima pravo glasa (punoljetni redovni član)'
                  : getAge(member.birthDate) < 18
                    ? 'Nema pravo glasa (maloljetan)'
                    : 'Nema pravo glasa (nije redovni član)'}
              </p>
            </div>
            {hasVotingRights
              ? <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
              : <XCircle className="w-5 h-5 text-slate-600 flex-shrink-0" />}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 pt-3 pb-6 md:px-8 border-t border-slate-800 bg-slate-900 flex-shrink-0 space-y-2"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* HKS copy — visible to all roles */}
          <button
            onClick={handleCopyHKS}
            className={cn(
              'w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl border transition-all',
              hksCopied
                ? 'bg-green-900/30 border-green-700/40 text-green-300'
                : 'bg-violet-900/20 hover:bg-violet-900/35 border-violet-700/40 text-violet-300'
            )}
          >
            {hksCopied
              ? <><Check className="w-4 h-4" /> Kopirano! Otvori HKS i aktiviraj bookmarklet.</>
              : <><Copy className="w-4 h-4" /> Kopiraj za HKS</>
            }
          </button>

          {/* HKS zahtjev PDF */}
          <button
            onClick={handleGenerirajZahtjev}
            disabled={pdfLoading}
            className={cn(
              'w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl border transition-all',
              pdfError
                ? 'bg-red-900/20 border-red-700/40 text-red-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {pdfLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generiranje...</>
              : pdfError
                ? <><AlertTriangle className="w-4 h-4" /> {pdfError}</>
                : <><FileDown className="w-4 h-4" /> Generiraj HKS zahtjev</>
            }
          </button>

          {/* Admin: edit + delete  |  Others: close */}
          {canEdit ? (
            <div className="flex gap-2">
              <button
                onClick={onDelete}
                title="Obriši člana"
                className="flex items-center justify-center gap-1.5 text-xs text-red-400 bg-red-900/20 border border-red-800/40 hover:bg-red-900/30 px-4 py-3 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                <Edit className="w-4 h-4" /> Uredi podatke
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              Zatvori
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── MAIN PAGE ────────────────────────────────────────────── */
type FilterStatus = 'svi' | 'aktivni' | 'neaktivni';
type FilterBelt = 'svi' | BeltColor;

function ClanoviContent() {
  // ── ROLE GATE ─────────────────────────────────────────────────
  // admin + trener can add members; only admin can edit existing ones
  const { isAdmin, canAdd, roleLoaded } = useRole();
  const canEdit = isAdmin;

  // ── DATA STATE ────────────────────────────────────────────────
  const [showModal, setShowModal]           = useState(false);
  const [editingMember, setEditingMember]   = useState<Member | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [search, setSearch]                 = useState('');
  const [filterStatus, setFilterStatus]     = useState<FilterStatus>('svi');
  const [filterBelt, setFilterBelt]         = useState<FilterBelt>('svi');
  const [allMembers, setAllMembers]         = useState<Member[]>([]);
  const [loading, setLoading]               = useState(true);
  const [syncing, setSyncing]               = useState(false);
  const [syncResult, setSyncResult]         = useState<RecategorizationChange[] | null>(null);
  const [syncError, setSyncError]           = useState('');
  const [deleteConfirm, setDeleteConfirm]   = useState<Member | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const reload = () => {
    setLoading(true);
    fetchClanovi()
      .then(data => setAllMembers(data))
      .catch(err => console.error('Greška pri učitavanju članova:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowModal(true);
      router.replace('/clanovi', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => { reload(); }, []);

  const filtered = allMembers.filter(m => {
    const matchSearch = `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'svi' || m.status === (filterStatus === 'aktivni' ? 'aktivan' : 'neaktivan');
    const matchBelt = filterBelt === 'svi' || m.belt === filterBelt;
    return matchSearch && matchStatus && matchBelt;
  });

  const handleEditSaved = (updated: Member) => {
    setAllMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
    setSelectedMember(updated);
    setEditingMember(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteClan(deleteConfirm.id);
      setAllMembers(prev => prev.filter(m => m.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e) {
      console.error('deleteClan:', e);
    } finally {
      setDeleting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError('');
    try {
      const changes = await runAutoRecategorization();
      setSyncResult(changes);
      if (changes.length > 0) reload();
      setTimeout(() => setSyncResult(null), 10000);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Greška pri sinkronizaciji.');
      setTimeout(() => setSyncError(''), 6000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AppLayout
      title="Registar članova"
      subtitle={loading ? 'Učitavanje...' : `${allMembers.filter(m => m.status === 'aktivan').length} aktivnih · ${allMembers.length} ukupno`}
      actions={
        roleLoaded && canAdd ? (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-red-900/30"
          >
            <UserPlus className="w-4 h-4" /> Novi član
          </button>
        ) : undefined
      }
    >
      {showModal && canAdd && (
        <NewMemberModal
          onClose={() => setShowModal(false)}
          onSaved={() => { reload(); setShowModal(false); }}
        />
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={handleEditSaved}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-100">Obriši člana?</p>
                <p className="text-sm text-slate-300 mt-0.5">
                  {deleteConfirm.firstName} {deleteConfirm.lastName}
                </p>
                <p className="text-xs text-slate-500 mt-1.5">
                  Ova radnja je trajna i ne može se poništiti. Obrisat će se i svi liječnički pregledi i natjecateljski rezultati tog člana.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-4 py-2.5 rounded-xl transition-colors"
              >
                Odustani
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 text-sm text-white bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {deleting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Briše se...</>
                  : <><Trash2 className="w-4 h-4" /> Obriši</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-5">
        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 flex-1 min-w-0 sm:min-w-[200px] sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pretraži po imenu..."
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-full" />
            {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-slate-500" /></button>}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto min-w-0 w-full">
            {(['svi', 'aktivni', 'neaktivni'] as FilterStatus[]).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn('text-sm px-3.5 py-2 rounded-xl font-medium transition-all capitalize flex-shrink-0',
                  filterStatus === s ? 'bg-red-600/20 text-red-300 border border-red-600/30' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700')}>
                {s}
              </button>
            ))}
            <select value={filterBelt} onChange={e => setFilterBelt(e.target.value as FilterBelt)}
              className="bg-slate-900 border border-slate-800 text-slate-400 text-sm rounded-xl px-3 py-2 outline-none focus:border-slate-600 cursor-pointer flex-shrink-0">
              <option value="svi">Svi pojasevi</option>
              {(Object.keys(beltLabels) as BeltColor[]).map(b => (
                <option key={b} value={b}>{beltLabels[b].label}</option>
              ))}
            </select>
            <span className="text-xs text-slate-600 flex-shrink-0 ml-1">{filtered.length} rezultata</span>

            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 hover:border-slate-600 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all font-medium flex-shrink-0 ml-auto"
              title="Automatski ažurira HKF kategorije prema datumu rođenja"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
              {syncing ? 'Sinkronizacija...' : 'Sinkroniziraj HKF'}
            </button>
          </div>
        </div>

        {/* Sync result banner */}
        {syncResult !== null && (
          <div className={cn(
            'flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm',
            syncResult.length === 0
              ? 'bg-green-950/30 border border-green-800/40'
              : 'bg-blue-950/30 border border-blue-800/40'
          )}>
            <CheckCircle className={cn('w-4 h-4 flex-shrink-0 mt-0.5', syncResult.length === 0 ? 'text-green-400' : 'text-blue-400')} />
            <div className="flex-1 min-w-0">
              {syncResult.length === 0 ? (
                <p className="font-semibold text-green-300">Sve HKF kategorije su ažurne — nema promjena.</p>
              ) : (
                <>
                  <p className="font-semibold text-blue-300 mb-1">
                    {syncResult.length} {syncResult.length === 1 ? 'član rekategoriziran' : syncResult.length < 5 ? 'člana rekategorizirana' : 'članova rekategorizirano'}
                  </p>
                  <ul className="space-y-0.5">
                    {syncResult.map(ch => (
                      <li key={ch.id} className="text-xs text-slate-400">
                        <span className="font-medium text-slate-300">{ch.ime} {ch.prezime}</span>
                        {' '}—{' '}
                        <span className="text-slate-500">{HKS_CAT_LABEL[ch.staraKat]}</span>
                        {' → '}
                        <span className="text-blue-300 font-medium">{HKS_CAT_LABEL[ch.novaKat]}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <button onClick={() => setSyncResult(null)} className="flex-shrink-0 text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {syncError && (
          <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/40 rounded-2xl px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {syncError}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-red-500 rounded-full animate-spin mr-3" />
            Učitavanje članova...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(member => {
            const belt = beltLabels[member.belt];
            const expired = isExpired(member.medicalExpiry);
            const expiringSoon = isExpiringSoon(member.medicalExpiry, 60);
            return (
              <div key={member.id} onClick={() => setSelectedMember(member)}
                className={cn('bg-slate-900 rounded-2xl border p-5 hover:border-slate-600 transition-all cursor-pointer group',
                  expired ? 'border-red-900/60' : expiringSoon ? 'border-amber-900/60' : 'border-slate-800')}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                      {member.firstName[0]}{member.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-100">{member.firstName} {member.lastName}</p>
                      <p className="text-xs text-slate-500">{getAge(member.birthDate)} god. · {member.category.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className={cn('flex items-center', member.status === 'aktivan' ? 'text-green-400' : 'text-slate-500')}>
                    <span className={cn('w-2 h-2 rounded-full mr-1.5', member.status === 'aktivan' ? 'bg-green-500' : 'bg-slate-600')} />
                    <span className="text-xs font-medium capitalize">{member.status}</span>
                  </div>
                </div>
                <div className="mb-4">
                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', belt.bg, belt.color)}>{belt.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <MedicalBadge date={member.medicalExpiry} />
                  {!member.consentSigned && (
                    <span className="text-xs text-orange-400 bg-orange-900/20 border border-orange-800/40 px-2 py-0.5 rounded-full">Privola nedostaje</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-800">
                  {member.email && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{member.email}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-slate-600">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nema pronađenih članova</p>
          </div>
        )}
      </div>

      {selectedMember && !editingMember && (
        <MemberDetailDrawer
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onEdit={() => setEditingMember(selectedMember)}
          onDelete={() => {
            setDeleteConfirm(selectedMember);
            setSelectedMember(null);
          }}
          canEdit={canEdit}
        />
      )}
    </AppLayout>
  );
}

export default function ClanoviPage() {
  return (
    <Suspense fallback={null}>
      <ClanoviContent />
    </Suspense>
  );
}
