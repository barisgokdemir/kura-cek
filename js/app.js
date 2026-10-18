import * as store from './store.js';
import { icons } from './icons.js';
import * as home from './pages/home.js';
import * as coin from './pages/coin.js';
import * as dice from './pages/dice.js';
import * as sticks from './pages/sticks.js';
import * as list from './pages/list.js';
import * as history from './pages/history.js';
import * as about from './pages/about.js';
import * as settings from './pages/settings.js';

// Modül renkleri SocialCPU paletinden; sayfa açılınca --mc olarak uygulanır.
export const COLORS = {
  'yazi-tura': 'var(--amber)',
  zar: 'var(--cyan)',
  'kisa-cubuk': 'var(--pink)',
  liste: 'var(--green)',
  'evet-hayir': 'var(--purple)',
};

// Hash tabanlı yönlendirme: GitHub Pages'te 404 sorunu çıkarmaz.
const ROUTES = {
  '': { page: home, title: 'Kura Çek', wide: true },
  'yazi-tura': { page: coin, title: 'Yazı-Tura', recent: true },
  zar: { page: dice, title: 'Zar', recent: true },
  'kisa-cubuk': { page: sticks, title: 'Kısa Çubuk', recent: true },
  liste: { page: list, title: 'Custom Liste', recent: true },
  gecmis: { page: history, title: 'Geçmiş' },
  hakkinda: { page: about, title: 'Hakkında' },
  ayarlar: { page: settings, title: 'Ayarlar' },
};

const NAV = [
  ['', 'Ana sayfa', icons.home],
  ['gecmis', 'Geçmiş', icons.history],
  ['ayarlar', 'Ayarlar', icons.settings],
  ['hakkinda', 'Hakkında', icons.info],
];

const main = document.getElementById('app');
let cleanup = null;

document.querySelectorAll('[data-nav]').forEach((nav) => {
  nav.innerHTML = NAV.map(([r, label, icon]) => `<a href="#/${r}">${icon}<span>${label}</span></a>`).join('');
});

export function applyTheme() {
  document.documentElement.dataset.theme = store.get().settings.theme;
}

function route() {
  const [name = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  const key = ROUTES[name] ? name : '';
  const r = ROUTES[key];
  try {
    cleanup?.();
  } catch {
    // Önceki sayfanın temizliği başarısız olsa da yeni sayfa açılmalı.
  }
  cleanup = null;
  main.replaceChildren();
  main.classList.toggle('wide', !!r.wide || (key === 'liste' && !id));
  document.documentElement.style.setProperty('--mc', COLORS[key] || 'var(--cyan)');
  document.title = key ? `${r.title} · Kura Çek` : 'Kura Çek';
  if (r.recent) store.touchRecent(key);
  cleanup = r.page.mount(main, { id: id && decodeURIComponent(id) }) || null;
  document.querySelectorAll('[data-nav] a').forEach((a) => {
    a.toggleAttribute('aria-current', a.getAttribute('href') === `#/${key}`);
  });
  main.focus({ preventScroll: true });
  scrollTo(0, 0);
}

applyTheme();
addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
