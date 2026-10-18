import { h, pageHeader, showResult, sleep, sound, reducedMotion, parseLines, stepper, toast } from '../ui.js';
import { shuffle, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

export const TEAM_STYLE = [
  ['Mavi', 'var(--cyan)'],
  ['Pembe', 'var(--pink)'],
  ['Yeşil', 'var(--green)'],
  ['Sarı', 'var(--amber)'],
  ['Mor', 'var(--purple)'],
  ['Turuncu', 'var(--orange)'],
  ['Lacivert', 'var(--indigo)'],
  ['Kırmızı', 'var(--red)'],
];

// "Ali 4", "Ali, 4", "Ali:4" → { name: 'Ali', level: 4 }
export function parsePlayer(line) {
  const m = line.match(/^(.*?)[\s,;:*-]+(10|[1-9])$/);
  return m && m[1].trim() ? { name: m[1].trim(), level: +m[2] } : { name: line, level: null };
}

// Seviye varsa: karıştır, seviyeye göre sırala (eşitler rastgele kalır), yılan sırasıyla dağıt.
// Seviye yoksa: karıştır ve sırayla dağıt. İlk seçim hakkı da rastgele takıma gider.
export function buildTeams(players, n) {
  const leveled = players.some((p) => p.level != null);
  const pool = shuffle(players).map((p) => ({ ...p, level: p.level ?? (leveled ? 3 : null) }));
  if (leveled) pool.sort((a, b) => b.level - a.level);
  const order = shuffle([...Array(n).keys()]);
  const teams = Array.from({ length: n }, () => []);
  pool.forEach((p, i) => {
    const round = Math.floor(i / n);
    const k = i % n;
    const t = leveled && round % 2 ? order[n - 1 - k] : order[k];
    teams[t].push(p);
  });
  return { teams, leveled };
}

export function mount(root) {
  const saved = store.get().teams || { text: '', n: 2 };
  let n = saved.n;
  let busy = false;
  let dead = false;

  const namesEl = h('textarea', {
    rows: 8,
    value: saved.text,
    placeholder: 'Her satıra bir oyuncu.\nSeviye vermek istersen sonuna 1–10 yaz:\nAli 7\nAyşe 5\nMehmet',
    'aria-label': 'Oyuncular',
    oninput: () => persist(),
  });
  const out = h('div', { class: 'teams-out' });
  const resultSlot = h('div');
  const buildBtn = h('button', { class: 'btn primary big block', onclick: () => build(), html: icons.shuffle }, 'Takımları kur');

  root.append(
    pageHeader('Takım Kurucu', 'Adil takımlar; seviye verirsen dengeli dağıtır.', 'team'),
    h(
      'section',
      { class: 'panel open' },
      h('label', { class: 'field col' }, h('span', {}, 'Oyuncular'), namesEl),
      h(
        'div',
        { class: 'field' },
        h('span', {}, 'Takım sayısı'),
        stepper({ value: n, min: 2, max: 8, label: 'Takım sayısı', onChange: (v) => ((n = v), persist()) }),
      ),
      h('p', { class: 'muted small' }, 'Seviyesi yazılmayan oyuncu orta seviye (3) sayılır. Takım boyları en fazla 1 farklı olur.'),
      buildBtn,
    ),
    out,
    resultSlot,
  );

  function persist() {
    store.update((s) => (s.teams = { text: namesEl.value, n }));
  }

  async function build() {
    if (busy) return;
    const players = parseLines(namesEl.value).map(parsePlayer);
    if (players.length < n) return toast(`${n} takım için en az ${n} oyuncu gir`);
    busy = true;
    buildBtn.disabled = true;
    resultSlot.replaceChildren();
    out.replaceChildren();
    try {
      const { teams, leveled } = buildTeams(players, n);
      const record = await seal(
        'takim-kurucu',
        { players: players.map((p) => (p.level != null ? `${p.name} ${p.level}` : p.name)), teams: n },
        teams.map((t) => t.map((p) => p.name)),
      );
      const lists = teams.map((t, i) => {
        const [name, color] = TEAM_STYLE[i];
        const ul = h('ul', {});
        const sum = t.reduce((a, p) => a + (p.level || 0), 0);
        out.append(
          h(
            'section',
            { class: 'team-card', style: { '--card-color': color } },
            h(
              'header',
              {},
              h('b', {}, `${name} Takım`),
              h('span', { class: 'muted small' }, `${t.length} kişi${leveled ? ` · güç ${sum}` : ''}`),
            ),
            ul,
          ),
        );
        return ul;
      });
      // Oyuncuları sırayla "seç": takım takım dağıtılıyormuş gibi göster.
      const slow = !reducedMotion();
      const max = Math.max(...teams.map((t) => t.length));
      for (let r = 0; r < max; r++) {
        for (let i = 0; i < n; i++) {
          const p = teams[i][r];
          if (!p) continue;
          lists[i].append(h('li', {}, h('span', {}, p.name), leveled ? h('span', { class: 'lvl' }, String(p.level)) : ''));
          if (slow) {
            sound('tick');
            await sleep(110);
            if (dead) return;
          }
        }
      }
      const sums = teams.map((t) => t.reduce((a, p) => a + (p.level || 0), 0));
      store.addHistory(record, teams.map((t, i) => `${TEAM_STYLE[i][0]}: ${t.map((p) => p.name).join(', ')}`).join(' | '));
      showResult(resultSlot, {
        title: 'Takımlar hazır',
        big: `${n} takım · ${players.length} oyuncu`,
        detail: leveled ? `Takım güçleri: ${sums.join(' – ')}` : 'Rastgele ve eşit dağıtıldı',
        record,
        onAgain: build,
        againLabel: 'Yeniden karıştır',
      });
    } finally {
      busy = false;
      buildBtn.disabled = false;
    }
  }

  return () => {
    dead = true;
  };
}
