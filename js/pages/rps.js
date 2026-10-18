import { h, pageHeader, showResult, sound, vibrate, sleep, reducedMotion, confetti } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

export const HANDS = ['Taş', 'Kağıt', 'Makas'];
const CHANT = ['Taş!', 'Kağıt!', 'Makas!'];
// Kazanan → kaybeden fiili
const VERBS = { '1-0': 'Kağıt taşı sarar!', '2-1': 'Makas kağıdı keser!', '0-2': 'Taş makası kırar!' };

// 0: berabere, 1: a kazanır, 2: b kazanır (kağıt taşı, makas kağıdı, taş makası yener)
export const judge = (a, b) => (a - b + 3) % 3;

// ---------- Çizimler: sağa bakan el (rakip tarafta aynalanır) ----------
let gid = 0;
export function handSvg(hand, [c1, c2]) {
  const id = `hg${++gid}`;
  const P = `fill="url(#${id})" stroke="#0a0a1a" stroke-width="3.5" stroke-linejoin="round"`;
  const sleeve = `<rect x="2" y="36" width="28" height="44" rx="7" fill="#1e1e3a" stroke="#0a0a1a" stroke-width="3.5"/><path d="M10 40v36M18 40v36" stroke="${c1}" stroke-width="3" opacity=".7"/>`;
  const knuckles = (ys) => ys.map((y) => `<rect x="74" y="${y}" width="30" height="14" rx="7" ${P}/>`).join('');
  const body = {
    // Yumruk
    0: `<rect x="24" y="28" width="64" height="58" rx="22" ${P}/>${knuckles([30, 43, 56, 69])}<rect x="38" y="20" width="44" height="16" rx="8" ${P}/>`,
    // Açık el
    1: `<rect x="24" y="34" width="54" height="52" rx="18" ${P}/>
        <rect x="66" y="33" width="58" height="12" rx="6" ${P}/><rect x="66" y="46" width="64" height="12" rx="6" ${P}/>
        <rect x="66" y="59" width="60" height="12" rx="6" ${P}/><rect x="66" y="72" width="50" height="12" rx="6" ${P}/>
        <rect x="46" y="12" width="16" height="38" rx="8" transform="rotate(-38 54 31)" ${P}/>`,
    // Makas: işaret ve orta parmak açık
    2: `<rect x="24" y="30" width="62" height="56" rx="20" ${P}/>
        <rect x="66" y="25" width="64" height="12" rx="6" transform="rotate(-14 70 31)" ${P}/>
        <rect x="66" y="41" width="62" height="12" rx="6" transform="rotate(12 70 47)" ${P}/>
        ${knuckles([58, 71])}<rect x="36" y="22" width="40" height="15" rx="7.5" ${P}/>`,
  }[hand];
  return `<svg viewBox="0 0 136 110" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>${sleeve}${body}</svg>`;
}

const BOT = {
  idle: '<circle cx="24" cy="32" r="4.5"/><circle cx="40" cy="32" r="4.5"/><path d="M26 43h12" fill="none"/>',
  think: '<circle cx="28" cy="29" r="4"/><circle cx="44" cy="29" r="4"/><path d="M27 44h10" fill="none"/>',
  happy: '<path d="M19 34q5-7 10 0M35 34q5-7 10 0" fill="none"/><path d="M23 41q9 8 18 0" fill="none"/>',
  sad: '<path d="M20 28l8 8M28 28l-8 8M36 28l8 8M44 28l-8 8" fill="none"/><path d="M24 46q8-7 16 0" fill="none"/>',
  draw: '<path d="M19 32h10M35 32h10M25 43h14" fill="none"/>',
};
const botSvg = (mood) =>
  `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="6" r="3.5" fill="currentColor"/><rect x="9" y="15" width="46" height="38" rx="11" fill="#0a0a1a" stroke="currentColor" stroke-width="3"/><g fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linecap="round">${BOT[mood]}</g></svg>`;

const SIDE_COLORS = [
  ['#f0abfc', '#c026d3'],
  ['#67e8f9', '#0891b2'],
];

