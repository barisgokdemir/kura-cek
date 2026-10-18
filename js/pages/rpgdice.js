import { h, pageHeader, showResult, sound, vibrate, sleep, reducedMotion, stepper, toast } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';
import { createStage, webglAvailable, easeOutCubic } from '../three/stage.js';
import { buildDie, faceQuaternion, percentileFaces, highlightFace } from '../three/polydice.js';

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

  const use3D = !reducedMotion() && webglAvailable();
  const tray = h('div', { class: use3D ? 'rpg-chips' : 'rpg-tray', 'aria-live': 'polite' });
  const stageEl = h('div', { class: 'rpg-stage', hidden: !use3D, role: 'button', tabindex: '0', 'aria-label': 'Zarları atmak için dokun', onclick: () => roll() });
  let stage = null;
  let meshes = [];
  let lastResults = null; // son atış: yeniden yerleşimde zarlar sonuçta kalsın
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
    h('section', { class: 'rpg-board' }, stageEl, formula, tray),
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
      if (use3D) build3D();
      return;
    }
    if (use3D) {
      tray.replaceChildren(
        ...cfg.pool.map((d, i) =>
          h(
            'button',
            {
              class: 'rpg-chip',
              'aria-label': `d${d.sides} zarını kaldır`,
              onclick: () => {
                if (busy) return;
                cfg.pool.splice(i, 1);
                persist();
                renderTray();
              },
            },
            h('span', { html: dieSvg(d.sides, null, d.color) }),
            h('b', {}, `d${d.sides}`),
            h('span', { class: 'rpg-chip-x', html: icons.cross }),
          ),
        ),
      );
      if (!results) {
        lastResults = null;
        build3D();
      }
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
      if (use3D && stage) {
        await roll3D(results);
        if (dead) return;
      }
      renderTray(use3D ? results : undefined);
      const els = use3D ? [] : [...tray.children];
      const slow = !reducedMotion() && !use3D;
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

  // ---------- 3D ----------
  // Havuzdaki zarlar sahnedeki parçalara açılır: d100 = onlar + birler zarı,
  // avantajlı d20 = iki zar (düşen soluk).
  function expand(results) {
    const items = [];
    cfg.pool.forEach((d, i) => {
      const r = results?.[i];
      const color = COLORS[d.color] || COLORS.obsidyen;
      if (d.sides === 100) {
        const pf = percentileFaces(r ? r.value : 100);
        items.push({ kind: 'tens', color, value: pf.tens, pair: 'a' }, { kind: 'units', color, value: pf.units, pair: 'b' });
      } else if (r && r.rolls.length > 1) {
        const keep = r.rolls.indexOf(r.value);
        r.rolls.forEach((v, k) => items.push({ kind: 'd20', color, value: v, dropped: k !== keep, crit: v === 20 && k === keep, fumble: v === 1 && k === keep }));
      } else {
        const v = r ? r.value : d.sides;
        items.push({ kind: `d${d.sides}`, color, value: v, crit: r && d.sides === 20 && v === 20, fumble: r && d.sides === 20 && v === 1 });
      }
    });
    return items;
  }

  function clearMeshes() {
    for (const m of meshes) {
      stage.scene.remove(m);
      // Sayı dokuları önbellekte paylaşılır; yalnızca geometri ve malzeme bırakılır.
      m.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    meshes = [];
  }

  function layout(n, hasPairs) {
    const w = stageEl.clientWidth || 340;
    let cols = Math.max(1, Math.min(n, w < 480 ? 3 : 5));
    // d100 çiftleri satır sonunda bölünmesin: çift varsa sütun sayısı çift olur.
    if (hasPairs && cols % 2) cols = cols === 1 ? 2 : n > cols ? cols + 1 : cols - 1 || 2;
    const rows = Math.max(1, Math.ceil(n / cols));
    const cell = w / cols;
    stageEl.style.height = `${Math.round(Math.min(640, Math.max(220, rows * cell * 0.86 + 40)))}px`;
    stage.resize();
    const gap = 2.75;
    const { camera } = stage;
    // Kamera hafif eğik; uzak sıra küçülüp yukarı kaydığı için dikeyde pay bırakılır.
    const halfW = (cols * gap) / 2 + 0.35;
    const halfH = (rows * gap) / 2 + 0.9;
    const t = Math.tan(((camera.fov / 2) * Math.PI) / 180);
    const D = Math.max(halfW / (t * camera.aspect), halfH / t) * 1.02;
    camera.position.set(0, D, D * 0.3);
    camera.lookAt(0, 0, -0.35);
    camera.updateMatrixWorld();
    return Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / cols);
      const inRow = r === rows - 1 ? n - r * cols : cols;
      return [((i % cols) - (inRow - 1) / 2) * gap, (r - (rows - 1) / 2) * gap];
    });
  }

  function restQuaternion(die, value) {
    const { THREE, camera } = stage;
    const toCam = new THREE.Vector3().subVectors(camera.position, die.position).normalize();
    const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    return faceQuaternion(THREE, die, value, toCam, screenUp);
  }

  function build3D(results) {
    if (!stage) return [];
    clearMeshes();
    // d100 çiftleri öne alınır ve çift sütunlu yerleşimde hep aynı satırda yan yana durur.
    const all = expand(results);
    const items = [...all.filter((it) => it.pair), ...all.filter((it) => !it.pair)];
    const spots = layout(items.length, items.some((it) => it.pair));
    // d100 çifti aynı satırdaysa birbirine yaklaşır: tek bir yüzdelik zar gibi okunur.
    items.forEach((it, i) => {
      if (it.pair === 'a' && items[i + 1]?.pair === 'b' && spots[i][1] === spots[i + 1][1]) {
        spots[i][0] += 0.32;
        spots[i + 1][0] -= 0.32;
      }
    });
    items.forEach((it, i) => {
      const die = buildDie(stage.THREE, it.kind, it.color);
      die.position.set(spots[i][0], 1.2, spots[i][1]);
      die.userData.item = it;
      stage.scene.add(die);
      die.quaternion.copy(restQuaternion(die, it.value));
      meshes.push(die);
      highlightFace(die, results ? it.value : null);
      if (results) mark(die);
    });
    stage.render();
    return items;
  }

  function resetMark(die) {
    const { bodyMat, edges } = die.userData;
    bodyMat.emissive.set(0x000000);
    edges.material.color.set(die.userData.edgeColor);
    die.userData.body.material.opacity = 1;
    edges.material.opacity = 0.9;
  }

  function mark(die) {
    const it = die.userData.item;
    const { bodyMat, edges } = die.userData;
    if (it.dropped) {
      die.traverse((o) => o.material && ((o.material.transparent = true), (o.material.opacity = Math.min(o.material.opacity, 0.28))));
    }
    if (it.crit) {
      bodyMat.emissive.set(0x6b4a00);
      edges.material.color.set('#facc15');
    }
    if (it.fumble) {
      bodyMat.emissive.set(0x5a0012);
      edges.material.color.set('#fb7185');
    }
  }

  async function roll3D(results) {
    const { THREE } = stage;
    lastResults = results;
    build3D(results);
    meshes.forEach((m) => (resetMark(m), highlightFace(m, null)));
    const box = stageEl.getBoundingClientRect();
    if (box.top < 70 || box.bottom > innerHeight - 70) stageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const plans = meshes.map((die, i) => {
      const finalQ = die.quaternion.clone();
      const final = new THREE.Euler().setFromQuaternion(finalQ);
      const spin = () => randomInt(2, 4) * Math.PI * 2 * (randomInt(0, 1) ? 1 : -1);
      const to = die.position.clone();
      const from = to.clone().add(new THREE.Vector3(randomInt(-30, 30) / 10, 6 + randomInt(0, 20) / 10, -4 - randomInt(0, 20) / 10));
      return { die, final, spins: [spin(), spin(), spin()], from, to, delay: i * 0.035 };
    });
    sound('roll');
    let ticked = 0;
    await stage.animate(1600, (t) => {
      for (const p of plans) {
        const k = Math.min(1, Math.max(0, (t - p.delay) / (1 - p.delay)));
        const e = easeOutCubic(k);
        p.die.position.x = p.from.x + (p.to.x - p.from.x) * e;
        p.die.position.z = p.from.z + (p.to.z - p.from.z) * e;
        // Düşüp sekerek durur.
        p.die.position.y = p.to.y + p.from.y * (1 - k) ** 2 * Math.abs(Math.cos(k * Math.PI * 2.5));
        p.die.rotation.set(p.final.x + p.spins[0] * (1 - e), p.final.y + p.spins[1] * (1 - e), p.final.z + p.spins[2] * (1 - e), p.final.order);
      }
      const bounce = Math.floor(t * 5);
      if (bounce > ticked && t < 0.9) {
        ticked = bounce;
        sound('tick');
      }
    });
    for (const p of plans) {
      p.die.position.copy(p.to);
      p.die.rotation.copy(p.final);
      highlightFace(p.die, p.die.userData.item.value);
      mark(p.die);
    }
    stage.render();
  }

  async function init3D() {
    stage = await createStage(stageEl, { cameraPos: [0, 12, 4], fov: 34, accent: 0xff6b3d });
    if (dead) return stage.dispose();
    renderTray();
    const ro = new ResizeObserver(() => !busy && build3D(lastResults));
    ro.observe(stageEl);
    stage.onDispose = () => ro.disconnect();
  }

  setColor(cfg.color);
  renderTray();
  if (use3D) {
    init3D().catch(() => {
      // WebGL açılamazsa 2D çizime dön.
      stageEl.hidden = true;
    });
  }
  return () => {
    dead = true;
    stage?.onDispose?.();
    stage?.dispose();
  };
}
