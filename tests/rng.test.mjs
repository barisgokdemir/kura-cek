import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, shuffle, sample, pick, seal, verify, fingerprint } from '../js/rng.js';

test('randomInt aralık içinde kalır ve uçları üretir', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const x = randomInt(1, 6);
    assert.ok(Number.isInteger(x) && x >= 1 && x <= 6);
    seen.add(x);
  }
  assert.equal(seen.size, 6);
});

test('randomInt geçersiz aralığı reddeder', () => {
  assert.throws(() => randomInt(5, 1), RangeError);
  assert.throws(() => randomInt(0, 2 ** 32), RangeError);
  assert.equal(randomInt(7, 7), 7);
});

test('randomInt yaklaşık eşit dağılır (ki-kare)', () => {
  const n = 7;
  const N = 70000;
  const counts = Array(n).fill(0);
  for (let i = 0; i < N; i++) counts[randomInt(0, n - 1)]++;
  const exp = N / n;
  const chi = counts.reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
  // 6 serbestlik derecesi, p=0.001 kritik değeri 22.46
  assert.ok(chi < 22.46, `ki-kare çok yüksek: ${chi}`);
});

test('shuffle bir permütasyon döndürür ve girdiyi değiştirmez', () => {
  const a = [1, 2, 3, 4, 5];
  const b = shuffle(a);
  assert.deepEqual(a, [1, 2, 3, 4, 5]);
  assert.deepEqual([...b].sort(), [1, 2, 3, 4, 5]);
});

test('shuffle 3 elemanın 6 permütasyonunu eşit üretir', () => {
  const counts = {};
  const N = 60000;
  for (let i = 0; i < N; i++) {
    const k = shuffle(['a', 'b', 'c']).join('');
    counts[k] = (counts[k] || 0) + 1;
  }
  assert.equal(Object.keys(counts).length, 6);
  const exp = N / 6;
  const chi = Object.values(counts).reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
  assert.ok(chi < 20.52, `ki-kare çok yüksek: ${chi}`); // 5 sd, p=0.001
});

test('sample tekrarsız seçer', () => {
  for (let i = 0; i < 200; i++) {
    const s = sample(['a', 'b', 'c', 'd', 'e'], 3);
    assert.equal(s.length, 3);
    assert.equal(new Set(s).size, 3);
  }
  assert.throws(() => sample([1], 2), RangeError);
  assert.throws(() => pick([]), RangeError);
});

test('seal/verify kaydın bütünlüğünü doğrular', async () => {
  const r = await seal('zar', { sides: 6 }, [4]);
  assert.match(r.code, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(await verify(r), true);
  assert.equal(await verify({ ...r, result: [6] }), false);
  assert.equal(await fingerprint(r), r.code);
});
