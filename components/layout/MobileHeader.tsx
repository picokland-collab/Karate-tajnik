'use client';

import { Menu, Bell, Shield } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  actions?: React.ReactNode;
  onHamburger: () => void;
}

export default function MobileHeader({ title, actions, onHamburger }: MobileHeaderProps) {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-3 flex-shrink-0 md:hidden">
      {/* Logo mark */}
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-900/40">
        <Shield className="w-4 h-4 text-white" />
      </div>

      {/* Page title */}
      <p className="flex-1 text-sm font-bold text-slate-100 truncate">{title}</p>

      {/* Optional action slot (e.g. "Novi član" button) */}
      {actions && (
        <div className="flex items-center gap-2 [&>a]:text-xs [&>a]:px-3 [&>a]:py-1.5 [&>button]:text-xs [&>button]:px-3 [&>button]:py-1.5">
          {actions}
        </div>
      )}

      {/* Notifications */}
      <button className="relative w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
        <Bell className="w-4 h-4 text-slate-400" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
      </button>

      {/* Hamburger */}
      <button
        onClick={onHamburger}
        className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center active:bg-slate-700 transition-colors"
        aria-label="Otvori navigaciju"
      >
        <Menu className="w-4 h-4 text-slate-300" />
      </button>
    </header>
  );
}
