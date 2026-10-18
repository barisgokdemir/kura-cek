import { h, pageHeader, sound, vibrate, sleep, reducedMotion, toast, stepper, confirmButton, proofLine, confetti, share } from '../ui.js';
import { randomInt, shuffle, sample, seal, randomHex } from '../rng.js';
import { encodeTicket, decodeTicket } from '../ticket.js';
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

// Kart linkte satır satır taşınır; sütun sayının kendisinden bulunur (1–9 → 0, …, 80–90 → 8).
export const colOf = (n) => Math.min(8, Math.floor(n / 10));
export const gridToRows = (grid) => grid.map((row) => row.filter((v) => v != null));
export function rowsToGrid(rows) {
  return rows.map((nums) => {
    const row = Array(9).fill(null);
    nums.forEach((n) => (row[colOf(n)] = n));
    return row;
  });
}

export function mount(root, params) {
  if (params?.id?.startsWith('k/')) return mountPlayerCard(root, params.id.slice(2));
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
      h('p', { class: 'muted small' }, 'Her kart 15 sayı: 3 satır, satır başına 5 sayı. Yazdırıp dağıtabilir ya da her oyuncuya kendi kartının linkini gönderebilirsin; oyuncu kendi telefonunda işaretler.'),
      h(
        'div',
        { class: 'row wrap' },
        stepper({ value: cardCount, min: 1, max: 12, label: 'Kart sayısı', onChange: (v) => (cardCount = v) }),
        h('button', { class: 'btn', onclick: () => renderCards(true), html: icons.shuffle }, 'Kart üret'),
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

  const cardUrl = (set, rows, k) =>
    `${location.origin}${location.pathname}#/tombala/k/${encodeTicket({ s: set, k: k + 1, r: rows })}`;

  function cardEl(rows, k, set) {
    const url = cardUrl(set, rows, k);
    return h(
      'div',
      { class: 'bingo-card' },
      h(
        'div',
        { class: 'bingo-card-head' },
        h('b', {}, 'TOMBALA'),
        h('span', { class: 'grow' }, `Kart ${k + 1}`),
        h(
          'span',
          { class: 'card-actions' },
          h('button', { class: 'btn icon', 'aria-label': `Kart ${k + 1} linkini kopyala`, html: icons.copy, onclick: () => copyLink(url) }),
          h('button', {
            class: 'btn icon',
            'aria-label': `Kart ${k + 1} linkini paylaş`,
            html: icons.share,
            onclick: () => share(`Tombala kartın (Kart ${k + 1}) hazır! Sayılar okundukça kendi telefonunda işaretle: ${url}`),
          }),
        ),
      ),
      h('div', { class: 'bingo-grid' }, rowsToGrid(rows).flat().map((v) => h('span', { class: v ? 'n' : 'x' }, v ?? ''))),
    );
  }
  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast('Kart linki kopyalandı');
    } catch {
      toast('Kopyalanamadı');
    }
  }
  // Kartlar saklanır; böylece sayfadan çıkıp dönünce gönderilen linkler ekrandakilerle aynı kalır.
  function renderCards(fresh) {
    let saved = store.get().tombalaCards;
    if (fresh || !saved) {
      saved = { set: randomHex(4), cards: Array.from({ length: cardCount }, () => gridToRows(makeCard())) };
      store.update((s) => (s.tombalaCards = saved));
    }
    cardsEl.replaceChildren(...saved.cards.map((rows, k) => cardEl(rows, k, saved.set)));
  }
  function printCards() {
    if (!cardsEl.children.length) renderCards(true);
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

// ---------- Oyuncu ekranı: linkle açılan kişisel kart ----------
const LEVELS = ['', 'Birinci çinko!', 'İkinci çinko!', 'TOMBALA!'];

function mountPlayerCard(root, payload) {
  let t;
  try {
    t = decodeTicket(payload);
    if (!Array.isArray(t.r) || t.r.length !== 3) throw new Error();
  } catch {
    root.append(pageHeader('Tombala', null, 'bingo'), h('p', { class: 'center muted' }, 'Bu kart linki bozuk görünüyor. Linki gönderen kişiden yeniden iste.'));
    return;
  }
  const id = `${t.s}-${t.k}`;
  const grid = rowsToGrid(t.r);
  const marks = new Set(store.get().bingoMarks?.[id] || []);
  let level = 0;
  let wake = null;

  const save = () =>
    store.update((s) => {
      // Son 20 kartın işaretleri tutulur.
      const all = { ...(s.bingoMarks || {}), [id]: [...marks] };
      const keys = Object.keys(all);
      if (keys.length > 20) keys.slice(0, keys.length - 20).forEach((k) => delete all[k]);
      s.bingoMarks = all;
    });

  const banner = h('div', { class: 'cinko-banner', 'aria-live': 'assertive', hidden: true });
  const pills = h('div', { class: 'row-pills' });
  const cells = grid.flat().map((v) =>
    v == null
      ? h('span', { class: 'x', 'aria-hidden': 'true' })
      : h(
          'button',
          {
            class: `n${marks.has(v) ? ' marked' : ''}`,
            'aria-pressed': String(marks.has(v)),
            'aria-label': String(v),
            onclick: (e) => toggle(v, e.currentTarget),
          },
          String(v),
        ),
  );

  function rowsDone() {
    return t.r.map((row) => row.filter((n) => marks.has(n)).length);
  }

  function update(celebrate) {
    const counts = rowsDone();
    pills.replaceChildren(
      ...counts.map((c, i) => h('span', { class: `pill${c === 5 ? ' full' : ''}` }, `${i + 1}. sıra `, h('b', {}, `${c}/5`))),
    );
    const full = counts.filter((c) => c === 5).length;
    // Bant her zaman mevcut durumu gösterir; yalnızca yeni bir seviyeye çıkınca kutlanır.
    banner.hidden = full === 0;
    if (full) banner.textContent = LEVELS[full];
    banner.classList.toggle('tombala', full === 3);
    if (full > level && celebrate) {
      banner.classList.remove('show');
      void banner.offsetWidth;
      banner.classList.add('show');
      confetti();
      sound('win');
      vibrate(full === 3 ? [80, 60, 80, 60, 200] : [60, 40, 60]);
    }
    level = full;
  }

  function toggle(n, el) {
    if (marks.has(n)) marks.delete(n);
    else marks.add(n);
    el.classList.toggle('marked', marks.has(n));
    el.setAttribute('aria-pressed', String(marks.has(n)));
    sound('tick');
    vibrate(15);
    save();
    update(true);
  }

  root.append(
    h(
      'section',
      { class: 'ticket-page' },
      h('span', { class: 'eyebrow' }, h('span', { class: 'dot' }), 'Senin tombala kartın'),
      h('h1', {}, 'Kart ', h('span', {}, String(t.k))),
      h('p', { class: 'muted ticket-lead' }, 'Sayılar okundukça kartındaki sayıya dokunup işaretle. Yanlış işaretlediysen tekrar dokun.'),
    ),
    h('div', { class: 'play-card' }, h('div', { class: 'play-grid' }, cells)),
    pills,
    banner,
    h('p', { class: 'note', html: `${icons.info}<span>Kartın çekilişi yapan ekranla canlı bağlı değildir; işaretlemeyi sen yaparsın. İşaretlerin bu telefonda saklanır, sayfayı kapatıp açsan da kaybolmaz.</span>` }),
    h(
      'div',
      { class: 'row wrap', style: { justifyContent: 'center', marginTop: '14px' } },
      confirmButton('İşaretleri temizle', 'Emin misin? Hepsi silinir', () => {
        marks.clear();
        save();
        cells.forEach((c) => c.classList?.remove('marked'));
        update(false);
      }),
    ),
  );
  level = rowsDone().filter((c) => c === 5).length;
  update(false);

  // Oyun boyunca ekran kararmasın (destekleyen tarayıcılarda).
  const keepAwake = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen');
    } catch {
      // İzin verilmezse sessizce devam.
    }
  };
  keepAwake();
  document.addEventListener('visibilitychange', keepAwake);

  return () => {
    document.removeEventListener('visibilitychange', keepAwake);
    wake?.release().catch(() => {});
  };
}
