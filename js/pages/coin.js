import { h, pageHeader, showResult, sound, sleep, reducedMotion } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';
import { createStage, webglAvailable, canvasTexture, easeOutCubic } from '../three/stage.js';

const MODES = [
  { id: 'single', label: 'Tek atış' },
  { id: 'bo3', label: "3'te 2", need: 2 },
  { id: 'bo5', label: "5'te 3", need: 3 },
];

export const meta = { route: 'yazi-tura', title: 'Yazı-Tura', icon: '🪙' };

export function mount(root) {
  const labels = [...store.get().coin.labels];
  let count = 1;
  let mode = 'single';
  let busy = false;
  const stats = [0, 0];
  let stage = null;
  let coins = [];
  let dead = false;

  const stageEl = h('div', { class: 'stage', tabindex: '0', 'aria-label': 'Parayı atmak için dokun' });
  const resultSlot = h('div');
  const statsEl = h('p', { class: 'muted center' });
  const throwBtn = h('button', { class: 'btn primary big', onclick: () => flip() }, 'Parayı at');

  const countOut = h('output', {}, '1');
  const countCtl = h(
    'div',
    { class: 'stepper' },
    h('button', { class: 'btn icon', 'aria-label': 'Azalt', onclick: () => setCount(count - 1) }, '−'),
    countOut,
    h('button', { class: 'btn icon', 'aria-label': 'Arttır', onclick: () => setCount(count + 1) }, '+'),
  );

  const modeCtl = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'Mod' },
    MODES.map((m) =>
      h('button', { role: 'radio', 'aria-checked': String(m.id === mode), 'data-id': m.id, onclick: () => setMode(m.id) }, m.label),
    ),
  );

  const labelInputs = labels.map((l, i) =>
    h('input', {
      type: 'text',
      maxLength: 14,
      value: l,
      'aria-label': i === 0 ? 'Birinci yüz' : 'İkinci yüz',
      onchange: (e) => {
        labels[i] = e.target.value.trim() || (i ? 'Tura' : 'Yazı');
        e.target.value = labels[i];
        store.update((s) => (s.coin.labels = [...labels]));
        rebuild();
        renderStats();
      },
    }),
  );

  root.append(
    pageHeader('Yazı-Tura', 'Dokun, yukarı kaydır ya da salla.'),
    stageEl,
    h('div', { class: 'controls' }, throwBtn),
    resultSlot,
    statsEl,
    h(
      'details',
      { class: 'panel' },
      h('summary', {}, 'Ayarlar'),
      h('label', { class: 'field' }, h('span', {}, 'Para sayısı'), countCtl),
      h('div', { class: 'field' }, h('span', {}, 'Seri'), modeCtl),
      h('div', { class: 'field' }, h('span', {}, 'Yüz etiketleri'), h('div', { class: 'row' }, labelInputs)),
    ),
  );

  function setCount(n) {
    count = Math.max(1, Math.min(10, n));
    countOut.textContent = count;
    if (count > 1 && mode !== 'single') setMode('single');
    rebuild();
  }
  function setMode(id) {
    mode = id;
    modeCtl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
    if (id !== 'single' && count !== 1) setCount(1);
  }
  function renderStats() {
    const total = stats[0] + stats[1];
    statsEl.textContent = total ? `Bu oturum: ${labels[0]} ${stats[0]} · ${labels[1]} ${stats[1]}` : '';
  }

  // ---------- 3D ----------
  const use3D = !reducedMotion() && webglAvailable();

  async function init3D() {
    stage = await createStage(stageEl, { cameraPos: [0, 7.5, 5.5] });
    if (dead) return stage.dispose();
    rebuild();
  }

  function makeCoin(THREE) {
    const R = 1;
    const T = 0.12;
    const gold = new THREE.MeshStandardMaterial({ color: 0xe0b23a, metalness: 0.45, roughness: 0.35 });
    const group = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 64, 1, true), gold);
    rim.castShadow = true;
    group.add(rim);
    labels.forEach((text, i) => {
      const tex = canvasTexture(THREE, 512, (c, s) => drawFace(c, s, text, i));
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(R, 64),
        new THREE.MeshStandardMaterial({ map: tex, metalness: 0.2, roughness: 0.45 }),
      );
      // i=0 yukarı bakar; i=1 aşağı bakar ve para π döndüğünde dik okunur.
      face.rotation.x = i === 0 ? -Math.PI / 2 : Math.PI / 2;
      face.position.y = i === 0 ? T / 2 + 0.001 : -T / 2 - 0.001;
      face.castShadow = true;
      group.add(face);
    });
    group.position.y = T / 2;
    return group;
  }

  function rebuild() {
    if (!stage) return;
    const { THREE, scene, camera } = stage;
    coins.forEach((c) => scene.remove(c));
    coins = [];
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const gap = 2.5;
    for (let i = 0; i < count; i++) {
      const coin = makeCoin(THREE);
      const r = Math.floor(i / cols);
      const inRow = r === rows - 1 ? count - r * cols : cols;
      coin.position.x = ((i % cols) - (inRow - 1) / 2) * gap;
      coin.position.z = (r - (rows - 1) / 2) * gap;
      scene.add(coin);
      coins.push(coin);
    }
    const scale = Math.max(1, cols * 0.85);
    camera.position.set(0, 7.5 * scale, 5.5 * scale);
    camera.lookAt(0, 0, 0);
    stage.render();
  }

  // Sonuç önceden belirlenmiş; para tam o yüze iner.
  async function animate3D(results) {
    const plans = coins.map((coin, i) => {
      const startX = coin.rotation.x % (Math.PI * 2);
      const want = results[i] ? Math.PI : 0;
      const spins = 4 + randomInt(0, 2);
      return {
        coin,
        startX,
        endX: startX + spins * Math.PI * 2 + ((want - startX + Math.PI * 2) % (Math.PI * 2)),
        height: 3 + randomInt(0, 10) / 10,
        delay: i * 0.04,
        baseY: coin.position.y,
      };
    });
    sound('flip');
    await stage.animate(1500 + count * 40, (t) => {
      for (const p of plans) {
        const k = Math.min(1, Math.max(0, (t - p.delay) / (1 - p.delay)));
        p.coin.rotation.x = p.startX + (p.endX - p.startX) * easeOutCubic(k);
        p.coin.position.y = p.baseY + 4 * p.height * k * (1 - k);
        p.coin.rotation.z = Math.sin(k * Math.PI) * 0.25;
      }
    });
    plans.forEach((p) => (p.coin.rotation.x = p.endX % (Math.PI * 2)));
    sound('land');
    stage.render();
  }

  // ---------- 2D (azaltılmış hareket / WebGL yok) ----------
  function render2D(results) {
    stageEl.replaceChildren(
      h(
        'div',
        { class: 'coins2d' },
        (results || Array(count).fill(0)).map((r) =>
          h('div', { class: `coin2d ${r ? 'b' : 'a'}${results ? ' pop' : ''}` }, labels[r]),
        ),
      ),
    );
  }

  async function show(results) {
    if (stage) await animate3D(results);
    else {
      render2D(results);
      await sleep(250);
    }
  }

  async function flip() {
    if (busy) return;
    busy = true;
    throwBtn.disabled = true;
    resultSlot.replaceChildren();
    try {
      if (mode === 'single') {
        const results = Array.from({ length: count }, () => randomInt(0, 1));
        const named = results.map((r) => labels[r]);
        const record = await seal('yazi-tura', { count, labels }, named);
        await show(results);
        if (dead) return;
        results.forEach((r) => stats[r]++);
        const a = results.filter((r) => r === 0).length;
        const big = count === 1 ? named[0] : `${labels[0]} ${a} · ${labels[1]} ${count - a}`;
        store.addHistory(record, count === 1 ? named[0] : big);
        showResult(resultSlot, {
          title: count === 1 ? 'Sonuç' : `${count} para`,
          big,
          detail: count > 1 ? named.join(', ') : null,
          record,
          onAgain: flip,
          againLabel: 'Tekrar at',
        });
      } else {
        // Seri: biri gereken sayıya ulaşana kadar atılan tüm atışlar önceden belirlenir.
        const need = MODES.find((m) => m.id === mode).need;
        const seq = [];
        const score = [0, 0];
        while (score[0] < need && score[1] < need) {
          const r = randomInt(0, 1);
          seq.push(r);
          score[r]++;
        }
        const winner = score[0] === need ? 0 : 1;
        const record = await seal('yazi-tura', { mode, labels }, { sequence: seq.map((r) => labels[r]), winner: labels[winner] });
        const tally = h('span', {});
        resultSlot.replaceChildren(h('p', { class: 'center tally' }, tally));
        const live = [0, 0];
        for (const r of seq) {
          await show([r]);
          if (dead) return;
          live[r]++;
          stats[r]++;
          tally.textContent = `${labels[0]} ${live[0]} – ${live[1]} ${labels[1]}`;
          await sleep(350);
        }
        store.addHistory(record, `${labels[winner]} kazandı (${score[0]}–${score[1]})`);
        showResult(resultSlot, {
          title: MODES.find((m) => m.id === mode).label,
          big: `${labels[winner]} kazandı`,
          detail: `${labels[0]} ${score[0]} – ${score[1]} ${labels[1]} · ${seq.map((r) => labels[r]).join(' → ')}`,
          record,
          onAgain: flip,
          againLabel: 'Yeni seri',
          celebrate: true,
        });
      }
      renderStats();
    } finally {
      busy = false;
      throwBtn.disabled = false;
    }
  }

  // Dokun / yukarı kaydır / salla
  stageEl.addEventListener('click', flip);
  stageEl.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), flip()));
  let touchY = null;
  stageEl.addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY), { passive: true });
  stageEl.addEventListener('touchend', (e) => {
    if (touchY != null && touchY - e.changedTouches[0].clientY > 40) flip();
    touchY = null;
  });
  const stopShake = onShake(flip);

  if (use3D) init3D().catch(() => render2D());
  else render2D();

  return () => {
    dead = true;
    stopShake();
    stage?.dispose();
  };
}

