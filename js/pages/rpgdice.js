import { h, pageHeader, showResult, sound, vibrate, sleep, reducedMotion, stepper, toast } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

export const DICE = [4, 6, 8, 10, 12, 20, 100];
const MAX_DICE = 12;

// Zar renkleri: gövde (üst → alt), kenar, sayı rengi. Siyah varsayılan; sayılar her renkte okunaklı.
export const COLORS = {
  obsidyen: { name: 'Obsidyen', body: ['#2c2c3a', '#09090f'], edge: '#a78bfa', text: '#ffffff' },
  kan: { name: 'Kan kırmızısı', body: ['#4a0f1a', '#130307'], edge: '#fb7185', text: '#ffffff' },
  okyanus: { name: 'Okyanus', body: ['#0c2f4d', '#03101c'], edge: '#38bdf8', text: '#ffffff' },
  zehir: { name: 'Zehir yeşili', body: ['#0f3a22', '#03150b'], edge: '#4ade80', text: '#ffffff' },
  ametist: { name: 'Ametist', body: ['#55209e', '#1c0838'], edge: '#e879f9', text: '#ffffff' },
  altin: { name: 'Altın', body: ['#fbe08a', '#b8860b'], edge: '#fff6cf', text: '#1a1200' },
  fildisi: { name: 'Fildişi', body: ['#ffffff', '#d6d2c4'], edge: '#55557a', text: '#111118' },
};

// Zar silüetleri (100×100) ve yüz çizgileri; sayı, ön yüzün ortasına yazılır.
const SHAPES = {
  4: { outline: '50,6 95,88 5,88', facets: 'M50 6L50 62M5 88L50 62M95 88L50 62', ty: 70, size: 30 },
  6: { rect: true, facets: 'M22 22L78 22L78 78L22 78Z', ty: 52, size: 40 },
  8: { outline: '50,3 95,50 50,97 5,50', facets: 'M5 50L95 50M50 3L28 50M50 3L72 50', ty: 66, size: 28 },
  10: { outline: '50,3 94,44 50,97 6,44', facets: 'M50 3L30 58M50 3L70 58M30 58L70 58M6 44L30 58M94 44L70 58M30 58L50 97M70 58L50 97', ty: 46, size: 26 },
  12: { outline: '50,4 95,37 78,92 22,92 5,37', facets: 'M50 24L72 40L64 68L36 68L28 40Z M50 4L50 24M95 37L72 40M78 92L64 68M22 92L36 68M5 37L28 40', ty: 55, size: 26 },
  20: { outline: '50,3 93,27 93,73 50,97 7,73 7,27', facets: 'M50 22L76 66L24 66Z M50 3L50 22M93 27L50 22M93 27L76 66M93 73L76 66M50 97L76 66M50 97L24 66M7 73L24 66M7 27L24 66M7 27L50 22', ty: 54, size: 24 },
};
SHAPES[100] = { ...SHAPES[10] };

let gid = 0;
export function dieSvg(sides, value, colorKey) {
  const c = COLORS[colorKey] || COLORS.obsidyen;
  const s = SHAPES[sides];
  const id = `dg${++gid}`;
  const body = s.rect
    ? `<rect x="6" y="6" width="88" height="88" rx="16" fill="url(#${id})" stroke="${c.edge}" stroke-width="3"/>`
    : `<polygon points="${s.outline}" fill="url(#${id})" stroke="${c.edge}" stroke-width="3" stroke-linejoin="round"/>`;
  const txt = String(value ?? `d${sides}`);
  const size = value == null ? s.size * 0.62 : txt.length >= 3 ? s.size * 0.72 : txt.length === 2 ? s.size * 0.92 : s.size;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${c.body[0]}"/><stop offset="1" stop-color="${c.body[1]}"/></linearGradient></defs>${body}<path d="${s.facets}" fill="none" stroke="${c.edge}" stroke-width="1.6" opacity=".45"/><text x="50" y="${s.ty}" text-anchor="middle" dominant-baseline="middle" font-family="Sora, Inter, system-ui, sans-serif" font-weight="900" font-size="${size}" fill="${c.text}" stroke="${c.text === '#ffffff' ? '#000' : 'none'}" stroke-width="${c.text === '#ffffff' ? 2.5 : 0}" paint-order="stroke">${txt}</text>${sides === 100 ? `<text x="50" y="76" text-anchor="middle" font-family="Sora, system-ui, sans-serif" font-weight="800" font-size="11" fill="${c.edge}">%</text>` : ''}</svg>`;
}

// d20 avantaj: iki kez atılır, yüksek olan alınır; dezavantajda düşük olan.
export function rollPool(pool, adv) {
  return pool.map(({ sides, color }) => {
    const a = randomInt(1, sides);
    if (sides !== 20 || adv === 'normal') return { sides, color, value: a, rolls: [a] };
    const b = randomInt(1, sides);
    const value = adv === 'adv' ? Math.max(a, b) : Math.min(a, b);
    return { sides, color, value, rolls: [a, b] };
  });
}

