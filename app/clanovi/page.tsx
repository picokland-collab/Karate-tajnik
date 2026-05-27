'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import {
  UserPlus, Search, Filter, ChevronDown, X, Check,
  AlertTriangle, Shield, Phone, Mail, Calendar,
  Edit, Eye, MoreHorizontal, CheckCircle, XCircle,
  ArrowLeft, ArrowRight, User, Star, Users,
} from 'lucide-react';
import { members as allMembers, beltLabels } from '@/lib/mock-data';
import { formatDate, isExpired, isExpiringSoon, daysUntil, getAge, cn } from '@/lib/utils';
import type { Member, BeltColor, MemberStatus } from '@/lib/types';

/* ── NEW MEMBER MODAL ─────────────────────────────────────── */

type Step = 'osobni' | 'sportska' | 'medicinska';
const STEPS: { key: Step; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'osobni',     label: 'Osobni podaci',      icon: User },
  { key: 'sportska',  label: 'Sportska karta',      icon: Star },
  { key: 'medicinska', label: 'Liječnički & privole', icon: Shield },
];

function NewMemberModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('osobni');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', birthDate: '', address: '',
    belt: 'bijeli' as BeltColor, category: 'kadet', memberSince: new Date().toISOString().slice(0, 10),
    medicalExpiry: '', guardian: '', consentSigned: false,
  });

  const stepIdx = STEPS.findIndex(s => s.key === step);

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const canProceed = () => {
    if (step === 'osobni') return form.firstName && form.lastName && form.birthDate;
    if (step === 'sportska') return form.belt && form.category;
    return form.medicalExpiry;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end md:items-center md:p-4">
      <div className="bg-slate-900 border-t md:border border-slate-700 rounded-t-3xl md:rounded-3xl w-full md:max-w-lg shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-50">Novi član</h2>
            <p className="text-xs text-slate-500 mt-0.5">Ispuni u 3 jednostavna koraka</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-5">
          {STEPS.map((s, i) => {
            const done = STEPS.findIndex(x => x.key === step) > i;
            const active = s.key === step;
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all',
                    done ? 'bg-green-600 border-green-600' : active ? 'bg-red-600 border-red-600' : 'bg-slate-800 border-slate-700'
                  )}>
                    {done ? <Check className="w-4 h-4 text-white" /> : <Icon className={cn('w-4 h-4', active ? 'text-white' : 'text-slate-500')} />}
                  </div>
                  <span className={cn('text-xs font-medium whitespace-nowrap', active ? 'text-slate-100' : done ? 'text-green-400' : 'text-slate-600')}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('h-0.5 flex-1 mx-2 mb-4 rounded-full transition-colors', done ? 'bg-green-600' : 'bg-slate-800')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 'osobni' && (
            <div className="space-y-4 fade-in">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Ime *" value={form.firstName} onChange={v => set('firstName', v)} placeholder="npr. Luka" />
                <FormField label="Prezime *" value={form.lastName} onChange={v => set('lastName', v)} placeholder="npr. Perić" />
              </div>
              <FormField label="Datum rođenja *" value={form.birthDate} onChange={v => set('birthDate', v)} type="date" />
              <FormField label="E-mail" value={form.email} onChange={v => set('email', v)} type="email" placeholder="luka@email.com" />
              <FormField label="Telefon" value={form.phone} onChange={v => set('phone', v)} placeholder="+385 91 ..." />
            </div>
          )}

          {step === 'sportska' && (
            <div className="space-y-4 fade-in">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Pojas *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(beltLabels) as BeltColor[]).map(belt => {
                    const b = beltLabels[belt];
                    return (
                      <button
                        key={belt}
                        onClick={() => set('belt', belt)}
                        className={cn(
                          'text-xs py-2 px-3 rounded-xl border transition-all font-medium',
                          form.belt === belt ? `${b.bg} ${b.color} border-current` : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                        )}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Kategorija *</label>
                <div className="grid grid-cols-2 gap-2">
                  {['mali_karatist', 'kadet', 'junior', 'senior', 'veteran'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => set('category', cat)}
                      className={cn(
                        'text-sm py-2.5 px-3 rounded-xl border transition-all font-medium capitalize',
                        form.category === cat ? 'bg-red-600/20 text-red-300 border-red-600/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      )}
                    >
                      {cat.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <FormField label="Datum učlanjenja" value={form.memberSince} onChange={v => set('memberSince', v)} type="date" />
            </div>
          )}

          {step === 'medicinska' && (
            <div className="space-y-4 fade-in">
              <FormField label="Istek liječničkog pregleda *" value={form.medicalExpiry} onChange={v => set('medicalExpiry', v)} type="date" />
              <FormField label="Skrbnik (za maloljetne)" value={form.guardian} onChange={v => set('guardian', v)} placeholder="Ime i prezime roditelja" />
              <div
                onClick={() => set('consentSigned', !form.consentSigned)}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all',
                  form.consentSigned ? 'bg-green-900/20 border-green-600/30' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                  form.consentSigned ? 'bg-green-600 border-green-600' : 'border-slate-600'
                )}>
                  {form.consentSigned && <Check className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">Privola za obradu podataka</p>
                  <p className="text-xs text-slate-500 mt-0.5">Član (ili roditelj) potpisao privolu za obradu osobnih podataka sukladno GDPR-u.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900 flex-shrink-0">
          <button
            onClick={() => stepIdx > 0 && setStep(STEPS[stepIdx - 1].key)}
            disabled={stepIdx === 0}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Natrag
          </button>
          {stepIdx < STEPS.length - 1 ? (
            <button
              onClick={() => canProceed() && setStep(STEPS[stepIdx + 1].key)}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
            >
              Dalje <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => { alert('Član uspješno dodan! (demo)'); onClose(); }}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
            >
              <Check className="w-4 h-4" /> Spremi člana
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
      />
    </div>
  );
}

/* ── MEMBER STATUS BADGE ──────────────────────────────────── */
function MedicalBadge({ date }: { date: string }) {
  if (isExpired(date))
    return (
      <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 border border-red-800/40 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" /> Isteklo
      </span>
    );
  if (isExpiringSoon(date, 60))
    return (
      <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" /> {daysUntil(date)}d
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/20 border border-green-800/40 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" /> {formatDate(date)}
    </span>
  );
}

/* ── MAIN PAGE ────────────────────────────────────────────── */
type FilterStatus = 'svi' | 'aktivni' | 'neaktivni';
type FilterBelt = 'svi' | BeltColor;

function ClanoviContent() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('svi');
  const [filterBelt, setFilterBelt] = useState<FilterBelt>('svi');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'new') setShowModal(true);
  }, [searchParams]);

  const filtered = allMembers.filter(m => {
    const matchSearch = `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'svi' || m.status === (filterStatus === 'aktivni' ? 'aktivan' : 'neaktivan');
    const matchBelt = filterBelt === 'svi' || m.belt === filterBelt;
    return matchSearch && matchStatus && matchBelt;
  });

  return (
    <AppLayout
      title="Registar članova"
      subtitle={`${allMembers.filter(m => m.status === 'aktivan').length} aktivnih · ${allMembers.length} ukupno`}
      actions={
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-red-900/30"
        >
          <UserPlus className="w-4 h-4" /> Novi član
        </button>
      }
    >
      {showModal && <NewMemberModal onClose={() => setShowModal(false)} />}

      <div className="max-w-7xl mx-auto space-y-5">

        {/* Filters bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 flex-1 min-w-0 sm:min-w-[200px] sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pretraži po imenu..."
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-full"
            />
            {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-slate-500" /></button>}
          </div>

          {/* Status filter pills + belt select in one scrollable row on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {(['svi', 'aktivni', 'neaktivni'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'text-sm px-3.5 py-2 rounded-xl font-medium transition-all capitalize',
                  filterStatus === s
                    ? 'bg-red-600/20 text-red-300 border border-red-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                )}
              >
                {s}
              </button>
            ))}
            {/* Belt filter */}
            <select
              value={filterBelt}
              onChange={e => setFilterBelt(e.target.value as FilterBelt)}
              className="bg-slate-900 border border-slate-800 text-slate-400 text-sm rounded-xl px-3 py-2 outline-none focus:border-slate-600 cursor-pointer flex-shrink-0"
            >
              <option value="svi">Svi pojasevi</option>
              {(Object.keys(beltLabels) as BeltColor[]).map(b => (
                <option key={b} value={b}>{beltLabels[b].label}</option>
              ))}
            </select>

            <span className="text-xs text-slate-600 flex-shrink-0 ml-1">{filtered.length} rezultata</span>
          </div>
        </div>

        {/* Members grid (card layout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(member => {
            const belt = beltLabels[member.belt];
            const expired = isExpired(member.medicalExpiry);
            const expiringSoon = isExpiringSoon(member.medicalExpiry, 60);
            return (
              <div
                key={member.id}
                className={cn(
                  'bg-slate-900 rounded-2xl border p-5 hover:border-slate-600 transition-all cursor-pointer group',
                  expired ? 'border-red-900/60' : expiringSoon ? 'border-amber-900/60' : 'border-slate-800'
                )}
                onClick={() => setSelectedMember(member)}
              >
                {/* Top row */}
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

                {/* Belt badge */}
                <div className="mb-4">
                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', belt.bg, belt.color)}>
                    {belt.label}
                  </span>
                </div>

                {/* Info row */}
                <div className="flex items-center justify-between">
                  <MedicalBadge date={member.medicalExpiry} />
                  {!member.consentSigned && (
                    <span className="text-xs text-orange-400 bg-orange-900/20 border border-orange-800/40 px-2 py-0.5 rounded-full">
                      Privola nedostaje
                    </span>
                  )}
                </div>

                {/* Contact */}
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

        {filtered.length === 0 && (
          <div className="text-center py-20 text-slate-600">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nema pronađenih članova</p>
          </div>
        )}
      </div>

      {/* Member detail drawer */}
      {selectedMember && (
        <MemberDetailDrawer member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </AppLayout>
  );
}

function MemberDetailDrawer({ member, onClose }: { member: Member; onClose: () => void }) {
  const belt = beltLabels[member.belt];
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-slate-900 border-l border-slate-800 h-full overflow-y-auto shadow-2xl fade-in">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-slate-100">Profil člana</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar + name */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-200 mx-auto mb-3">
              {member.firstName[0]}{member.lastName[0]}
            </div>
            <p className="text-xl font-bold text-slate-50">{member.firstName} {member.lastName}</p>
            <p className="text-sm text-slate-400 mt-0.5">{member.category.replace('_', ' ')} · član od {formatDate(member.memberSince)}</p>
            <span className={cn('inline-block mt-2 text-xs px-3 py-1 rounded-full font-semibold', belt.bg, belt.color)}>
              {belt.label}
            </span>
          </div>

          {/* Details */}
          {[
            { icon: Calendar, label: 'Datum rođenja', value: `${formatDate(member.birthDate)} (${getAge(member.birthDate)} god.)` },
            { icon: Mail, label: 'E-mail', value: member.email || '—' },
            { icon: Phone, label: 'Telefon', value: member.phone || '—' },
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

          {/* Medical */}
          <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Liječnički pregled</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Istek</span>
              <MedicalBadge date={member.medicalExpiry} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Privola</span>
              {member.consentSigned
                ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Potpisano</span>
                : <span className="text-xs text-orange-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Nedostaje</span>
              }
            </div>
            {member.guardian && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Skrbnik</span>
                <span className="text-sm text-slate-200 font-medium">{member.guardian}</span>
              </div>
            )}
          </div>

          <button className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold py-3 rounded-xl transition-colors">
            <Edit className="w-4 h-4" /> Uredi podatke
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClanoviPage() {
  return (
    <Suspense fallback={null}>
      <ClanoviContent />
    </Suspense>
  );
}
