import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LangProvider } from './context/LangContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CardDetail from './pages/CardDetail';
import Sets from './pages/Sets';
import SetDetail from './pages/SetDetail';

// Chart-lastige Seiten lazy laden – hält Recharts aus dem Haupt-Bundle
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Admin     = lazy(() => import('./pages/Admin'));
const Analytics = lazy(() => import('./pages/Analytics'));

const routeFallback = (
  <div className="py-20 text-center text-sm text-slate-600">Lädt…</div>
);

export default function App() {
  return (
    <LangProvider>
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#0d0d1a]">
        <Navbar />
        <main className="flex-1">
          <Suspense fallback={routeFallback}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/suche" element={<Home />} />
              <Route path="/karte/:lang/:id" element={<CardDetail />} />
              <Route path="/sets" element={<Sets />} />
              <Route path="/set/:id" element={<SetDetail />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/analytics" element={<Analytics />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="border-t border-white/[0.04] py-4 text-center text-xs text-slate-700 safe-bottom">
          PokéCapital · Daten via{' '}
          <a href="https://tcgdex.net" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-slate-400 transition-colors">
            TCGdex
          </a>{' '}
          &amp; Cardmarket · Kein offizielles Produkt
        </footer>
      </div>
    </BrowserRouter>
    </LangProvider>
  );
}
