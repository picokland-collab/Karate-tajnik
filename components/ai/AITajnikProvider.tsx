'use client';

import {
  createContext, useContext, useState, useRef,
  type ReactNode,
} from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Dobar dan! Ja sam vaš AI Tajnik — spojen s bazom podataka kluba u stvarnom vremenu.\n\nZnam točan broj vaših članova, glasačka prava, kvorum i podatke predsjednika. Mogu odmah:\n• Pisati zapisnike i odluke Skupštine s točnim brojevima kvoruma (čl. 24. Statuta)\n• Pisati odluke Upravnog odbora o promjenama statusa članstva (čl. 15., 16. i 30. Statuta)\n• Analizirati glasačka prava i glasački kvorum\n• Generirati molbe, obavijesti, GDPR privole i medijski sadržaj\n\nŠto trebate danas?',
};

interface AITajnikContextValue {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  isTyping: boolean;
  send: (text?: string) => Promise<void>;
  reset: () => void;
  spremiContent: string | null;
  setSpremiContent: (v: string | null) => void;
  savedToast: boolean;
  setSavedToast: (v: boolean) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

const AITajnikContext = createContext<AITajnikContextValue | null>(null);

export function useAITajnik(): AITajnikContextValue {
  const ctx = useContext(AITajnikContext);
  if (!ctx) throw new Error('useAITajnik must be used inside AITajnikProvider');
  return ctx;
}

export function AITajnikProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [spremiContent, setSpremiContent] = useState<string | null>(null);
  const [savedToast, setSavedToast]       = useState(false);
  const [isOpen, setIsOpen]     = useState(false);

  // Refs so that `send` never captures stale closures for reading-only values
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const inputRef = useRef(input);
  inputRef.current = input;
  const isTypingRef = useRef(isTyping);
  isTypingRef.current = isTyping;

  async function send(text?: string) {
    const msg = text ?? inputRef.current.trim();
    if (!msg || isTypingRef.current) return;

    const userMsg: Message = { role: 'user', content: msg };
    const newHistory = [...messagesRef.current, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsTyping(true);

    const apiMessages = newHistory.map(m => ({ role: m.role, content: m.content }));
    let firstChunk = true;

    try {
      const res = await fetch('/api/ai-tajnik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const errText = await res.text();
        setMessages(prev => [...prev, { role: 'assistant', content: `Greška: ${errText}` }]);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        if (firstChunk) {
          firstChunk = false;
          setIsTyping(false);
          setMessages(prev => [...prev, { role: 'assistant', content }]);
        } else {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content };
            return updated;
          });
        }
      }

      const remaining = decoder.decode();
      if (remaining) {
        content += remaining;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content };
          return updated;
        });
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Došlo je do greške pri spajanju s AI servisom. Pokušajte ponovo.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function reset() {
    setMessages([INITIAL_MESSAGE]);
    setInput('');
  }

  return (
    <AITajnikContext.Provider value={{
      messages, input, setInput, isTyping, send, reset,
      spremiContent, setSpremiContent,
      savedToast, setSavedToast,
      isOpen, setIsOpen,
    }}>
      {children}
    </AITajnikContext.Provider>
  );
}
