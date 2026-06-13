import { apiFetch } from './api.js';

let _cache = null;

export async function getSettings() {
  if (_cache) return _cache;
  _cache = await apiFetch('/settings');
  return _cache;
}

export function getSettingsSync() {
  return _cache ?? {};
}

export async function saveSettings(patch) {
  _cache = await apiFetch('/settings', { body: patch });
  return _cache;
}
