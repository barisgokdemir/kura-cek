import { h, pageHeader, showResult, sound, vibrate, sleep, reducedMotion, parseLines, stepper } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';
import { TEKERLEMELER, syllablesOf } from '../data/tekerlemeler.js';

const TAU = Math.PI * 2;
const SPEEDS = { slow: 430, normal: 290, fast: 170 };

// Sayışmanın sonucu: başlangıç kişisi ve hece sayısı belli olunca tamamen belirlidir.
// "ebe": son hecenin gösterdiği kişi ebe olur.
// "eleme": her turda son hecenin gösterdiği kişi kurtulur ve çıkar; kalan son kişi ebe olur.
export function countOut(n, start, syllables, mode) {
  if (mode === 'ebe') return { ebe: (start + syllables - 1) % n, saved: [] };
  const left = [...Array(n).keys()];
  const saved = [];
  let pos = start % n;
  while (left.length > 1) {
    const idx = (pos + syllables - 1) % left.length;
    saved.push(left[idx]);
    left.splice(idx, 1);
    pos = idx % left.length;
  }
  return { ebe: left[0], saved };
}

export function mount(root) {
  const cfg = { names: '', count: 6, rhyme: 'random', custom: '', mode: 'ebe', speed: 'normal', ...(store.get().counting || {}) };
  const persist = () => store.update((s) => (s.counting = { ...cfg }));
  let busy = false;
  let dead = false;
  let skip = false;
  let names = [];

  const stageEl = h('div', { class: 'stage count-stage' });
  const seatsEl = h('div', { class: 'seats', 'aria-hidden': 'true' });
  const sylEl = h('div', { class: 'count-syl', 'aria-hidden': 'true' });
  const lineEl = h('div', { class: 'count-line', 'aria-live': 'off' });
  stageEl.append(seatsEl, h('div', { class: 'count-center' }, sylEl, lineEl));
  const resultSlot = h('div');
  const startBtn = h('button', { class: 'btn primary big', onclick: () => run(), html: icons.chant }, 'Saymaya başla');
  const skipBtn = h('button', { class: 'btn', hidden: true, onclick: () => (skip = true) }, 'Sonuca geç');

  const namesEl = h('textarea', {
    rows: 4,
    value: cfg.names,
    placeholder: 'Her satıra bir isim (boş bırakırsan numara kullanılır)',
    'aria-label': 'İsimler',
    oninput: (e) => ((cfg.names = e.target.value), persist(), layout()),
  });
  const rhymeSel = h(
    'select',
    { 'aria-label': 'Tekerleme', value: cfg.rhyme, onchange: (e) => ((cfg.rhyme = e.target.value), persist(), preview()) },
    h('option', { value: 'random' }, 'Rastgele tekerleme'),
    TEKERLEMELER.map((t, i) => h('option', { value: String(i) }, t.title)),
    h('option', { value: 'custom' }, 'Kendi tekerlemem'),
  );
  const customEl = h('textarea', {
    rows: 4,
    value: cfg.custom,
    placeholder: 'Kendi tekerlemeni yaz, her satıra bir dize',
    'aria-label': 'Kendi tekerlemen',
    oninput: (e) => ((cfg.custom = e.target.value), persist(), preview()),
  });
  const previewEl = h('div', { class: 'rhyme-preview' });

  const seg = (label, key, options) => {
    const el = h(
      'div',
      { class: 'segmented', role: 'radiogroup', 'aria-label': label },
      options.map(([id, text]) =>
        h(
          'button',
          {
            role: 'radio',
            'aria-checked': String(cfg[key] === id),
            'data-id': id,
            onclick: () => {
              cfg[key] = id;
              persist();
              el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
            },
          },
          text,
        ),
      ),
    );
    return el;
  };

  root.append(
    pageHeader('Sayışmaca', 'Tekerleme hece hece sayar; son hece kime denk gelirse…', 'chant'),
    stageEl,
    h('div', { class: 'controls row wrap', style: { justifyContent: 'center' } }, startBtn, skipBtn),
    resultSlot,
    h(
      'section',
      { class: 'panel open' },
      h('label', { class: 'field col' }, h('span', {}, 'Tekerleme'), rhymeSel),
      customEl,
      previewEl,
      h(
        'div',
        { class: 'field col' },
        h('span', {}, 'Nasıl seçilsin?'),
        seg('Mod', 'mode', [
          ['ebe', 'Son hece ebe olur'],
          ['eleme', 'Eleme: kalan son kişi ebe'],
        ]),
      ),
      h('div', { class: 'field col' }, h('span', {}, 'Hız'), seg('Hız', 'speed', [['slow', 'Yavaş'], ['normal', 'Normal'], ['fast', 'Hızlı']])),
    ),
    h(
      'details',
      { class: 'panel' },
      h('summary', {}, 'Oyuncular'),
      h('label', { class: 'field col' }, h('span', {}, 'İsimler'), namesEl),
      h(
        'div',
        { class: 'field' },
        h('span', {}, 'İsim yoksa kişi sayısı'),
        stepper({ value: cfg.count, min: 2, max: 16, label: 'Kişi sayısı', onChange: (v) => ((cfg.count = v), persist(), layout()) }),
      ),
    ),
    h('p', { class: 'muted small center' }, 'Tekerlemeler halk kaynaklarından derlendi; yöreden yöreye farklı söylenebilir. Saymanın kimden başlayacağını uygulama rastgele seçer, böylece kimse sonucu ayarlayamaz.'),
  );

  function currentNames() {
    const list = parseLines(namesEl.value).slice(0, 16);
    return list.length >= 2 ? list : Array.from({ length: cfg.count }, (_, i) => String(i + 1));
  }

  function rhymeLines(choice) {
    if (choice === 'custom') return parseLines(cfg.custom);
    return TEKERLEMELER[+choice]?.lines || [];
  }

  function preview() {
    customEl.hidden = cfg.rhyme !== 'custom';
    if (cfg.rhyme === 'random') {
      previewEl.replaceChildren(h('p', { class: 'muted small' }, `${TEKERLEMELER.length} tekerlemeden biri rastgele seçilir.`));
      return;
    }
    const lines = rhymeLines(cfg.rhyme);
    const n = lines.flatMap(syllablesOf).length;
    previewEl.replaceChildren(
      ...lines.map((l) => h('p', {}, l)),
      n ? h('p', { class: 'muted small' }, `${n} hece`) : '',
    );
  }

  function layout() {
    names = currentNames();
    const w = stageEl.clientWidth;
    const hh = stageEl.clientHeight;
    const R = Math.min(w, hh) / 2 - 34;
    seatsEl.replaceChildren(
      ...names.map((n, i) => {
        const a = Math.PI / 2 - (i * TAU) / names.length;
        return h('span', { class: 'seat', style: { left: `${w / 2 + Math.cos(a) * R}px`, top: `${hh / 2 - Math.sin(a) * R}px` } }, n);
      }),
    );
  }

  async function run() {
    if (busy) return;
    layout();
    let choice = cfg.rhyme;
    if (choice === 'custom' && !rhymeLines('custom').flatMap(syllablesOf).length) return;
    busy = true;
    skip = false;
    startBtn.disabled = true;
    skipBtn.hidden = false;
    resultSlot.replaceChildren();
    try {
      if (choice === 'random') choice = String(randomInt(0, TEKERLEMELER.length - 1));
      const lines = rhymeLines(choice);
      const title = choice === 'custom' ? 'Kendi tekerlemen' : TEKERLEMELER[+choice].title;
      const syl = lines.map((l) => syllablesOf(l));
      const flat = syl.flat();
      const n = names.length;
      const start = randomInt(0, n - 1);
      const { ebe, saved } = countOut(n, start, flat.length, cfg.mode);
      const record = await seal(
        'sayismaca',
        { people: names, rhyme: title, syllables: flat.length, mode: cfg.mode, start: names[start] },
        { ebe: names[ebe], saved: saved.map((i) => names[i]) },
      );
      const seats = [...seatsEl.children];
      seats.forEach((s) => s.classList.remove('near', 'win', 'saved'));
      const slow = !reducedMotion();

      // Bir tur: hece hece kalanlar arasında ilerler.
      const left = [...Array(n).keys()];
      let pos = start;
      const rounds = cfg.mode === 'ebe' ? 1 : n - 1;
      for (let r = 0; r < rounds; r++) {
        const step = SPEEDS[cfg.speed] * (r === 0 ? 1 : 0.7);
        let k = 0;
        for (let li = 0; li < syl.length; li++) {
          for (let si = 0; si < syl[li].length; si++, k++) {
            const who = left[(pos + k) % left.length];
            if (slow && !skip) {
              seats.forEach((s, i) => s.classList.toggle('near', i === who));
              sylEl.textContent = syl[li][si];
              sylEl.classList.remove('beat');
              void sylEl.offsetWidth;
              sylEl.classList.add('beat');
              lineEl.replaceChildren(
                ...syl[li].map((x, xi) => h('span', { class: xi === si ? 'on' : xi < si ? 'done' : '' }, x)),
              );
              sound('tick');
              await sleep(step);
              if (dead) return;
            }
          }
        }
        if (cfg.mode === 'eleme') {
          const idx = (pos + flat.length - 1) % left.length;
          const out = left[idx];
          left.splice(idx, 1);
          pos = idx % left.length;
          seats[out].classList.remove('near');
          seats[out].classList.add('saved');
          if (slow && !skip) {
            sylEl.textContent = `${names[out]} kurtuldu`;
            vibrate(20);
            await sleep(700);
            if (dead) return;
          }
        }
      }
      seats.forEach((s, i) => {
        s.classList.remove('near');
        s.classList.toggle('win', i === ebe);
      });
      sylEl.textContent = 'Ebe!';
      lineEl.textContent = title;
      const ebeName = /^\d+$/.test(names[ebe]) ? `${names[ebe]}. kişi` : names[ebe];
      store.addHistory(record, `${title}: ${ebeName} ebe`);
      showResult(resultSlot, {
        title: `${title} · ${flat.length} hece`,
        big: `${ebeName} ebe!`,
        detail: `Saymaya başlayan: ${names[start]}${cfg.mode === 'eleme' ? ` · kurtulma sırası: ${saved.map((i) => names[i]).join(', ')}` : ''}`,
        record,
        onAgain: run,
        againLabel: 'Yeniden say',
        celebrate: true,
      });
    } finally {
      busy = false;
      startBtn.disabled = false;
      skipBtn.hidden = true;
    }
  }

  const ro = new ResizeObserver(() => !busy && layout());
  ro.observe(stageEl);
  layout();
  preview();
  sylEl.textContent = 'Hazır';
  lineEl.textContent = 'İsimleri yaz, tekerlemeni seç';

  return () => {
    dead = true;
    ro.disconnect();
  };
}
