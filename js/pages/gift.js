import { h, pageHeader, toast, share, confetti, sound, vibrate, parseLines, confirmButton, proofLine } from '../ui.js';
import { shuffle, seal, randomHex, sha256hex } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

// ---------- Eşleştirme ----------
const key = (a, b) => `${a.toLocaleLowerCase('tr-TR')}|${b.toLocaleLowerCase('tr-TR')}`;

export function parseExclusions(text) {
  return parseLines(text)
    .map((l) => l.split(/\s*[-–,/]\s*/).filter(Boolean))
    .filter((p) => p.length === 2);
}

// Kısıtları sağlayan permütasyonlar arasından eşit olasılıkla biri (reddetme örneklemesi).
export function assign(names, exclusions) {
  const banned = new Set();
  exclusions.forEach(([a, b]) => (banned.add(key(a, b)), banned.add(key(b, a))));
  for (let t = 0; t < 50000; t++) {
    const p = shuffle(names);
    if (names.every((g, i) => key(g, '') !== key(p[i], '') && !banned.has(key(g, p[i])))) return names.map((g, i) => [g, p[i]]);
  }
  return null;
}

export { encodeTicket, decodeTicket } from '../ticket.js';
import { encodeTicket, decodeTicket } from '../ticket.js';

export function mount(root, params) {
  if (params.id?.startsWith('g/')) return mountTicket(root, params.id.slice(2));

  const g = () => store.get().gift;
  if (!g()) store.update((s) => (s.gift = { event: 'Yılbaşı hediyeleşmesi', budget: '', date: '', names: '', excl: '', mode: 'hand', pairs: null, seen: [] }));

  const view = h('div');
  root.append(pageHeader('Hediyeleşme', 'Kim kime hediye alacak? Kimse kendini çekmez.', 'gift'), view);
  render();

  function render() {
    if (g().pairs) renderRun();
    else renderSetup();
  }

  function input(field, attrs) {
    return h(attrs.rows ? 'textarea' : 'input', {
      type: 'text',
      ...attrs,
      value: g()[field],
      oninput: (e) => store.update((s) => (s.gift[field] = e.target.value)),
    });
  }

  function renderSetup() {
    const modeCtl = h(
      'div',
      { class: 'segmented', role: 'radiogroup', 'aria-label': 'Gizlilik modu' },
      [
        ['hand', 'Elden ele'],
        ['link', 'Kişiye özel link'],
      ].map(([id, label]) =>
        h(
          'button',
          {
            role: 'radio',
            'aria-checked': String(g().mode === id),
            'data-id': id,
            onclick: () => {
              store.update((s) => (s.gift.mode = id));
              modeCtl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
              modeHint.textContent = HINTS[id];
            },
          },
          label,
        ),
      ),
    );
    const HINTS = {
      hand: 'Telefon elden ele dolaşır; herkes yalnızca kendi eşleşmesini görür ve gizler.',
      link: 'Herkese kendi linkini gönderirsin. Linkler gerçek şifreleme değildir; sonucu görmemek için başkasının linkini açma.',
    };
    const modeHint = h('p', { class: 'muted small' }, HINTS[g().mode]);

    view.replaceChildren(
      h(
        'section',
        { class: 'panel open' },
        h('label', { class: 'field col' }, h('span', {}, 'Etkinlik'), input('event', { 'aria-label': 'Etkinlik adı', maxLength: 60 })),
        h(
          'div',
          { class: 'fields-2' },
          h('label', { class: 'field' }, h('span', {}, 'Bütçe'), input('budget', { placeholder: '500 ₺', maxLength: 30 })),
          h('label', { class: 'field' }, h('span', {}, 'Tarih'), input('date', { placeholder: '31 Aralık', maxLength: 30 })),
        ),
        h('label', { class: 'field col' }, h('span', {}, 'Katılımcılar'), input('names', { rows: 6, placeholder: 'Her satıra bir isim (en az 3)' })),
        h(
          'label',
          { class: 'field col' },
          h('span', {}, 'Birbirini çekmesin (isteğe bağlı)'),
          input('excl', { rows: 2, placeholder: 'Ali - Ayşe\nMehmet - Zeynep' }),
        ),
        h('div', { class: 'field col' }, h('span', {}, 'Gizlilik'), modeCtl, modeHint),
        h('button', { class: 'btn primary big block', onclick: draw, html: icons.gift }, 'Kurayı çek'),
      ),
    );
  }

  async function draw() {
    const names = parseLines(g().names);
    const lower = names.map((n) => n.toLocaleLowerCase('tr-TR'));
    if (names.length < 3) return toast('En az 3 katılımcı gir');
    if (new Set(lower).size !== names.length) return toast('Aynı isim iki kez yazılmış; ayırt etmek için soyadı ekle');
    const excl = parseExclusions(g().excl);
    const pairs = assign(names, excl);
    if (!pairs) return toast('Bu kısıtlarla geçerli bir eşleşme yok');
    const salt = randomHex(16);
    const commitment = await sha256hex(JSON.stringify(pairs) + salt);
    // Mühürde eşleşmelerin kendisi değil, taahhüdü (hash) tutulur: geçmişten kimse sonucu göremez.
    const record = await seal('hediyelesme', { people: names, exclusions: excl, mode: g().mode }, { commitment });
    store.update((s) => Object.assign(s.gift, { pairs, salt, seen: [], record }));
    store.addHistory(record, `${g().event || 'Hediyeleşme'}: ${names.length} kişi (eşleşmeler gizli)`);
    sound('win');
    render();
  }

  function renderRun() {
    const { pairs, seen, mode, record } = g();
    const reset = confirmButton('Yeni kura', 'Emin misin? Eşleşmeler silinir', () => {
      store.update((s) => Object.assign(s.gift, { pairs: null, seen: [], record: null, salt: null }));
      render();
    });
    const head = h(
      'section',
      { class: 'gift-head' },
      h('b', {}, g().event || 'Hediyeleşme'),
      h('span', { class: 'muted small' }, [g().budget && `Bütçe ${g().budget}`, g().date].filter(Boolean).join(' · ') || `${pairs.length} kişi`),
      record && proofLine(record),
    );

    if (mode === 'link') {
      const base = `${location.origin}${location.pathname}#/hediyelesme/g/`;
      view.replaceChildren(
        head,
        h('p', { class: 'note', html: `${icons.eyeOff}<span>Herkese <b>yalnızca kendi</b> linkini gönder. Linkler gerçek şifreleme değildir; açan kişi kime düştüğünü görür.</span>` }),
        h(
          'ul',
          { class: 'list-cards' },
          pairs.map(([giver, recv]) => {
            const url = base + encodeTicket({ e: g().event, b: g().budget, d: g().date, g: giver, r: recv });
            return h(
              'li',
              { class: 'card gift-row' },
              h('b', { class: 'grow' }, giver),
              h('button', { class: 'btn icon', 'aria-label': `${giver} linkini kopyala`, html: icons.copy, onclick: () => copy(url) }),
              h('button', {
                class: 'btn icon',
                'aria-label': `${giver} linkini paylaş`,
                html: icons.share,
                onclick: () => share(`${giver}, ${g().event || 'hediyeleşme'} kuran hazır! Kime hediye alacağını gör: ${url}`),
              }),
            );
          }),
        ),
        h('div', { class: 'row wrap' }, reset),
      );
      return;
    }

    const done = seen.length === pairs.length;
    view.replaceChildren(
      head,
      h('p', { class: 'center muted' }, done ? 'Herkes baktı. İyi eğlenceler!' : `Sıradaki kişi kendi adına dokunsun · ${seen.length}/${pairs.length}`),
      h(
        'div',
        { class: 'gift-grid' },
        pairs.map(([giver]) =>
          h(
            'button',
            {
              class: `gift-person${seen.includes(giver) ? ' seen' : ''}`,
              disabled: seen.includes(giver),
              onclick: () => reveal(giver),
              html: seen.includes(giver) ? icons.check : icons.gift,
            },
            h('span', {}, giver),
          ),
        ),
      ),
      h('div', { class: 'row wrap' }, reset),
    );
    if (done) confetti();
  }

  function reveal(giver) {
    const recv = g().pairs.find(([a]) => a === giver)[1];
    const card = h(
      'section',
      { class: 'gift-reveal' },
      h('p', { class: 'muted' }, 'Bu ekrana yalnızca'),
      h('h2', { class: 'gift-who' }, giver),
      h('p', { class: 'muted' }, 'baksın.'),
      h(
        'button',
        {
          class: 'btn primary big',
          html: icons.eye,
          onclick: () => {
            card.replaceChildren(
              h('p', { class: 'muted' }, `${giver}, hediye alacağın kişi:`),
              h('div', { class: 'gift-recv' }, recv),
              h('p', { class: 'muted small' }, [g().budget && `Bütçe ${g().budget}`, g().date].filter(Boolean).join(' · ')),
              h(
                'button',
                {
                  class: 'btn big',
                  html: icons.eyeOff,
                  onclick: () => {
                    store.update((s) => s.gift.seen.push(giver));
                    render();
                  },
                },
                'Gördüm, gizle',
              ),
            );
            sound('win');
            vibrate(40);
          },
        },
        `Ben ${giver}, göster`,
      ),
      h('button', { class: 'btn', onclick: render }, 'Vazgeç'),
    );
    view.replaceChildren(card);
  }

  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link kopyalandı');
    } catch {
      toast('Kopyalanamadı');
    }
  }
}

