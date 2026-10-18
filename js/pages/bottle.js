import { h, pageHeader, showResult, sound, reducedMotion, parseLines, stepper } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';
import { createStage, webglAvailable, easeOutQuart } from '../three/stage.js';
import { onShake } from './coin.js';

const TAU = Math.PI * 2;

// Kişi i, tepeden (π/2) başlayıp saat yönünde dizilir. Açılar ekran düzleminde, saat yönünün tersi pozitif.
const seatAngle = (i, n) => Math.PI / 2 - (i * TAU) / n;
const norm = (a) => ((a % TAU) + TAU) % TAU;

export function mount(root) {
  const saved = store.get().bottle || { names: '', count: 6 };
  let count = saved.count;
  let names = [];
  let angle = Math.PI / 2; // şişe ağzının baktığı yön
  let busy = false;
  let dead = false;
  let stage = null;
  let bottle = null;

  const stageEl = h('div', { class: 'stage bottle-stage', tabindex: '0', role: 'button', 'aria-label': 'Şişeyi çevirmek için dokun' });
  const seatsEl = h('div', { class: 'seats', 'aria-hidden': 'true' });
  const hint = h('span', { class: 'stage-hint' }, 'Dokun · salla');
  const resultSlot = h('div');
  const spinBtn = h('button', { class: 'btn primary big', onclick: () => spin(), html: icons.bottle }, 'Şişeyi çevir');
  const namesEl = h('textarea', {
    rows: 4,
    value: saved.names,
    placeholder: 'Her satıra bir isim (boş bırakırsan numara kullanılır)',
    'aria-label': 'İsimler',
    oninput: () => {
      persist();
      layoutSeats();
    },
  });
  const countCtl = stepper({
    value: count,
    min: 2,
    max: 12,
    label: 'Kişi sayısı',
    onChange: (v) => {
      count = v;
      persist();
      layoutSeats();
    },
  });

  root.append(
    pageHeader('Şişe Çevirme', 'Şişe kimi gösterirse sıra onda.', 'bottle'),
    stageEl,
    h('div', { class: 'controls' }, spinBtn),
    resultSlot,
    h(
      'details',
      { class: 'panel' },
      h('summary', {}, 'Oyuncular'),
      h('label', { class: 'field col' }, h('span', {}, 'İsimler'), namesEl),
      h('div', { class: 'field' }, h('span', {}, 'İsim yoksa kişi sayısı'), countCtl),
    ),
  );

  function persist() {
    store.update((s) => (s.bottle = { names: namesEl.value, count }));
  }

  function currentNames() {
    const list = parseLines(namesEl.value).slice(0, 16);
    return list.length >= 2 ? list : Array.from({ length: count }, (_, i) => String(i + 1));
  }

  function layoutSeats() {
    names = currentNames();
    const w = stageEl.clientWidth;
    const hh = stageEl.clientHeight;
    const R = Math.min(w, hh) / 2 - 34;
    seatsEl.replaceChildren(
      ...names.map((n, i) => {
        const a = seatAngle(i, names.length);
        return h(
          'span',
          { class: 'seat', style: { left: `${w / 2 + Math.cos(a) * R}px`, top: `${hh / 2 - Math.sin(a) * R}px` } },
          n,
        );
      }),
    );
    markSeat(-1);
  }

  function pointedSeat(a) {
    const n = names.length;
    const seg = TAU / n;
    // seatAngle(i) = π/2 - i·seg  →  i = (π/2 - a) / seg
    return Math.round(norm(Math.PI / 2 - a) / seg) % n;
  }

  function markSeat(i) {
    [...seatsEl.children].forEach((el, k) => el.classList.toggle('near', k === i));
  }

  // ---------- Görünüm ----------
  const svgBottle = h('div', { class: 'bottle2d', html: BOTTLE_SVG });

  function apply(a) {
    if (bottle) {
      bottle.rotation.y = a;
      stage.render();
    } else {
      svgBottle.style.transform = `translate(-50%, -50%) rotate(${-a}rad)`;
    }
  }

  async function init3D() {
    stage = await createStage(stageEl, { cameraPos: [0, 10, 0.001], accent: 0xa78bfa });
    if (dead) return stage.dispose();
    const { THREE, scene, camera } = stage;
    camera.position.set(0, 10, 0.001);
    camera.lookAt(0, 0, 0);
    // Şişe profili (alt → ağız), Lathe ile döndürülür.
    const pts = [
      [0, 0], [0.5, 0], [0.56, 0.06], [0.56, 1.55], [0.5, 1.8], [0.28, 2.15], [0.19, 2.45], [0.19, 2.85], [0.23, 2.9], [0.23, 3.02], [0, 3.02],
    ].map(([x, y]) => new THREE.Vector2(x, y - 1.5));
    const glass = new THREE.Mesh(
      new THREE.LatheGeometry(pts, 40),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.82 }),
    );
    glass.castShadow = true;
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.575, 0.575, 0.7, 40, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.4, emissive: 0x3b2a7a }),
    );
    label.position.y = -0.4;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 24), new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.3 }));
    cap.position.y = 1.56;
    const body = new THREE.Group();
    body.add(glass, label, cap);
    body.rotation.z = -Math.PI / 2; // ekseni +x'e yatır: ağız +x yönünde
    bottle = new THREE.Group();
    bottle.add(body);
    bottle.position.y = 0.58;
    scene.add(bottle);
    stageEl.append(seatsEl, hint);
    apply(angle);
  }

  async function spin() {
    if (busy) return;
    busy = true;
    spinBtn.disabled = true;
    resultSlot.replaceChildren();
    try {
      layoutSeats();
      const n = names.length;
      const winner = randomInt(0, n - 1);
      const record = await seal('sise-cevirme', { people: names }, names[winner]);
      // Hedef: kazananın koltuğu, dilim içinde kenara yakın olmayan bir sapma ile.
      const seg = TAU / n;
      const target = seatAngle(winner, n) + (randomInt(-30, 30) / 100) * seg;
      const turns = reducedMotion() ? 0 : 4 + randomInt(0, 2);
      const from = angle;
      const to = from + turns * TAU + norm(target - from);
      const duration = reducedMotion() ? 300 : 4200;
      let last = -1;
      await new Promise((resolve) => {
        const t0 = performance.now();
        const frame = (now) => {
          if (dead) return resolve();
          const t = Math.min(1, (now - t0) / duration);
          angle = from + (to - from) * easeOutQuart(t);
          apply(angle);
          const p = pointedSeat(angle);
          if (p !== last) {
            last = p;
            markSeat(p);
            sound('tick');
          }
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      if (dead) return;
      angle = norm(to);
      markSeat(winner);
      seatsEl.children[winner]?.classList.add('win');
      store.addHistory(record, `Şişe ${names[winner]} kişisini gösterdi`);
      showResult(resultSlot, {
        title: 'Şişe gösterdi',
        big: /^\d+$/.test(names[winner]) ? `${names[winner]}. kişi` : names[winner],
        detail: `${n} kişi arasından`,
        record,
        onAgain: spin,
        againLabel: 'Tekrar çevir',
        celebrate: true,
      });
    } finally {
      busy = false;
      spinBtn.disabled = false;
    }
  }

  stageEl.addEventListener('click', spin);
  stageEl.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), spin()));
  const stopShake = onShake(spin);
  const ro = new ResizeObserver(() => layoutSeats());
  ro.observe(stageEl);

  if (!reducedMotion() && webglAvailable()) {
    init3D().catch(() => {
      stageEl.append(svgBottle, seatsEl, hint);
      apply(angle);
    });
  } else {
    stageEl.append(svgBottle, seatsEl, hint);
    apply(angle);
  }
  layoutSeats();

  return () => {
    dead = true;
    stopShake();
    ro.disconnect();
    stage?.dispose();
  };
}

// 2D yedek: ağzı sağa (+x) bakan şişe.
const BOTTLE_SVG = `<svg viewBox="0 0 200 60" aria-hidden="true">
  <defs><linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86efac"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs>
  <path d="M10 8h90c10 0 18 6 28 12h36v20h-36c-10 6-18 12-28 12H10a6 6 0 01-6-6V14a6 6 0 016-6z" fill="url(#bg2)" opacity=".9"/>
  <rect x="30" y="8" width="40" height="44" fill="#a78bfa"/>
  <rect x="164" y="18" width="10" height="24" rx="2" fill="#fbbf24"/>
</svg>`;
