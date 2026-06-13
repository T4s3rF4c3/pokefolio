import { apiFetch } from './api.js';

export function getAllManualCards() {
  return apiFetch('/manual-cards');
}

export function getManualCard(id) {
  return apiFetch(`/manual-cards/${id}`).catch(() => null);
}

export async function saveManualCard(card) {
  await apiFetch(`/manual-cards/${card.id}`, { method: 'PUT', body: card });
}

export async function deleteManualCard(id) {
  await apiFetch(`/manual-cards/${id}`, { method: 'DELETE' });
}

export async function findManualByAbbr(abbr, number) {
  const all = await getAllManualCards();
  const a = abbr.toUpperCase();
  const n = parseInt(number, 10);
  return Object.values(all).filter(c =>
    (c._abbr ?? '').toUpperCase() === a &&
    parseInt(c.localId, 10) === n
  );
}

export async function findManualByName(query) {
  const all = await getAllManualCards();
  const q = query.toLowerCase();
  return Object.values(all).filter(c =>
    (c.name ?? '').toLowerCase().includes(q)
  );
}
