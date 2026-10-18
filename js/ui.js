// Ortak arayüz parçaları: DOM yardımcısı, sonuç kartı, konfeti, ses, titreşim.

import * as store from './store.js';
import { verify } from './rng.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false || k === 'value') continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
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

export function pageHeader(title, subtitle) {
  return h(
    'header',
    { class: 'page-head' },
    h('a', { class: 'back', href: '#/', 'aria-label': 'Ana sayfa' }, '←'),
    h('div', {}, h('h1', {}, title), subtitle && h('p', { class: 'muted' }, subtitle)),
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
  const colors = ['#ff5a5f', '#ffb400', '#00a699', '#7b61ff', '#2bb3ff', '#ff8a00'];
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
        onAgain && h('button', { class: 'btn primary', onclick: onAgain }, againLabel),
        h('button', { class: 'btn', onclick: () => share(shareText) }, 'Paylaş'),
      ),
    ),
  );
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
          status.textContent = (await verify(record)) ? ' ✓ doğrulandı' : ' ✗ tutmuyor';
        },
      },
      record.code ? `kod ${record.code}` : 'kod yok (güvenli bağlantı gerekli)',
    ),
    status,
  );
}
