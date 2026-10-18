import { h, pageHeader, showResult, sound, sleep, reducedMotion, toast } from '../ui.js';
import { randomInt, sample, shuffle, seal } from '../rng.js';
import * as store from '../store.js';
import { easeOutQuart } from '../three/stage.js';

export const meta = { route: 'liste', title: 'Custom Liste', icon: '📝' };

export const TEMPLATES = [
  { name: 'Ne yesek?', items: ['Makarna', 'Tantuni', 'Pizza', 'Hamburger', 'Döner', 'Lahmacun', 'Mantı', 'Köfte'] },
  { name: 'Kim hesabı öder?', items: ['Ali', 'Ayşe', 'Mehmet', 'Zeynep'] },
  { name: 'Hafta sonu ne yapsak?', items: ['Sinema', 'Piknik', 'Müze', 'Evde film', 'Kahvaltıya çık', 'Doğa yürüyüşü'] },
  { name: 'Hangi film?', items: ['Komedi', 'Aksiyon', 'Bilim kurgu', 'Dram', 'Korku', 'Animasyon'] },
  { name: 'Kim çay demler?', items: ['Ali', 'Ayşe', 'Mehmet', 'Zeynep'] },
];

const MODES = [
  { id: 'one', label: 'Tek sonuç' },
  { id: 'n', label: 'N sonuç' },
  { id: 'all', label: 'Tümünü sırala' },
];

const COLORS = ['#ff5a5f', '#ffb400', '#00a699', '#7b61ff', '#2bb3ff', '#ff8a00', '#e84393', '#20bf6b'];

export function newList(name = 'Yeni liste', items = []) {
  return { id: store.uid(), name, items, mode: 'one', n: 2, fav: false, updated: Date.now() };
}

export function mount(root, params) {
  return params.id ? mountEditor(root, params.id) : mountIndex(root);
}

function mountIndex(root) {
  const lists = store.get().lists;
  const create = (tpl) => {
    const list = newList(tpl?.name, tpl ? [...tpl.items] : []);
    store.saveList(list);
    location.hash = `#/liste/${list.id}`;
  };
  root.append(
    ...[
      pageHeader('Custom Liste', 'Seçeneklerini yaz; tek sonuç, birkaç sonuç ya da tüm listeyi karıştır.'),
      h('div', { class: 'controls' }, h('button', { class: 'btn primary big', onclick: () => create() }, '+ Yeni liste')),
      lists.length
        ? h(
            'section',
            {},
            h('h2', {}, 'Listelerim'),
            h(
              'ul',
              { class: 'list-cards' },
              lists.map((l) =>
                h(
                  'li',
                  {},
                  h(
                    'a',
                    { href: `#/liste/${l.id}`, class: 'card row' },
                    h(
                      'span',
                      { class: 'grow' },
                      h('b', {}, l.fav ? '★ ' : '', l.name),
                      h('small', { class: 'muted' }, ` · ${l.items.length} seçenek`),
                    ),
                    '›',
                  ),
                ),
              ),
            ),
          )
        : null,
      h(
        'section',
        {},
        h('h2', {}, 'Şablonlar'),
        h(
          'div',
          { class: 'chips' },
          TEMPLATES.map((t) => h('button', { class: 'chip', onclick: () => create(t) }, t.name)),
        ),
      ),
    ].filter(Boolean),
  );
}

