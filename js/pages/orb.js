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

// Üçgenler pencerenin içinde bir çember üzerinde dolaşır; kendi etraflarında dönmez, hep dik durur.
// Hedef cevap + diğer cevaplardan karışık dolgu.
const FACES = 6;
const STEP = (Math.PI * 2) / FACES;
const TOP = -Math.PI / 2; // ekranda tepe noktası

export function mount(root) {
  let mode = store.get().orbMode || 'classic';
  let busy = false;
  let dead = false;
  let angle = 0; // çemberin mevcut dönüşü (radyan)
  let geo = { R: 50, land: 2.6 };
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
        h('div', { class: `orb-face t-${tone}` }, h('div', { class: 'orb-tri' }, h('span', {}, text))),
      ),
    );
    setAngle(angle);
    return faces;
  }

  // Yörünge yarıçapı ve üçgen boyu pencereye göre; durunca seçilen üçgen pencerenin %83'üne büyür.
  const fitRadius = () => {
    const W = windowEl.clientWidth || 160;
    const fw = W * 0.3;
    geo = { R: W * 0.29, land: (W * 0.83) / fw };
    orbEl.style.setProperty('--fw', `${Math.round(fw)}px`);
    if (!windowEl.classList.contains('landed')) setAngle(angle);
  };
  const ro = new ResizeObserver(fitRadius);
  ro.observe(windowEl);

  // Her üçgen çemberdeki yerine taşınır; üstteki küçülür, alttaki büyür (hafif derinlik).
  const setAngle = (a) => {
    angle = a;
    [...drum.children].forEach((el, i) => {
      const t = a + i * STEP;
      const x = Math.cos(t) * geo.R;
      const y = Math.sin(t) * geo.R * 0.86;
      const depth = 0.86 + 0.14 * ((Math.sin(t) + 1) / 2);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${depth.toFixed(3)})`;
      el.style.zIndex = String(Math.round(depth * 100));
    });
  };

  // Boşta tambur ağır ağır salınır.
  function idle() {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const base = angle;
    const frame = (now) => {
      if (dead || busy) return;
      setAngle(base + (now - t0) / 4000);
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
    [...drum.children].forEach((el) => (el.style.transition = ''));
    try {
      const target = pick(ANSWERS[mode]);
      const [text, tone] = target;
      const q = question.value.trim();
      const record = await seal('sihirli-kure', { question: q, mode }, text);
      const face = randomInt(0, FACES - 1);
      fillDrum(target, face);

      // Üçgen i, çember açısı TOP - i·STEP iken tepeye gelir. Hızla birkaç tur atıp orada durur.
      const TAU = Math.PI * 2;
      const from = angle;
      const goal = TOP - face * STEP;
      const turns = reducedMotion() ? 0 : 4 + randomInt(0, 2);
      const to = from + turns * TAU + ((((goal - from) % TAU) + TAU) % TAU);
      const duration = reducedMotion() ? 250 : 2000;

      orbEl.classList.remove('shake');
      void orbEl.offsetWidth;
      if (!reducedMotion()) orbEl.classList.add('shake');
      windowEl.classList.add('spinning');
      vibrate(30);

      let lastFace = Math.floor(from / STEP);
      await new Promise((resolve) => {
        const t0 = performance.now();
        const frame = (now) => {
          if (dead) return resolve();
          const t = Math.min(1, (now - t0) / duration);
          setAngle(from + (to - from) * easeOutCubic(t));
          // Dönerken bulanıklık hızla orantılı; yavaşladıkça yazılar netleşir.
          drum.style.filter = `blur(${((1 - t) ** 2 * 3).toFixed(2)}px)`;
          const f = Math.floor(angle / STEP);
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
      setAngle(to % (Math.PI * 2));
      drum.style.filter = '';
      windowEl.classList.remove('spinning');
      // Seçilen üçgen tepeden merkeze kayıp büyür.
      const front = drum.children[face];
      front.classList.add('front');
      front.style.transition = reducedMotion() ? 'none' : 'transform 0.6s cubic-bezier(0.2, 1.4, 0.4, 1)';
      front.style.zIndex = '200';
      requestAnimationFrame(() => (front.style.transform = `translate(0px, 0px) scale(${geo.land.toFixed(3)})`));
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

  fitRadius();
  fillDrum(null);
  idle();
  const stopShake = onShake(ask);
  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    stopShake();
  };
}
