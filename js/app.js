import * as store from './store.js';
import * as home from './pages/home.js';
import * as coin from './pages/coin.js';
import * as dice from './pages/dice.js';
import * as sticks from './pages/sticks.js';
import * as list from './pages/list.js';
import * as history from './pages/history.js';
import * as about from './pages/about.js';
import * as settings from './pages/settings.js';

// Hash tabanlı yönlendirme: GitHub Pages'te 404 sorunu çıkarmaz.
const ROUTES = {
  '': { page: home, title: 'Kura Çek' },
  'yazi-tura': { page: coin, title: 'Yazı-Tura', recent: true },
  zar: { page: dice, title: 'Zar', recent: true },
  'kisa-cubuk': { page: sticks, title: 'Kısa Çubuk', recent: true },
  liste: { page: list, title: 'Custom Liste', recent: true },
  gecmis: { page: history, title: 'Geçmiş' },
  hakkinda: { page: about, title: 'Hakkında' },
  ayarlar: { page: settings, title: 'Ayarlar' },
};

const main = document.getElementById('app');
let cleanup = null;

export function applyTheme() {
  const t = store.get().settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

function route() {
  const [name = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  const r = ROUTES[name] || ROUTES[''];
  try {
    cleanup?.();
  } catch {
    // Önceki sayfanın temizliği başarısız olsa da yeni sayfa açılmalı.
  }
  cleanup = null;
  main.replaceChildren();
  document.title = r === ROUTES[''] ? 'Kura Çek' : `${r.title} · Kura Çek`;
  if (r.recent) store.touchRecent(name);
  cleanup = r.page.mount(main, { id: id && decodeURIComponent(id) }) || null;
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.toggleAttribute('aria-current', a.getAttribute('href') === `#/${ROUTES[name] ? name : ''}`);
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
