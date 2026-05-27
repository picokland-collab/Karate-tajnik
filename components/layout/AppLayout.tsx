'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileHeader from './MobileHeader';
import BottomNav from './BottomNav';
import MobileDrawer from './MobileDrawer';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-950">
      {/* ── Desktop sidebar (hidden on mobile) ─────────────── */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <Sidebar />
      </div>

      {/* ── Mobile full-screen drawer ───────────────────────── */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── Main column ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Desktop top bar */}
        <div className="hidden md:block flex-shrink-0">
          <TopBar title={title} subtitle={subtitle} actions={actions} />
        </div>

        {/* Mobile top header */}
        <MobileHeader
          title={title}
          actions={actions}
          onHamburger={() => setDrawerOpen(true)}
        />

        {/* Scrollable content
            pb-20 on mobile to clear the fixed bottom nav (h-16 + 4px safety) */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-4 md:p-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom,0px))] md:[padding-bottom:1rem] mobile-pb">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation bar (fixed) ───────────── */}
      <BottomNav />
    </div>
  );
}
