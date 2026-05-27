'use client';

import AppLayout from '@/components/layout/AppLayout';
import { FileText, Download, Eye, Clock, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const docs = [
  {
    id: 'd1', title: 'Zapisnik s redovne skupštine — 10.12.2024.', type: 'Zapisnik',
    status: 'usvojeno' as const, date: '10.12.2024.', author: 'Maja Horvat',
  },
  {
    id: 'd2', title: 'Odluka o planu aktivnosti 2025.', type: 'Odluka',
    status: 'usvojeno' as const, date: '10.12.2024.', author: 'Ante Marković',
  },
  {
    id: 'd3', title: 'Zapisnik s izvanredne skupštine — nacrt', type: 'Zapisnik',
    status: 'nacrt' as const, date: '22.05.2025.', author: 'Maja Horvat',
  },
  {
    id: 'd4', title: 'Godišnji financijski izvještaj 2024.', type: 'Izvještaj',
    status: 'na_odobrenju' as const, date: '15.01.2025.', author: 'Maja Horvat',
  },
];

const statusMap = {
  usvojeno:     { label: 'Usvojeno',      color: 'text-green-400',  bg: 'bg-green-900/20 border-green-800/40', icon: CheckCircle },
  na_odobrenju: { label: 'Na odobrenju',  color: 'text-amber-400',  bg: 'bg-amber-900/20 border-amber-800/40', icon: Clock },
  nacrt:        { label: 'Nacrt',         color: 'text-slate-400',  bg: 'bg-slate-800 border-slate-700',       icon: FileText },
};

export default function DokumentiPage() {
  return (
    <AppLayout
      title="Dokumenti"
      subtitle="Arhiva svih službenih dokumenata kluba"
      actions={
        <button className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Novi dokument
        </button>
      }
    >
      <div className="max-w-4xl mx-auto space-y-3">
        {docs.map(doc => {
          const s = statusMap[doc.status];
          const StatusIcon = s.icon;
          return (
            <div key={doc.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:border-slate-700 transition-colors group cursor-pointer">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-100 truncate flex-1 min-w-0">{doc.title}</p>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 flex-shrink-0', s.color, s.bg)}>
                    <StatusIcon className="w-3 h-3" /> {s.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{doc.type} · {doc.date} · {doc.author}</p>
              </div>
              <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700">
                  <Eye className="w-4 h-4 text-slate-400" />
                </button>
                <button className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700">
                  <Download className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
