'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Sparkles, Send, User, ChevronDown, RefreshCw,
  FileText, Calendar, Trophy, Zap, Copy, Check, Save, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAITajnik, type Message } from './AITajnikProvider';
import { insertDokument, VRSTA_LABEL, type VrstaDokumenta } from '@/lib/queries/dokumenti';

// Routes where the floating widget is suppressed (full-page experience handles it)
const HIDE_ON = new Set(['/', '/login', '/onboarding', '/ai-tajnik']);

const QUICK_ACTIONS = [
  { icon: FileText, text: 'Napiši pozivnicu za redovnu skupštinu' },
  { icon: Calendar, text: 'Obavijest o promjeni rasporeda treninga' },
  { icon: Trophy,   text: 'Facebook objava za zlatnu medalju' },
  { icon: Zap,      text: 'Molba za sufinanciranje 2026.' },
];

/* ── Spremi modal ────────────────────────────────────────────── */
export function SpremiModal({
  sadrzaj, onClose, onSaved,
}: {
  sadrzaj: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [naziv, setNaziv] = useState('');
  const [vrsta, setVrsta] = useState<VrstaDokumenta>('ostalo');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-800">
          <p className="text-sm font-bold text-slate-100">Spremi u arhivu</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
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
              autoFocus
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
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 px-4 py-2 rounded-xl transition-colors"
          >
            Odustani
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Sprema...' : 'Spremi'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Message bubble (shared, used here + full page) ─────────── */
export function MessageBubble({
  msg, isLast, onSpremi, compact = false,
}: {
  msg: Message;
  isLast: boolean;
  onSpremi?: (content: string) => void;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const avatarSize  = compact ? 'w-7 h-7 rounded-lg'   : 'w-8 h-8 rounded-xl';
  const iconSize    = compact ? 'w-3.5 h-3.5'           : 'w-4 h-4';
  const bubbleText  = compact ? 'text-xs leading-relaxed' : 'text-sm leading-7';

  return (
    <div className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : '')}>
      <div className={cn(
        avatarSize,
        'flex items-center justify-center flex-shrink-0 mt-0.5',
        msg.role === 'assistant'
          ? 'bg-violet-600/20 border border-violet-600/30'
          : 'bg-red-600/20 border border-red-600/30',
      )}>
        {msg.role === 'assistant'
          ? <Sparkles className={cn(iconSize, 'text-violet-400')} />
          : <User    className={cn(iconSize, 'text-red-400')}    />}
      </div>

      <div className={cn(
        'max-w-[85%] rounded-2xl px-3.5 py-3',
        bubbleText,
        msg.role === 'assistant'
          ? 'bg-slate-800 border border-slate-700 text-slate-100 shadow-sm'
          : 'bg-red-600 text-white shadow-md shadow-red-900/30',
      )}>
        <p className="whitespace-pre-wrap">{msg.content}</p>

        {msg.role === 'assistant' && msg.content && (
          <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-700/60">
            <button
              onClick={copy}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              title="Kopiraj"
            >
              {copied
                ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Kopirano</span></>
                : <><Copy  className="w-3 h-3" /> Kopiraj</>}
            </button>

            {isLast && onSpremi && (
              <>
                <span className="text-slate-700 select-none">·</span>
                <button
                  onClick={() => onSpremi(msg.content)}
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                  title="Spremi u arhivu"
                >
                  <Save className="w-3 h-3" /> Spremi u arhivu
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Global floating widget ──────────────────────────────────── */
export default function GlobalAITajnikWidget() {
  const pathname = usePathname();
  const {
    messages, input, setInput, isTyping, send, reset,
    spremiContent, setSpremiContent, savedToast, setSavedToast,
    isOpen, setIsOpen,
  } = useAITajnik();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => textareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Suppress widget on routes that have their own full-page experience
  if (HIDE_ON.has(pathname)) return null;

  const hasConversation = messages.length > 1;

  return (
    <>
      {/* ── FAB (minimised) ─────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Zatvori AI Tajnik' : 'Otvori AI Tajnik'}
        className={cn(
          // Position: above BottomNav on mobile, standard corner on desktop
          'fixed z-50 transition-all duration-200',
          'bottom-[5.5rem] right-4 md:bottom-6 md:right-6',
          // Shape & colour
          'w-14 h-14 rounded-full',
          'bg-violet-600 hover:bg-violet-500 text-white',
          'shadow-xl shadow-violet-900/40',
          'flex items-center justify-center',
          'hover:scale-105 active:scale-95',
          // Hide FAB when panel is open (panel has its own close button)
          isOpen && 'opacity-0 pointer-events-none scale-90',
        )}
      >
        <Sparkles className="w-6 h-6" />
        {/* Unread indicator */}
        {hasConversation && !isOpen && (
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-slate-950 animate-pulse" />
        )}
      </button>

      {/* ── Chat panel ──────────────────────────────────────── */}
      <div
        className={cn(
          'fixed z-50 flex flex-col',
          'transition-all duration-300 ease-out',
          // Mobile: full-width sheet above BottomNav
          'left-2 right-2 bottom-[4.5rem] rounded-2xl',
          // Desktop: corner panel
          'md:left-auto md:right-6 md:bottom-6 md:w-[400px]',
          // Height
          'h-[70dvh] md:h-[580px]',
          // Appearance
          'bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden',
          // Open/closed
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 flex-shrink-0 bg-slate-900">
          <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-100 leading-none">AI Tajnik</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isTyping ? 'Piše...' : 'Spreman za pomoć'}
            </p>
          </div>
          <button
            onClick={reset}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            title="Novi razgovor"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            title="Minimiziraj"
          >
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scroll-smooth">
          {/* Quick actions — only on fresh session */}
          {messages.length === 1 && (
            <div className="grid grid-cols-1 gap-1.5 pb-1">
              {QUICK_ACTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s.text)}
                  disabled={isTyping}
                  className="flex items-center gap-2.5 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-left hover:border-violet-700/50 hover:bg-slate-800/80 transition-all group disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                    <s.icon className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <span className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors leading-snug">{s.text}</span>
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="fade-in">
              <MessageBubble
                msg={msg}
                isLast={i === messages.length - 1}
                onSpremi={msg.role === 'assistant' ? c => setSpremiContent(c) : undefined}
                compact
              />
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5 fade-in">
              <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-600/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl px-3.5 py-2.5 flex items-center gap-1">
                {[0, 1, 2].map(j => (
                  <span
                    key={j}
                    className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                    style={{ animationDelay: `${j * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-3 pb-3 pt-2 border-t border-slate-800">
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 pt-2.5 flex items-end gap-2 focus-within:border-violet-500 transition-colors"
            style={{ paddingBottom: '0.625rem' }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Opišite što trebate..."
              className="flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 outline-none resize-none max-h-28 min-h-[1.75rem] leading-relaxed"
              rows={1}
            />
            <button
              onClick={() => void send()}
              disabled={!input.trim() || isTyping}
              className="w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 flex items-center justify-center flex-shrink-0 transition-all"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 fade-in">
          <Check className="w-4 h-4" /> Dokument je spremljen u arhivu!
        </div>
      )}

      {/* Spremi modal */}
      {spremiContent && (
        <SpremiModal
          sadrzaj={spremiContent}
          onClose={() => setSpremiContent(null)}
          onSaved={() => {
            setSpremiContent(null);
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 3000);
          }}
        />
      )}
    </>
  );
}
