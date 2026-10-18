import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syllablesOf, TEKERLEMELER } from '../js/data/tekerlemeler.js';
import { countOut } from '../js/pages/counting.js';
import { buildDates, buildRoster } from '../js/pages/duty.js';
import { arrange } from '../js/pages/seating.js';
import { fullDeck, cardScore, cardName } from '../js/pages/cards.js';

test('Türkçe heceleme', () => {
  assert.deepEqual(syllablesOf('Portakalı soydum'), ['Por', 'ta', 'ka', 'lı', 'soy', 'dum']);
  assert.deepEqual(syllablesOf('Terazi lastik jimnastik'), ['Te', 'ra', 'zi', 'las', 'tik', 'jim', 'nas', 'tik']);
  assert.deepEqual(syllablesOf('Ebe kim?'), ['E', 'be', 'kim?']);
  assert.ok(TEKERLEMELER.length >= 20);
  TEKERLEMELER.forEach((t) => assert.ok(t.lines.flatMap(syllablesOf).length > 5, t.title));
});

test('sayışma: son hece ve eleme', () => {
  assert.equal(countOut(5, 0, 7, 'ebe').ebe, 1); // 0,1,2,3,4,0,1
  assert.equal(countOut(4, 2, 4, 'ebe').ebe, 1);
  const r = countOut(5, 0, 3, 'eleme'); // Josephus benzeri: kurtulanlar 2,0,4,1 → ebe 3
  assert.deepEqual(r.saved, [2, 0, 4, 1]);
  assert.equal(r.ebe, 3);
  for (let n = 2; n < 10; n++) {
    const x = countOut(n, 1, 11, 'eleme');
    assert.equal(new Set([...x.saved, x.ebe]).size, n);
  }
});

test('nöbet tarihleri: hafta içi hafta sonunu atlar, haftalık 7 gün arayla', () => {
  assert.deepEqual(buildDates('2026-10-23', 'weekday', 3), ['2026-10-23', '2026-10-26', '2026-10-27']); // Cuma → Pzt
  assert.deepEqual(buildDates('2026-10-30', 'week', 2), ['2026-10-30', '2026-11-06']);
  assert.deepEqual(buildDates('2026-12-31', 'day', 2), ['2026-12-31', '2027-01-01']);
});

test('nöbet: herkese eşit (±1), yeniden karıştırmada üst üste gelmez', () => {
  const people = ['A', 'B', 'C', 'D'];
  for (const mode of ['rotate', 'reshuffle']) {
    for (let k = 0; k < 100; k++) {
      const r = buildRoster(people, 14, mode);
      const c = people.map((p) => r.filter((x) => x === p).length);
      assert.ok(Math.max(...c) - Math.min(...c) <= 1, `${mode}: ${c}`);
      r.forEach((x, i) => i && assert.notEqual(x, r[i - 1]));
    }
  }
});

test('oturma: yasaklı çiftler yan yana / aynı masada değil', () => {
  const people = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const excl = [['A', 'B'], ['C', 'D']];
  for (let k = 0; k < 100; k++) {
    const rows = arrange(people, 'rows', 4, excl);
    rows.forEach((row) => row.forEach((p, i) => i && assert.ok(!['A|B', 'B|A', 'C|D', 'D|C'].includes(`${row[i - 1]}|${p}`))));
    const tables = arrange(people, 'tables', 3, excl);
    assert.equal(tables.flat().length, 8);
    tables.forEach((t) => assert.ok(!(t.includes('A') && t.includes('B')) && !(t.includes('C') && t.includes('D'))));
    const sizes = tables.map((t) => t.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  }
  assert.equal(arrange(['A', 'B'], 'tables', 2, [['A', 'B']]), null);
});

test('iskambil destesi', () => {
  assert.equal(fullDeck(false).length, 52);
  assert.equal(new Set(fullDeck(true)).size, 54);
  assert.ok(cardScore('S1') > cardScore('H13')); // as > papaz
  assert.ok(cardScore('S12') > cardScore('H12')); // maça > kupa
  assert.equal(cardName('H13'), 'Kupa Papaz');
  assert.equal(cardName('C1'), 'Sinek As');
});
