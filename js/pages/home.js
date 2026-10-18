import { h, proofLine, sound, vibrate } from '../ui.js';
import { randomInt, seal } from '../rng.js';
import * as store from '../store.js';

export const MODULES = [
  { route: 'yazi-tura', title: 'Yazı-Tura', icon: '🪙', desc: "3D para; çoklu para, 3'te 2 ve 5'te 3 seri.", anim: 'spin' },
  { route: 'zar', title: 'Zar', icon: '🎲', desc: "d4'ten d20'ye 3D zarlar, zar tutma, tavla modu.", anim: 'roll' },
  { route: 'kisa-cubuk', title: 'Kısa Çubuk', icon: '🥢', desc: 'Kötü iş kime? Elden ele modu ile gizli çekiliş.', anim: 'pull' },
  { route: 'liste', title: 'Custom Liste', icon: '📝', desc: 'Çark, N sonuç ya da tüm listeyi karıştır.', anim: 'wheel' },
];

const SOON = ['Parmak seçici', 'Takım kurucu', 'İsim-Şehir harfi', 'Şişe çevirme', 'Tombala', 'Hediyeleşme'];

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
        h('h1', {}, 'Kura Çek'),
        h('p', { class: 'muted' }, 'Ücretsiz, reklamsız, kayıtsız. Adil olduğunu kanıtlayan rastgelelik.'),
        h(
          'div',
          { class: 'yesno' },
          h('button', { class: 'btn primary big', onclick: yesNo }, 'Hızlı karar: Evet mi, hayır mı?'),
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
              recent.map((m) => h('a', { class: 'chip', href: `#/${m.route}` }, `${m.icon} ${m.title}`)),
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
              favs.map((l) => h('a', { class: 'chip', href: `#/liste/${l.id}` }, `★ ${l.name}`)),
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
              { class: 'card module', href: `#/${m.route}` },
              h('span', { class: `module-icon anim-${m.anim}`, 'aria-hidden': 'true' }, m.icon),
              h('b', {}, m.title),
              h('small', { class: 'muted' }, m.desc),
            ),
          ),
        ),
      ),
      h(
        'section',
        {},
        h('h2', {}, 'Yakında'),
        h(
          'div',
          { class: 'chips' },
          SOON.map((t) => h('span', { class: 'chip disabled' }, t)),
        ),
      ),
    ].filter(Boolean),
  );
}
