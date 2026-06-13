import { apiFetch } from './api.js';

export function getCollection() {
  return apiFetch('/collection');
}

// Alle Varianten-Einträge einer Karte (eine Karte kann z.B. als Normal UND
// Reverse Holo gleichzeitig in der Sammlung sein)
export function getCollectionEntries(cardId) {
  return apiFetch(`/collection/${cardId}`).catch(() => []);
}

export async function saveCollectionEntry(entry) {
  await apiFetch(`/collection/${entry.cardId}/${entry.variant ?? 'normal'}`, { method: 'PUT', body: entry });
}

export async function removeCollectionEntry(cardId, variant = 'normal') {
  await apiFetch(`/collection/${cardId}/${variant}`, { method: 'DELETE' });
}

export function getCardSnapshots(cardId) {
  return apiFetch(`/snapshots/${cardId}`);
}

export async function saveCardSnapshot(cardId, prices) {
  const date = new Date().toISOString().slice(0, 10);
  await apiFetch(`/snapshots/${cardId}`, { body: { date, ...prices } });
}

export function getPortfolioHistory() {
  return apiFetch('/portfolio');
}

export async function savePortfolioSnapshot(value) {
  const date = new Date().toISOString().slice(0, 10);
  await apiFetch('/portfolio', { body: { date, value: Math.round(value * 100) / 100 } });
}
