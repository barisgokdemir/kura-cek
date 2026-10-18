import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCard, gridToRows, rowsToGrid } from '../js/pages/bingo.js';
import { buildTeams, parsePlayer } from '../js/pages/teams.js';
import { assign, parseExclusions, encodeTicket, decodeTicket } from '../js/pages/gift.js';
import { tavlaName } from '../js/pages/dice.js';

test('tombala kartı: 3×9, 15 sayı, satır başına 5, sütun aralıkları doğru', () => {
  for (let k = 0; k < 300; k++) {
    const card = makeCard();
    assert.equal(card.length, 3);
    const nums = card.flat().filter((v) => v != null);
    assert.equal(nums.length, 15);
    assert.equal(new Set(nums).size, 15);
    card.forEach((row) => assert.equal(row.filter((v) => v != null).length, 5));
    for (let c = 0; c < 9; c++) {
      const col = card.map((r) => r[c]).filter((v) => v != null);
      assert.ok(col.length >= 1);
      const lo = c === 0 ? 1 : c * 10;
      const hi = c === 8 ? 90 : c * 10 + 9;
      col.forEach((v) => assert.ok(v >= lo && v <= hi));
      assert.deepEqual(col, [...col].sort((a, b) => a - b));
    }
  }
});

test('oyuncu satırı seviye ile ayrıştırılır', () => {
  assert.deepEqual(parsePlayer('Ali 7'), { name: 'Ali', level: 7 });
  assert.deepEqual(parsePlayer('Ayşe Yılmaz, 10'), { name: 'Ayşe Yılmaz', level: 10 });
  assert.deepEqual(parsePlayer('Mehmet'), { name: 'Mehmet', level: null });
});

test('takımlar: herkes bir kez, boylar en fazla 1 farklı, seviyeler dengeli', () => {
  const players = Array.from({ length: 11 }, (_, i) => ({ name: `P${i}`, level: (i % 10) + 1 }));
  for (let k = 0; k < 200; k++) {
    const { teams } = buildTeams(players, 3);
    const all = teams.flat().map((p) => p.name);
    assert.equal(all.length, 11);
    assert.equal(new Set(all).size, 11);
    const sizes = teams.map((t) => t.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    const sums = teams.map((t) => t.reduce((a, p) => a + p.level, 0));
    assert.ok(Math.max(...sums) - Math.min(...sums) <= 10, `dengesiz: ${sums}`);
  }
});

test('hediyeleşme: kimse kendini ve yasaklı eşini çekmez, herkes bir kez alır', () => {
  const names = ['Ali', 'Ayşe', 'Mehmet', 'Zeynep', 'Can'];
  const excl = parseExclusions('Ali - Ayşe\nMehmet, Zeynep');
  assert.deepEqual(excl, [['Ali', 'Ayşe'], ['Mehmet', 'Zeynep']]);
  for (let k = 0; k < 300; k++) {
    const pairs = assign(names, excl);
    assert.ok(pairs);
    assert.deepEqual(pairs.map((p) => p[1]).sort(), [...names].sort());
    for (const [g, r] of pairs) {
      assert.notEqual(g, r);
      for (const [a, b] of excl) assert.ok(!((g === a && r === b) || (g === b && r === a)));
    }
  }
  assert.equal(assign(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['A', 'C']]), null);
});

test('kişiye özel link kodlanıp çözülür (Türkçe karakterler dahil)', () => {
  const t = { e: 'Yılbaşı', b: '500 ₺', d: '31 Aralık', g: 'Şükrü', r: 'Gülşen' };
  const s = encodeTicket(t);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeTicket(s), t);
});

test('tavla adları', () => {
  assert.equal(tavlaName(6, 6), 'Düşeş');
  assert.equal(tavlaName(5, 6), 'Şeşbeş');
  assert.equal(tavlaName(1, 1), 'Hep yek');
  assert.equal(tavlaName(3, 4), 'Cihar se');
});

test('tombala kartı linke satır olarak gider ve aynen geri kurulur', () => {
  for (let k = 0; k < 200; k++) {
    const card = makeCard();
    const rows = gridToRows(card);
    assert.deepEqual(rows.map((r) => r.length), [5, 5, 5]);
    assert.deepEqual(rowsToGrid(rows), card);
    assert.deepEqual(decodeTicket(encodeTicket({ s: 'ab12', k: 1, r: rows })).r, rows);
  }
});