export function mount(root) {
  const cfg = { mode: 'app', bestOf: 3, ...(store.get().rps || {}) };
  const persist = () => store.update((s) => (s.rps = { ...cfg }));
  let busy = false;
  let dead = false;
  let pending = null; // uygulamaya karşı: mühürlü hamle
  let p1 = null; // iki kişilik: 1. oyuncunun gizli hamlesi
  let match = { wins: [0, 0], rounds: [] };

  const names = () => (cfg.mode === 'app' ? ['Sen', 'Kura Çek'] : ['1. Oyuncu', '2. Oyuncu']);
  const need = () => Math.ceil(cfg.bestOf / 2);

  const handEls = [h('div', { class: 'rps-hand' }), h('div', { class: 'rps-hand mirror' })];
  const nameEls = [h('b', { class: 'rps-name' }), h('b', { class: 'rps-name' })];
  const bot = h('span', { class: 'rps-bot' });
  const sides = [0, 1].map((i) => h('div', { class: 'rps-side' }, handEls[i], h('div', { class: 'rps-tag' }, i === 1 ? bot : '', nameEls[i])));
  const clash = h('div', { class: 'rps-clash', 'aria-hidden': 'true' });
  const chant = h('div', { class: 'rps-chant', 'aria-live': 'assertive' });
  const scoreEl = h('div', { class: 'rps-score' });
  const dots = h('div', { class: 'rps-dots', 'aria-label': 'Eller' });
  const arena = h('section', { class: 'rps-arena' }, sides[0], h('div', { class: 'rps-mid' }, scoreEl, dots), sides[1], clash, chant);
  const status = h('div', { class: 'rps-status' });
  const picks = h(
    'div',
    { class: 'rps-picks', role: 'group', 'aria-label': 'Hamleni seç' },
    HANDS.map((name, i) =>
      h(
        'button',
        { class: 'rps-pick', onclick: () => choose(i), 'aria-label': name },
        h('span', { class: 'rps-pick-art', html: handSvg(i, SIDE_COLORS[0]) }),
        h('span', {}, name),
      ),
    ),
  );
  const resultSlot = h('div');

  const seg = (label, key, options, after) => {
    const el = h(
      'div',
      { class: 'segmented', role: 'radiogroup', 'aria-label': label },
      options.map(([id, text]) =>
        h(
          'button',
          {
            role: 'radio',
            'aria-checked': String(cfg[key] === id),
            'data-id': String(id),
            onclick: () => {
              cfg[key] = id;
              persist();
              el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === String(id))));
              after();
            },
          },
          text,
        ),
      ),
    );
    return el;
  };

  root.append(
    pageHeader('Taş-Kağıt-Makas', 'Kağıt taşı sarar, makas kağıdı keser, taş makası kırar.', 'rps'),
    h(
      'div',
      { class: 'rps-modes' },
      seg('Rakip', 'mode', [['app', 'Uygulamaya karşı'], ['duo', 'İki kişi']], newMatch),
      seg('Maç', 'bestOf', [[1, 'Tek el'], [3, "3'te 2"], [5, "5'te 3"]], newMatch),
    ),
    arena,
    status,
    picks,
    resultSlot,
  );

  function setBot(mood) {
    bot.hidden = cfg.mode !== 'app';
    bot.innerHTML = botSvg(mood);
    bot.dataset.mood = mood;
  }
  function setHand(i, hand) {
    handEls[i].innerHTML = handSvg(hand, SIDE_COLORS[i]);
  }
  function renderScore() {
    scoreEl.replaceChildren(h('b', {}, String(match.wins[0])), h('span', {}, ':'), h('b', {}, String(match.wins[1])));
    nameEls.forEach((el, i) => (el.textContent = names()[i]));
    dots.hidden = cfg.bestOf === 1;
    dots.replaceChildren(
      ...Array.from({ length: cfg.bestOf }, (_, i) => {
        const r = match.rounds[i];
        return h('i', { class: r == null ? '' : r === 0 ? 'draw' : r === 1 ? 'p1' : 'p2' });
      }),
    );
  }

  function newMatch() {
    match = { wins: [0, 0], rounds: [] };
    newRound();
  }

  async function newRound() {
    resultSlot.replaceChildren();
    chant.textContent = '';
    arena.classList.remove('revealed', 'shake-screen');
    sides.forEach((s) => s.classList.remove('win', 'lose', 'pump'));
    clash.classList.remove('boom');
    setHand(0, 0);
    setHand(1, 0);
    picks.hidden = false;
    p1 = null;
    renderScore();
    setBot('think');
    if (cfg.mode === 'app') {
      // Uygulamanın hamlesi oyuncu seçmeden önce belirlenir ve mühürlenir.
      const hand = randomInt(0, 2);
      const record = await seal('tas-kagit-makas', { mode: 'app' }, HANDS[hand]);
      if (dead) return;
      pending = { hand, record };
      status.replaceChildren(
        h('p', { class: 'commit' }, 'Robotun hamlesi sen seçmeden mühürlendi', h('code', {}, record.code ?? '—')),
        h('p', { class: 'center rps-turn' }, 'Hamleni seç!'),
      );
    } else {
      status.replaceChildren(h('p', { class: 'center rps-turn' }, h('b', {}, '1. Oyuncu'), ' seçsin — 2. oyuncu bakmasın!'));
    }
  }

  async function choose(hand) {
    if (busy) return;
    if (cfg.mode === 'duo' && p1 == null) {
      p1 = hand;
      sound('tick');
      vibrate(20);
      picks.hidden = true;
      status.replaceChildren(
        h('p', { class: 'center rps-turn' }, 'Seçildi! Telefonu ', h('b', {}, '2. Oyuncu'), 'ya ver.'),
        h(
          'div',
          { class: 'controls' },
          h(
            'button',
            {
              class: 'btn primary big',
              onclick: () => {
                picks.hidden = false;
                status.replaceChildren(h('p', { class: 'center rps-turn' }, h('b', {}, '2. Oyuncu'), ' seçsin!'));
              },
            },
            'Hazırım, 2. oyuncuyum',
          ),
        ),
      );
      return;
    }
    busy = true;
    picks.hidden = true;
    const a = cfg.mode === 'app' ? hand : p1;
    const b = cfg.mode === 'app' ? pending.hand : hand;
    const record = cfg.mode === 'app' ? pending.record : await seal('tas-kagit-makas', { mode: 'duo' }, [HANDS[a], HANDS[b]]);
    status.replaceChildren();
    setBot('idle');

    // "Taş! Kağıt! Makas!" — iki yumruk birlikte iner kalkar.
    if (!reducedMotion()) {
      for (const word of CHANT) {
        chant.textContent = word;
        chant.classList.remove('pop');
        void chant.offsetWidth;
        chant.classList.add('pop');
        sides.forEach((s) => {
          s.classList.remove('pump');
          void s.offsetWidth;
          s.classList.add('pump');
        });
        sound('tick');
        vibrate(15);
        await sleep(420);
        if (dead) return;
      }
    }
    chant.textContent = '';
    setHand(0, a);
    setHand(1, b);
    arena.classList.add('revealed');
    clash.classList.add('boom');
    arena.classList.add('shake-screen');
    sound('land');
    vibrate(60);

    const r = judge(a, b);
    match.rounds.push(r);
    if (r) {
      match.wins[r - 1]++;
      sides[r - 1].classList.add('win');
      sides[2 - r].classList.add('lose');
    }
    const verb = r === 0 ? 'Aynı el, berabere!' : VERBS[r === 1 ? `${a}-${b}` : `${b}-${a}`];
    chant.textContent = verb;
    chant.classList.remove('pop');
    void chant.offsetWidth;
    chant.classList.add('pop', 'verb');
    if (cfg.mode === 'app') setBot(r === 0 ? 'draw' : r === 2 ? 'happy' : 'sad');
    renderScore();

    const [n1, n2] = names();
    const roundWinner = r === 0 ? null : names()[r - 1];
    const matchOver = cfg.bestOf > 1 && (match.wins[0] >= need() || match.wins[1] >= need());
    store.addHistory(record, `${n1}: ${HANDS[a]} · ${n2}: ${HANDS[b]} → ${roundWinner ? `${roundWinner} kazandı` : 'berabere'}`);

    let big;
    let title = `${HANDS[a]} – ${HANDS[b]}`;
    let celebrate = r !== 0 && !(cfg.mode === 'app' && r === 2);
    if (matchOver) {
      const mw = match.wins[0] >= need() ? 0 : 1;
      big = cfg.mode === 'app' ? (mw === 0 ? 'Maçı kazandın!' : 'Maçı robot aldı') : `${names()[mw]} maçı kazandı!`;
      title = `Maç bitti · ${match.wins[0]}–${match.wins[1]}`;
      celebrate = !(cfg.mode === 'app' && mw === 1);
    } else {
      big = r === 0 ? 'Berabere' : cfg.mode === 'app' ? (r === 1 ? 'Kazandın!' : 'Kaybettin') : `${roundWinner} kazandı`;
    }
    await sleep(reducedMotion() ? 0 : 500);
    if (dead) return;
    showResult(resultSlot, {
      title,
      big: matchOver ? h('span', { class: 'rps-trophy-line' }, h('span', { class: 'rps-trophy', html: TROPHY }), big) : big,
      detail: cfg.mode === 'app' && !matchOver ? 'Koda dokun: robotun hamlesi baştan beri buydu' : verb,
      record,
      onAgain: matchOver ? newMatch : newRound,
      againLabel: matchOver ? 'Yeni maç' : cfg.bestOf > 1 ? 'Sonraki el' : 'Yeni el',
      celebrate,
    });
    if (matchOver && celebrate) setTimeout(confetti, 400);
    if (cfg.mode === 'app' && r === 2) sound('lose');
    busy = false;
  }

  newMatch();
  return () => {
    dead = true;
  };
}

const TROPHY =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 8h24v14a12 12 0 01-24 0z" fill="#facc15" stroke="#0a0a1a" stroke-width="3"/><path d="M20 12H10c0 9 5 13 11 14M44 12h10c0 9-5 13-11 14" fill="none" stroke="#facc15" stroke-width="4"/><path d="M28 34h8v10h-8z" fill="#facc15"/><rect x="18" y="44" width="28" height="10" rx="3" fill="#facc15" stroke="#0a0a1a" stroke-width="3"/></svg>';
