'use client';

import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Sparkles, Send, Bot, User, Zap, FileText, Calendar, Trophy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const suggestions = [
  { icon: FileText, text: 'Napiši pozivnicu za skupštinu za 15. lipnja' },
  { icon: Calendar, text: 'Sastavi obavijest o promjeni rasporeda treninga' },
  { icon: Trophy, text: 'Napiši čestitku za osvajanje prvog mjesta' },
  { icon: Zap, text: 'Generiraj molbu za sufinanciranje općini' },
];

const demoReplies: Record<string, string> = {
  default: `Razumijem vaš zahtjev. Kao AI tajnik Karate kluba Rijeka, mogu vam pomoći s:

📄 **Dokumentima** — zapisnici, odluke, izvještaji, molbe
📧 **Komunikacijom** — pozivnice, obavijesti, čestitke
🏆 **Natjecanjima** — medijski izvještaji, objave za društvene mreže
⚖️ **Pravnim pitanjima** — statut, pravilnici, odluke skupštine

Opišite što trebate i ja ću pripremiti nacrt u roku od nekoliko sekundi!`,
};

export default function AITajnikPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Dobar dan! Ja sam vaš AI Tajnik. Tu sam da vam pomognem s pisanjem svih službenih dokumenata, obavijesti i komunikacije za karate klub. Što trebate danas?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const send = (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setMessages(m => [...m, { role: 'user', content: msg }]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(m => [...m, { role: 'assistant', content: demoReplies.default }]);
    }, 1800);
  };

  return (
    <AppLayout
      title="AI Tajnik"
      subtitle="Vaš inteligentni asistent za sve administrativne zadatke"
    >
      <div className="max-w-3xl mx-auto h-[calc(100vh-10rem)] flex flex-col gap-4">

        {/* Suggestions (shown only when no user messages) */}
        {messages.length === 1 && (
          <div className="grid grid-cols-2 gap-3 fade-in">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s.text)}
                className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left hover:border-slate-600 hover:bg-slate-800/50 transition-all group"
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
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-3 fade-in', msg.role === 'user' ? 'flex-row-reverse' : '')}>
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold',
                msg.role === 'assistant'
                  ? 'bg-violet-600/20 border border-violet-600/30'
                  : 'bg-red-600/20 border border-red-600/30'
              )}>
                {msg.role === 'assistant' ? <Sparkles className="w-4 h-4 text-violet-400" /> : <User className="w-4 h-4 text-red-400" />}
              </div>
              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'assistant'
                  ? 'bg-slate-900 border border-slate-800 text-slate-200'
                  : 'bg-red-600/20 border border-red-600/20 text-slate-100'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3 fade-in">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-400 spin-slow" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3 flex items-end gap-3 focus-within:border-violet-500 transition-colors">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Opišite što trebate... (Enter za slanje)"
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none max-h-32 min-h-[2.5rem]"
            rows={1}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim()}
            className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 flex items-center justify-center flex-shrink-0 transition-all"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
