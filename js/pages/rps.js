import { h, pageHeader, showResult, sound, vibrate, sleep, reducedMotion } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

export const HANDS = ['Taş', 'Kağıt', 'Makas'];
const HAND_ICONS = ['rock', 'paper', 'scissors'];
const CHANT = ['Taş!', 'Kağıt!', 'Makas!'];

// 0: berabere, 1: a kazanır, 2: b kazanır (kağıt taşı, makas kağıdı, taş makası yener)
export const judge = (a, b) => (a - b + 3) % 3;

export function mount(root) {
  let mode = 'app';
  let score = [0, 0];
  let busy = false;
  let dead = false;
  let pending = null; // uygulamaya karşı: mühürlü hamle { hand, record }
  let p1 = null; // iki kişilik: 1. oyuncunun gizli hamlesi

  const names = () => (mode === 'app' ? ['Sen', 'Kura Çek'] : ['1. Oyuncu', '2. Oyuncu']);

  const slot = (i) =>
    h('div', { class: 'rps-slot' }, h('span', { class: 'rps-hand', html: icons.rock }), h('b', { class: 'rps-name' }));
  const slots = [slot(0), slot(1)];
  const scoreEl = h('div', { class: 'rps-score', 'aria-live': 'polite' });
  const chantEl = h('p', { class: 'rps-chant', 'aria-live': 'assertive' });
  const arena = h('section', { class: 'rps-arena' }, slots[0], scoreEl, slots[1]);
  const status = h('div', { class: 'rps-status' });
  const picks = h(
    'div',
    { class: 'rps-picks', role: 'group', 'aria-label': 'Hamleni seç' },
    HANDS.map((name, i) =>
      h('button', { class: 'rps-pick', onclick: () => choose(i), html: icons[HAND_ICONS[i]] }, h('span', {}, name)),
    ),
  );
  const resultSlot = h('div');

  const modeCtl = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'Mod' },
    [
      ['app', 'Uygulamaya karşı'],
      ['duo', 'İki kişi'],
    ].map(([id, label]) =>
      h('button', { role: 'radio', 'aria-checked': String(id === mode), 'data-id': id, onclick: () => setMode(id) }, label),
    ),
  );

  root.append(
    pageHeader('Taş-Kağıt-Makas', 'Kağıt taşı, makas kağıdı, taş makası yener.', 'rps'),
    h('div', { class: 'rps-mode' }, modeCtl),
    arena,
    chantEl,
    status,
    picks,
    resultSlot,
    h('div', { class: 'row wrap', style: { justifyContent: 'center', marginTop: '14px' } }, h('button', { class: 'btn', onclick: resetScore }, 'Skoru sıfırla')),
  );

  function setMode(id) {
    mode = id;
    modeCtl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
    score = [0, 0];
    newRound();
  }
  function resetScore() {
    score = [0, 0];
    renderScore();
  }
  function renderScore() {
    scoreEl.replaceChildren(h('b', {}, String(score[0])), h('span', {}, ':'), h('b', {}, String(score[1])));
    slots.forEach((s, i) => (s.querySelector('.rps-name').textContent = names()[i]));
  }
  function setHand(i, hand) {
    slots[i].querySelector('.rps-hand').innerHTML = icons[HAND_ICONS[hand]];
  }

  async function newRound() {
    resultSlot.replaceChildren();
    chantEl.textContent = '';
    slots.forEach((s, i) => {
      s.classList.remove('win', 'lose', 'shake');
      setHand(i, 0);
    });
    picks.hidden = false;
    p1 = null;
    renderScore();
    if (mode === 'app') {
      // Uygulamanın hamlesi oyuncu seçmeden önce belirlenir ve mühürlenir.
      const hand = randomInt(0, 2);
      const record = await seal('tas-kagit-makas', { mode: 'app' }, HANDS[hand]);
      if (dead) return;
      pending = { hand, record };
      status.replaceChildren(
        h('p', { class: 'commit' }, 'Uygulamanın hamlesi seçimini yapmadan önce mühürlendi', h('code', {}, record.code ?? '—')),
        h('p', { class: 'center muted' }, 'Hamleni seç'),
      );
    } else {
      status.replaceChildren(h('p', { class: 'center rps-turn' }, h('b', {}, '1. Oyuncu'), ' hamlesini seçsin — 2. oyuncu bakmasın'));
    }
  }

  async function choose(hand) {
    if (busy) return;
    if (mode === 'duo' && p1 == null) {
      p1 = hand;
      sound('tick');
      vibrate(20);
      picks.hidden = true;
      status.replaceChildren(
        h('p', { class: 'center rps-turn' }, '1. oyuncu seçti. Telefonu ', h('b', {}, '2. Oyuncu'), 'ya ver.'),
        h(
          'div',
          { class: 'controls' },
          h('button', { class: 'btn primary big', onclick: () => ((picks.hidden = false), status.replaceChildren(h('p', { class: 'center rps-turn' }, h('b', {}, '2. Oyuncu'), ' hamlesini seçsin'))) }, 'Hazırım, 2. oyuncuyum'),
        ),
      );
      return;
    }
    busy = true;
    picks.hidden = true;
    const a = mode === 'app' ? hand : p1;
    const b = mode === 'app' ? pending.hand : hand;
    const record = mode === 'app' ? pending.record : await seal('tas-kagit-makas', { mode: 'duo' }, [HANDS[a], HANDS[b]]);
    status.replaceChildren();

    // "Taş! Kağıt! Makas!" — iki el de sallanır, sonra açılır.
    if (!reducedMotion()) {
      for (const word of CHANT) {
        chantEl.textContent = word;
        slots.forEach((s) => {
          s.classList.remove('shake');
          void s.offsetWidth;
          s.classList.add('shake');
        });
        sound('tick');
        await sleep(380);
        if (dead) return;
      }
    }
    chantEl.textContent = '';
    setHand(0, a);
    setHand(1, b);
    const r = judge(a, b);
    if (r) {
      score[r - 1]++;
      slots[r - 1].classList.add('win');
      slots[2 - r].classList.add('lose');
    }
    renderScore();
    const [n1, n2] = names();
    const title = r === 0 ? 'Berabere' : `${r === 1 ? n1 : n2} kazandı`;
    store.addHistory(record, `${n1}: ${HANDS[a]} · ${n2}: ${HANDS[b]} → ${title}`);
    showResult(resultSlot, {
      title: `${HANDS[a]} – ${HANDS[b]}`,
      big: mode === 'app' && r === 1 ? 'Kazandın!' : mode === 'app' && r === 2 ? 'Kaybettin' : title,
      detail: mode === 'app' ? 'Koda dokun: uygulamanın hamlesi baştan beri buydu' : null,
      record,
      onAgain: newRound,
      againLabel: 'Yeni el',
      celebrate: r !== 0 && !(mode === 'app' && r === 2),
    });
    if (mode === 'app' && r === 2) sound('lose');
    busy = false;
  }

  newRound();
  return () => {
    dead = true;
  };
}
