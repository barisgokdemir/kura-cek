// Tüm veri tarayıcıda, localStorage'da durur. Sunucu yok.

import { randomHex } from './rng.js';

const KEY = 'kuracek:v1';
const HISTORY_LIMIT = 50;
const RECENT_LIMIT = 4;

const defaults = () => ({
  version: 1,
  settings: { theme: 'dark', sound: true, vibrate: true, motion: 'auto' },
  history: [],
  recent: [],
  lists: [],
  coin: { labels: ['Yazı', 'Tura'] },
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return merge(defaults(), JSON.parse(raw));
  } catch {
    return defaults();
  }
}

function merge(base, data) {
  const out = { ...base, ...data };
  out.settings = { ...base.settings, ...(data.settings || {}) };
  out.coin = { ...base.coin, ...(data.coin || {}) };
  for (const k of ['history', 'recent', 'lists']) if (!Array.isArray(out[k])) out[k] = [];
  return out;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Gizli sekme veya dolu depolama: uygulama bellekte çalışmaya devam eder.
  }
  listeners.forEach((fn) => fn(state));
}

export const get = () => state;
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function update(fn) {
  fn(state);
  save();
}

export function addHistory(record, summary) {
  update((s) => {
    s.history.unshift({ ...record, summary });
    s.history.length = Math.min(s.history.length, HISTORY_LIMIT);
  });
}

export function touchRecent(route) {
  update((s) => {
    s.recent = [route, ...s.recent.filter((r) => r !== route)].slice(0, RECENT_LIMIT);
  });
}

export const uid = () => Date.now().toString(36) + randomHex(3);

export function saveList(list) {
  update((s) => {
    const i = s.lists.findIndex((l) => l.id === list.id);
    if (i >= 0) s.lists[i] = list;
    else s.lists.unshift(list);
  });
}

export function deleteList(id) {
  update((s) => {
    s.lists = s.lists.filter((l) => l.id !== id);
  });
}

export function exportJSON() {
  return JSON.stringify({ app: 'kura-cek', exported: new Date().toISOString(), ...state }, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (data?.app !== 'kura-cek') throw new Error('Bu dosya Kura Çek yedeği değil');
  delete data.app;
  delete data.exported;
  state = merge(defaults(), data);
  save();
}

export function reset() {
  state = defaults();
  save();
}
