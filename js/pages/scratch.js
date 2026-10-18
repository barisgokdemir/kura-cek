import { h, pageHeader, toast, share, confetti, sound, vibrate, parseLines, confirmButton, proofLine, stepper } from '../ui.js';
import { shuffle, seal, randomHex, sha256hex } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';
import { encodeTicket, decodeTicket } from '../ticket.js';

// "Kahve x3", "Sinema bileti × 2", "Çikolata*2" → 3, 2, 2 adet
export function parsePrizes(text) {
  return parseLines(text).flatMap((line) => {
    const m = line.match(/^(.*?)\s*[x×*]\s*(\d{1,3})$/i);
    const [name, n] = m && m[1].trim() ? [m[1].trim(), Math.min(+m[2], 500)] : [line, 1];
    return Array(n).fill(name);
  });
}

// Ödüller ve boşlar karıştırılıp kartlara dağıtılır.
export function dealPrizes(prizes, count, blank) {
  if (prizes.length > count) return null;
  return shuffle([...prizes, ...Array(count - prizes.length).fill(blank)]);
}

export function mount(root, params) {
  if (params.id?.startsWith('k/')) return mountCard(root, params.id.slice(2));

  const st = () => store.get().scratch;
  if (!st()) store.update((s) => (s.scratch = { event: 'Kazı kazan', prizes: '', blank: 'Bu sefer olmadı', count: 10, cards: null }));
  const view = h('div');
  root.append(pageHeader('Kazı Kazan', 'Ödülleri yaz, kartları dağıt; herkes kendi telefonunda kazısın.', 'ticket'), view);
  render();

  function render() {
    if (st().cards) renderCards();
    else renderSetup();
  }

  function input(field, attrs) {
    return h(attrs.rows ? 'textarea' : 'input', {
      type: 'text',
      ...attrs,
      value: st()[field],
      oninput: (e) => store.update((s) => (s.scratch[field] = e.target.value)),
    });
  }

  function renderSetup() {
    view.replaceChildren(
      h(
        'section',
        { class: 'panel open' },
        h('label', { class: 'field col' }, h('span', {}, 'Etkinlik'), input('event', { maxLength: 60 })),
        h(
          'label',
          { class: 'field col' },
          h('span', {}, 'Ödüller'),
          input('prizes', { rows: 5, placeholder: 'Her satıra bir ödül. Birden fazla için adet yaz:\nSinema bileti\nKahve x3\nÇikolata x2' }),
        ),
        h('label', { class: 'field col' }, h('span', {}, 'Boş kartta yazacak'), input('blank', { maxLength: 40 })),
        h(
          'div',
          { class: 'field' },
          h('span', {}, 'Kart sayısı'),
          stepper({ value: st().count, min: 2, max: 60, label: 'Kart sayısı', onChange: (v) => store.update((s) => (s.scratch.count = v)) }),
        ),
        h('button', { class: 'btn primary big block', onclick: create, html: icons.ticket }, 'Kartları oluştur'),
      ),
    );
  }

  async function create() {
    const { prizes: text, count, blank, event } = st();
    const prizes = parsePrizes(text);
    if (!prizes.length) return toast('En az bir ödül yaz');
    const dealt = dealPrizes(prizes, count, blank.trim() || 'Bu sefer olmadı');
    if (!dealt) return toast(`${prizes.length} ödül var; kart sayısını en az ${prizes.length} yap`);
    const set = randomHex(4);
    const salt = randomHex(16);
    // Mühürde dağılımın kendisi değil, taahhüdü tutulur; geçmişe bakan kimin ne kazandığını göremez.
    const commitment = await sha256hex(JSON.stringify(dealt) + salt);
    const record = await seal('kazi-kazan', { event, prizes, count }, { commitment });
    store.update((s) => (s.scratch.cards = { set, salt, list: dealt, blank: blank.trim() || 'Bu sefer olmadı', record }));
    store.addHistory(record, `${event || 'Kazı kazan'}: ${count} kart, ${prizes.length} ödül`);
    sound('win');
    render();
  }

  function renderCards() {
    const { set, list, blank, record } = st().cards;
    const event = st().event;
    const payload = list.map((p, k) => encodeTicket({ e: event, s: set, k: k + 1, p, w: p !== blank }));
    const url = (k) => `${location.origin}${location.pathname}#/kazi-kazan/k/${payload[k]}`;
    view.replaceChildren(
      h(
        'section',
        { class: 'gift-head' },
        h('b', {}, event || 'Kazı kazan'),
        h('span', { class: 'muted small' }, `${list.length} kart · ${list.filter((p) => p !== blank).length} ödül`),
        proofLine(record),
      ),
      h('p', { class: 'note', html: `${icons.eyeOff}<span>Her kişiye <b>bir</b> kart linki gönder. Ödüller kartlara karıştırılarak dağıtıldı; bu listede kimin ne kazandığı görünmez.</span>` }),
      h(
        'ul',
        { class: 'list-cards' },
        list.map((_, k) =>
          h(
            'li',
            { class: 'card gift-row' },
            h('span', { class: 'scratch-no', html: icons.ticket }),
            h('b', { class: 'grow' }, `Kart ${k + 1}`),
            h('a', { class: 'btn icon', href: `#/kazi-kazan/k/${payload[k]}`, 'aria-label': `Kart ${k + 1}: bu telefonda kazı`, html: icons.eye }),
            h('button', { class: 'btn icon', 'aria-label': `Kart ${k + 1} linkini kopyala`, html: icons.copy, onclick: () => copy(url(k)) }),
            h('button', {
              class: 'btn icon',
              'aria-label': `Kart ${k + 1} linkini paylaş`,
              html: icons.share,
              onclick: () => share(`${event || 'Kazı kazan'}: senin kartın (Kart ${k + 1}) hazır! Aç ve kazı: ${url(k)}`),
            }),
          ),
        ),
      ),
      h(
        'div',
        { class: 'row wrap', style: { marginTop: '14px' } },
        confirmButton('Yeni kartlar', 'Emin misin? Eski linkler yine çalışır', () => {
          store.update((s) => (s.scratch.cards = null));
          render();
        }),
      ),
    );
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Kart linki kopyalandı');
    } catch {
      toast('Kopyalanamadı');
    }
  }
}

