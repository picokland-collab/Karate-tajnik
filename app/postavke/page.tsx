'use client';

import AppLayout from '@/components/layout/AppLayout';
import { Building2, Mail, Phone, Globe, Save, Shield, Bell, Users, Palette } from 'lucide-react';
import { club } from '@/lib/mock-data';
import { formatDate } from '@/lib/utils';

export default function PostavkePage() {
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

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Naziv kluba', value: club.name },
              { label: 'OIB', value: club.oib },
              { label: 'Adresa', value: `${club.address}, ${club.city}` },
              { label: 'Godina osnivanja', value: club.founded.toString() },
              { label: 'Predsjednik', value: club.presidentName },
              { label: 'Istek mandata', value: formatDate(club.presidentMandateExpiry) },
              { label: 'Tajnica', value: club.secretaryName },
              { label: 'E-mail', value: club.email },
            ].map(({ label, value }) => (
              <div key={label}>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">{label}</label>
                <input defaultValue={value}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-red-500 transition-colors" />
              </div>
            ))}
          </div>

          <button className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Save className="w-4 h-4" /> Spremi promjene
          </button>
        </div>

        {/* Section cards */}
        {[
          { icon: Bell, title: 'Obavijesti', desc: 'Konfiguracija automatskih podsjetnika za istekle liječničke preglede, mandate i slično.' },
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