const PRESETS = [
  ['1d20', [20]],
  ['2d6', [6, 6]],
  ['4d6 karakter', [6, 6, 6, 6]],
  ['1d100', [100]],
  ['Tam set', [4, 6, 8, 10, 12, 20, 100]],
];

export function mount(root) {
  const cfg = { pool: [{ sides: 20, color: 'obsidyen' }], color: 'obsidyen', mod: 0, adv: 'normal', ...(store.get().rpg || {}) };
  const persist = () => store.update((s) => (s.rpg = { ...cfg, pool: cfg.pool.map((d) => ({ ...d })) }));
  let busy = false;
  let dead = false;

  const tray = h('div', { class: 'rpg-tray', 'aria-live': 'polite' });
  const formula = h('p', { class: 'rpg-formula' });
  const resultSlot = h('div');
  const rollBtn = h('button', { class: 'btn primary big', onclick: () => roll(), html: icons.d20 }, 'Zarları at');
  const typeBtns = h(
    'div',
    { class: 'rpg-types', role: 'group', 'aria-label': 'Zar ekle' },
    DICE.map((sides) =>
      h(
        'button',
        { class: 'rpg-type', 'aria-label': `d${sides} ekle`, onclick: () => add(sides) },
        h('span', { class: 'rpg-type-art', 'data-sides': sides }),
        h('b', {}, `d${sides}`),
      ),
    ),
  );
  const swatches = h(
    'div',
    { class: 'rpg-swatches', role: 'radiogroup', 'aria-label': 'Zar rengi' },
    Object.entries(COLORS).map(([key, c]) =>
      h('button', {
        class: 'rpg-swatch',
        role: 'radio',
        'aria-checked': String(cfg.color === key),
        'aria-label': c.name,
        title: c.name,
        'data-key': key,
        style: { '--b1': c.body[0], '--b2': c.body[1], '--e': c.edge },
        onclick: () => setColor(key),
      }),
    ),
  );
  const colorName = h('span', { class: 'muted small' });
  const advCtl = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'd20 modu' },
    [
      ['dis', 'Dezavantaj'],
      ['normal', 'Normal'],
      ['adv', 'Avantaj'],
    ].map(([id, text]) =>
      h(
        'button',
        {
          role: 'radio',
          'aria-checked': String(cfg.adv === id),
          'data-id': id,
          onclick: () => {
            cfg.adv = id;
            persist();
            advCtl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
            renderTray();
          },
        },
        text,
      ),
    ),
  );

  root.append(
    pageHeader('RPG Zar Atma', 'd4’ten d100’e; zar ekle, rengini seç, at.', 'd20'),
    h('section', { class: 'rpg-board' }, tray, formula),
    h('div', { class: 'controls row wrap', style: { justifyContent: 'center' } }, rollBtn, h('button', { class: 'btn', onclick: clear }, 'Temizle')),
    resultSlot,
    h(
      'section',
      { class: 'panel open' },
      h('div', { class: 'field col' }, h('span', {}, 'Zar ekle (dokun)'), typeBtns),
      h('div', { class: 'field col' }, h('span', {}, 'Renk ', colorName), swatches),
      h('div', { class: 'chips' }, PRESETS.map(([label, list]) => h('button', { class: 'chip', onclick: () => preset(list) }, label))),
      h(
        'div',
        { class: 'field' },
        h('span', {}, 'Değiştirici (+/−)'),
        stepper({ value: cfg.mod, min: -20, max: 20, label: 'Değiştirici', onChange: (v) => ((cfg.mod = v), persist(), renderTray()) }),
      ),
      h('div', { class: 'field col' }, h('span', {}, 'd20 modu'), advCtl),
    ),
  );

  function setColor(key) {
    cfg.color = key;
    persist();
    swatches.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.key === key)));
    colorName.textContent = `· ${COLORS[key].name}`;
    typeBtns.querySelectorAll('.rpg-type-art').forEach((el) => (el.innerHTML = dieSvg(+el.dataset.sides, null, key)));
  }
  function add(sides) {
    if (cfg.pool.length >= MAX_DICE) return toast(`En fazla ${MAX_DICE} zar`);
    cfg.pool.push({ sides, color: cfg.color });
    persist();
    renderTray();
    sound('tick');
  }
  function preset(list) {
    cfg.pool = list.map((sides) => ({ sides, color: cfg.color }));
    persist();
    renderTray();
  }
  function clear() {
    cfg.pool = [];
    persist();
    renderTray();
    resultSlot.replaceChildren();
  }

  function formulaText() {
    const counts = {};
    cfg.pool.forEach((d) => (counts[d.sides] = (counts[d.sides] || 0) + 1));
    const dice = DICE.filter((s) => counts[s]).map((s) => `${counts[s]}d${s}`).join(' + ');
    if (!dice) return 'Zar ekle';
    return cfg.mod ? `${dice} ${cfg.mod > 0 ? '+' : '−'} ${Math.abs(cfg.mod)}` : dice;
  }

  function renderTray(results) {
    formula.textContent = formulaText() + (cfg.adv !== 'normal' && cfg.pool.some((d) => d.sides === 20) ? ` · d20 ${cfg.adv === 'adv' ? 'avantajlı' : 'dezavantajlı'}` : '');
    if (!cfg.pool.length) {
      tray.replaceChildren(h('p', { class: 'rpg-empty' }, 'Aşağıdan zar ekle'));
      return;
    }
    tray.replaceChildren(
      ...cfg.pool.map((d, i) =>
        h(
          'button',
          {
            class: 'rpg-die',
            'aria-label': `d${d.sides}${results ? `: ${results[i].value}` : ''} — kaldırmak için dokun`,
            onclick: () => {
              if (busy) return;
              cfg.pool.splice(i, 1);
              persist();
              renderTray();
            },
            html: dieSvg(d.sides, results ? results[i].value : null, d.color),
          },
        ),
      ),
    );
  }

  async function roll() {
    if (busy) return;
    if (!cfg.pool.length) return toast('Önce zar ekle');
    busy = true;
    rollBtn.disabled = true;
    resultSlot.replaceChildren();
    try {
      const results = rollPool(cfg.pool, cfg.adv);
      const sum = results.reduce((a, r) => a + r.value, 0);
      const total = sum + cfg.mod;
      const record = await seal(
        'rpg-zar',
        { formula: formulaText(), adv: cfg.adv, dice: cfg.pool.map((d) => `d${d.sides}`) },
        results.map((r) => (r.rolls.length > 1 ? r.rolls : r.value)),
      );
      renderTray();
      const els = [...tray.children];
      const slow = !reducedMotion();
      // Zarlar ekranın dışındaysa önce görünür alana gel.
      const box = tray.getBoundingClientRect();
      if (box.top < 70 || box.bottom > innerHeight - 70) tray.scrollIntoView({ behavior: slow ? 'smooth' : 'auto', block: 'center' });
      if (slow) {
        sound('roll');
        els.forEach((el, i) => {
          el.classList.add('tumble');
          el.style.setProperty('--tx', `${randomInt(-30, 30)}px`);
          el.style.setProperty('--rot', `${randomInt(2, 4) * 360 * (randomInt(0, 1) ? 1 : -1)}deg`);
          el.style.animationDelay = `${i * 50}ms`;
        });
        // Dönerken sayılar hızla değişir; sonuç zaten belli.
        const t0 = performance.now();
        while (performance.now() - t0 < 900) {
          els.forEach((el, i) => (el.innerHTML = dieSvg(cfg.pool[i].sides, randomInt(1, cfg.pool[i].sides), cfg.pool[i].color)));
          await sleep(70);
          if (dead) return;
        }
      }
      els.forEach((el, i) => {
        const r = results[i];
        el.classList.remove('tumble');
        el.innerHTML = dieSvg(r.sides, r.value, r.color);
        el.classList.add('landed');
        if (r.sides === 20 && r.value === 20) el.classList.add('crit');
        if (r.sides === 20 && r.value === 1) el.classList.add('fumble');
        if (r.rolls.length > 1) el.append(h('span', { class: 'rpg-alt' }, `${r.rolls.join(' / ')}`));
      });
      sound('land');
      vibrate(40);

      const crit = results.some((r) => r.sides === 20 && r.value === 20);
      const fumble = results.some((r) => r.sides === 20 && r.value === 1);
      const detail = [
        results.map((r) => `d${r.sides}: ${r.value}${r.rolls.length > 1 ? ` (${r.rolls.join('/')})` : ''}`).join(' · '),
        cfg.mod ? `${cfg.mod > 0 ? '+' : '−'}${Math.abs(cfg.mod)}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      store.addHistory(record, `${formulaText()} = ${total}${crit ? ' (kritik!)' : fumble ? ' (kritik başarısızlık)' : ''}`);
      showResult(resultSlot, {
        title: crit ? 'KRİTİK!' : fumble ? 'Kritik başarısızlık' : formulaText(),
        big: String(total),
        detail,
        record,
        onAgain: roll,
        againLabel: 'Tekrar at',
        celebrate: crit,
      });
      if (fumble) sound('lose');
    } finally {
      busy = false;
      rollBtn.disabled = false;
    }
  }

  setColor(cfg.color);
  renderTray();
  return () => {
    dead = true;
  };
}
