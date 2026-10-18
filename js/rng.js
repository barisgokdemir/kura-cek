// Kura Çek rastgelelik motoru.
// Tüm sonuçlar crypto.getRandomValues() ile üretilir; Math.random() kullanılmaz.
// Animasyonlar her zaman burada önceden belirlenen sonuca iner.

const RANGE = 2 ** 32;

export function randomUint32() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

// [min, max] aralığında (iki uç dahil) eşit olasılıklı tamsayı.
// Rejection sampling: `x % n` kullanmak, 2^32 n'e tam bölünmediğinde
// bazı değerleri çok az da olsa daha olası kılar. Bu yüzden son eksik
// "kova"ya düşen değerler atılır ve yeniden çekilir.
export function randomInt(min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`Geçersiz aralık: ${min}..${max}`);
  }
  const n = max - min + 1;
  if (n > RANGE) throw new RangeError('Aralık 2^32 değerden büyük olamaz');
  if (n === 1) return min;
  const limit = RANGE - (RANGE % n);
  let x;
  do {
    x = randomUint32();
  } while (x >= limit);
  return min + (x % n);
}

// [0, 1) aralığında 53 bit çözünürlüklü ondalık (yalnızca görsel amaçlar için).
export function randomFloat() {
  const hi = randomUint32() >>> 5; // 27 bit
  const lo = randomUint32() >>> 6; // 26 bit
  return (hi * 67108864 + lo) / 9007199254740992;
}

export function pick(items) {
  if (!items.length) throw new RangeError('Boş listeden seçim yapılamaz');
  return items[randomInt(0, items.length - 1)];
}

// Fisher–Yates: her permütasyon eşit olasılıklı. Girdiyi değiştirmez.
export function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tekrarsız n eleman (kısmi Fisher–Yates).
export function sample(items, n) {
  if (n > items.length) throw new RangeError('İstenen sayı liste uzunluğundan büyük');
  const a = [...items];
  for (let i = 0; i < n; i++) {
    const j = randomInt(i, a.length - 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export function randomHex(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Doğrulama kodu: kaydın (modül, girdi, sonuç, zaman, nonce) SHA-256 parmak izi.
// Kayıt sonradan değiştirilirse kod tutmaz. Rastgeleliği değil, kaydın
// bütünlüğünü kanıtlar; Hakkında sayfasında bu fark açıkça anlatılır.
export function canonical(record) {
  const { module, input, result, ts, nonce } = record;
  return JSON.stringify({ module, input, result, ts, nonce });
}

export async function fingerprint(record) {
  if (!globalThis.crypto?.subtle) return null; // güvensiz bağlamda (http) yok
  const data = new TextEncoder().encode(canonical(record));
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 12).toUpperCase().replace(/(.{4})(?=.)/g, '$1-');
}

export async function seal(module, input, result) {
  const record = { module, input, result, ts: new Date().toISOString(), nonce: randomHex(16) };
  record.code = await fingerprint(record);
  return record;
}

export async function verify(record) {
  return record.code != null && (await fingerprint(record)) === record.code;
}

export async function sha256hex(text) {
  if (!globalThis.crypto?.subtle) return null;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