function mountTicket(root, payload) {
  let t;
  try {
    t = decodeTicket(payload);
  } catch {
    root.append(pageHeader('Hediyeleşme', null, 'gift'), h('p', { class: 'center muted' }, 'Bu link bozuk görünüyor. Linki gönderen kişiden yeniden iste.'));
    return;
  }
  const meta = [t.b && `Bütçe ${t.b}`, t.d].filter(Boolean).join(' · ');

  const open = () => {
    if (wrap.classList.contains('open')) return;
    wrap.classList.add('open');
    card.classList.add('open');
    cta.hidden = true;
    after.hidden = false;
    confetti();
    sound('win');
    vibrate([40, 60, 40]);
  };

  const card = h(
    'button',
    { class: 'gift-ticket', 'aria-label': 'Kartı aç ve kime hediye alacağını gör', onclick: open },
    h(
      'div',
      { class: 'face back' },
      h('span', { class: 'tap-rings', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      h('span', { class: 'ticket-gift', html: icons.gift }),
      h('b', { class: 'ticket-cta' }, 'DOKUN VE AÇ'),
      h('span', { class: 'ticket-sub' }, 'Kime hediye alacağın bu kartın arkasında'),
    ),
    h(
      'div',
      { class: 'face front' },
      h('span', { class: 'muted' }, 'Hediye alacağın kişi'),
      h('b', {}, t.r),
      meta && h('span', { class: 'muted small' }, meta),
    ),
  );
  const cta = h('button', { class: 'btn primary big block ticket-btn', onclick: open, html: icons.eye }, 'Kime düştüğümü göster');
  const after = h(
    'p',
    { class: 'note ticket-note', hidden: true, html: `${icons.eyeOff}<span><b>Kimseye gösterme.</b> Bu link yalnızca sana özel; başkasına iletme.</span>` },
  );
  const wrap = h(
    'section',
    { class: 'ticket-page' },
    h('span', { class: 'eyebrow' }, h('span', { class: 'dot' }), 'Gizli kura sonucu'),
    h('h1', {}, 'Merhaba ', h('span', {}, t.g), '!'),
    h('p', { class: 'muted ticket-lead' }, `${t.e || 'Hediyeleşme'} kurası çekildi. Kime hediye alacağını görmek için kartı aç.`),
    card,
    cta,
    after,
    h('p', { class: 'center muted small ticket-private' }, 'Sonucu yalnızca sen görürsün; ekranına kimse bakmasın.'),
  );
  root.append(wrap);
}
