import { h, pageHeader, showResult, sound, vibrate, stepper } from '../ui.js';
import { sample, shuffle, seal } from '../rng.js';
import * as store from '../store.js';

const COLORS = ['#22d3ee', '#f472b6', '#4ade80', '#a78bfa', '#fbbf24', '#fb923c', '#38bdf8', '#fb7185', '#a3e635', '#818cf8'];
const TEAM_COLORS = ['#22d3ee', '#f472b6', '#4ade80', '#fbbf24'];
const TEAM_NAMES = ['Mavi', 'Pembe', 'Yeşil', 'Sarı'];
const WAIT_MS = 2600;

export function mount(root) {
  let mode = 'pick';
  let winners = 1;
  let teams = 2;
  let state = 'idle'; // idle → arming → done
  let timer = null;
  let seq = 0;
  let dead = false;
  const fingers = new Map(); // pointerId → { el, n, color, sticky }

  const area = h('div', { class: 'finger-area', 'aria-label': 'Parmaklarınızı buraya koyun' });
  const msg = h('p', { class: 'finger-msg' });
  area.append(msg);
  const resultSlot = h('div');

  const modeCtl = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'Mod' },
    [
      ['pick', 'Kazanan seç'],
      ['teams', 'Takımlara böl'],
    ].map(([id, label]) =>
      h('button', { role: 'radio', 'aria-checked': String(id === mode), 'data-id': id, onclick: () => setMode(id) }, label),
    ),
  );
  const winnersField = h(
    'div',
    { class: 'field' },
    h('span', {}, 'Kazanan sayısı'),
    stepper({ value: 1, min: 1, max: 5, label: 'Kazanan sayısı', onChange: (v) => ((winners = v), reset()) }),
  );
  const teamsField = h(
    'div',
    { class: 'field', hidden: true },
    h('span', {}, 'Takım sayısı'),
    stepper({ value: 2, min: 2, max: 4, label: 'Takım sayısı', onChange: (v) => ((teams = v), reset()) }),
  );

  root.append(
    pageHeader('Parmak Seçici', 'Herkes bir parmağını ekrana koysun ve beklesin.', 'finger'),
    area,
    resultSlot,
    h('section', { class: 'panel open' }, h('div', { class: 'field col' }, h('span', {}, 'Mod'), modeCtl), winnersField, teamsField),
  );

  function setMode(id) {
    mode = id;
    modeCtl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
    winnersField.hidden = id !== 'pick';
    teamsField.hidden = id !== 'teams';
    reset();
  }

  const needed = () => (mode === 'pick' ? winners + 1 : teams);

  function updateMsg() {
    const n = fingers.size;
    if (state === 'done') return;
    if (state === 'arming') msg.textContent = 'Kıpırdamayın…';
    else if (n === 0) msg.innerHTML = 'Parmaklarınızı ekrana koyun<small>Bilgisayarda tıklayarak parmak ekleyebilirsin</small>';
    else if (n < needed()) msg.textContent = `En az ${needed()} parmak gerekli`;
    else msg.textContent = '';
    area.classList.toggle('has-fingers', n > 0);
  }

  function schedule() {
    clearTimeout(timer);
    area.classList.remove('arming');
    if (state === 'done') return;
    state = 'idle';
    if (fingers.size >= needed()) {
      state = 'arming';
      void area.offsetWidth;
      area.classList.add('arming');
      timer = setTimeout(choose, WAIT_MS);
    }
    updateMsg();
  }

  function addFinger(id, x, y, sticky) {
    const color = COLORS[seq % COLORS.length];
    const el = h('div', { class: 'finger', style: { '--fc': color } });
    const n = ++seq;
    area.append(el);
    fingers.set(id, { el, n, color, sticky });
    moveFinger(id, x, y);
    sound('tick');
    vibrate(10);
  }
  function moveFinger(id, x, y) {
    const f = fingers.get(id);
    if (!f) return;
    const r = area.getBoundingClientRect();
    f.el.style.left = `${x - r.left}px`;
    f.el.style.top = `${y - r.top}px`;
  }
  function removeFinger(id) {
    const f = fingers.get(id);
    if (!f) return;
    f.el.remove();
    fingers.delete(id);
  }

  async function choose() {
    if (dead || fingers.size < needed()) return schedule();
    state = 'done';
    area.classList.remove('arming');
    area.classList.add('decided');
    const entries = [...fingers.values()].sort((a, b) => a.n - b.n);
    if (mode === 'pick') {
      const chosen = sample(entries, winners);
      const record = await seal('parmak-secici', { fingers: entries.length, winners }, chosen.map((f) => `${f.n}. parmak`));
      entries.forEach((f) => f.el.classList.add(chosen.includes(f) ? 'win' : 'out'));
      msg.textContent = '';
      store.addHistory(record, `${entries.length} parmaktan ${chosen.map((f) => `${f.n}.`).join(', ')} seçildi`);
      showResult(resultSlot, {
        title: winners > 1 ? `${winners} kazanan` : 'Seçilen',
        big: winners > 1 ? `${winners} parmak parlıyor` : 'Parlayan parmak!',
        detail: `${entries.length} parmak arasından · ekrandan kaldırınca yeniden başlar`,
        record,
        onAgain: reset,
        againLabel: 'Yeniden',
        celebrate: true,
      });
    } else {
      // Karıştır ve sırayla takımlara dağıt: takım boyları en fazla 1 farklı.
      const order = shuffle(entries);
      const groups = Array.from({ length: teams }, () => []);
      order.forEach((f, i) => groups[i % teams].push(f));
      const record = await seal(
        'parmak-secici',
        { fingers: entries.length, teams },
        groups.map((g) => g.map((f) => f.n)),
      );
      groups.forEach((g, t) =>
        g.forEach((f) => {
          f.el.style.setProperty('--fc', TEAM_COLORS[t]);
          f.el.classList.add('team');
          f.el.dataset.team = TEAM_NAMES[t][0];
        }),
      );
      store.addHistory(record, `${entries.length} parmak ${teams} takıma bölündü`);
      showResult(resultSlot, {
        title: 'Takımlar',
        big: groups.map((g, t) => `${TEAM_NAMES[t]} ${g.length}`).join(' · '),
        detail: 'Renkler takımları gösteriyor',
        record,
        onAgain: reset,
        againLabel: 'Yeniden',
        celebrate: true,
      });
    }
  }

  function reset() {
    clearTimeout(timer);
    for (const id of [...fingers.keys()]) if (fingers.get(id).sticky) removeFinger(id);
    fingers.forEach((f) => f.el.classList.remove('win', 'out', 'team'));
    area.classList.remove('decided', 'arming');
    resultSlot.replaceChildren();
    state = 'idle';
    seq = fingers.size;
    schedule();
  }

  // Pointer Events: dokunmatikte her parmak ayrı pointer; farede tıklama kalıcı parmak ekler/siler.
  area.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state === 'done') {
      if (e.pointerType === 'mouse') reset();
      return;
    }
    if (e.pointerType === 'mouse') {
      const hit = [...fingers.entries()].find(([, f]) => f.el === e.target);
      if (hit) removeFinger(hit[0]);
      else addFinger(`m${performance.now()}`, e.clientX, e.clientY, true);
    } else {
      area.setPointerCapture?.(e.pointerId);
      addFinger(e.pointerId, e.clientX, e.clientY, false);
    }
    schedule();
  });
  area.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') moveFinger(e.pointerId, e.clientX, e.clientY);
  });
  const lift = (e) => {
    if (e.pointerType === 'mouse' || !fingers.has(e.pointerId)) return;
    removeFinger(e.pointerId);
    if (state === 'done') {
      if (![...fingers.values()].some((f) => !f.sticky)) reset();
    } else schedule();
  };
  area.addEventListener('pointerup', lift);
  area.addEventListener('pointercancel', lift);
  area.addEventListener('contextmenu', (e) => e.preventDefault());

  updateMsg();
  return () => {
    dead = true;
    clearTimeout(timer);
  };
}
