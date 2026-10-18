import { h, pageHeader, showResult, toast, stepper, parseLines, sound } from '../ui.js';
import { shuffle, seal } from '../rng.js';
import * as store from '../store.js';
import { icons } from '../icons.js';

const PERIODS = [
  ['day', 'Her gün'],
  ['weekday', 'Hafta içi'],
  ['week', 'Haftalık'],
];

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Nöbet tarihleri (yerel saat; gün başı).
export function buildDates(startISO, period, count) {
  let d = fromISO(startISO);
  const out = [];
  if (period === 'week') {
    for (let i = 0; i < count; i++) out.push(toISO(addDays(d, i * 7)));
    return out;
  }
  while (out.length < count) {
    const wd = d.getDay();
    if (period === 'day' || (wd !== 0 && wd !== 6)) out.push(toISO(d));
    d = addDays(d, 1);
  }
  return out;
}

// Herkes eşit sayıda (en fazla 1 fark) nöbet tutar. "rotate": bir kez karıştırılıp sırayla döner.
// "reshuffle": her tur yeniden karıştırılır; tur geçişinde aynı kişi üst üste gelmez.
export function buildRoster(people, count, mode) {
  const n = people.length;
  const out = [];
  if (mode === 'rotate') {
    const order = shuffle(people);
    for (let i = 0; i < count; i++) out.push(order[i % n]);
    return out;
  }
  while (out.length < count) {
    let round;
    do round = shuffle(people);
    while (n > 1 && out.length && round[0] === out[out.length - 1]);
    out.push(...round);
  }
  return out.slice(0, count);
}

