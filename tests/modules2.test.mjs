import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge, HANDS } from '../js/pages/rps.js';
import { drawNumbers } from '../js/pages/numbers.js';
import { parsePrizes, dealPrizes } from '../js/pages/scratch.js';
import { ANSWERS } from '../js/pages/orb.js';

test('taş-kağıt-makas kuralları', () => {
  const [T, K, M] = [0, 1, 2];
  assert.equal(HANDS[T], 'Taş');
  assert.equal(judge(K, T), 1); // kağıt taşı yener
  assert.equal(judge(M, K), 1); // makas kağıdı yener
  assert.equal(judge(T, M), 1); // taş makası yener
  assert.equal(judge(T, K), 2);
  for (let i = 0; i < 3; i++) assert.equal(judge(i, i), 0);
});

test('rastgele sayı: aralıkta, tekrarsız modda benzersiz', () => {
  for (let k = 0; k < 200; k++) {
    const u = drawNumbers(1, 10, 10, true);
    assert.deepEqual([...u].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const r = drawNumbers(-5, 5, 30, false);
    assert.equal(r.length, 30);
    r.forEach((n) => assert.ok(n >= -5 && n <= 5));
  }
  const big = drawNumbers(1, 4_000_000_000, 5, true);
  big.forEach((n) => assert.ok(Number.isInteger(n) && n >= 1 && n <= 4_000_000_000));
});

test('kazı kazan: ödül adetleri ve dağıtım', () => {
  assert.deepEqual(parsePrizes('Sinema bileti\nKahve x3\nÇikolata × 2'), ['Sinema bileti', 'Kahve', 'Kahve', 'Kahve', 'Çikolata', 'Çikolata']);
  assert.deepEqual(parsePrizes('Mars 2'), ['Mars 2']); // "x" yoksa sayı adın parçası
  const prizes = parsePrizes('A x2\nB');
  for (let k = 0; k < 100; k++) {
    const d = dealPrizes(prizes, 6, 'Boş');
    assert.equal(d.length, 6);
    assert.equal(d.filter((p) => p === 'A').length, 2);
    assert.equal(d.filter((p) => p === 'B').length, 1);
    assert.equal(d.filter((p) => p === 'Boş').length, 3);
  }
  assert.equal(dealPrizes(prizes, 2, 'Boş'), null);
});

test('sihirli küre: 20 klasik cevap (10/5/5)', () => {
  const c = ANSWERS.classic;
  assert.equal(c.length, 20);
  assert.equal(c.filter(([, t]) => t === 'yes').length, 10);
  assert.equal(c.filter(([, t]) => t === 'maybe').length, 5);
  assert.equal(c.filter(([, t]) => t === 'no').length, 5);
});
