'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Library,
  Search,
  Layers,
  BookOpen,
  Heart,
  Settings as SettingsIcon,
  Plus,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PokeballMark from './PokeballMark';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolio', label: 'Kursverlauf', icon: Activity },
  { href: '/search', label: 'Suche', icon: Search },
  { href: '/collection', label: 'Sammlung', icon: Library },
  { href: '/sets', label: 'Sets', icon: Layers },
  { href: '/binders', label: 'Binder', icon: BookOpen },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-white/5 bg-ink-900/40 backdrop-blur-md sticky top-0 h-screen">
      <div className="px-6 py-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3">
          <PokeballMark className="h-8 w-8" />
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-tight">Pokéfolio</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
              Portfolio · TCG
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {nav.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-gradient-to-r from-flame-500/15 to-transparent text-white border border-flame-500/20'
                  : 'text-ink-200 hover:text-white hover:bg-white/[0.03]',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition',
                  active ? 'text-flame-400' : 'text-ink-300 group-hover:text-white',
                )}
              />
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-flame-400 shadow-[0_0_8px_rgb(255_107_31)]" />
              )}
            </Link>
          );
        })}

        <div className="pt-6 mt-2 border-t border-white/5">
          <Link
            href="/cards/new"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-200 hover:text-white hover:bg-white/[0.03] transition"
          >
            <Plus className="h-4 w-4 text-electric-500" />
            <span>Custom Card</span>
            <span className="pill ml-auto !text-[9px]">manuell</span>
          </Link>
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
              pathname.startsWith('/settings')
                ? 'text-white bg-white/[0.04]'
                : 'text-ink-200 hover:text-white hover:bg-white/[0.03]',
            )}
          >
            <SettingsIcon className="h-4 w-4 text-ink-300" />
            <span>Einstellungen</span>
          </Link>
        </div>
      </nav>

      <div className="px-5 py-5 border-t border-white/5">
        <div className="surface-glass p-3 text-xs text-ink-200 leading-relaxed">
          <div className="font-semibold text-white mb-1">Datenquelle</div>
          Preise & Bilder via{' '}
          <a
            href="https://tcgdex.dev/"
            target="_blank"
            rel="noreferrer"
            className="text-flame-400 hover:underline"
          >
            TCGdex
          </a>{' '}
          (Cardmarket EUR). Custom Cards sind manuell.
        </div>
      </div>
    </aside>
  );
}
