'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Plus, RefreshCw, Menu } from 'lucide-react';
import { useState } from 'react';
import { useMobileNav } from './MobileNavContext';

const titles: Record<string, string> = {
  '/': 'Übersicht',
  '/search': 'Karten finden',
  '/collection': 'Meine Sammlung',
  '/sets': 'Sets',
  '/binders': 'Binder',
  '/wishlist': 'Wishlist',
  '/settings': 'Einstellungen',
  '/cards/new': 'Custom Card',
};

export default function TopBar() {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const { toggle } = useMobileNav();

  const title =
    Object.entries(titles).find(([k]) =>
      k === '/' ? pathname === '/' : pathname.startsWith(k),
    )?.[1] ?? 'Pokéfolio';

  async function triggerSync() {
    setSyncing(true);
    try {
      await fetch('/api/sync/prices', { method: 'POST' });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 lg:px-10 py-3 sm:py-4 max-w-[1500px] mx-auto">
        <button
          onClick={toggle}
          aria-label="Menü öffnen"
          className="lg:hidden p-2 -ml-1 rounded-md text-ink-200 hover:text-white hover:bg-white/5 transition"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-ink-300">Portfolio</div>
          <h1 className="font-display text-lg sm:text-xl lg:text-2xl font-bold truncate">{title}</h1>
        </div>

        <Link
          href="/search"
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-sm text-ink-200 hover:text-white hover:bg-white/[0.06] transition w-72"
        >
          <Search className="h-4 w-4" />
          <span className="text-ink-300">Karte, Set oder Code suchen…</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-ink-300 border border-white/5">
            /
          </kbd>
        </Link>

        <button
          onClick={triggerSync}
          disabled={syncing}
          className="btn btn-ghost text-xs"
          title="Preise neu synchronisieren"
        >
          <RefreshCw className={syncing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          <span className="hidden sm:inline">{syncing ? 'Sync…' : 'Sync'}</span>
        </button>

        <Link
          href="/search"
          aria-label="Suche"
          className="md:hidden btn btn-ghost text-xs !px-2.5"
        >
          <Search className="h-4 w-4" />
        </Link>

        <Link href="/cards/new" className="btn btn-primary text-xs !px-2.5 sm:!px-3">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Custom Card</span>
        </Link>
      </div>
    </header>
  );
}