const fmtDay = (iso) => fromISO(iso).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
function label(iso, period) {
  if (period !== 'week') return fmtDay(iso);
  const a = fromISO(iso);
  const b = addDays(a, 6);
  const f = (d, opt) => d.toLocaleDateString('tr-TR', opt);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${f(b, { day: 'numeric', month: 'short' })}`
    : `${f(a, { day: 'numeric', month: 'short' })} – ${f(b, { day: 'numeric', month: 'short' })}`;
}

export function mount(root) {
  const today = toISO(new Date());
  const st = store.get().duty || {};
  const cfg = { title: 'Nöbet sırası', names: '', start: today, period: 'day', count: 14, mode: 'reshuffle', ...(st.cfg || {}) };
  const persist = () => store.update((s) => (s.duty = { ...(s.duty || {}), cfg: { ...cfg } }));

  const out = h('div');
  const resultSlot = h('div');
  const field = (key, attrs) =>
    h(attrs.rows ? 'textarea' : 'input', { type: 'text', ...attrs, value: cfg[key], oninput: (e) => ((cfg[key] = e.target.value), persist()) });
  const seg = (key, options, label) => {
    const el = h(
      'div',
      { class: 'segmented', role: 'radiogroup', 'aria-label': label },
      options.map(([id, text]) =>
        h(
          'button',
          {
            role: 'radio',
            'aria-checked': String(cfg[key] === id),
            'data-id': id,
            onclick: () => {
              cfg[key] = id;
              persist();
              el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
            },
          },
          text,
        ),
      ),
    );
    return el;
  };

  root.append(
    pageHeader('Nöbet Sırası', 'Nöbet, temizlik, çay sırası: herkese eşit gün.', 'calendar'),
    h(
      'section',
      { class: 'panel open' },
      h('label', { class: 'field col' }, h('span', {}, 'Başlık'), field('title', { maxLength: 60 })),
      h('label', { class: 'field col' }, h('span', {}, 'Kişiler'), field('names', { rows: 5, placeholder: 'Her satıra bir isim' })),
      h(
        'div',
        { class: 'fields-2' },
        h('label', { class: 'field' }, h('span', {}, 'Başlangıç'), field('start', { type: 'date' })),
        h(
          'div',
          { class: 'field' },
          h('span', {}, 'Kaç nöbet'),
          stepper({ value: cfg.count, min: 1, max: 120, label: 'Kaç nöbet', onChange: (v) => ((cfg.count = v), persist()) }),
        ),
      ),
      h('div', { class: 'field col' }, h('span', {}, 'Sıklık'), seg('period', PERIODS, 'Sıklık')),
      h(
        'div',
        { class: 'field col' },
        h('span', {}, 'Dağıtım'),
        seg(
          'mode',
          [
            ['reshuffle', 'Her tur yeniden karıştır'],
            ['rotate', 'Tek sıra, sırayla dön'],
          ],
          'Dağıtım',
        ),
      ),
      h('button', { class: 'btn primary big block', onclick: () => build(), html: icons.calendar }, 'Sırayı oluştur'),
    ),
    resultSlot,
    out,
  );

  async function build() {
    const people = [...new Set(parseLines(cfg.names))];
    if (people.length < 2) return toast('En az iki kişi yaz');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.start)) return toast('Başlangıç tarihini seç');
    const dates = buildDates(cfg.start, cfg.period, cfg.count);
    const roster = buildRoster(people, cfg.count, cfg.mode);
    const record = await seal('nobet-sirasi', { people, start: cfg.start, period: cfg.period, count: cfg.count, mode: cfg.mode }, roster);
    const plan = { title: cfg.title, period: cfg.period, dates, roster, record };
    store.update((s) => (s.duty = { cfg: { ...cfg }, plan }));
    store.addHistory(record, `${cfg.title || 'Nöbet sırası'}: ${cfg.count} nöbet, ${people.length} kişi`);
    sound('win');
    render(plan, true);
  }

  function render(plan, fresh) {
    const counts = {};
    plan.roster.forEach((n) => (counts[n] = (counts[n] || 0) + 1));
    const todayIdx = plan.dates.findIndex((d, i) => (plan.period === 'week' ? d <= today && today < toISO(addDays(fromISO(d), 7)) : d === today));
    const text = `${plan.title}\n` + plan.dates.map((d, i) => `${label(d, plan.period)}: ${plan.roster[i]}`).join('\n');
    out.replaceChildren(
      h(
        'section',
        { class: 'duty' },
        h('div', { class: 'duty-head' }, h('b', {}, plan.title || 'Nöbet sırası'), h('span', { class: 'muted small' }, `${plan.dates.length} nöbet`)),
        h('div', { class: 'chips duty-counts' }, Object.entries(counts).map(([n, c]) => h('span', { class: 'chip' }, n, h('b', {}, String(c))))),
        h(
          'ol',
          { class: 'duty-list' },
          plan.dates.map((d, i) =>
            h(
              'li',
              { class: i === todayIdx ? 'today' : d < today && plan.period !== 'week' ? 'past' : '' },
              h('span', { class: 'duty-date' }, label(d, plan.period)),
              h('b', {}, plan.roster[i]),
              i === todayIdx ? h('span', { class: 'duty-badge' }, plan.period === 'week' ? 'Bu hafta' : 'Bugün') : '',
            ),
          ),
        ),
        h(
          'div',
          { class: 'row wrap', style: { marginTop: '12px' } },
          h('button', { class: 'btn', html: icons.copy, onclick: () => copy(text) }, 'Kopyala'),
          h('button', { class: 'btn', html: icons.print, onclick: printPlan }, 'Yazdır'),
        ),
      ),
    );
    if (fresh) {
      showResult(resultSlot, {
        title: plan.title || 'Nöbet sırası',
        big: todayIdx >= 0 ? `${plan.period === 'week' ? 'Bu hafta' : 'Bugün'}: ${plan.roster[todayIdx]}` : `İlk nöbet: ${plan.roster[0]}`,
        detail: 'Herkes eşit sayıda (en fazla 1 fark) nöbet tutar',
        record: plan.record,
        onAgain: build,
        againLabel: 'Yeniden karıştır',
      });
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Liste kopyalandı');
    } catch {
      toast('Kopyalanamadı');
    }
  }
  function printPlan() {
    document.body.classList.add('printing-duty');
    const done = () => {
      document.body.classList.remove('printing-duty');
      removeEventListener('afterprint', done);
    };
    addEventListener('afterprint', done);
    print();
    setTimeout(done, 1000);
  }

  if (st.plan) render(st.plan, false);
}
