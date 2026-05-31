'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Ploča' },
  { href: '/clanovi',    icon: Users,            label: 'Članovi' },
  { href: '/skupstine',  icon: Calendar,         label: 'Skupštine' },
  { href: '/ai-tajnik',  icon: Sparkles,         label: 'AI Tajnik' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-16">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:bg-slate-800',
                active ? 'text-red-400' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <div className={cn(
                'w-10 h-6 flex items-center justify-center rounded-full transition-colors',
                active && 'bg-red-500/15'
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={cn('text-xs font-medium leading-none', active ? 'text-red-400' : 'text-slate-500')}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
