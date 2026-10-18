import { h, pageHeader, showResult, sound, vibrate, reducedMotion, toast, sleep } from '../ui.js';
import { pick, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

export const ALPHABET = 'A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z'.split(' ');
// Ğ ile başlayan kelime yok; diğerleri İsim-Şehir'de zor sayılan harfler.
const HARD = ['Ğ', 'I', 'J', 'Ö', 'Ü', 'Z'];
const TIMES = [0, 30, 60, 90, 120];

export function mount(root) {
  const st = () => store.get().letter;
  if (!st()) store.update((s) => (s.letter = { off: ['Ğ'], noRepeat: true, used: [], time: 60 }));
  let busy = false;
  let dead = false;
  let countdown = null;

  const reel = h('div', { class: 'reel-strip' });
  const reelBox = h('div', { class: 'reel', 'aria-live': 'polite' }, reel);
  const timerEl = h('div', { class: 'timer', hidden: true }, h('div', { class: 'timer-bar' }), h('span', {}));
  const resultSlot = h('div');
  const drawBtn = h('button', { class: 'btn primary big', onclick: () => draw(), html: icons.letter }, 'Harf çek');
  const stopBtn = h('button', { class: 'btn', hidden: true, onclick: () => stopTimer(true), html: icons.stop }, 'Dur!');
  const grid = h('div', { class: 'letter-grid', role: 'group', 'aria-label': 'Harfler' });
  const repeatChk = h('input', {
    type: 'checkbox',
    checked: st().noRepeat,
    onchange: (e) => store.update((s) => (s.letter.noRepeat = e.target.checked)),
  });
  const timeSel = h(
    'select',
    { value: String(st().time), 'aria-label': 'Süre', onchange: (e) => store.update((s) => (s.letter.time = +e.target.value)) },
    TIMES.map((t) => h('option', { value: String(t) }, t ? `${t} saniye` : 'Süre yok')),
  );

  reel.append(h('span', {}, '?'));

  root.append(
    pageHeader('İsim-Şehir', 'Harfi çek, süre başlasın.', 'letter'),
    reelBox,
    timerEl,
    h('div', { class: 'controls row wrap', style: { justifyContent: 'center' } }, drawBtn, stopBtn),
    resultSlot,
    h(
      'section',
      { class: 'panel open' },
      h('div', { class: 'field' }, h('span', {}, 'Süre'), timeSel),
      h('label', { class: 'field check' }, h('span', {}, 'Çıkan harf bu oyunda tekrar gelmesin'), repeatChk),
      h('div', { class: 'field col' }, h('span', {}, 'Harfler (kapatmak için dokun)'), grid),
      h(
        'div',
        { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => setOff([...new Set(['Ğ', ...HARD])]) }, 'Zorları çıkar'),
        h('button', { class: 'btn', onclick: () => setOff(['Ğ']) }, 'Hepsini aç'),
        h('button', { class: 'btn', onclick: () => (store.update((s) => (s.letter.used = [])), renderGrid()) }, 'Çıkanları sıfırla'),
      ),
    ),
  );

  function setOff(list) {
    store.update((s) => (s.letter.off = list));
    renderGrid();
  }

  function renderGrid() {
    const { off, used } = st();
    grid.replaceChildren(
      ...ALPHABET.map((L) =>
        h(
          'button',
          {
            class: `letter-chip${off.includes(L) ? ' off' : ''}${used.includes(L) ? ' used' : ''}`,
            'aria-pressed': String(!off.includes(L)),
            title: used.includes(L) ? 'Bu oyunda çıktı' : '',
            onclick: () => {
              store.update((s) => {
                s.letter.off = s.letter.off.includes(L) ? s.letter.off.filter((x) => x !== L) : [...s.letter.off, L];
              });
              renderGrid();
            },
          },
          L,
        ),
      ),
    );
  }

  function pool() {
    const { off, used, noRepeat } = st();
    return ALPHABET.filter((L) => !off.includes(L) && !(noRepeat && used.includes(L)));
  }

  async function draw() {
    if (busy) return;
    const p = pool();
    if (!p.length) return toast(st().noRepeat ? 'Harf kalmadı — çıkanları sıfırla' : 'En az bir harf açık olmalı');
    busy = true;
    drawBtn.disabled = true;
    stopTimer(false);
    resultSlot.replaceChildren();
    try {
      const letter = pick(p);
      const record = await seal('isim-sehir', { pool: p }, letter);
      // Makara: rastgele harfler, en sonda önceden belirlenen harf.
      const slow = !reducedMotion();
      const strip = [...Array(slow ? 22 : 0)].map(() => pick(p)).concat(letter);
      reel.style.transition = 'none';
      reel.style.transform = 'translateY(0)';
      reel.replaceChildren(...[reel.lastElementChild?.textContent || '?', ...strip].map((L) => h('span', {}, L)));
      void reel.offsetWidth;
      reel.style.transition = slow ? 'transform 1.8s cubic-bezier(.12,.8,.2,1)' : 'none';
      reel.style.transform = `translateY(calc(var(--cell) * -${strip.length}))`;
      if (slow) {
        for (let i = 0; i < 10; i++) {
          sound('tick');
          await sleep(90 + i * 18);
          if (dead) return;
        }
        await sleep(200);
      }
      reelBox.classList.remove('pop');
      void reelBox.offsetWidth;
      reelBox.classList.add('pop');
      store.update((s) => (s.letter.used = [...new Set([...s.letter.used, letter])]));
      renderGrid();
      store.addHistory(record, `Harf: ${letter}`);
      showResult(resultSlot, {
        title: 'Harf',
        big: letter,
        detail: `${p.length} harf arasından`,
        record,
        onAgain: draw,
        againLabel: 'Yeni harf',
      });
      if (st().time) startTimer(st().time);
    } finally {
      busy = false;
      drawBtn.disabled = false;
    }
  }

  function startTimer(sec) {
    const end = performance.now() + sec * 1000;
    const bar = timerEl.firstElementChild;
    const label = timerEl.lastElementChild;
    timerEl.hidden = false;
    timerEl.classList.remove('done');
    stopBtn.hidden = false;
    let lastSec = sec;
    const tick = () => {
      if (dead) return;
      const left = Math.max(0, end - performance.now());
      const s = Math.ceil(left / 1000);
      bar.style.transform = `scaleX(${left / (sec * 1000)})`;
      label.textContent = `${s} sn`;
      timerEl.classList.toggle('hurry', s <= 5);
      if (s !== lastSec && s <= 5 && s > 0) sound('tick');
      lastSec = s;
      if (left <= 0) return finishTimer();
      countdown = requestAnimationFrame(tick);
    };
    tick();
  }
  function finishTimer() {
    countdown = null;
    timerEl.classList.add('done');
    timerEl.lastElementChild.textContent = 'Süre doldu! Kalemler bırakılsın';
    stopBtn.hidden = true;
    sound('lose');
    vibrate([200, 100, 200]);
  }
  function stopTimer(byUser) {
    if (countdown) cancelAnimationFrame(countdown);
    countdown = null;
    stopBtn.hidden = true;
    if (byUser) {
      timerEl.classList.add('done');
      timerEl.lastElementChild.textContent = 'Durduruldu';
      sound('land');
    } else timerEl.hidden = true;
  }

  renderGrid();
  return () => {
    dead = true;
    if (countdown) cancelAnimationFrame(countdown);
  };
}
