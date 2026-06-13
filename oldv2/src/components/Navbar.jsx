import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const GEAR_PATH = "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z";

export default function Navbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const isActive = (path) =>
    path === '/' ? pathname === '/' || pathname === '/suche' : pathname.startsWith(path);

  const linkCls = (path) =>
    `text-sm font-medium px-3 py-2 rounded-lg transition-all duration-150 ${
      isActive(path)
        ? 'bg-poke-yellow/10 text-poke-yellow'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <>
      <nav className="sticky top-0 z-50 safe-top">
        <div className="absolute inset-0 bg-[#0d0d1a]/88 backdrop-blur-xl border-b border-white/5" />

        <div className="relative max-w-7xl mx-auto px-4 flex items-center gap-1.5 h-14">
          {/* Logo */}
          <Link to="/" onClick={close}
            className="flex items-center gap-2.5 font-black tracking-tight text-[17px] text-white mr-3 shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-poke-yellow to-amber-500 flex items-center justify-center text-[13px] leading-none">
              ⚡
            </div>
            <span><span className="text-poke-yellow">Poké</span>Capital</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            <Link to="/"          onClick={close} className={linkCls('/')}>Suche</Link>
            <Link to="/sets"      onClick={close} className={linkCls('/sets')}>Sets</Link>
            <Link to="/portfolio" onClick={close} className={linkCls('/portfolio')}>Portfolio</Link>
            <Link to="/analytics" onClick={close} className={linkCls('/analytics')}>Analyse</Link>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 border border-white/5 rounded-full px-2.5 py-1 bg-white/[0.02]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              EUR
            </span>

            <Link to="/admin" onClick={close}
              className={`p-2 rounded-lg transition-all ${
                pathname === '/admin'
                  ? 'text-poke-yellow bg-poke-yellow/10'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
              title="Verwaltung"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={GEAR_PATH} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setOpen(v => !v)}
              className="sm:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              aria-label="Menü"
            >
              {open ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown — inside the sticky nav so it sticks too */}
        {open && (
          <div className="sm:hidden relative bg-[#0d0d1a]/95 backdrop-blur-xl border-b border-white/5 px-4 pb-3">
            <div className="flex flex-col gap-0.5 pt-1">
              <Link to="/"          onClick={close} className={linkCls('/')}>Suche</Link>
              <Link to="/sets"      onClick={close} className={linkCls('/sets')}>Sets</Link>
              <Link to="/portfolio" onClick={close} className={linkCls('/portfolio')}>Portfolio</Link>
              <Link to="/analytics" onClick={close} className={linkCls('/analytics')}>Analyse</Link>
              <div className="my-1 border-t border-white/5" />
              <Link to="/admin" onClick={close}
                className={`flex items-center gap-2 ${linkCls('/admin')}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={GEAR_PATH} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Verwaltung
              </Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
