import { h, pageHeader, proofLine } from '../ui.js';
import * as store from '../store.js';
import { COLORS } from '../app.js';

const NAMES = {
  'yazi-tura': 'Yazı-Tura',
  zar: 'Zar',
  'kisa-cubuk': 'Kısa Çubuk',
  liste: 'Liste',
  'evet-hayir': 'Evet/Hayır',
};

export function mount(root) {
  let filter = '';
  const listEl = h('ol', { class: 'history' });
  const select = h(
    'select',
    { 'aria-label': 'Modüle göre filtre', onchange: (e) => ((filter = e.target.value), render()) },
    h('option', { value: '' }, 'Tümü'),
    Object.entries(NAMES).map(([k, v]) => h('option', { value: k }, v)),
  );
  const clearBtn = h('button', {
    class: 'btn danger',
    onclick: (e) => {
      if (!e.target.dataset.sure) {
        e.target.dataset.sure = '1';
        e.target.textContent = 'Emin misin? Temizle';
        return;
      }
      store.update((s) => (s.history = []));
      delete e.target.dataset.sure;
      e.target.textContent = 'Geçmişi temizle';
      render();
    },
  }, 'Geçmişi temizle');

  function render() {
    const items = store.get().history.filter((r) => !filter || r.module === filter);
    listEl.replaceChildren(
      ...(items.length
        ? items.map((r) =>
            h('li', { class: 'card', style: { '--card-color': COLORS[r.module] || 'var(--cyan)' } }, h('small', { class: 'tag' }, NAMES[r.module] || r.module), h('p', {}, r.summary), proofLine(r)),
          )
        : [h('li', { class: 'muted center' }, 'Henüz sonuç yok.')]),
    );
  }

  root.append(
    pageHeader('Geçmiş', 'Son 50 sonuç. Koda dokun, kaydı doğrula.', 'history'),
    h('div', { class: 'row wrap' }, select, clearBtn),
    listEl,
  );
  render();
}
