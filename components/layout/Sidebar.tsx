'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileText,
  Calendar,
  Trophy,
  Euro,
  Sparkles,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase-browser';

const ULOGA_LABEL: Record<string, string> = {
  admin:       'Administrator',
  predsjednik: 'Predsjednik',
  tajnik:      'Tajnik/ica',
  trener:      'Trener/ica',
  clan:        'Član',
};

const navItems = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Nadzorna ploča' },
  { href: '/clanovi',    icon: Users,            label: 'Članovi' },
  { href: '/treneri',    icon: GraduationCap,    label: 'Treneri' },
  { href: '/dokumenti',  icon: FileText,         label: 'Dokumenti' },
  { href: '/skupstine',  icon: Calendar,         label: 'Skupštine' },
  { href: '/natjecanja', icon: Trophy,           label: 'Natjecanja' },
  { href: '/financije',  icon: Euro,             label: 'Financije'  },
  { href: '/analitika',  icon: BarChart3,        label: 'Analitika' },
  { href: '/ai-tajnik',  icon: Sparkles,         label: 'AI Tajnik' },
];

const bottomItems = [
  { href: '/postavke', icon: Settings, label: 'Postavke' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<{ puno_ime: string; uloga: string; klubovi: { naziv: string } | null } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profili')
        .select('puno_ime, uloga, klubovi(naziv)')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          const raw = data as { puno_ime: string; uloga: string; klubovi: { naziv: string }[] | { naziv: string } | null };
          const klubovi = Array.isArray(raw.klubovi) ? (raw.klubovi[0] ?? null) : raw.klubovi;
          setProfile({ puno_ime: raw.puno_ime, uloga: raw.uloga, klubovi });
        });
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out relative',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 h-16 border-b border-slate-800 flex-shrink-0',
        collapsed && 'justify-center px-0'
      )}>
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-900/30">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="fade-in">
            <p className="text-sm font-bold text-slate-50 leading-tight">Digitalni</p>
            <p className="text-xs text-red-400 font-semibold tracking-wider uppercase">Tajnik</p>
          </div>
        )}
      </div>

      {/* Club name */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-800 fade-in">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Klub</p>
          <p className="text-sm font-semibold text-slate-200 mt-0.5">
            {profile?.klubovi?.naziv ?? '...'}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 group',
                collapsed && 'justify-center px-0 h-11',
                active
                  ? 'bg-red-600/15 text-red-400 border border-red-600/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              )}
            >
              <Icon
                className={cn(
                  'flex-shrink-0 w-5 h-5 transition-colors',
                  active ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              {!collapsed && <span className="fade-in">{label}</span>}
              {!collapsed && active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="px-2 pb-4 border-t border-slate-800 pt-4 space-y-1">
        {bottomItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all',
              collapsed && 'justify-center px-0 h-11'
            )}
          >
            <Icon className="flex-shrink-0 w-5 h-5 text-slate-500" />
            {!collapsed && <span className="fade-in">{label}</span>}
          </Link>
        ))}

        {/* User avatar + logout */}
        <div
          onClick={handleLogout}
          title="Odjava"
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 mt-2 cursor-pointer hover:bg-slate-800 transition-all group',
            collapsed && 'justify-center px-0'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-200">
            {profile
              ? profile.puno_ime.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
              : '·'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 fade-in">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {profile?.puno_ime ?? '...'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {profile ? (ULOGA_LABEL[profile.uloga] ?? profile.uloga) : ''}
              </p>
            </div>
          )}
          {!collapsed && (
            <LogOut className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
          )}
        </div>
      </div>

      {/* Collapse toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-20 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors shadow-lg z-10"
        aria-label={collapsed ? 'Proširi navigaciju' : 'Skupi navigaciju'}
      >
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
        }
      </button>
    </aside>
  );
}
