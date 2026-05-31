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

        {/* Scrollable content area.
            overflow-x-hidden is NOT placed on this element — iOS Safari coerces it
            to overflow-x:auto when overflow-y is also set. Instead the html/body
            carry overflow-x:hidden. The inner div provides a non-scroll clip layer. */}
        <main className="flex-1 overflow-y-auto p-4 mobile-pb">
          <div className="w-full overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom navigation bar (fixed) ───────────── */}
      <BottomNav />
    </div>
  );
}
