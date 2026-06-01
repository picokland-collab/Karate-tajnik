'use client';

import { AITajnikProvider } from './ai/AITajnikProvider';
import GlobalAITajnikWidget from './ai/GlobalAITajnikWidget';
import { ProfileProvider } from '@/lib/context/ProfileContext';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <AITajnikProvider>
        {children}
        <GlobalAITajnikWidget />
      </AITajnikProvider>
    </ProfileProvider>
  );
}
