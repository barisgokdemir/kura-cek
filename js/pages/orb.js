import { h, pageHeader, showResult, sound, vibrate, reducedMotion } from '../ui.js';
import { pick, randomInt, shuffle, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';
import { onShake } from './coin.js';
import { easeOutCubic } from '../three/stage.js';

// Klasik 20 cevap: 10 olumlu, 5 belirsiz, 5 olumsuz.
export const ANSWERS = {
  classic: [
    ...['Kesinlikle evet', 'Hiç şüphesiz', 'Kesin öyle', 'Evet, kesinlikle', 'Buna güvenebilirsin', 'Bence evet', 'Büyük ihtimalle', 'Görünüşe göre iyi', 'Evet', 'İşaretler evet diyor'].map((t) => [t, 'yes']),
    ...['Belirsiz, tekrar dene', 'Sonra tekrar sor', 'Şimdi söylemesem iyi', 'Şu an bilemiyorum', 'Odaklan ve tekrar sor'].map((t) => [t, 'maybe']),
    ...['Hiç sanmıyorum', 'Cevabım hayır', 'Kaynaklarım hayır diyor', 'Pek iyi görünmüyor', 'Çok şüpheli'].map((t) => [t, 'no']),
  ],
  simple: [
    ['Evet', 'yes'],
    ['Hayır', 'no'],
    ['Belki', 'maybe'],
  ],
};

// Yatay atlıkarınca: 8 yüz, hedef cevap + diğer cevaplardan karışık dolgu.
const FACES = 8;
const STEP = 360 / FACES;

export function mount(root) {
  let mode = store.get().orbMode || 'classic';
  let busy = false;
  let dead = false;
  let angle = 0; // tamburun mevcut dönüşü (derece)
  let raf = null;

  const question = h('input', { type: 'text', class: 'orb-q', maxLength: 120, placeholder: 'Sorunu yaz (isteğe bağlı)', 'aria-label': 'Soru' });
  const drum = h('div', { class: 'orb-drum' });
  const bubbles = h('div', { class: 'orb-bubbles', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('i', { style: { '--i': i } })));
  const windowEl = h('div', { class: 'orb-window idle' }, h('div', { class: 'orb-liquid' }), bubbles, h('div', { class: 'orb-drum-wrap' }, drum), h('div', { class: 'orb-glass' }));
  const answerLive = h('span', { class: 'sr-only', 'aria-live': 'assertive' });
  const orbEl = h(
    'button',
    { class: 'orb', 'aria-label': 'Küreyi salla ve cevabı gör', onclick: () => ask() },
    h('span', { class: 'orb-shine' }),
    h('span', { class: 'orb-rim' }),
    windowEl,
  );
  const resultSlot = h('div');

  const modeCtl = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'Cevap türü' },
    [
      ['classic', 'Klasik 20 cevap'],
      ['simple', 'Evet / Hayır / Belki'],
    ].map(([id, label]) =>
      h(
        'button',
        {
          role: 'radio',
          'aria-checked': String(id === mode),
          'data-id': id,
          onclick: () => {
            mode = id;
            store.update((s) => (s.orbMode = id));
            modeCtl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
            fillDrum(null);
            windowEl.classList.remove('landed', 'yes', 'no', 'maybe');
            windowEl.classList.add('idle');
            resultSlot.replaceChildren();
          },
        },
        label,
      ),
    ),
  );

  root.append(
    pageHeader('Sihirli Küre', 'Sorunu aklından geçir, küreye dokun ya da telefonu salla.', 'orb'),
    question,
    h('div', { class: 'orb-wrap' }, h('div', { class: 'orb-halo', 'aria-hidden': 'true' }), orbEl, h('div', { class: 'orb-floor', 'aria-hidden': 'true' })),
    answerLive,
    h('div', { class: 'controls' }, h('button', { class: 'btn primary big', onclick: () => ask(), html: icons.orb }, 'Küreye sor')),
    resultSlot,
    h('section', { class: 'panel open' }, h('div', { class: 'field col' }, h('span', {}, 'Cevaplar'), modeCtl)),
  );

  // Yüzleri doldur: hedef verilirse belirtilen yüze yerleşir.
  function fillDrum(target, targetFace = 0) {
    const pool = ANSWERS[mode];
    const others = shuffle(pool.filter(([t]) => t !== target?.[0]));
    const faces = Array.from({ length: FACES }, (_, i) => (target && i === targetFace ? target : others[i % others.length] || pool[0]));
    drum.replaceChildren(
      ...faces.map(([text, tone], i) =>
        h('div', { class: `orb-face t-${tone}`, style: { transform: `rotateY(${i * STEP}deg) translateZ(var(--r))` } }, h('span', {}, text)),
      ),
    );
    return faces;
  }

  // Atlıkarınca yarıçapı: yüz genişliğine göre (r = w/2 / tan(π/n)).
  const fitRadius = () => {
    const w = windowEl.clientWidth * 0.84;
    orbEl.style.setProperty('--r', `${Math.round(w / 2 / Math.tan(Math.PI / FACES)) + 2}px`);
  };
  const ro = new ResizeObserver(fitRadius);
  ro.observe(windowEl);

  const setAngle = (a) => {
    angle = a;
    drum.style.transform = `translateZ(calc(var(--r) * -1)) rotateY(${a}deg)`;
  };

  // Boşta tambur ağır ağır salınır.
  function idle() {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const base = angle;
    const frame = (now) => {
      if (dead || busy) return;
      setAngle(base + Math.sin((now - t0) / 1300) * 9);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  async function ask() {
    if (busy) return;
    busy = true;
    cancelAnimationFrame(raf);
    resultSlot.replaceChildren();
    windowEl.classList.remove('idle', 'landed', 'yes', 'no', 'maybe');
    try {
      const target = pick(ANSWERS[mode]);
      const [text, tone] = target;
      const q = question.value.trim();
      const record = await seal('sihirli-kure', { question: q, mode }, text);
      const face = randomInt(0, FACES - 1);
      fillDrum(target, face);

      // Yüz i, tambur rotateY(-i·STEP) iken öne gelir. Hızla birkaç tur atıp hedefte durur.
      const from = angle;
      const goal = -face * STEP;
      const turns = reducedMotion() ? 0 : 5 + randomInt(0, 2);
      const to = from - turns * 360 - ((((from - goal) % 360) + 360) % 360);
      const duration = reducedMotion() ? 250 : 1900;

      orbEl.classList.remove('shake');
      void orbEl.offsetWidth;
      if (!reducedMotion()) orbEl.classList.add('shake');
      windowEl.classList.add('spinning');
      vibrate(30);

      let lastFace = Math.round(from / STEP);
      await new Promise((resolve) => {
        const t0 = performance.now();
        const frame = (now) => {
          if (dead) return resolve();
          const t = Math.min(1, (now - t0) / duration);
          setAngle(from + (to - from) * easeOutCubic(t));
          // Dönerken bulanıklık hızla orantılı; yavaşladıkça yazılar netleşir.
          drum.style.filter = `blur(${((1 - t) ** 2 * 3).toFixed(2)}px)`;
          const f = Math.round(angle / STEP);
          if (f !== lastFace) {
            lastFace = f;
            sound('tick');
          }
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      if (dead) return;
      setAngle(((to % 360) + 360) % 360);
      drum.style.filter = '';
      windowEl.classList.remove('spinning');
      drum.children[face].classList.add('front');
      windowEl.classList.add('landed', tone);
      answerLive.textContent = text;
      sound(tone === 'no' ? 'lose' : tone === 'yes' ? 'win' : 'land');
      vibrate(tone === 'yes' ? [40, 50, 40] : 50);
      store.addHistory(record, q ? `${q} → ${text}` : text);
      showResult(resultSlot, { title: q || 'Küre diyor ki', big: text, record, onAgain: ask, againLabel: 'Yeniden sor' });
    } finally {
      busy = false;
      orbEl.classList.remove('shake');
    }
  }

  fillDrum(null);
  setAngle(0);
  idle();
  const stopShake = onShake(ask);
  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    stopShake();
  };
}
