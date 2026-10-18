// Ortak arayüz parçaları: DOM yardımcısı, sonuç kartı, konfeti, ses, titreşim.

import * as store from './store.js';
import { verify } from './rng.js';
import { icons } from './icons.js';

export const icon = (name, cls = '') => h('span', { class: `ico ${cls}`.trim(), html: icons[name], 'aria-hidden': 'true' });

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false || k === 'value') continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, val);
        else el.style[prop] = val;
      }
    }
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  // value en sonda: <select> seçenekleri eklendikten sonra atanmalı.
  if (attrs?.value != null) el.value = attrs.value;
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function reducedMotion() {
  const pref = store.get().settings.motion;
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function pageHeader(title, subtitle, iconName, backHref = '#/') {
  return h(
    'header',
    { class: 'page-head' },
    h('a', { class: 'back-btn', href: backHref, 'aria-label': 'Geri', html: icons.back }),
    h('div', { class: 'grow' }, h('h1', {}, title), subtitle && h('p', { class: 'muted' }, subtitle)),
    iconName && h('span', { class: 'head-icon', html: icons[iconName], 'aria-hidden': 'true' }),
  );
}

// ---------- Toast ----------
export function toast(msg) {
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

// ---------- Ses ----------
let audio;
function ctx() {
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

function tone(freq, dur, { type = 'sine', gain = 0.15, delay = 0, slide } = {}) {
  const ac = ctx();
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const sounds = {
  tick: () => tone(1400, 0.03, { type: 'square', gain: 0.05 }),
  flip: () => tone(500, 0.25, { type: 'triangle', slide: 1500, gain: 0.1 }),
  land: () => tone(180, 0.12, { type: 'triangle', gain: 0.25 }),
  roll: () => {
    for (let i = 0; i < 6; i++) tone(200 + i * 40, 0.05, { type: 'square', gain: 0.04, delay: i * 0.07 });
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { delay: i * 0.08, gain: 0.12 })),
  lose: () => tone(330, 0.5, { type: 'sawtooth', slide: 110, gain: 0.08 }),
};

export function sound(name) {
  if (!store.get().settings.sound) return;
  try {
    sounds[name]?.();
  } catch {
    // Ses desteklenmiyorsa sessiz devam.
  }
}

export function vibrate(pattern = 30) {
  if (store.get().settings.vibrate && navigator.vibrate) navigator.vibrate(pattern);
}

// ---------- Konfeti ----------
export function confetti() {
  if (reducedMotion()) return;
  const canvas = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
  document.body.append(canvas);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = (canvas.width = innerWidth * dpr);
  const H = (canvas.height = innerHeight * dpr);
  const c = canvas.getContext('2d');
  const colors = ['#22d3ee', '#f472b6', '#4ade80', '#a78bfa', '#fbbf24', '#fb7185'];
  // Konfetinin konumları görseldir; sonuçla ilgisi yoktur.
  const rnd = Math.random;
  const parts = Array.from({ length: 140 }, () => ({
    x: W / 2 + (rnd() - 0.5) * W * 0.3,
    y: H * 0.45,
    vx: (rnd() - 0.5) * 22 * dpr,
    vy: (-rnd() * 22 - 8) * dpr,
    s: (5 + rnd() * 6) * dpr,
    r: rnd() * Math.PI,
    vr: (rnd() - 0.5) * 0.4,
    color: colors[(rnd() * colors.length) | 0],
  }));
  const start = performance.now();
  (function frame(now) {
    const t = now - start;
    c.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.6 * dpr;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.r);
      c.fillStyle = p.color;
      c.globalAlpha = Math.max(0, 1 - t / 2600);
      c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      c.restore();
    }
    if (t < 2600) requestAnimationFrame(frame);
    else canvas.remove();
  })(start);
}

// ---------- Paylaşım ----------
export async function share(text) {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Kura Çek', text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('Sonuç panoya kopyalandı');
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Paylaşılamadı');
  }
}

export function formatTime(iso) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ---------- Sonuç kartı ----------
// slot: sonucun yazılacağı kapsayıcı. Sonuç zaten belirlenmiş ve mühürlenmiştir.
export function showResult(slot, { title, big, detail, record, onAgain, againLabel = 'Tekrar', celebrate }) {
  const shareText = `Kura Çek — ${title}: ${typeof big === 'string' ? big : big.textContent}` +
    (detail ? `\n${typeof detail === 'string' ? detail : detail.textContent}` : '') +
    (record?.code ? `\nDoğrulama: ${record.code}` : '');
  slot.replaceChildren(
    h(
      'section',
      { class: 'result', 'aria-live': 'polite' },
      h('p', { class: 'result-title' }, title),
      h('div', { class: 'result-big' }, big),
      detail && h('div', { class: 'result-detail' }, detail),
      record && proofLine(record),
      h(
        'div',
        { class: 'row' },
        onAgain && h('button', { class: 'btn primary', onclick: onAgain, html: icons.again }, againLabel),
        h('button', { class: 'btn', onclick: () => share(shareText), html: icons.share }, 'Paylaş'),
      ),
    ),
  );
  // Küçük ekranlarda sonuç kartı görünür alana kaydırılır.
  const card = slot.firstElementChild;
  requestAnimationFrame(() => {
    const r = card.getBoundingClientRect();
    if (r.bottom > innerHeight - 80 || r.top < 0) card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  });
  if (celebrate) {
    confetti();
    sound('win');
    vibrate([40, 60, 40]);
  } else {
    vibrate(30);
  }
}

export function proofLine(record) {
  const status = h('span', { class: 'proof-status' });
  return h(
    'p',
    { class: 'proof' },
    h('span', {}, formatTime(record.ts)),
    ' · ',
    h(
      'button',
      {
        class: 'link',
        title: 'Kaydın parmak izini yeniden hesapla',
        onclick: async () => {
          const ok = await verify(record);
          status.className = `proof-status ${ok ? 'ok' : 'bad'}`;
          status.innerHTML = `${ok ? icons.check : icons.cross}<span>${ok ? 'doğrulandı' : 'tutmuyor'}</span>`;
        },
      },
      record.code ? `kod ${record.code}` : 'kod yok (güvenli bağlantı gerekli)',
    ),
    status,
  );
}

// Satır başına bir öğe (isim, seçenek).
export const parseLines = (text) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

// − sayı + kontrolü
export function stepper({ value, min, max, label, onChange }) {
  let v = value;
  const out = h('output', { 'aria-live': 'polite' }, String(v));
  const set = (n) => {
    v = Math.max(min, Math.min(max, n));
    out.textContent = v;
    onChange(v);
  };
  const el = h(
    'div',
    { class: 'stepper', role: 'group', 'aria-label': label },
    h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Azalt', html: icons.minus, onclick: () => set(v - 1) }),
    out,
    h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Arttır', html: icons.plus, onclick: () => set(v + 1) }),
  );
  el.set = (n) => {
    v = Math.max(min, Math.min(max, n));
    out.textContent = v;
  };
  return el;
}

// Onay isteyen buton: ilk dokunuşta uyarır, ikincide çalışır.
export function confirmButton(label, sureLabel, action, cls = 'btn danger') {
  const btn = h('button', {
    class: cls,
    type: 'button',
    onclick: () => {
      if (!btn.dataset.sure) {
        btn.dataset.sure = '1';
        btn.textContent = sureLabel;
        setTimeout(() => {
          delete btn.dataset.sure;
          btn.textContent = label;
        }, 4000);
        return;
      }
      delete btn.dataset.sure;
      btn.textContent = label;
      action();
    },
  }, label);
  return btn;
}
