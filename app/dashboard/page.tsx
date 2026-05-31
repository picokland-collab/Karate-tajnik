'use client';

import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import {
  AlertTriangle, Info, AlertCircle,
  UserPlus, Calendar, Trophy, Sparkles,
  ChevronRight, Users, FileText, TrendingUp,
  Clock, CheckCircle, Heart, ArrowUpRight, Settings,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRole } from '@/lib/hooks/useRole';
import { fetchMemberCount } from '@/lib/queries/clanovi';
import {
  fetchUpozorenja, fetchMedaljeCount, fetchKlubInfo,
  fetchDnevnikAktivnosti, fetchCurrentUserName,
} from '@/lib/queries/dashboard';
import { fetchDokumenti } from '@/lib/queries/dokumenti';
import type { DnevnikEntry } from '@/lib/queries/dashboard';
import { formatDateTime, daysUntil } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Alert } from '@/lib/types';

const quickActions = [
  {
    icon: UserPlus,
    label: 'Upiši novog člana',
    description: 'Dodaj u 3 koraka',
    href: '/clanovi?action=new',
    glow: 'hover:shadow-blue-900/30',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    permission: 'canAdd' as const,
  },
  {
    icon: Calendar,
    label: 'Sazovi skupštinu',
    description: 'Dnevni red i pozivnica',
    href: '/skupstine?action=new',
    glow: 'hover:shadow-violet-900/30',
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-400',
    permission: 'isAdmin' as const,
  },
  {
    icon: Trophy,
    label: 'Objavi natjecanje',
    description: 'Rezultati i medijska objava',
    href: '/natjecanja?action=new',
    glow: 'hover:shadow-amber-900/30',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    permission: 'all' as const,
  },
  {
    icon: Sparkles,
    label: 'AI Tajnik',
    description: 'Generiraj dokumente',
    href: '/ai-tajnik',
    glow: 'hover:shadow-emerald-900/30',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    permission: 'all' as const,
  },
];

const VRSTA_ICON: Record<string, React.FC<{ className?: string }>> = {
  sjednica:   Calendar,
  natjecanje: Trophy,
  clan:       UserPlus,
  klub:       Settings,
  sustav:     CheckCircle,
  dokument:   FileText,
  korisnik:   UserPlus,
};

