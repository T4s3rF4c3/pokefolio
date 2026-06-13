import { createContext, useContext, useState, useRef, useEffect } from 'react';

export const LANGS = [
  { code: 'de',    label: 'DE', name: 'Deutsch' },
  { code: 'en',    label: 'EN', name: 'English' },
  { code: 'fr',    label: 'FR', name: 'Français' },
  { code: 'es',    label: 'ES', name: 'Español' },
  { code: 'it',    label: 'IT', name: 'Italiano' },
  { code: 'pt',    label: 'PT', name: 'Português' },
  { code: 'ja',    label: 'JA', name: '日本語' },
  { code: 'zh-tw', label: 'ZH', name: '繁體中文' },
  { code: 'ko',    label: 'KO', name: '한국어' },
];

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('pokelang') ?? 'de');

  const setLang = (code) => {
    localStorage.setItem('pokelang', code);
    setLangState(code);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, langs: LANGS }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
