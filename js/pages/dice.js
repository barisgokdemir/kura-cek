import { h, pageHeader, showResult, sound, sleep, reducedMotion } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';
import { createStage, webglAvailable, canvasTexture, easeOutCubic } from '../three/stage.js';
import { onShake } from './coin.js';

export const meta = { route: 'zar', title: 'Zar', icon: '🎲' };

const TYPES = [4, 6, 8, 10, 12, 20];
const TAVLA = ['', 'yek', 'dü', 'se', 'cihar', 'penç', 'şeş'];
const TAVLA_DOUBLE = ['', 'Hep yek', 'Dü bara', 'Dü se', 'Dört cihar', 'Dü beş', 'Düşeş'];

export function tavlaName(a, b) {
  if (a === b) return TAVLA_DOUBLE[a];
  const [hi, lo] = a > b ? [a, b] : [b, a];
  if (hi === 6 && lo === 5) return 'Şeşbeş';
  const name = `${TAVLA[hi]} ${TAVLA[lo]}`;
  return name[0].toLocaleUpperCase('tr-TR') + name.slice(1);
}

export function mount(root) {
  let sides = 6;
  let count = 2;
  let tavla = false;
  let values = [];
  let held = [];
  let busy = false;
  let dead = false;
  let stage = null;
  let dice = [];

  const stageEl = h('div', { class: 'stage', tabindex: '0', role: 'button', 'aria-label': 'Zarları atmak için dokun' });
  const hint = h('span', { class: 'stage-hint' }, 'Dokun · yukarı kaydır · salla');
  const chipsEl = h('div', { class: 'chips center' });
  const resultSlot = h('div');
  const rollBtn = h('button', { class: 'btn primary big', onclick: () => roll(), html: icons.dice }, 'Zarları at');
  const countOut = h('output', {}, String(count));
  const typeSel = h(
    'select',
    { 'aria-label': 'Zar tipi', value: '6', onchange: (e) => setType(+e.target.value) },
    TYPES.map((t) => h('option', { value: String(t) }, `d${t}`)),
  );
  const tavlaChk = h('input', { type: 'checkbox', onchange: (e) => setTavla(e.target.checked) });

  root.append(
    pageHeader('Zar', 'd4’ten d20’ye, tavla dahil.', 'dice'),
    stageEl,
    chipsEl,
    h('div', { class: 'controls' }, rollBtn),
    resultSlot,
    h(
      'details',
      { class: 'panel' },
      h('summary', {}, 'Ayarlar'),
      h(
        'label',
        { class: 'field' },
        h('span', {}, 'Zar sayısı'),
        h(
          'div',
          { class: 'stepper' },
          h('button', { class: 'btn icon', 'aria-label': 'Azalt', onclick: () => setCount(count - 1) }, '−'),
          countOut,
          h('button', { class: 'btn icon', 'aria-label': 'Arttır', onclick: () => setCount(count + 1) }, '+'),
        ),
      ),
      h('label', { class: 'field' }, h('span', {}, 'Zar tipi'), typeSel),
      h('label', { class: 'field check' }, h('span', {}, 'Tavla modu (iki zar, çiftler vurgulu)'), tavlaChk),
    ),
  );

  function resetDice() {
    values = [];
    held = Array(count).fill(false);
    renderChips();
    rebuild();
  }
  function setCount(n) {
    if (tavla) return;
    count = Math.max(1, Math.min(6, n));
    countOut.textContent = count;
    resetDice();
  }
  function setType(t) {
    if (tavla) return;
    sides = t;
    resetDice();
  }
  function setTavla(on) {
    tavla = on;
    if (on) {
      count = 2;
      sides = 6;
      countOut.textContent = '2';
      typeSel.value = '6';
    }
    typeSel.disabled = on;
    resetDice();
  }

  function renderChips() {
    chipsEl.replaceChildren(
      ...(values.length && !tavla
        ? values.map((v, i) =>
            h(
              'button',
              {
                class: `chip${held[i] ? ' held' : ''}`,
                'aria-pressed': String(held[i]),
                title: held[i] ? 'Tutuluyor — bırakmak için dokun' : 'Bu zarı tut',
                onclick: () => {
                  held[i] = !held[i];
                  renderChips();
                  tintHeld();
                },
              },
              h('b', {}, v),
              held[i] ? 'tutuldu' : '',
            ),
          )
        : []),
    );
    if (values.length && !tavla && count > 1) {
      chipsEl.append(h('span', { class: 'muted small', style: { flexBasis: '100%', textAlign: 'center' } }, 'Tutmak istediğin zarın sayısına dokun'));
    }
  }

  // ---------- 3D ----------
  const use3D = !reducedMotion() && webglAvailable();
  let THREE;

  async function init3D() {
    stage = await createStage(stageEl, { cameraPos: [0, 9, 6], accent: 0x22d3ee });
    stageEl.append(hint);
    if (dead) return stage.dispose();
    THREE = stage.THREE;
    rebuild();
  }

  // d6 yüzleri, BoxGeometry malzeme sırasıyla (+x, -x, +y, -y, +z, -z). Karşı yüzler toplamı 7.
  const D6_FACES = [2, 5, 1, 6, 3, 4];

  // Değerin yukarı (+y) bakması için gereken dönüş.
  function d6Quaternion(v) {
    const q = new THREE.Quaternion();
    const X = new THREE.Vector3(1, 0, 0);
    const Z = new THREE.Vector3(0, 0, 1);
    const map = { 1: [X, 0], 6: [X, Math.PI], 2: [Z, Math.PI / 2], 5: [Z, -Math.PI / 2], 3: [X, -Math.PI / 2], 4: [X, Math.PI / 2] };
    const [axis, angle] = map[v];
    return q.setFromAxisAngle(axis, angle);
  }

  function makeDie() {
    const color = { 4: 0x22d3ee, 6: 0xfafafa, 8: 0xa78bfa, 10: 0x4ade80, 12: 0xfbbf24, 20: 0xf472b6 }[sides];
    let mesh;
    if (sides === 6) {
      const mats = D6_FACES.map(
        (v) => new THREE.MeshStandardMaterial({ map: canvasTexture(THREE, 256, (c, s) => drawPips(c, s, v)), roughness: 0.35 }),
      );
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mats);
    } else {
      const geo = {
        4: () => new THREE.TetrahedronGeometry(0.95),
        8: () => new THREE.OctahedronGeometry(0.85),
        10: () => bipyramid(THREE, 0.85),
        12: () => new THREE.DodecahedronGeometry(0.85),
        20: () => new THREE.IcosahedronGeometry(0.85),
      }[sides]();
      mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1, flatShading: true }));
    }
    mesh.castShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    group.userData.mesh = mesh;
    return group;
  }

  function rebuild() {
    if (!stage) return;
    const { scene, camera } = stage;
    dice.forEach((d) => scene.remove(d));
    dice = [];
    const cols = Math.min(count, 3);
    const rows = Math.ceil(count / cols);
    const gap = 1.9;
    for (let i = 0; i < count; i++) {
      const d = makeDie();
      const r = Math.floor(i / cols);
      const inRow = r === rows - 1 ? count - r * cols : cols;
      d.position.set(((i % cols) - (inRow - 1) / 2) * gap, 0.6, (r - (rows - 1) / 2) * gap);
      d.userData.home = d.position.clone();
      // Grup yalnızca konum taşır; dönüş içteki mesh'te, böylece etiket hep zarın üstünde kalır.
      if (sides === 6) d.userData.mesh.quaternion.copy(d6Quaternion(1 + (i % 6)));
      else d.userData.mesh.rotation.set(0.4 * i, 0.7 * i, 0.2);
      scene.add(d);
      dice.push(d);
    }
    // Dar (dikey) ekranda yatay görüş azalır; kamerayı en-boy oranına göre uzaklaştır.
    const aspect = stageEl.clientWidth / Math.max(1, stageEl.clientHeight);
    const scale = Math.max(0.75, (cols * 0.42 + rows * 0.2) / Math.min(1, aspect + 0.15));
    camera.position.set(0, 9 * scale, 6 * scale);
    camera.lookAt(0, 0, 0);
    stage.render();
  }

  function tintHeld() {
    if (!stage) return;
    dice.forEach((d, i) => {
      const mats = [d.userData.mesh.material].flat();
      mats.forEach((m) => m.emissive?.setHex(held[i] ? 0x553300 : 0x000000));
    });
    stage.render();
  }

  function setLabel(die, value) {
    if (die.userData.label) {
      die.remove(die.userData.label);
      die.userData.label.material.map.dispose();
      die.userData.label.material.dispose();
      die.userData.label = null;
    }
    if (value == null || sides === 6) return;
    const tex = canvasTexture(THREE, 128, (c, s) => {
      c.fillStyle = 'rgba(10,10,26,.9)';
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff';
      c.font = `800 ${s * 0.5}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(value), s / 2, s / 2 + s * 0.03);
    });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.scale.set(0.9, 0.9, 1);
    sprite.position.set(0, 1.25, 0);
    die.userData.label = sprite;
    die.add(sprite);
  }

  async function animate3D(newValues, which) {
    const { Euler, Quaternion, Vector3 } = THREE;
    const plans = which.map((i) => {
      const die = dice[i];
      setLabel(die, null);
      let finalQ;
      const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (randomInt(-40, 40) * Math.PI) / 180);
      if (sides === 6) finalQ = yaw.multiply(d6Quaternion(newValues[i]));
      else finalQ = new Quaternion().setFromEuler(new Euler(randomInt(0, 628) / 100, randomInt(0, 628) / 100, randomInt(0, 628) / 100));
      const final = new Euler().setFromQuaternion(finalQ);
      const spin = () => (randomInt(2, 4) * Math.PI * 2) * (randomInt(0, 1) ? 1 : -1);
      return {
        die,
        final,
        spins: [spin(), spin(), spin()],
        from: die.userData.home.clone().add(new Vector3(-5 - randomInt(0, 20) / 10, 0, randomInt(-15, 15) / 10)),
        to: die.userData.home,
      };
    });
    sound('roll');
    await stage.animate(1500, (t) => {
      const e = easeOutCubic(t);
      for (const p of plans) {
        p.die.position.x = p.from.x + (p.to.x - p.from.x) * e;
        p.die.position.z = p.from.z + (p.to.z - p.from.z) * e;
        p.die.position.y = p.to.y + 3 * (1 - t) ** 2 * Math.abs(Math.cos(t * Math.PI * 2.5));
        p.die.userData.mesh.rotation.set(
          p.final.x + p.spins[0] * (1 - e),
          p.final.y + p.spins[1] * (1 - e),
          p.final.z + p.spins[2] * (1 - e),
          p.final.order,
        );
      }
    });
    for (const p of plans) {
      p.die.position.copy(p.to);
      p.die.userData.mesh.rotation.copy(p.final);
    }
    which.forEach((i) => setLabel(dice[i], newValues[i]));
    sound('land');
    stage.render();
  }

  function render2D(vals, which = []) {
    stageEl.replaceChildren(
      hint,
      h(
        'div',
        { class: 'dice2d' },
        Array.from({ length: count }, (_, i) =>
          h(
            'div',
            { class: `die2d${which.includes(i) ? ' pop' : ''}${held[i] ? ' held' : ''}` },
            vals?.[i] != null ? (sides === 6 ? '⚀⚁⚂⚃⚄⚅'[vals[i] - 1] : vals[i]) : sides === 6 ? '⚅' : `d${sides}`,
          ),
        ),
      ),
    );
  }

  async function roll() {
    if (busy) return;
    busy = true;
    rollBtn.disabled = true;
    resultSlot.replaceChildren();
    try {
      const which = [];
      const next = Array.from({ length: count }, (_, i) => {
        if (values.length && held[i]) return values[i];
        which.push(i);
        return randomInt(1, sides);
      });
      if (!which.length) {
        // Hepsi tutuluyorsa hepsini bırak ve yeniden at.
        held = Array(count).fill(false);
        busy = false;
        rollBtn.disabled = false;
        tintHeld();
        return roll();
      }
      const record = await seal('zar', { count, sides, held: values.length ? held : [], tavla }, next);
      if (stage) await animate3D(next, which);
      else {
        render2D(next, which);
        await sleep(250);
      }
      if (dead) return;
      values = next;
      const total = values.reduce((a, b) => a + b, 0);
      renderChips();

      if (tavla) {
        const dbl = values[0] === values[1];
        const name = tavlaName(values[0], values[1]);
        store.addHistory(record, `${name} (${values.join('-')})`);
        showResult(resultSlot, {
          title: dbl ? 'Çift geldi! 4 hamle' : 'Tavla',
          big: name,
          detail: `${values[0]} – ${values[1]}`,
          record,
          onAgain: roll,
          againLabel: 'Tekrar at',
          celebrate: dbl,
        });
        if (dbl) stageEl.classList.add('flash'), setTimeout(() => stageEl.classList.remove('flash'), 1200);
      } else {
        const summary = count === 1 ? String(values[0]) : `${total} (${values.join(' + ')})`;
        store.addHistory(record, `d${sides}: ${summary}`);
        showResult(resultSlot, {
          title: count === 1 ? `d${sides}` : `${count}d${sides} toplam`,
          big: String(count === 1 ? values[0] : total),
          detail: count > 1 ? values.join(' + ') : null,
          record,
          onAgain: roll,
          againLabel: held.some(Boolean) ? 'Kalanları at' : 'Tekrar at',
        });
      }
    } finally {
      busy = false;
      rollBtn.disabled = false;
    }
  }

  stageEl.addEventListener('click', roll);
  stageEl.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), roll()));
  let touchY = null;
  stageEl.addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY), { passive: true });
  stageEl.addEventListener('touchend', (e) => {
    if (touchY != null && touchY - e.changedTouches[0].clientY > 40) roll();
    touchY = null;
  });
  const stopShake = onShake(roll);

  held = Array(count).fill(false);
  if (use3D) init3D().catch(() => render2D());
  else render2D();

  return () => {
    dead = true;
    stopShake();
    stage?.dispose();
  };
}

// d10 için 10 üçgen yüzlü beşgen çift piramit.
function bipyramid(THREE, radius) {
  const v = [0, 1, 0, 0, -1, 0];
  for (let i = 0; i < 5; i++) v.push(Math.cos((i * 2 * Math.PI) / 5), 0, Math.sin((i * 2 * Math.PI) / 5));
  const idx = [];
  for (let i = 0; i < 5; i++) {
    const a = 2 + i;
    const b = 2 + ((i + 1) % 5);
    idx.push(0, b, a, 1, a, b);
  }
  return new THREE.PolyhedronGeometry(v, idx, radius, 0);
}

function drawPips(c, s, v) {
  c.fillStyle = '#fafafa';
  c.fillRect(0, 0, s, s);
  c.strokeStyle = '#d9d9d9';
  c.lineWidth = s * 0.04;
  c.strokeRect(0, 0, s, s);
  const P = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
    6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
  }[v];
  c.fillStyle = v === 1 ? '#d62828' : '#1b1b1f';
  for (const [x, y] of P) {
    c.beginPath();
    c.arc(x * s, y * s, s * (v === 1 ? 0.11 : 0.085), 0, Math.PI * 2);
    c.fill();
  }
}