function AlertCard({ alert }: { alert: Alert }) {
  const config = {
    critical: {
      icon: AlertCircle,
      border: 'border-red-800/60',
      bg: 'bg-red-950/40',
      iconColor: 'text-red-400',
      badge: 'bg-red-500/20 text-red-300 border-red-500/30',
      badgeText: 'Hitno',
    },
    warning: {
      icon: AlertTriangle,
      border: 'border-amber-800/60',
      bg: 'bg-amber-950/30',
      iconColor: 'text-amber-400',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      badgeText: 'Upozorenje',
    },
    info: {
      icon: Info,
      border: 'border-blue-800/40',
      bg: 'bg-blue-950/20',
      iconColor: 'text-blue-400',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      badgeText: 'Info',
    },
  }[alert.type];

  const Icon = config.icon;

  return (
    <div className={cn('rounded-xl border px-3 py-2.5 flex gap-2.5 fade-in', config.border, config.bg)}>
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', config.bg)}>
        <Icon className={cn('w-3.5 h-3.5', config.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-semibold text-slate-100">{alert.title}</p>
          <span className={cn('text-xs px-1.5 py-0 rounded-full border font-medium leading-5', config.badge)}>
            {config.badgeText}
          </span>
          {alert.count != null && (
            <span className="text-xs bg-slate-700 text-slate-300 px-1.5 rounded-full font-bold leading-5">
              {alert.count}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 leading-snug">{alert.description}</p>
        {alert.action && (
          <Link
            href={alert.actionUrl || '#'}
            className={cn('inline-flex items-center gap-1 text-xs font-semibold mt-1', config.iconColor, 'hover:underline')}
          >
            {alert.action} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isAdmin, canAdd, roleLoaded } = useRole();
  const [memberCount, setMemberCount]   = useState({ active: 0, total: 0 });
  const [upozorenja, setUpozorenja]     = useState<Alert[]>([]);
  const [medaljeCount, setMedaljeCount] = useState(0);
  const [klubInfo, setKlubInfo]         = useState<{ predsjednik: string | null; datumMandata: string | null } | null>(null);
  const [dnevnik, setDnevnik]           = useState<DnevnikEntry[]>([]);
  const [userName, setUserName]         = useState('');
  const [dokumentiCount, setDokumentiCount] = useState(0);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    Promise.all([
      fetchMemberCount(),
      fetchUpozorenja(),
      fetchMedaljeCount(),
      fetchKlubInfo(),
      fetchDnevnikAktivnosti(),
      fetchCurrentUserName(),
      fetchDokumenti(),
    ]).then(([members, alerts, medalje, klub, dnevnikData, name, dokumenti]) => {
      setMemberCount(members);
      setUpozorenja(alerts);
      setMedaljeCount(medalje);
      setKlubInfo(klub);
      setDnevnik(dnevnikData);
      setUserName(name);
      setDokumentiCount(dokumenti.length);
    }).finally(() => setLoading(false));
  }, []);

  const mandateDays = klubInfo?.datumMandata ? daysUntil(klubInfo.datumMandata) : null;
  const greeting    = userName ? userName.split(' ')[0] : '...';

  // While role is loading keep all tiles so the layout doesn't jump for admin.
  // Once settled, filter to only the tiles the current role may see.
  const visibleActions = !roleLoaded
    ? quickActions
    : quickActions.filter(a => {
        if (a.permission === 'canAdd')  return canAdd;
        if (a.permission === 'isAdmin') return isAdmin;
        return true;
      });

  return (
    <AppLayout
      title="Nadzorna ploča"
      subtitle={`Dobrodošli natrag, ${greeting} · ${new Date().toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
    >
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {[
            {
              icon: Users,
              value: memberCount.active,
              label: 'Aktivnih članova',
              sub: `od ${memberCount.total} ukupno`,
              color: 'text-blue-400',
              bg: 'bg-blue-500/10',
            },
            {
              icon: FileText,
              value: dokumentiCount,
              label: 'Dokumenata',
              sub: dokumentiCount === 0 ? 'nema u arhivi' : 'u arhivi kluba',
              color: 'text-violet-400',
              bg: 'bg-violet-500/10',
            },
            {
              icon: Trophy,
              value: medaljeCount,
              label: 'Medalje ove sezone',
              sub: 'ukupno osvajanja',
              color: 'text-amber-400',
              bg: 'bg-amber-500/10',
            },
            {
              icon: Clock,
              value: mandateDays != null ? `${mandateDays}d` : '—',
              label: 'Do isteka mandata',
              sub: klubInfo?.predsjednik ?? '—',
              color: mandateDays != null && mandateDays < 60 ? 'text-red-400' : 'text-green-400',
              bg: mandateDays != null && mandateDays < 60 ? 'bg-red-500/10' : 'bg-green-500/10',
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 md:p-3 hover:border-slate-700 transition-colors"
            >
              <div className={cn('w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center mb-1.5 md:mb-2', stat.bg)}>
                <stat.icon className={cn('w-3.5 h-3.5 md:w-4 md:h-4', stat.color)} />
              </div>
              <p className="text-lg md:text-xl font-bold text-slate-50">{stat.value}</p>
              <p className="text-xs font-medium text-slate-300 mt-0.5 leading-tight">{stat.label}</p>
              <p className="text-xs text-slate-600 hidden sm:block">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Main 2-col grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Left: Alerts + Quick Actions */}
          <div className="xl:col-span-2 space-y-3">

            {/* Alerts */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Zahtijeva pažnju
                </h2>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {upozorenja.length} stavki
                </span>
              </div>
              <div className="space-y-2">
                {loading ? (
                  <div className="rounded-xl border border-slate-800 px-3 py-4 text-xs text-slate-600 text-center">
                    Učitavam upozorenja...
                  </div>
                ) : upozorenja.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 px-3 py-4 text-xs text-slate-600 text-center">
                    Nema aktivnih upozorenja.
                  </div>
                ) : (
                  upozorenja.map(alert => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))
                )}
              </div>
            </section>

            {/* Quick Actions */}
            <section>
              <h2 className="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                Brze akcije
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {visibleActions.map((action, i) => (
                  <Link
                    key={i}
                    href={action.href}
                    className={cn(
                      'group flex items-center gap-3 bg-slate-900 border border-slate-800',
                      'rounded-xl px-3 py-2.5 hover:border-slate-600',
                      'transition-all duration-150 hover:shadow-lg',
                      action.glow
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', action.iconBg)}>
                      <action.icon className={cn('w-4 h-4', action.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-100 leading-tight truncate">{action.label}</p>
                      <p className="text-xs text-slate-500 truncate">{action.description}</p>
                    </div>
                    <ArrowUpRight className={cn('w-3.5 h-3.5 flex-shrink-0', action.iconColor, 'opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all')} />
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Activity feed */}
          <div>
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-full">
              <h2 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Nedavne aktivnosti
              </h2>
              <div className="space-y-0.5">
                {dnevnik.length === 0 ? (
                  <p className="text-xs text-slate-600 py-4 text-center">Nema zabilježenih aktivnosti.</p>
                ) : (
                  dnevnik.map((log, i) => {
                    const Icon = VRSTA_ICON[log.vrsta_entiteta] ?? FileText;
                    return (
                      <div key={log.id} className="relative">
                        {i < dnevnik.length - 1 && (
                          <div className="absolute left-3.5 top-8 bottom-0 w-px bg-slate-800" />
                        )}
                        <div className="flex gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 z-10">
                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-300 leading-snug">{log.radnja}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{formatDateTime(log.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <Link href="#" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-3 font-medium transition-colors">
                Prikaži sve aktivnosti <ChevronRight className="w-3 h-3" />
              </Link>
            </section>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
