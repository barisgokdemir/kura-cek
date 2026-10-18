import { h, pageHeader, showResult, sound, sleep, reducedMotion, toast, stepper } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

const PRESETS = [
  ['1–6', 1, 6, 1],
  ['1–10', 1, 10, 1],
  ['1–100', 1, 100, 1],
  ['Loto 6/49', 1, 49, 6],
  ['Loto 6/60', 1, 60, 6],
  ['Loto 6/90', 1, 90, 6],
  ['10/80', 1, 80, 10],
];
const MAX_COUNT = 100;

// Tekrarsız seçimde her sayı eşit olasılıklı: çekilen tekrar gelirse yeniden çekilir.
export function drawNumbers(min, max, count, unique) {
  const out = [];
  const seen = new Set();
  while (out.length < count) {
    const n = randomInt(min, max);
    if (unique && seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function mount(root) {
  const cfg = { min: 1, max: 100, count: 1, unique: true, sorted: false, ...(store.get().numbers || {}) };
  let busy = false;
  let dead = false;
  const persist = () => store.update((s) => (s.numbers = { ...cfg }));

  const minEl = h('input', { type: 'number', inputMode: 'numeric', value: String(cfg.min), 'aria-label': 'En küçük', onchange: (e) => ((cfg.min = Math.trunc(+e.target.value)), persist()) });
  const maxEl = h('input', { type: 'number', inputMode: 'numeric', value: String(cfg.max), 'aria-label': 'En büyük', onchange: (e) => ((cfg.max = Math.trunc(+e.target.value)), persist()) });
  const countCtl = stepper({ value: cfg.count, min: 1, max: MAX_COUNT, label: 'Kaç sayı', onChange: (v) => ((cfg.count = v), persist()) });
  const uniqueChk = h('input', { type: 'checkbox', checked: cfg.unique, onchange: (e) => ((cfg.unique = e.target.checked), persist()) });
  const sortedChk = h('input', { type: 'checkbox', checked: cfg.sorted, onchange: (e) => ((cfg.sorted = e.target.checked), persist()) });

  const display = h('div', { class: 'num-display', 'aria-live': 'polite' }, h('span', { class: 'num-big' }, '?'));
  const resultSlot = h('div');
  const drawBtn = h('button', { class: 'btn primary big', onclick: () => draw(), html: icons.hash }, 'Sayı çek');

  root.append(
    pageHeader('Rastgele Sayı', 'Aralık seç, kaç sayı istediğini yaz.', 'hash'),
    display,
    h('div', { class: 'controls' }, drawBtn),
    resultSlot,
    h(
      'section',
      { class: 'panel open' },
      h('div', { class: 'chips' }, PRESETS.map(([label, a, b, c]) => h('button', { class: 'chip', onclick: () => preset(a, b, c) }, label))),
      h('div', { class: 'fields-2' }, h('label', { class: 'field' }, h('span', {}, 'En küçük'), minEl), h('label', { class: 'field' }, h('span', {}, 'En büyük'), maxEl)),
      h('div', { class: 'field' }, h('span', {}, 'Kaç sayı'), countCtl),
      h('label', { class: 'field check' }, h('span', {}, 'Tekrarsız (aynı sayı iki kez gelmesin)'), uniqueChk),
      h('label', { class: 'field check' }, h('span', {}, 'Küçükten büyüğe sırala'), sortedChk),
    ),
  );

  function preset(a, b, c) {
    Object.assign(cfg, { min: a, max: b, count: c, unique: true, sorted: c > 1 });
    minEl.value = a;
    maxEl.value = b;
    countCtl.set(c);
    uniqueChk.checked = true;
    sortedChk.checked = c > 1;
    persist();
  }

  async function draw() {
    if (busy) return;
    let { min, max, count, unique, sorted } = cfg;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return toast('Geçerli sayılar gir');
    if (min > max) [min, max] = [max, min];
    const range = max - min + 1;
    if (range > 2 ** 32) return toast('Aralık en fazla 4 milyar sayı olabilir');
    if (unique && count > range) return toast(`Bu aralıkta en fazla ${range} farklı sayı var`);
    busy = true;
    drawBtn.disabled = true;
    resultSlot.replaceChildren();
    try {
      const drawn = drawNumbers(min, max, count, unique);
      const shown = sorted ? [...drawn].sort((a, b) => a - b) : drawn;
      const record = await seal('rastgele-sayi', { min, max, count, unique, sorted }, drawn);
      const slow = !reducedMotion();
      if (count === 1) {
        const big = h('span', { class: 'num-big' });
        display.replaceChildren(big);
        if (slow) {
          for (let i = 0; i < 14; i++) {
            big.textContent = fmt(randomInt(min, max));
            sound('tick');
            await sleep(40 + i * 6);
            if (dead) return;
          }
        }
        big.textContent = fmt(shown[0]);
        big.classList.add('pop');
      } else {
        const balls = h('div', { class: 'num-balls' });
        display.replaceChildren(balls);
        for (const n of shown) {
          balls.append(h('span', { class: 'num-ball' }, fmt(n)));
          if (slow) {
            sound('tick');
            await sleep(Math.max(40, 260 - count * 6));
            if (dead) return;
          }
        }
      }
      sound('land');
      store.addHistory(record, `${fmt(min)}–${fmt(max)}: ${shown.map(fmt).join(', ')}`);
      showResult(resultSlot, {
        title: count === 1 ? `${fmt(min)}–${fmt(max)} arası` : `${count} sayı · ${fmt(min)}–${fmt(max)}`,
        big: count === 1 ? fmt(shown[0]) : shown.slice(0, 12).map(fmt).join(' · ') + (count > 12 ? ' …' : ''),
        detail: [unique && count > 1 ? 'tekrarsız' : null, sorted && count > 1 ? 'sıralı' : null].filter(Boolean).join(' · ') || null,
        record,
        onAgain: draw,
        againLabel: 'Tekrar çek',
      });
      if (count > 1) {
        resultSlot.querySelector('.result .row')?.append(
          h('button', { class: 'btn', html: icons.copy, onclick: () => copy(shown.join(', ')) }, 'Kopyala'),
        );
      }
    } finally {
      busy = false;
      drawBtn.disabled = false;
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Sayılar kopyalandı');
    } catch {
      toast('Kopyalanamadı');
    }
  }

  return () => {
    dead = true;
  };
}

const fmt = (n) => n.toLocaleString('tr-TR');
