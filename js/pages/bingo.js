import { h, pageHeader, sound, vibrate, sleep, reducedMotion, toast, stepper, confirmButton, proofLine, confetti } from '../ui.js';
import { randomInt, shuffle, sample, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

const MAX = 90;

// Tombala kartı: 3 satır × 9 sütun, 15 sayı; her satırda 5 sayı, her sütunda en az 1 sayı.
// Sütun c: 1–9, 10–19, …, 80–90. Kriptografik RNG ile üretilir.
export function makeCard() {
  let rows;
  do {
    rows = [0, 1, 2].map(() => sample([0, 1, 2, 3, 4, 5, 6, 7, 8], 5));
  } while (![0, 1, 2, 3, 4, 5, 6, 7, 8].every((c) => rows.some((r) => r.includes(c))));
  const grid = [0, 1, 2].map(() => Array(9).fill(null));
  for (let c = 0; c < 9; c++) {
    const lo = c === 0 ? 1 : c * 10;
    const hi = c === 8 ? 90 : c * 10 + 9;
    const rowsWith = [0, 1, 2].filter((r) => rows[r].includes(c));
    const nums = sample(
      Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
      rowsWith.length,
    ).sort((a, b) => a - b);
    rowsWith.forEach((r, k) => (grid[r][c] = nums[k]));
  }
  return grid;
}

export function mount(root) {
  let dead = false;
  let auto = null;
  let busy = false;

  const game = () => store.get().tombala;
  const drawn = () => (game() ? game().order.slice(0, game().idx) : []);

  const ball = h('div', { class: 'ball', 'aria-live': 'assertive' }, h('span', {}, '?'));
  const lastEl = h('div', { class: 'last-balls', 'aria-label': 'Son çekilenler' });
  const progress = h('p', { class: 'center muted small' });
  const commitEl = h('p', { class: 'commit' });
  const board = h('div', { class: 'board', role: 'grid', 'aria-label': 'Tombala tahtası' });
  const cells = Array.from({ length: MAX }, (_, i) => h('span', { class: 'cell', role: 'gridcell' }, String(i + 1)));
  board.append(...cells);

  const drawBtn = h('button', { class: 'btn primary big', onclick: () => drawNext(), html: icons.bingo }, 'Sayı çek');
  const autoBtn = h('button', { class: 'btn', 'aria-pressed': 'false', onclick: () => toggleAuto(), html: icons.timer }, 'Otomatik');
  const speakChk = h('input', {
    type: 'checkbox',
    checked: store.get().settings.speak !== false,
    onchange: (e) => store.update((s) => (s.settings.speak = e.target.checked)),
  });
  let interval = 5;
  const intervalCtl = stepper({ value: interval, min: 2, max: 20, label: 'Otomatik aralık (saniye)', onChange: (v) => (interval = v) });

  let cardCount = 4;
  const cardsEl = h('div', { class: 'cards-print' });

  root.append(
    pageHeader('Tombala', '1–90 torba. Çekiliş sırası baştan mühürlenir.', 'bingo'),
    h('section', { class: 'bingo-top' }, ball, lastEl),
    progress,
    h('div', { class: 'controls row wrap', style: { justifyContent: 'center' } }, drawBtn, autoBtn),
    commitEl,
    board,
    h(
      'details',
      { class: 'panel' },
      h('summary', {}, 'Ayarlar'),
      h('label', { class: 'field check' }, h('span', {}, 'Sayıları sesli oku'), speakChk),
      h('div', { class: 'field' }, h('span', {}, 'Otomatik aralık (sn)'), intervalCtl),
      h('div', { class: 'row wrap' }, confirmButton('Yeni oyun', 'Emin misin? Yeni oyun', () => newGame(true))),
    ),
    h(
      'section',
      { class: 'panel open' },
      h('h2', {}, 'Tombala kartları'),
      h('p', { class: 'muted small' }, 'Her kart 15 sayı: 3 satır, satır başına 5 sayı. Yazdırıp dağıtabilirsin.'),
      h(
        'div',
        { class: 'row wrap' },
        stepper({ value: cardCount, min: 1, max: 12, label: 'Kart sayısı', onChange: (v) => (cardCount = v) }),
        h('button', { class: 'btn', onclick: () => renderCards(), html: icons.shuffle }, 'Kart üret'),
        h('button', { class: 'btn', onclick: () => printCards(), html: icons.print }, 'Yazdır'),
      ),
      cardsEl,
    ),
  );

  async function newGame(manual) {
    stopAuto();
    const order = shuffle(Array.from({ length: MAX }, (_, i) => i + 1));
    const record = await seal('tombala', { range: '1-90' }, order);
    store.update((s) => (s.tombala = { order, idx: 0, record }));
    store.addHistory(record, 'Yeni tombala oyunu başladı');
    ball.replaceChildren(h('span', {}, '?'));
    ball.classList.remove('pop');
    render();
    if (manual) toast('Yeni oyun: torba karıştırıldı');
  }

  function render() {
    const g = game();
    const d = drawn();
    const set = new Set(d);
    cells.forEach((c, i) => {
      c.classList.toggle('on', set.has(i + 1));
      c.classList.toggle('latest', d[d.length - 1] === i + 1);
    });
    lastEl.replaceChildren(...d.slice(-6, -1).reverse().map((n) => h('span', { class: 'mini-ball' }, String(n))));
    progress.textContent = `${d.length} / ${MAX} çekildi`;
    commitEl.replaceChildren(h('span', {}, 'Torba sırası oyun başında mühürlendi'), g?.record ? proofLine(g.record) : '');
    if (d.length && !ball.dataset.n) ball.replaceChildren(h('span', {}, String(d[d.length - 1])));
    drawBtn.disabled = d.length >= MAX;
  }

  function speak(n) {
    if (!speakChk.checked || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(String(n));
    u.lang = 'tr-TR';
    u.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  async function drawNext() {
    if (busy) return;
    const g = game();
    if (!g || g.idx >= MAX) return;
    busy = true;
    const n = g.order[g.idx];
    // Görsel karıştırma; sonuç zaten torba sırasında belli.
    if (!reducedMotion()) {
      ball.classList.add('rolling');
      for (let i = 0; i < 8; i++) {
        ball.replaceChildren(h('span', {}, String(randomInt(1, MAX))));
        sound('tick');
        await sleep(55);
        if (dead) return;
      }
      ball.classList.remove('rolling');
    }
    store.update((s) => s.tombala.idx++);
    ball.dataset.n = n;
    ball.replaceChildren(h('span', {}, String(n)));
    ball.classList.remove('pop');
    void ball.offsetWidth;
    ball.classList.add('pop');
    sound('land');
    vibrate(25);
    speak(n);
    render();
    if (game().idx >= MAX) {
      stopAuto();
      confetti();
      toast('Torba boşaldı');
    }
    busy = false;
  }

  function toggleAuto() {
    if (auto) return stopAuto();
    autoBtn.setAttribute('aria-pressed', 'true');
    autoBtn.innerHTML = `${icons.stop}<span>Durdur</span>`;
    drawNext();
    auto = setInterval(() => drawNext(), interval * 1000);
  }
  function stopAuto() {
    clearInterval(auto);
    auto = null;
    autoBtn.setAttribute('aria-pressed', 'false');
    autoBtn.innerHTML = `${icons.timer}<span>Otomatik</span>`;
  }

  function cardEl(grid, k) {
    return h(
      'div',
      { class: 'bingo-card' },
      h('div', { class: 'bingo-card-head' }, h('b', {}, 'TOMBALA'), h('span', {}, `Kart ${k + 1}`)),
      h('div', { class: 'bingo-grid' }, grid.flat().map((v) => h('span', { class: v ? 'n' : 'x' }, v ?? ''))),
    );
  }
  function renderCards() {
    cardsEl.replaceChildren(...Array.from({ length: cardCount }, (_, k) => cardEl(makeCard(), k)));
  }
  function printCards() {
    if (!cardsEl.children.length) renderCards();
    document.body.classList.add('printing-cards');
    const done = () => {
      document.body.classList.remove('printing-cards');
      removeEventListener('afterprint', done);
    };
    addEventListener('afterprint', done);
    print();
    setTimeout(done, 1000);
  }

  if (!game()) newGame(false);
  else render();
  renderCards();

  return () => {
    dead = true;
    stopAuto();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  };
}
