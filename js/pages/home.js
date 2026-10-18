import { h, proofLine, sound, vibrate } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import { icons } from '../icons.js';
import * as store from '../store.js';
import { MODULES, SOON } from '../modules.js';


export function mount(root) {
  const s = store.get();
  const answer = h('div', { class: 'yesno-answer', 'aria-live': 'polite' });
  const proof = h('div');
  let busy = false;

  async function yesNo() {
    if (busy) return;
    busy = true;
    const r = randomInt(0, 1);
    const text = r ? 'Hayır' : 'Evet';
    const record = await seal('evet-hayir', {}, text);
    answer.classList.remove('show', 'yes', 'no');
    void answer.offsetWidth;
    answer.textContent = text;
    answer.classList.add('show', r ? 'no' : 'yes');
    proof.replaceChildren(proofLine(record));
    store.addHistory(record, text);
    sound(r ? 'land' : 'win');
    vibrate(30);
    busy = false;
  }

  const favs = s.lists.filter((l) => l.fav);
  const recent = s.recent.map((r) => MODULES.find((m) => m.route === r)).filter(Boolean);

  root.append(
    ...[
      h(
        'section',
        { class: 'hero' },
        h('span', { class: 'eyebrow' }, h('span', { class: 'dot' }), 'Adil · Reklamsız · Kayıtsız'),
        h('h1', {}, 'Kura ', h('span', {}, 'Çek')),
        h('p', { class: 'muted' }, 'Kriptografik rastgelelik, gerçek 3D animasyon. Sonuç önce belirlenir, her çekiliş doğrulanabilir.'),
        h(
          'div',
          { class: 'quick', style: { '--mc': 'var(--cyan)' } },
          h('button', { class: 'btn primary big', onclick: yesNo, html: icons.bolt }, 'Evet mi, hayır mı?'),
          answer,
          proof,
        ),
      ),
      recent.length
        ? h(
            'section',
            {},
            h('h2', {}, 'Son kullanılanlar'),
            h(
              'div',
              { class: 'chips' },
              recent.map((m) =>
                h('a', { class: 'chip', href: `#/${m.route}`, style: { '--card-color': m.color }, html: icons[m.icon] }, m.title),
              ),
            ),
          )
        : null,
      favs.length
        ? h(
            'section',
            {},
            h('h2', {}, 'Favori listelerim'),
            h(
              'div',
              { class: 'chips' },
              favs.map((l) =>
                h('a', { class: 'chip', href: `#/liste/${l.id}`, style: { '--card-color': 'var(--amber)' }, html: icons.star }, l.name),
              ),
            ),
          )
        : null,
      h(
        'section',
        {},
        h('h2', {}, 'Modüller'),
        h(
          'div',
          { class: 'grid' },
          MODULES.map((m) =>
            h(
              'a',
              { class: 'card game-card', href: `#/${m.route}`, style: { '--card-color': m.color } },
              h('div', { class: 'game-card-thumb', html: icons[m.icon] }),
              h(
                'div',
                { class: 'game-card-body' },
                h('span', { class: 'game-card-title' }, m.title),
                h('span', { class: 'game-card-desc' }, m.desc),
                h('span', { class: 'game-card-play', html: icons.play }, 'Aç'),
              ),
            ),
          ),
        ),
      ),
      SOON.length &&
      h(
        'section',
        {},
        h('h2', {}, 'Yakında'),
        h(
          'div',
          { class: 'soon' },
          SOON.map(([t, ic]) => h('div', { class: 'soon-item', html: icons[ic] }, t)),
        ),
      ),
    ].filter(Boolean),
  );
}
