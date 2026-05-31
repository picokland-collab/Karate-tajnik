'use client';

import { AITajnikProvider } from './ai/AITajnikProvider';
import GlobalAITajnikWidget from './ai/GlobalAITajnikWidget';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AITajnikProvider>
      {children}
      <GlobalAITajnikWidget />
    </AITajnikProvider>
  );
}
