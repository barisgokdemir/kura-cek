import { h, pageHeader, showResult, toast, stepper, parseLines, sound, sleep, reducedMotion } from '../ui.js';
import { shuffle, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';
import { parseExclusions } from './gift.js';

// Sınıf: satır satır doldurulur; yan yana = aynı satırda komşu sütun.
// Masa: kişiler masalara sırayla dağıtılır (masa boyları en fazla 1 farklı); yan yana = aynı masa.
export function arrange(people, layout, size, exclusions) {
  const key = (a, b) => `${a}|${b}`;
  const banned = new Set();
  exclusions.forEach(([a, b]) => (banned.add(key(a, b)), banned.add(key(b, a))));
  const ok = (groups) =>
    groups.every((g) =>
      layout === 'tables'
        ? g.every((a, i) => g.slice(i + 1).every((b) => !banned.has(key(a, b))))
        : g.every((a, i) => i === 0 || !banned.has(key(g[i - 1], a))),
    );
  const split = (order) => {
    if (layout === 'rows') return Array.from({ length: Math.ceil(order.length / size) }, (_, r) => order.slice(r * size, r * size + size));
    const tables = Math.ceil(order.length / size);
    const groups = Array.from({ length: tables }, () => []);
    order.forEach((p, i) => groups[i % tables].push(p));
    return groups;
  };
  for (let t = 0; t < 20000; t++) {
    const groups = split(shuffle(people));
    if (ok(groups)) return groups;
  }
  return null;
}

export function mount(root) {
  const st = store.get().seating || {};
  const cfg = { title: 'Oturma planı', names: '', excl: '', layout: 'rows', cols: 4, pairs: true, size: 6, ...(st.cfg || {}) };
  const persist = () => store.update((s) => (s.seating = { ...(s.seating || {}), cfg: { ...cfg } }));
  let dead = false;

  const out = h('div');
  const resultSlot = h('div');
  const field = (key, attrs) =>
    h(attrs.rows ? 'textarea' : 'input', { type: 'text', ...attrs, value: cfg[key], oninput: (e) => ((cfg[key] = e.target.value), persist()) });
  const colsField = h(
    'div',
    { class: 'field' },
    h('span', {}, 'Bir sıradaki kişi'),
    stepper({ value: cfg.cols, min: 2, max: 10, label: 'Sütun sayısı', onChange: (v) => ((cfg.cols = v), persist()) }),
  );
  const pairsField = h(
    'label',
    { class: 'field check' },
    h('span', {}, 'İkişerli sıralar (sınıf düzeni)'),
    h('input', { type: 'checkbox', checked: cfg.pairs, onchange: (e) => ((cfg.pairs = e.target.checked), persist()) }),
  );
  const sizeField = h(
    'div',
    { class: 'field' },
    h('span', {}, 'Masa başına kişi'),
    stepper({ value: cfg.size, min: 2, max: 12, label: 'Masa başına kişi', onChange: (v) => ((cfg.size = v), persist()) }),
  );
  const layoutCtl = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'Düzen' },
    [
      ['rows', 'Sınıf (sıralar)'],
      ['tables', 'Masalar'],
    ].map(([id, text]) =>
      h('button', { role: 'radio', 'aria-checked': String(cfg.layout === id), 'data-id': id, onclick: () => setLayout(id) }, text),
    ),
  );

  root.append(
    pageHeader('Oturma Planı', 'Sınıf, düğün, toplantı: kim nereye otursun?', 'seats'),
    h(
      'section',
      { class: 'panel open' },
      h('label', { class: 'field col' }, h('span', {}, 'Başlık'), field('title', { maxLength: 60 })),
      h('label', { class: 'field col' }, h('span', {}, 'Kişiler'), field('names', { rows: 6, placeholder: 'Her satıra bir isim' })),
      h('div', { class: 'field col' }, h('span', {}, 'Düzen'), layoutCtl),
      colsField,
      pairsField,
      sizeField,
      h(
        'label',
        { class: 'field col' },
        h('span', {}, 'Yan yana oturmasın (isteğe bağlı)'),
        field('excl', { rows: 2, placeholder: 'Ali - Veli\nAyşe - Zeynep' }),
      ),
      h('button', { class: 'btn primary big block', onclick: () => build(), html: icons.shuffle }, 'Yerleri dağıt'),
    ),
    resultSlot,
    out,
  );

  function setLayout(id) {
    cfg.layout = id;
    persist();
    layoutCtl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
    sync();
  }
  function sync() {
    colsField.hidden = cfg.layout !== 'rows';
    pairsField.hidden = cfg.layout !== 'rows';
    sizeField.hidden = cfg.layout !== 'tables';
  }

  async function build() {
    const people = [...new Set(parseLines(cfg.names))];
    if (people.length < 2) return toast('En az iki kişi yaz');
    const excl = parseExclusions(cfg.excl);
    const size = cfg.layout === 'rows' ? cfg.cols : cfg.size;
    const groups = arrange(people, cfg.layout, size, excl);
    if (!groups) return toast('Bu kısıtlarla uygun bir yerleşim bulunamadı');
    const record = await seal('oturma-plani', { people, layout: cfg.layout, size, exclusions: excl }, groups);
    const plan = { title: cfg.title, layout: cfg.layout, cols: cfg.cols, pairs: cfg.pairs, groups, record };
    store.update((s) => (s.seating = { cfg: { ...cfg }, plan }));
    store.addHistory(record, `${cfg.title || 'Oturma planı'}: ${people.length} kişi, ${cfg.layout === 'rows' ? `${groups.length} sıra` : `${groups.length} masa`}`);
    sound('win');
    await render(plan, true);
  }

  async function render(plan, fresh) {
    const cells = [];
    let body;
    if (plan.layout === 'rows') {
      body = h(
        'div',
        { class: 'classroom' },
        h('div', { class: 'board-bar' }, 'TAHTA'),
        plan.groups.map((row, r) =>
          h(
            'div',
            { class: `class-row${plan.pairs ? ' pairs' : ''}`, style: { '--cols': plan.cols } },
            Array.from({ length: plan.cols }, (_, c) => {
              const name = row[c];
              const el = h('span', { class: `seat-cell${name ? '' : ' empty'}`, title: name ? `${r + 1}. sıra, ${c + 1}. koltuk` : '' }, name || '');
              if (name) cells.push(el);
              return el;
            }),
          ),
        ),
      );
    } else {
      body = h(
        'div',
        { class: 'tables-grid' },
        plan.groups.map((g, t) =>
          h(
            'section',
            { class: 'table-card' },
            h('header', {}, h('b', {}, `Masa ${t + 1}`), h('span', { class: 'muted small' }, `${g.length} kişi`)),
            h(
              'div',
              { class: 'table-seats' },
              g.map((name) => {
                const el = h('span', { class: 'seat-cell' }, name);
                cells.push(el);
                return el;
              }),
            ),
          ),
        ),
      );
    }
    out.replaceChildren(
      h(
        'section',
        { class: 'seating' },
        h('div', { class: 'duty-head' }, h('b', {}, plan.title || 'Oturma planı'), h('span', { class: 'muted small' }, `${cells.length} kişi`)),
        h('div', { class: 'seating-scroll' }, body),
        h('div', { class: 'row wrap', style: { marginTop: '12px' } }, h('button', { class: 'btn', html: icons.print, onclick: printPlan }, 'Yazdır')),
      ),
    );
    if (fresh && !reducedMotion()) {
      cells.forEach((c) => c.classList.add('hide'));
      for (const c of shuffle(cells)) {
        c.classList.remove('hide');
        c.classList.add('pop');
        await sleep(Math.max(25, 160 - cells.length * 3));
        if (dead) return;
      }
    }
    if (fresh) {
      showResult(resultSlot, {
        title: plan.title || 'Oturma planı',
        big: plan.layout === 'rows' ? `${plan.groups.length} sıra hazır` : `${plan.groups.length} masa hazır`,
        detail: 'Yerler kriptografik rastgelelikle dağıtıldı',
        record: plan.record,
        onAgain: build,
        againLabel: 'Yeniden dağıt',
      });
    }
  }

  function printPlan() {
    document.body.classList.add('printing-duty');
    const done = () => {
      document.body.classList.remove('printing-duty');
      removeEventListener('afterprint', done);
    };
    addEventListener('afterprint', done);
    print();
    setTimeout(done, 1000);
  }

  sync();
  if (st.plan) render(st.plan, false);
  return () => {
    dead = true;
  };
}
