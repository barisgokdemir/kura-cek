// Kişiye özel linkler: veri linkin içinde taşınır (sunucu yok).
// Okunmasın diye karıştırılır; bu gizlemedir, şifreleme değildir.
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function encodeTicket(obj) {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const k = crypto.getRandomValues(new Uint8Array(4));
  return b64url([...k, ...data.map((b, i) => b ^ k[i % 4])]);
}
export function decodeTicket(s) {
  const all = unb64url(s);
  const k = all.slice(0, 4);
  return JSON.parse(new TextDecoder().decode(all.slice(4).map((b, i) => b ^ k[i % 4])));
}
