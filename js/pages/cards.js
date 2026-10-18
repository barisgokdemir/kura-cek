import { h, pageHeader, showResult, sound, sleep, reducedMotion, toast, stepper, parseLines, proofLine } from '../ui.js';
import { shuffle, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

export const SUITS = {
  S: { name: 'Maça', red: false, path: 'M16 3C10 10 4 14 4 19.5A5.5 5.5 0 0 0 14.5 22c-.3 2.6-1.3 4.8-3.5 6.5h10c-2.2-1.7-3.2-3.9-3.5-6.5A5.5 5.5 0 0 0 28 19.5C28 14 22 10 16 3z' },
  H: { name: 'Kupa', red: true, path: 'M16 28C7 21 3 16.5 3 11.5A6.5 6.5 0 0 1 16 8.5 6.5 6.5 0 0 1 29 11.5C29 16.5 25 21 16 28z' },
  D: { name: 'Karo', red: true, path: 'M16 3l10 13-10 13L6 16z' },
  C: {
    name: 'Sinek',
    red: false,
    path: 'M16 4a6 6 0 0 1 5.6 8.2A6 6 0 1 1 18 22.6c.4 2.3 1.4 4.3 3 5.9H11c1.6-1.6 2.6-3.6 3-5.9a6 6 0 1 1-3.6-10.4A6 6 0 0 1 16 4z',
  },
};
// Yüksek kart karşılaştırmasında eşit değerde renk sırası: maça > kupa > karo > sinek
const SUIT_ORDER = ['C', 'D', 'H', 'S'];
const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const RANK_NAME = { 1: 'As', 11: 'Vale', 12: 'Kız', 13: 'Papaz' };

export const fullDeck = (jokers) => [
  ...Object.keys(SUITS).flatMap((s) => Array.from({ length: 13 }, (_, i) => `${s}${i + 1}`)),
  ...(jokers ? ['J1', 'J2'] : []),
];
export const parseCard = (id) => (id[0] === 'J' && id.length === 2 ? { joker: true } : { suit: id[0], rank: +id.slice(1) });
export function cardName(id) {
  const c = parseCard(id);
  return c.joker ? 'Joker' : `${SUITS[c.suit].name} ${RANK_NAME[c.rank] || c.rank}`;
}
// As en yüksek; eşitlikte renk sırası.
export const cardScore = (id) => {
  const c = parseCard(id);
  return (c.rank === 1 ? 14 : c.rank) * 4 + SUIT_ORDER.indexOf(c.suit);
};

const suitSvg = (s) => `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${SUITS[s].path}" fill="currentColor"/></svg>`;

export function cardEl(id) {
  const c = parseCard(id);
  const front = c.joker
    ? h('div', { class: 'pc-face front joker' }, h('span', { class: 'pc-joker', html: icons.star }), h('b', {}, 'JOKER'))
    : h(
        'div',
        { class: `pc-face front${SUITS[c.suit].red ? ' red' : ''}` },
        h('span', { class: 'pc-corner tl' }, h('b', {}, RANK_LABEL[c.rank] || String(c.rank)), h('span', { html: suitSvg(c.suit) })),
        h('span', { class: 'pc-center', html: c.rank > 10 ? '' : suitSvg(c.suit) }, c.rank > 10 ? RANK_LABEL[c.rank] : ''),
        h('span', { class: 'pc-corner br' }, h('b', {}, RANK_LABEL[c.rank] || String(c.rank)), h('span', { html: suitSvg(c.suit) })),
      );
  return h('div', { class: 'pcard', role: 'img', 'aria-label': cardName(id) }, h('div', { class: 'pc-face back' }), front);
}

export function mount(root) {
  const cfg = { mode: 'draw', n: 1, jokers: false, names: '', ...(store.get().cardsCfg || {}) };
  const persist = () => store.update((s) => (s.cardsCfg = { ...cfg }));
  const deck = () => store.get().deck;
  let busy = false;
  let dead = false;

  const table = h('div', { class: 'card-table' });
  const info = h('p', { class: 'center muted small deck-info' });
  const resultSlot = h('div');
  const drawBtn = h('button', { class: 'btn primary big', onclick: () => go(), html: icons.cards }, 'Kart çek');
  const shuffleBtn = h('button', { class: 'btn', onclick: () => newDeck(true), html: icons.shuffle }, 'Desteyi karıştır');
  const nField = h(
    'div',
    { class: 'field' },
    h('span', {}, 'Kaç kart'),
    stepper({ value: cfg.n, min: 1, max: 10, label: 'Kaç kart', onChange: (v) => ((cfg.n = v), persist()) }),
  );
  const namesField = h(
    'label',
    { class: 'field col' },
    h('span', {}, 'Oyuncular'),
    h('textarea', { rows: 4, value: cfg.names, placeholder: 'Her satıra bir isim (en az 2)', oninput: (e) => ((cfg.names = e.target.value), persist()) }),
  );
  const jokerChk = h('input', { type: 'checkbox', checked: cfg.jokers, onchange: (e) => ((cfg.jokers = e.target.checked), persist(), newDeck(true)) });
  const modeCtl = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'Mod' },
    [
      ['draw', 'Desteden çek'],
      ['high', 'Yüksek kart kazanır'],
    ].map(([id, label]) =>
      h('button', { role: 'radio', 'aria-checked': String(cfg.mode === id), 'data-id': id, onclick: () => setMode(id) }, label),
    ),
  );

  root.append(
    pageHeader('İskambil Kartı', 'Karıştırılmış desteden çek; destenin sırası mühürlenir.', 'cards'),
    h('div', { class: 'rps-mode' }, modeCtl),
    table,
    info,
    h('div', { class: 'controls row wrap', style: { justifyContent: 'center' } }, drawBtn, shuffleBtn),
    resultSlot,
    h('section', { class: 'panel open' }, nField, namesField, h('label', { class: 'field check' }, h('span', {}, 'Desteye 2 joker ekle'), jokerChk)),
  );

  function setMode(id) {
    cfg.mode = id;
    persist();
    modeCtl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
    syncUi();
  }
  function syncUi() {
    const high = cfg.mode === 'high';
    nField.hidden = high;
    namesField.hidden = !high;
    shuffleBtn.hidden = high;
    drawBtn.lastChild.textContent = high ? 'Herkes çeksin' : 'Kart çek';
    renderInfo();
  }
  function renderInfo() {
    const d = deck();
    if (cfg.mode === 'high') info.textContent = 'Her tur yeni karıştırılmış desteden herkes birer kart çeker. As en yüksek.';
    else info.replaceChildren(`Destede ${d.order.length - d.idx} kart kaldı · `, proofLine(d.record));
  }

  async function newDeck(manual) {
    const order = shuffle(fullDeck(cfg.jokers));
    const record = await seal('iskambil', { jokers: cfg.jokers }, order);
    store.update((s) => (s.deck = { order, idx: 0, record }));
    if (manual) {
      store.addHistory(record, `Deste karıştırıldı (${order.length} kart)`);
      table.replaceChildren();
      resultSlot.replaceChildren();
      toast('Deste karıştırıldı');
      sound('roll');
    }
    renderInfo();
  }

  async function flipIn(ids, labels) {
    table.replaceChildren(
      ...ids.map((id, i) => h('div', { class: 'pc-slot' }, cardEl(id), labels ? h('span', { class: 'pc-label' }, labels[i]) : '')),
    );
    const slow = !reducedMotion();
    for (const c of table.querySelectorAll('.pcard')) {
      if (slow) await sleep(Math.max(120, 380 - ids.length * 25));
      if (dead) return;
      c.classList.add('flipped');
      sound('tick');
    }
    if (slow) await sleep(450);
  }

  async function go() {
    if (busy) return;
    resultSlot.replaceChildren();
    if (cfg.mode === 'high') return high();
    const d = deck();
    const left = d.order.length - d.idx;
    if (left < cfg.n) return toast(left ? `Destede ${left} kart kaldı; karıştır ya da daha az çek` : 'Deste bitti, karıştır');
    busy = true;
    drawBtn.disabled = true;
    try {
      const ids = d.order.slice(d.idx, d.idx + cfg.n);
      store.update((s) => (s.deck.idx += cfg.n));
      await flipIn(ids);
      if (dead) return;
      renderInfo();
      const names = ids.map(cardName);
      store.addHistory(d.record, `Çekilen: ${names.join(', ')}`);
      showResult(resultSlot, {
        title: ids.length > 1 ? `${ids.length} kart` : 'Çekilen kart',
        big: names.join(' · '),
        detail: `Destede ${d.order.length - deck().idx} kart kaldı`,
        record: d.record,
        onAgain: go,
        againLabel: 'Bir daha çek',
      });
    } finally {
      busy = false;
      drawBtn.disabled = false;
    }
  }

  async function high() {
    const people = parseLines(cfg.names).slice(0, 26);
    if (people.length < 2) return toast('En az iki oyuncu yaz');
    busy = true;
    drawBtn.disabled = true;
    try {
      const order = shuffle(fullDeck(false));
      const hands = people.map((_, i) => order[i]);
      const best = hands.reduce((b, id, i) => (cardScore(id) > cardScore(hands[b]) ? i : b), 0);
      const record = await seal('iskambil', { mode: 'high', people }, hands.map((id, i) => `${people[i]}: ${cardName(id)}`));
      await flipIn(hands, people);
      if (dead) return;
      table.children[best]?.classList.add('best');
      store.addHistory(record, `Yüksek kart: ${people[best]} (${cardName(hands[best])})`);
      showResult(resultSlot, {
        title: 'Yüksek kart',
        big: people[best],
        detail: `${cardName(hands[best])} · eşit değerde maça > kupa > karo > sinek`,
        record,
        onAgain: high,
        againLabel: 'Yeni tur',
        celebrate: true,
      });
    } finally {
      busy = false;
      drawBtn.disabled = false;
    }
  }

  if (!deck() || (deck().order.length === 54) !== cfg.jokers) newDeck(false).then(syncUi);
  else syncUi();

  return () => {
    dead = true;
  };
}