// ---------- Kazıma ekranı ----------
function mountCard(root, payload) {
  let t;
  try {
    t = decodeTicket(payload);
    if (typeof t.p !== 'string') throw new Error();
  } catch {
    root.append(pageHeader('Kazı Kazan', null, 'ticket'), h('p', { class: 'center muted' }, 'Bu kart linki bozuk görünüyor. Linki gönderen kişiden yeniden iste.'));
    return;
  }
  const id = `${t.s}-${t.k}`;
  const already = !!store.get().scratched?.[id];

  const prize = h(
    'div',
    { class: `scratch-prize${t.w ? ' win' : ''}` },
    h('span', { class: 'scratch-prize-icon', html: t.w ? icons.gift : icons.cross }),
    h('b', {}, t.p),
    h('span', { class: 'small' }, t.w ? 'Tebrikler, kazandın!' : 'Bir dahaki sefere'),
  );
  const canvas = h('canvas', { class: 'scratch-canvas', 'aria-hidden': 'true' });
  const card = h('div', { class: 'scratch-card' }, prize, canvas);
  const hint = h('p', { class: 'center muted small' }, 'Parmağınla gümüş alanı kazı');
  const revealBtn = h('button', { class: 'link', onclick: () => reveal(true) }, 'Kazımadan aç');

  root.append(
    h(
      'section',
      { class: 'ticket-page' },
      h('span', { class: 'eyebrow' }, h('span', { class: 'dot' }), t.e || 'Kazı kazan'),
      h('h1', {}, 'Kart ', h('span', {}, String(t.k))),
    ),
    card,
    hint,
    h('p', { class: 'center' }, revealBtn),
  );

  let done = false;
  function reveal(celebrate) {
    if (done) return;
    done = true;
    canvas.classList.add('gone');
    card.classList.add('revealed');
    hint.textContent = t.w ? 'Ödülünü kartı gönderen kişiden al.' : 'Bu sefer olmadı.';
    revealBtn.hidden = true;
    store.update((s) => {
      const all = { ...(s.scratched || {}), [id]: true };
      const keys = Object.keys(all);
      if (keys.length > 50) keys.slice(0, keys.length - 50).forEach((k) => delete all[k]);
      s.scratched = all;
    });
    if (!celebrate) return;
    if (t.w) {
      confetti();
      sound('win');
      vibrate([60, 40, 60]);
    } else {
      sound('lose');
      vibrate(80);
    }
  }

  if (already) {
    reveal(false);
    return;
  }

  // Gümüş kaplama: önce boyanır, sonra parmak izi "destination-out" ile silinir.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let dpr = 1;
  function paint() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, r.width * dpr);
    canvas.height = Math.max(1, r.height * dpr);
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, '#d9d9e3');
    g.addColorStop(0.45, '#9a9aae');
    g.addColorStop(0.55, '#f4f4fa');
    g.addColorStop(1, '#8a8aa0');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Hafif desen
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    for (let y = 0; y < canvas.height; y += 14 * dpr) for (let x = (y / 2) % (28 * dpr); x < canvas.width; x += 28 * dpr) ctx.fillRect(x, y, 3 * dpr, 3 * dpr);
    ctx.fillStyle = 'rgba(40,40,60,.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(canvas.width / 9)}px Sora, system-ui, sans-serif`;
    ctx.fillText('KAZI', canvas.width / 2, canvas.height / 2 - canvas.height * 0.06);
    ctx.font = `700 ${Math.round(canvas.width / 26)}px Inter, system-ui, sans-serif`;
    ctx.fillText('parmağınla kazı', canvas.width / 2, canvas.height / 2 + canvas.height * 0.16);
  }
  paint();
  document.fonts?.ready.then(() => !done && !scratched && paint());

  let last = null;
  let moves = 0;
  let scratched = false;
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr];
  };
  function scratchTo(p) {
    scratched = true;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 46 * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(...(last || p));
    ctx.lineTo(...p);
    ctx.stroke();
    last = p;
    if (++moves % 8 === 0) {
      if (moves % 24 === 0) sound('tick');
      if (cleared() > 0.5) reveal(true);
    }
  }
  function cleared() {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 16) {
      total++;
      if (data[i] === 0) clear++;
    }
    return clear / total;
  }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    last = null;
    scratchTo(point(e));
    vibrate(8);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons || e.pointerType === 'touch') {
      if (last) scratchTo(point(e));
    }
  });
  const up = () => {
    last = null;
    if (!done && scratched && cleared() > 0.5) reveal(true);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}
