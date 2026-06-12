import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatEur(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export function cardCode(setCode: string | null | undefined, localId: string): string {
  const c = (setCode ?? '').toUpperCase().trim();
  if (!c) return localId;
  return `${c} ${localId}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('de-DE').format(value);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const CONDITIONS = ['Mint', 'NM', 'LP', 'MP', 'HP'] as const;
export const VARIANTS = ['Normal', 'Holo', 'Reverse Holo', 'First Edition'] as const;
export const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'ja'] as const;

export type CardLike = {
  id: string;
  name: string;
  imageUrl: string | null;
  localId: string;
  setLabel: string | null;
  rarity: string | null;
  isCustom: boolean;
  trendEur: number | null;
};
