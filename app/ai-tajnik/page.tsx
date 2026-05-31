'use client';

import { useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Sparkles, Send, User, FileText, Calendar, Trophy, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAITajnik } from '@/components/ai/AITajnikProvider';
import { MessageBubble, SpremiModal } from '@/components/ai/GlobalAITajnikWidget';

const suggestions = [
  { icon: FileText,  text: 'Napiši pozivnicu za redovnu skupštinu za 15. lipnja u 18:00h u dvorani' },
  { icon: Calendar,  text: 'Sastavi obavijest o promjeni rasporeda treninga od sljedećeg ponedjeljka' },
  { icon: Trophy,    text: 'Napiši Facebook objavu za osvajanje zlatne medalje na državnom natjecanju' },
  { icon: Zap,       text: 'Generiraj molbu za sufinanciranje programa rada kluba za 2026. godinu' },
];

export default function AITajnikPage() {
  const {
    messages, input, setInput, isTyping, send, reset,
    spremiContent, setSpremiContent, savedToast, setSavedToast,
  } = useAITajnik();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSpremiSaved = () => {
    setSpremiContent(null);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <AppLayout
      title="AI Tajnik"
      subtitle="Vaš inteligentni asistent za sve administrativne zadatke"
      actions={
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Novi razgovor
        </button>
      }
    >
      {/* On mobile: 3.5rem header + 1rem p-4 top + 5rem mobile-pb + 2rem safe-area slack = ~12rem consumed.
          On desktop: 4rem topbar + 2rem p-4 = ~8rem consumed. Use dvh (dynamic, excludes browser chrome). */}
      <div className="max-w-3xl mx-auto h-[calc(100dvh-12rem)] md:h-[calc(100dvh-8rem)] flex flex-col gap-4">

        {/* Suggestions — only on fresh session */}
        {messages.length === 1 && (
          <div className="grid grid-cols-2 gap-3 fade-in">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s.text)}
                disabled={isTyping}
                className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left hover:border-slate-600 hover:bg-slate-800/50 transition-all group disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">{s.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0 scroll-smooth">
          {messages.map((msg, i) => (
            <div key={i} className="fade-in">
              <MessageBubble
                msg={msg}
                isLast={i === messages.length - 1}
                onSpremi={msg.role === 'assistant' ? c => setSpremiContent(c) : undefined}
              />
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 fade-in">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-1">
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
        <div
          className="bg-slate-900 border border-slate-700 rounded-2xl px-3 pt-3 flex items-end gap-3 focus-within:border-violet-500 transition-colors flex-shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
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
            placeholder="Opišite što trebate... (Enter za slanje, Shift+Enter za novi red)"
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none resize-none max-h-40 min-h-[2.5rem] leading-relaxed"
            rows={1}
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || isTyping}
            className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 flex items-center justify-center flex-shrink-0 transition-all mb-0.5"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>

      </div>

      {/* Toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 fade-in">
          <User className="w-4 h-4" /> Dokument je spremljen u arhivu!
        </div>
      )}

      {/* Spremi modal */}
      {spremiContent && (
        <SpremiModal
          sadrzaj={spremiContent}
          onClose={() => setSpremiContent(null)}
          onSaved={handleSpremiSaved}
        />
      )}
    </AppLayout>
  );
}
