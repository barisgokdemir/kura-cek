import { h, pageHeader, showResult, sound, vibrate, sleep, reducedMotion } from '../ui.js';
import { pick, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';
import { onShake } from './coin.js';

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

export function mount(root) {
  let mode = store.get().orbMode || 'classic';
  let busy = false;
  let dead = false;

  const question = h('input', { type: 'text', class: 'orb-q', maxLength: 120, placeholder: 'Sorunu yaz (isteğe bağlı)', 'aria-label': 'Soru' });
  const answerEl = h('span', { class: 'orb-answer' }, '8');
  const windowEl = h('div', { class: 'orb-window' }, h('div', { class: 'orb-tri' }, answerEl));
  const orbEl = h('button', { class: 'orb', 'aria-label': 'Küreyi salla', onclick: () => ask() }, windowEl);
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
          },
        },
        label,
      ),
    ),
  );

  root.append(
    pageHeader('Sihirli Küre', 'Sorunu aklından geçir, küreye dokun ya da telefonu salla.', 'orb'),
    question,
    h('div', { class: 'orb-wrap' }, orbEl),
    h('div', { class: 'controls' }, h('button', { class: 'btn primary big', onclick: () => ask(), html: icons.orb }, 'Küreye sor')),
    resultSlot,
    h('section', { class: 'panel open' }, h('div', { class: 'field col' }, h('span', {}, 'Cevaplar'), modeCtl)),
  );

  async function ask() {
    if (busy) return;
    busy = true;
    resultSlot.replaceChildren();
    try {
      const [text, tone] = pick(ANSWERS[mode]);
      const q = question.value.trim();
      const record = await seal('sihirli-kure', { question: q, mode }, text);
      windowEl.classList.remove('show', 'yes', 'no', 'maybe');
      if (!reducedMotion()) {
        orbEl.classList.remove('shake');
        void orbEl.offsetWidth;
        orbEl.classList.add('shake');
        for (let i = 0; i < 6; i++) {
          sound('tick');
          await sleep(170);
          if (dead) return;
        }
        orbEl.classList.remove('shake');
      }
      answerEl.textContent = text;
      void windowEl.offsetWidth;
      windowEl.classList.add('show', tone);
      sound(tone === 'no' ? 'lose' : tone === 'yes' ? 'win' : 'land');
      vibrate(40);
      store.addHistory(record, q ? `${q} → ${text}` : text);
      showResult(resultSlot, {
        title: q || 'Küre diyor ki',
        big: text,
        record,
        onAgain: ask,
        againLabel: 'Yeniden sor',
      });
    } finally {
      busy = false;
    }
  }

  const stopShake = onShake(ask);
  return () => {
    dead = true;
    stopShake();
  };
}
