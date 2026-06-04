'use client';

import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  FileText, Download, Eye, Clock, CheckCircle, AlertCircle,
  Plus, X, FileDown, Printer, Trash2, ChevronDown,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import {
  fetchDokumenti, insertDokument, updateDokumentStatus, deleteDokument,
  VRSTA_LABEL, STATUS_LABEL,
  type Dokument, type VrstaDokumenta, type StatusDokumenta,
} from '@/lib/queries/dokumenti';
import { downloadAsWord } from '@/lib/export/word';
import { printAsPdf } from '@/lib/export/pdf';

/* ─── Status config ─────────────────────────────────────── */
const statusConfig: Record<StatusDokumenta, { color: string; bg: string; icon: React.FC<{ className?: string }> }> = {
  usvojeno:     { color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/40', icon: CheckCircle },
  na_odobrenju: { color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-800/40', icon: Clock },
  nacrt:        { color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700',       icon: FileText },
};

const STATUS_ORDER: StatusDokumenta[] = ['nacrt', 'na_odobrenju', 'usvojeno'];

/* ─── View Modal ────────────────────────────────────────── */
function DokumentModal({
  doc, onClose, onStatusChange, onDelete,
}: {
  doc: Dokument;
  onClose: () => void;
  onStatusChange: (id: string, status: StatusDokumenta) => void;
  onDelete: (id: string) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const handleWord = async () => {
    if (!doc.sadrzaj) return;
    setExporting(true);
    try { await downloadAsWord(doc.naziv, doc.sadrzaj); }
    finally { setExporting(false); }
  };

  const handlePdf = () => {
    if (!doc.sadrzaj) return;
    printAsPdf(doc.naziv, doc.sadrzaj);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-100 leading-snug">{doc.naziv}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {VRSTA_LABEL[doc.vrsta]} · {formatDate(doc.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center flex-shrink-0 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {doc.sadrzaj ? (
            <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
              {doc.sadrzaj}
            </pre>
          ) : (
            <p className="text-sm text-slate-600 text-center py-8">Nema sadržaja za ovaj dokument.</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 border-t border-slate-800 flex items-center gap-2 flex-wrap flex-shrink-0"
             style={{ paddingTop: '1rem', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          {/* Status toggle */}
          <div className="relative">
            <button
              onClick={() => setStatusOpen(o => !o)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
                statusConfig[doc.status].color, statusConfig[doc.status].bg
              )}
            >
              {STATUS_LABEL[doc.status]} <ChevronDown className="w-3 h-3" />
            </button>
            {statusOpen && (
              <div className="absolute bottom-full mb-1 left-0 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-10 min-w-[140px]">
                {STATUS_ORDER.map(s => (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(doc.id, s); setStatusOpen(false); }}
                    className={cn(
                      'w-full text-left text-xs px-3 py-2 hover:bg-slate-700 transition-colors',
                      s === doc.status ? 'text-slate-100 font-semibold' : 'text-slate-400'
                    )}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <button
            onClick={() => { if (confirm('Obrisati ovaj dokument?')) { onDelete(doc.id); onClose(); } }}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Obriši
          </button>

          <button
            onClick={handlePdf}
            disabled={!doc.sadrzaj}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> PDF
          </button>

          <button
            onClick={handleWord}
            disabled={!doc.sadrzaj || exporting}
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <FileDown className="w-3.5 h-3.5" /> {exporting ? 'Generira...' : 'Word'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── New Document Modal ────────────────────────────────── */
function NoviDokumentModal({
  onClose, onSaved,
  initialNaziv = '', initialSadrzaj = '',
}: {
  onClose: () => void;
  onSaved: () => void;
  initialNaziv?: string;
  initialSadrzaj?: string;
}) {
  const [naziv, setNaziv] = useState(initialNaziv);
  const [vrsta, setVrsta] = useState<VrstaDokumenta>('ostalo');
  const [sadrzaj, setSadrzaj] = useState(initialSadrzaj);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!naziv.trim()) { setError('Naziv je obavezan.'); return; }
    setSaving(true);
    setError('');
    try {
      await insertDokument({ naziv: naziv.trim(), vrsta, sadrzaj });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri spremanju.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-800">
          <p className="text-sm font-bold text-slate-100">Novi dokument</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Naziv dokumenta *</label>
            <input
              type="text"
              value={naziv}
              onChange={e => setNaziv(e.target.value)}
              placeholder="npr. Zapisnik s redovne skupštine — lipanj 2026."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Vrsta dokumenta</label>
            <select
              value={vrsta}
              onChange={e => setVrsta(e.target.value as VrstaDokumenta)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors"
            >
              {(Object.entries(VRSTA_LABEL) as [VrstaDokumenta, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Sadržaj</label>
            <textarea
              value={sadrzaj}
              onChange={e => setSadrzaj(e.target.value)}
              rows={8}
              placeholder="Unesite tekst dokumenta ili ga zalijepite iz AI Tajnika..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors resize-none leading-relaxed"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="px-5 border-t border-slate-800 flex justify-end gap-2 flex-shrink-0"
             style={{ paddingTop: '1rem', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200 px-4 py-2 rounded-xl transition-colors">
            Odustani
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {saving ? 'Sprema...' : 'Spremi dokument'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────── */
export default function DokumentiPage() {
  const [dokumenti, setDokumenti] = useState<Dokument[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Dokument | null>(null);
  const [showNew, setShowNew]     = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchDokumenti().then(setDokumenti).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, status: StatusDokumenta) => {
    await updateDokumentStatus(id, status);
    setDokumenti(prev => prev.map(d => d.id === id ? { ...d, status } : d));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const handleDelete = async (id: string) => {
    await deleteDokument(id);
    setDokumenti(prev => prev.filter(d => d.id !== id));
  };

  const handleWordQuick = async (e: React.MouseEvent, doc: Dokument) => {
    e.stopPropagation();
    if (!doc.sadrzaj) return;
    setExporting(doc.id);
    try { await downloadAsWord(doc.naziv, doc.sadrzaj); }
    finally { setExporting(null); }
  };

  const handlePdfQuick = (e: React.MouseEvent, doc: Dokument) => {
    e.stopPropagation();
    if (!doc.sadrzaj) return;
    printAsPdf(doc.naziv, doc.sadrzaj);
  };

  return (
    <AppLayout
      title="Dokumenti"
      subtitle="Arhiva svih službenih dokumenata kluba"
      actions={
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Novi dokument
        </button>
      }
    >
      <div className="max-w-4xl mx-auto space-y-2">
        {loading ? (
          <div className="text-center py-12 text-sm text-slate-600">Učitavam dokumente...</div>
        ) : dokumenti.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <FileText className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="text-sm text-slate-500">Još nema dokumenata u arhivi.</p>
            <p className="text-xs text-slate-600">Generirajte dokument u AI Tajniku i spremite ga ovdje.</p>
          </div>
        ) : (
          dokumenti.map(doc => {
            const s = statusConfig[doc.status];
            const StatusIcon = s.icon;
            return (
              <div
                key={doc.id}
                onClick={() => setSelected(doc)}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:border-slate-700 transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-100 truncate flex-1 min-w-0">{doc.naziv}</p>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 flex-shrink-0',
                      s.color, s.bg
                    )}>
                      <StatusIcon className="w-3 h-3" /> {STATUS_LABEL[doc.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {VRSTA_LABEL[doc.vrsta]} · {formatDate(doc.created_at)}
                  </p>
                </div>

                <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); setSelected(doc); }}
                    title="Pregledaj"
                    className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-slate-400" />
                  </button>
                  <button
                    onClick={e => handlePdfQuick(e, doc)}
                    title="Ispis / PDF"
                    disabled={!doc.sadrzaj}
                    className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-slate-400" />
                  </button>
                  <button
                    onClick={e => handleWordQuick(e, doc)}
                    title="Preuzmi Word"
                    disabled={!doc.sadrzaj || exporting === doc.id}
                    className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <DokumentModal
          doc={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      )}

      {showNew && (
        <NoviDokumentModal
          onClose={() => setShowNew(false)}
          onSaved={() => { load(); setShowNew(false); }}
        />
      )}
    </AppLayout>
  );
}