function drawFace(c, s, text, side) {
  const g = c.createRadialGradient(s * 0.35, s * 0.3, s * 0.05, s / 2, s / 2, s / 2);
  g.addColorStop(0, side ? '#f3e2a0' : '#ffe680');
  g.addColorStop(1, side ? '#a9862a' : '#c99400');
  c.fillStyle = g;
  c.fillRect(0, 0, s, s);
  c.strokeStyle = 'rgba(90,60,0,.55)';
  c.lineWidth = s * 0.025;
  c.beginPath();
  c.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([s * 0.012, s * 0.02]);
  c.beginPath();
  c.arc(s / 2, s / 2, s * 0.465, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = '#5a3c00';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const label = text.toLocaleUpperCase('tr-TR');
  let size = s * 0.2;
  c.font = `800 ${size}px system-ui, sans-serif`;
  while (c.measureText(label).width > s * 0.7 && size > 20) {
    size -= 4;
    c.font = `800 ${size}px system-ui, sans-serif`;
  }
  c.fillText(label, s / 2, s / 2);
}

// Android'de DeviceMotion izinsiz çalışır; iOS izin istediği için orada yalnızca dokunma/kaydırma.
export function onShake(fn) {
  if (typeof DeviceMotionEvent === 'undefined' || typeof DeviceMotionEvent.requestPermission === 'function') return () => {};
  let last = 0;
  const handler = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const force = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    const now = Date.now();
    if (force > 25 && now - last > 1200) {
      last = now;
      fn();
    }
  };
  addEventListener('devicemotion', handler);
  return () => removeEventListener('devicemotion', handler);
}
