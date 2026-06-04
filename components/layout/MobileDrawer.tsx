'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  X, Shield, LayoutDashboard, Users, Stethoscope, FileText,
  Calendar, Trophy, Sparkles, BarChart3, Settings, LogOut, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase-browser';
import { useProfile } from '@/lib/context/ProfileContext';

const ULOGA_LABEL: Record<string, string> = {
  admin:       'Administrator',
  predsjednik: 'Predsjednik',
  tajnik:      'Tajnik/ica',
  trener:      'Trener/ica',
  clan:        'Član',
};

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Nadzorna ploča' },
  { href: '/clanovi',           icon: Users,         label: 'Članovi'   },
  { href: '/trener/prisustvo',  icon: ClipboardList, label: 'Prisustvo' },
  { href: '/lijecnicki',        icon: Stethoscope,   label: 'Liječnički' },
  { href: '/dokumenti',  icon: FileText,         label: 'Dokumenti' },
  { href: '/skupstine',  icon: Calendar,         label: 'Skupštine' },
  { href: '/natjecanja', icon: Trophy,           label: 'Natjecanja' },
  { href: '/analitika',  icon: BarChart3,        label: 'Analitika' },
  { href: '/ai-tajnik',  icon: Sparkles,         label: 'AI Tajnik' },
  { href: '/postavke',   icon: Settings,         label: 'Postavke' },
];

export default function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    onClose();
    router.push('/login');
    router.refresh();
  };

  const initials = profile
    ? profile.punoIme.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '·';

  return (
    /* Outer overlay — always rendered, visibility toggled via opacity + pointer-events */
    <div
      className={cn(
        'fixed inset-0 z-50 md:hidden transition-all duration-300',
        open ? 'visible' : 'invisible pointer-events-none'
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel — slides in from left */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-72 bg-slate-900 border-r border-slate-800',
          'flex flex-col shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-800 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-50 leading-tight">Digitalni tajnik</p>
            <p className="text-xs text-red-400 font-semibold">{profile?.klubNaziv ?? '...'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-red-600/15 text-red-400 border border-red-600/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:bg-slate-700'
                )}
              >
                <Icon className={cn('w-5 h-5', active ? 'text-red-400' : 'text-slate-500')} />
                {label}
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />}
              </Link>
            );
          })}
        </nav>

        {/* User row */}
        <div className="px-3 pb-6 border-t border-slate-800 pt-4">
          <div
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{profile?.punoIme ?? '...'}</p>
              <p className="text-xs text-slate-500">{profile ? (ULOGA_LABEL[profile.uloga] ?? profile.uloga) : ''}</p>
            </div>
            <LogOut className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}
