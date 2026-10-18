import { h, pageHeader, toast } from '../ui.js';
import * as store from '../store.js';
import { applyTheme } from '../app.js';

export function mount(root) {
  const s = store.get().settings;
  const set = (k, v) => {
    store.update((st) => (st.settings[k] = v));
    if (k === 'theme') applyTheme();
  };

  const select = (key, label, options) =>
    h(
      'label',
      { class: 'field' },
      h('span', {}, label),
      h(
        'select',
        { value: s[key], onchange: (e) => set(key, e.target.value) },
        options.map(([v, t]) => h('option', { value: v }, t)),
      ),
    );
  const toggle = (key, label) =>
    h('label', { class: 'field check' }, h('input', { type: 'checkbox', checked: s[key], onchange: (e) => set(key, e.target.checked) }), h('span', {}, label));

  const fileEl = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        store.importJSON(await file.text());
        applyTheme();
        toast('Yedek içe aktarıldı');
        location.hash = '#/';
      } catch (err) {
        toast(err.message || 'Dosya okunamadı');
      }
    },
  });

  function exportData() {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `kura-cek-yedek-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  root.append(
    pageHeader('Ayarlar', 'Tema, ses, animasyon ve veriler.', 'settings'),
    h(
      'section',
      { class: 'panel open' },
      select('theme', 'Tema', [['dark', 'Koyu'], ['light', 'Açık'], ['auto', 'Sistem']]),
      select('motion', 'Animasyon', [['auto', 'Sistem tercihine uy'], ['full', 'Tam (3D)'], ['reduce', 'Azaltılmış (2D)']]),
      toggle('sound', 'Ses'),
      toggle('vibrate', 'Titreşim (Android)'),
    ),
    h(
      'section',
      { class: 'panel open' },
      h('h2', {}, 'Veri'),
      h('p', { class: 'muted' }, 'Listeler, ayarlar ve geçmiş yalnızca bu cihazda saklanır.'),
      h(
        'div',
        { class: 'row wrap' },
        h('button', { class: 'btn', onclick: exportData }, 'Dışa aktar (JSON)'),
        h('button', { class: 'btn', onclick: () => fileEl.click() }, 'İçe aktar'),
        fileEl,
        h('button', {
          class: 'btn danger',
          onclick: (e) => {
            if (!e.target.dataset.sure) {
              e.target.dataset.sure = '1';
              e.target.textContent = 'Emin misin? Her şey silinecek';
              return;
            }
            store.reset();
            applyTheme();
            toast('Tüm veriler silindi');
            location.hash = '#/';
          },
        }, 'Tüm verileri sil'),
      ),
    ),
  );
}