function mountEditor(root, id) {
  const list = store.get().lists.find((l) => l.id === id);
  if (!list) {
    root.append(pageHeader('Liste bulunamadı'), h('p', {}, h('a', { href: '#/liste' }, 'Listelere dön')));
    return;
  }
  let busy = false;
  let dead = false;

  const persist = () => {
    list.updated = Date.now();
    store.saveList(list);
  };

  const items = () => list.items.filter((s) => s.trim());

  const nameEl = h('input', {
    class: 'title-input',
    type: 'text',
    value: list.name,
    'aria-label': 'Liste adı',
    oninput: (e) => {
      list.name = e.target.value.trim() || 'Liste';
      persist();
    },
  });
  const favBtn = h(
    'button',
    {
      class: 'btn icon',
      'aria-pressed': String(list.fav),
      title: 'Favori',
      onclick: () => {
        list.fav = !list.fav;
        favBtn.setAttribute('aria-pressed', String(list.fav));
        favBtn.textContent = list.fav ? '★' : '☆';
        persist();
      },
    },
    list.fav ? '★' : '☆',
  );

  const itemsEl = h('textarea', {
    rows: 6,
    value: list.items.join('\n'),
    placeholder: 'Her satıra bir seçenek',
    'aria-label': 'Seçenekler',
    oninput: (e) => {
      list.items = e.target.value
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      persist();
      drawWheel(0);
      syncN();
    },
  });

  const nEl = h('input', {
    type: 'number',
    min: 1,
    value: String(list.n),
    'aria-label': 'Kaç sonuç',
    oninput: (e) => {
      list.n = Math.max(1, +e.target.value || 1);
      persist();
    },
  });
  const nField = h('label', { class: 'field' }, h('span', {}, 'Kaç sonuç (tekrarsız)'), nEl);
  const syncN = () => {
    nEl.max = Math.max(1, items().length);
    nField.hidden = list.mode !== 'n';
  };

  const modeCtl = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'Mod' },
    MODES.map((m) =>
      h(
        'button',
        {
          role: 'radio',
          'aria-checked': String(m.id === list.mode),
          'data-id': m.id,
          onclick: () => {
            list.mode = m.id;
            modeCtl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === m.id)));
            persist();
            syncN();
            showView();
          },
        },
        m.label,
      ),
    ),
  );

  const canvas = h('canvas', { class: 'wheel', width: 640, height: 640, 'aria-hidden': 'true' });
  const wheelWrap = h('div', { class: 'wheel-wrap' }, canvas, h('div', { class: 'wheel-pointer', 'aria-hidden': 'true' }));
  const cardsEl = h('ol', { class: 'reveal-cards' });
  const view = h('div', { class: 'list-view' });
  const resultSlot = h('div');
  const drawBtn = h('button', { class: 'btn primary big', onclick: () => draw() }, 'Kura çek');

  root.append(
    h(
      'header',
      { class: 'page-head' },
      h('a', { class: 'back', href: '#/liste', 'aria-label': 'Listeler' }, '←'),
      nameEl,
      favBtn,
    ),
    view,
    h('div', { class: 'controls' }, drawBtn),
    resultSlot,
    h(
      'section',
      { class: 'panel open' },
      h('div', { class: 'field' }, h('span', {}, 'Mod'), modeCtl),
      nField,
      h('label', { class: 'field col' }, h('span', {}, 'Seçenekler'), itemsEl),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            class: 'btn danger',
            onclick: (e) => {
              if (e.target.dataset.sure) {
                store.deleteList(list.id);
                location.hash = '#/liste';
              } else {
                e.target.dataset.sure = '1';
                e.target.textContent = 'Emin misin? Sil';
              }
            },
          },
          'Listeyi sil',
        ),
      ),
    ),
  );

  function showView() {
    view.replaceChildren(list.mode === 'one' ? wheelWrap : cardsEl);
    cardsEl.replaceChildren();
    if (list.mode === 'one') drawWheel(rotation);
  }

  // ---------- Çark ----------
  let rotation = 0;
  function drawWheel(rot) {
    const opts = items();
    const c = canvas.getContext('2d');
    const S = canvas.width;
    const r = S / 2 - 8;
    c.clearRect(0, 0, S, S);
    c.save();
    c.translate(S / 2, S / 2);
    if (!opts.length) {
      c.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted') || '#888';
      c.font = '600 28px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText('Seçenek ekle', 0, 10);
      c.restore();
      return;
    }
    const seg = (Math.PI * 2) / opts.length;
    opts.forEach((label, i) => {
      // Dilim i, -π/2 (tepe) açısından başlar ve saat yönünde ilerler.
      const a0 = rot - Math.PI / 2 + i * seg;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, r, a0, a0 + seg);
      c.closePath();
      c.fillStyle = COLORS[i % COLORS.length];
      if (opts.length % COLORS.length === 1 && i === opts.length - 1) c.fillStyle = COLORS[3];
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.7)';
      c.lineWidth = 3;
      c.stroke();
      c.save();
      c.rotate(a0 + seg / 2);
      c.fillStyle = '#fff';
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      const size = Math.max(14, Math.min(34, 320 / Math.max(opts.length, 6) + 10));
      c.font = `700 ${size}px system-ui, sans-serif`;
      let text = label;
      while (c.measureText(text).width > r * 0.72 && text.length > 3) text = text.slice(0, -2) + '…';
      c.fillText(text, r - 22, 0);
      c.restore();
    });
    c.beginPath();
    c.arc(0, 0, 34, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
    c.restore();
  }

  // Kazanan önce belirlenir; çark, işaretçi o dilimin içinde duracak şekilde döndürülür.
  async function spinTo(index, count) {
    const seg = (Math.PI * 2) / count;
    // Dilim içinde kenarlara yakın olmayan bir nokta.
    const within = (randomInt(15, 85) / 100) * seg;
    // İşaretçi tepede: dönüş rot iken tepedeki açı, dilim başlangıcından -rot kadar ileride.
    const targetMod = (Math.PI * 2 - (index * seg + within)) % (Math.PI * 2);
    const startMod = rotation % (Math.PI * 2);
    const extra = (targetMod - startMod + Math.PI * 2) % (Math.PI * 2);
    const turns = reducedMotion() ? 0 : 5 + randomInt(0, 2);
    const from = rotation;
    const to = rotation + turns * Math.PI * 2 + extra;
    const duration = reducedMotion() ? 400 : 4200;
    let lastSeg = -1;
    await new Promise((resolve) => {
      const t0 = performance.now();
      const frame = (now) => {
        if (dead) return resolve();
        const t = Math.min(1, (now - t0) / duration);
        rotation = from + (to - from) * easeOutQuart(t);
        drawWheel(rotation);
        const pointerSeg = Math.floor(((Math.PI * 2 - (rotation % (Math.PI * 2))) % (Math.PI * 2)) / seg);
        if (pointerSeg !== lastSeg) {
          lastSeg = pointerSeg;
          sound('tick');
        }
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    rotation = to % (Math.PI * 2);
  }

  async function revealCards(order) {
    cardsEl.replaceChildren(
      ...order.map((item) =>
        h('li', { class: 'flip-card' }, h('div', { class: 'face back' }, '?'), h('div', { class: 'face front' }, item)),
      ),
    );
    const slow = !reducedMotion();
    for (const li of cardsEl.children) {
      if (dead) return;
      if (slow) await sleep(Math.max(120, 520 - order.length * 25));
      li.classList.add('flipped');
      sound('tick');
    }
  }

  async function draw() {
    if (busy) return;
    const opts = items();
    if (opts.length < 2) return toast('En az iki seçenek gir');
    busy = true;
    drawBtn.disabled = true;
    resultSlot.replaceChildren();
    try {
      if (list.mode === 'one') {
        const index = randomInt(0, opts.length - 1);
        const record = await seal('liste', { list: list.name, items: opts, mode: 'one' }, opts[index]);
        await spinTo(index, opts.length);
        if (dead) return;
        store.addHistory(record, `${list.name} → ${opts[index]}`);
        showResult(resultSlot, {
          title: list.name,
          big: opts[index],
          record,
          onAgain: draw,
          againLabel: 'Tekrar çevir',
          celebrate: true,
        });
      } else {
        const n = list.mode === 'n' ? Math.min(list.n, opts.length) : opts.length;
        const order = list.mode === 'n' ? sample(opts, n) : shuffle(opts);
        const record = await seal('liste', { list: list.name, items: opts, mode: list.mode, n }, order);
        await revealCards(order);
        if (dead) return;
        store.addHistory(record, `${list.name} → ${order.join(', ')}`);
        showResult(resultSlot, {
          title: list.mode === 'n' ? `${list.name} — ${n} sonuç` : `${list.name} — sıralama`,
          big: list.mode === 'n' ? order.join(', ') : `1. ${order[0]}`,
          detail:
            list.mode === 'all'
              ? h(
                  'ol',
                  {},
                  order.map((o) => h('li', {}, o)),
                )
              : null,
          record,
          onAgain: draw,
          againLabel: 'Tekrar çek',
          celebrate: true,
        });
      }
    } finally {
      busy = false;
      drawBtn.disabled = false;
    }
  }

  syncN();
  showView();
  if (!list.items.length) itemsEl.focus();

  return () => {
    dead = true;
  };
}
