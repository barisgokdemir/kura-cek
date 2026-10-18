import { h, pageHeader, showResult, sound, sleep, vibrate, reducedMotion } from '../ui.js';
import { shuffle, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

export const meta = { route: 'kisa-cubuk', title: 'Kısa Çubuk', icon: '🥢' };

export function mount(root) {
  let dead = false;
  const namesEl = h('textarea', {
    rows: 4,
    placeholder: 'Her satıra bir isim (boş bırakırsan kişi sayısı kullanılır)',
    'aria-label': 'İsimler',
  });
  const countEl = h('input', { type: 'number', min: 2, max: 30, value: '4', 'aria-label': 'Kişi sayısı' });
  const shortEl = h('input', { type: 'number', min: 1, max: 29, value: '1', 'aria-label': 'Kısa çubuk sayısı' });
  const modeEl = h(
    'select',
    { 'aria-label': 'Mod', value: 'hepsi' },
    h('option', { value: 'hepsi' }, 'Hepsini birden çek'),
    h('option', { value: 'elden' }, 'Elden ele (sonuç sona kadar gizli)'),
  );
  const play = h('div', { class: 'sticks-play' });
  const resultSlot = h('div');

  root.append(
    pageHeader('Kısa Çubuk', 'Kötü işi kim yapacak? Kısa çubuğu çeken.', 'sticks'),
    h(
      'section',
      { class: 'panel open' },
      h('label', { class: 'field col' }, h('span', {}, 'İsimler'), namesEl),
      h(
        'div',
        { class: 'fields-2' },
        h('label', { class: 'field' }, h('span', {}, 'Kişi sayısı'), countEl),
        h('label', { class: 'field' }, h('span', {}, 'Kısa çubuk'), shortEl),
      ),
      h('label', { class: 'field col' }, h('span', {}, 'Mod'), modeEl),
      h('button', { class: 'btn primary big block', onclick: () => start(), html: icons.sticks }, 'Çubukları hazırla'),
    ),
    play,
    resultSlot,
  );

  function people() {
    const names = namesEl.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length >= 2) return names.slice(0, 30);
    const n = Math.max(2, Math.min(30, +countEl.value || 4));
    return Array.from({ length: n }, (_, i) => `Kişi ${i + 1}`);
  }

  async function start() {
    const names = people();
    const P = names.length;
    const N = Math.max(1, Math.min(P - 1, +shortEl.value || 1));
    shortEl.value = N;
    const mode = modeEl.value;
    resultSlot.replaceChildren();

    // Çubukların eldeki dizilişi çekilişten ÖNCE belirlenir ve mühürlenir.
    const layout = shuffle([...Array(N).fill(true), ...Array(P - N).fill(false)]);
    const record = await seal('kisa-cubuk', { people: names, short: N, mode }, layout.map((s) => (s ? 'kısa' : 'uzun')));
    const drawn = []; // [{name, pos}]

    const hand = h('div', { class: 'hand', role: 'group', 'aria-label': 'Eldeki çubuklar' });
    const fist = h('div', { class: 'fist', 'aria-hidden': 'true', style: { width: `min(92%, ${P * 22 + 70}px)` } });
    const out = h('div', { class: 'drawn' });
    const prompt = h('p', { class: 'center prompt', 'aria-live': 'polite' });
    const sticks = layout.map((isShort, pos) =>
      h('button', {
        class: `stick${isShort ? ' short' : ''}`,
        'aria-label': `Çubuk ${pos + 1}`,
        disabled: mode !== 'elden',
        onclick: () => pickBy(pos),
      }),
    );
    hand.append(...sticks, fist);

    play.replaceChildren(
      h('p', { class: 'commit' }, 'Çubuklar karıştırıldı ve mühürlendi', h('code', { title: 'Taahhüt kodu: çekilişten önce sabitlendi' }, record.code ?? '—')),
      prompt,
      hand,
      out,
    );

    const slow = !reducedMotion();
    // Telefonda form uzun; çekiliş alanını görünür yap.
    requestAnimationFrame(() => prompt.scrollIntoView({ behavior: slow ? 'smooth' : 'auto', block: 'start' }));

    function addDrawn(name, pos, hidden) {
      const card = h(
        'div',
        { class: `drawn-item${hidden ? ' hidden-result' : ''}` },
        h('span', {}, name),
        h('div', { class: `stick out${layout[pos] ? ' short' : ''}` }),
      );
      out.append(card);
      return card;
    }

    if (mode === 'hepsi') {
      prompt.textContent = 'Çekiliyor…';
      for (let i = 0; i < P; i++) {
        if (dead) return;
        sticks[i].classList.add('pulling');
        sound('tick');
        if (slow) await sleep(380);
        sticks[i].classList.add('gone');
        addDrawn(names[i], i, false);
        drawn.push({ name: names[i], pos: i });
      }
      finish();
    } else {
      nextTurn();
    }

    function nextTurn() {
      if (drawn.length === P) {
        prompt.textContent = 'Herkes çekti.';
        hand.classList.add('empty');
        play.append(
          h('div', { class: 'controls' }, h('button', { class: 'btn primary big', onclick: reveal, html: icons.bolt }, 'Sonuçları aç')),
        );
        return;
      }
      prompt.replaceChildren('Sıra: ', h('b', {}, names[drawn.length]), ' — bir çubuk seç');
    }

    async function pickBy(pos) {
      if (drawn.some((d) => d.pos === pos)) return;
      const name = names[drawn.length];
      sticks[pos].disabled = true;
      sticks[pos].classList.add('pulling');
      sound('tick');
      vibrate(20);
      if (slow) await sleep(300);
      sticks[pos].classList.add('gone');
      addDrawn(name, pos, true);
      drawn.push({ name, pos });
      nextTurn();
    }

    async function reveal(e) {
      e.target.closest('.controls')?.remove();
      for (const card of out.children) {
        card.classList.remove('hidden-result');
        if (slow) await sleep(250);
      }
      finish();
    }

    function finish() {
      prompt.textContent = '';
      hand.hidden = true;
      const losers = drawn.filter((d) => layout[d.pos]).map((d) => d.name);
      const summary = `${losers.join(', ')} kısa çubuğu çekti`;
      store.addHistory({ ...record }, summary);
      sound('lose');
      showResult(resultSlot, {
        title: losers.length > 1 ? 'Kısa çubuklar' : 'Kısa çubuk',
        big: losers.join(', '),
        detail: `${P} kişi · ${N} kısa çubuk`,
        record,
        onAgain: start,
        againLabel: 'Yeniden',
      });
      vibrate([60, 40, 60]);
    }
  }

  return () => {
    dead = true;
  };
}
