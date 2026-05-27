'use client';

import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import {
  AlertTriangle, Info, AlertCircle,
  UserPlus, Calendar, Trophy, Sparkles,
  ChevronRight, Users, FileText, TrendingUp,
  Clock, CheckCircle, Heart, ArrowUpRight,
} from 'lucide-react';
import { alerts, activityLog, members, competitions, club } from '@/lib/mock-data';
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
  },
  {
    icon: Calendar,
    label: 'Sazovi skupštinu',
    description: 'Dnevni red i pozivnica',
    href: '/skupstine?action=new',
    glow: 'hover:shadow-violet-900/30',
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-400',
  },
  {
    icon: Trophy,
    label: 'Objavi natjecanje',
    description: 'Rezultati i medijska objava',
    href: '/natjecanja?action=new',
    glow: 'hover:shadow-amber-900/30',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: Sparkles,
    label: 'AI Tajnik',
    description: 'Generiraj dokumente',
    href: '/ai-tajnik',
    glow: 'hover:shadow-emerald-900/30',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
];

const activityIcons: Record<string, React.FC<{ className?: string }>> = {
  UserPlus, Sparkles, Calendar, Heart, CheckCircle, FileText,
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
      {/* ↑ p-4→px-3 py-2.5 (–5px vertical), rounded-2xl→rounded-xl */}
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', config.bg)}>
        {/* ↑ w-9 h-9→w-7 h-7 */}
        <Icon className={cn('w-3.5 h-3.5', config.iconColor)} />
        {/* ↑ w-5 h-5→w-3.5 h-3.5 */}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-semibold text-slate-100">{alert.title}</p>
          {/* ↑ text-sm→text-xs */}
          <span className={cn('text-xs px-1.5 py-0 rounded-full border font-medium leading-5', config.badge)}>
            {config.badgeText}
          </span>
          {alert.count && (
            <span className="text-xs bg-slate-700 text-slate-300 px-1.5 rounded-full font-bold leading-5">
              {alert.count}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 leading-snug">{alert.description}</p>
        {/* ↑ mt-1→mt-0.5 */}
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
  const activeMembers = members.filter(m => m.status === 'aktivan').length;
  const mandateDays = daysUntil(club.presidentMandateExpiry);
  const lastComp = competitions[0];

  return (
    <AppLayout
      title="Nadzorna ploča"
      subtitle={`Dobrodošli natrag, Maja · ${new Date().toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
    >
      {/* ↓ space-y-8→space-y-4, mx-auto bez dodat. paddinga */}
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Stats row — 2 cols on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {[
            {
              icon: Users,
              value: activeMembers,
              label: 'Aktivnih članova',
              sub: `od ${members.length} ukupno`,
              color: 'text-blue-400',
              bg: 'bg-blue-500/10',
            },
            {
              icon: FileText,
              value: '2',
              label: 'Dokumenata',
              sub: '1 čeka odobrenje',
              color: 'text-violet-400',
              bg: 'bg-violet-500/10',
            },
            {
              icon: Trophy,
              value: '3',
              label: 'Medalje ove sezone',
              sub: lastComp?.name.split(' ')[0] ?? '',
              color: 'text-amber-400',
              bg: 'bg-amber-500/10',
            },
            {
              icon: Clock,
              value: `${mandateDays}d`,
              label: 'Do isteka mandata',
              sub: club.presidentName,
              color: mandateDays < 60 ? 'text-red-400' : 'text-green-400',
              bg: mandateDays < 60 ? 'bg-red-500/10' : 'bg-green-500/10',
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
          {/* ↑ gap-6→gap-4 */}

          {/* Left column: Alerts + Quick Actions */}
          <div className="xl:col-span-2 space-y-3">
            {/* ↑ space-y-6→space-y-3 */}

            {/* Alerts */}
            <section>
              <div className="flex items-center justify-between mb-2">
                {/* ↑ mb-3→mb-2 */}
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  {/* ↑ text-base→text-sm */}
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Zahtijeva pažnju
                </h2>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {alerts.length} stavki
                </span>
              </div>
              <div className="space-y-2">
                {/* ↑ space-y-3→space-y-2 */}
                {alerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </section>

            {/* Quick Actions — horizontal compact layout (icon-left) */}
            <section>
              <h2 className="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                Brze akcije
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action, i) => (
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
                    {/* Icon — kompaktni kvadrat lijevo */}
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', action.iconBg)}>
                      <action.icon className={cn('w-4 h-4', action.iconColor)} />
                    </div>
                    {/* Tekst */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-100 leading-tight truncate">{action.label}</p>
                      <p className="text-xs text-slate-500 truncate">{action.description}</p>
                    </div>
                    {/* Arrow */}
                    <ArrowUpRight className={cn('w-3.5 h-3.5 flex-shrink-0', action.iconColor, 'opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all')} />
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Right column: Activity feed */}
          <div>
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-full">
              {/* ↑ rounded-2xl→rounded-xl, p-5→p-4 */}
              <h2 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
                {/* ↑ text-base→text-sm, mb-4→mb-3 */}
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Nedavne aktivnosti
              </h2>
              <div className="space-y-0.5">
                {/* ↑ space-y-1→space-y-0.5 */}
                {activityLog.map((log, i) => {
                  const Icon = activityIcons[log.icon] ?? FileText;
                  return (
                    <div key={log.id} className="relative">
                      {i < activityLog.length - 1 && (
                        <div className="absolute left-3.5 top-8 bottom-0 w-px bg-slate-800" />
                        // ↑ left-4→left-3.5, top-9→top-8
                      )}
                      <div className="flex gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                        {/* ↑ gap-3→gap-2.5, p-2→px-1.5 py-1.5, rounded-xl→rounded-lg */}
                        <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 z-10">
                          {/* ↑ w-8 h-8 rounded-xl → w-7 h-7 rounded-lg */}
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          {/* ↑ w-4 h-4→w-3.5 h-3.5 */}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 leading-snug">
                            <span className="font-semibold text-slate-100">{log.userName}</span>{' '}
                            {log.action}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {/* ↑ mt-1→mt-0.5 */}
                            {formatDateTime(log.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link href="#" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-3 font-medium transition-colors">
                {/* ↑ mt-4→mt-3 */}
                Prikaži sve aktivnosti <ChevronRight className="w-3 h-3" />
              </Link>
            </section>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
