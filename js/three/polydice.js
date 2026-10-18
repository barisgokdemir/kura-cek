// RPG zarları için 3D geometri: her yüzde okunaklı sayı, sonuç yüzü kameraya döndürülür.

const textures = new Map();

// Yüz sayısı dokusu: kalın, konturlu; 6 ve 9 altı çizili.
function numberTexture(THREE, label, fg, stroke) {
  const key = `${label}|${fg}|${stroke}`;
  if (textures.has(key)) return textures.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const size = label.length >= 3 ? 104 : label.length === 2 ? 132 : 168;
  g.font = `900 ${size}px Sora, Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  if (stroke) {
    g.lineWidth = 22;
    g.strokeStyle = stroke;
    g.strokeText(label, 128, 136);
  }
  g.fillStyle = fg;
  g.fillText(label, 128, 136);
  if (label === '6' || label === '9') {
    if (stroke) {
      g.fillStyle = stroke;
      g.fillRect(84, 206, 88, 26);
    }
    g.fillStyle = fg;
    g.fillRect(92, 212, 72, 14);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  textures.set(key, tex);
  return tex;
}

// Beşgen yamuk on yüzlü (d10): üst/alt tepe + iki beşli halka. Halkanın yüksekliği
// yüzlerin düzlemsel olması için sayısal olarak bulunur.
function d10Geometry(THREE, radius) {
  const V = THREE.Vector3;
  const H = 1;
  const ring = (a, off, y) => Array.from({ length: 5 }, (_, k) => new V(Math.cos((k * 2 * Math.PI) / 5 + off), y, Math.sin((k * 2 * Math.PI) / 5 + off)));
  const planarity = (a) => {
    const T = new V(0, H, 0);
    const [U0, U1] = ring(a, 0, a);
    const L0 = ring(a, Math.PI / 5, -a)[0];
    const n = new V().subVectors(U0, T).cross(new V().subVectors(U1, T));
    return n.dot(new V().subVectors(L0, T));
  };
  let lo = 0.001;
  let hi = 0.999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(planarity(mid)) === Math.sign(planarity(lo))) lo = mid;
    else hi = mid;
  }
  const a = (lo + hi) / 2;
  const T = new V(0, H, 0);
  const B = new V(0, -H, 0);
  const U = ring(a, 0, a);
  const L = ring(a, Math.PI / 5, -a);
  const tris = [];
  for (let k = 0; k < 5; k++) {
    const k1 = (k + 1) % 5;
    tris.push([T, U[k], L[k]], [T, L[k], U[k1]]); // üst uçurtma
    tris.push([B, L[k], U[k1]], [B, U[k1], L[k1]]); // alt uçurtma
  }
  const pos = [];
  for (let [p, q, r] of tris) {
    const n = new V().subVectors(q, p).cross(new V().subVectors(r, p));
    const centroid = new V().add(p).add(q).add(r).divideScalar(3);
    if (n.dot(centroid) < 0) [q, r] = [r, q]; // dışa bakan sarım
    for (const v of [p, q, r]) pos.push(v.x, v.y, v.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.scale(radius, radius * 1.08, radius);
  geo.computeVertexNormals();
  return geo;
}

function baseGeometry(THREE, sides) {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(1.25);
    case 6:
      return new THREE.BoxGeometry(1.45, 1.45, 1.45).toNonIndexed();
    case 8:
      return new THREE.OctahedronGeometry(1.2);
    case 10:
      return d10Geometry(THREE, 1.1);
    case 12:
      return new THREE.DodecahedronGeometry(1.18);
    default:
      return new THREE.IcosahedronGeometry(1.22);
  }
}

// Üçgenleri normale göre gruplayıp yüzleri çıkarır: merkez, normal, "yukarı" yönü ve boyut.
function extractFaces(THREE, geo, square, kite) {
  const V = THREE.Vector3;
  const p = geo.attributes.position.array;
  const groups = new Map();
  for (let i = 0; i < p.length; i += 9) {
    const a = new V(p[i], p[i + 1], p[i + 2]);
    const b = new V(p[i + 3], p[i + 4], p[i + 5]);
    const c = new V(p[i + 6], p[i + 7], p[i + 8]);
    const n = new V().subVectors(b, a).cross(new V().subVectors(c, a)).normalize();
    // Aynı düzlemdeki üçgenler normal yönü neredeyse aynı olanlardır (yuvarlamalı anahtar sınırda bölünür).
    let g = [...groups.values()].find((x) => x.normal.dot(n) > 0.999);
    if (!g) groups.set(groups.size, (g = { normal: n, verts: [] }));
    for (const v of [a, b, c]) if (!g.verts.some((w) => w.distanceTo(v) < 1e-4)) g.verts.push(v);
  }
  return [...groups.values()].map(({ normal, verts }) => {
    const center = verts.reduce((s, v) => s.add(v), new V()).divideScalar(verts.length);
    // Yukarı: merkezden en uzak köşeye (üçgen ve uçurtmada sivri uç yukarı bakar).
    // Uçurtma yüzde yukarı her zaman kutup ucudur (|y| en büyük köşe); yoksa en uzak köşe.
    const far = kite
      ? verts.reduce((m, v) => (Math.abs(v.y) > Math.abs(m.y) ? v : m), verts[0])
      : verts.reduce((m, v) => (v.distanceTo(center) > m.distanceTo(center) ? v : m), verts[0]);
    // Küpte köşe yerine kenara paralel yukarı: sayı yatık durmaz.
    const up = square ? (Math.abs(normal.y) > 0.9 ? new V(0, 0, -1) : new V(0, 1, 0)) : new V().subVectors(far, center);
    up.sub(normal.clone().multiplyScalar(up.dot(normal))).normalize();
    const circum = far.distanceTo(center);
    // Yüzün sayının yazıldığı yükseklikteki genişliği: sayı komşu yüze taşmasın.
    const across = new V().crossVectors(up, normal).normalize();
    const xs = verts.map((v) => new V().subVectors(v, center).dot(across));
    const width = Math.max(...xs) - Math.min(...xs);
    const inradius = square ? circum * 0.707 : verts.length === 4 ? circum * 0.62 : circum * Math.cos(Math.PI / verts.length);
    return { normal, center, up, size: inradius, width };
  });
}

// Karşılıklı yüzlerin toplamı n+1 olacak şekilde 1..n numaralandırma.
function numberFaces(faces) {
  const n = faces.length;
  const used = new Set();
  let next = 1;
  faces.forEach((f, i) => {
    if (used.has(i)) return;
    f.value = next;
    used.add(i);
    const j = faces.findIndex((g, k) => !used.has(k) && g.normal.dot(f.normal) < -0.99);
    if (j >= 0) {
      faces[j].value = n + 1 - next;
      used.add(j);
    }
    next++;
  });
  // Karşılığı olmayanlar (d4) için kalan değerler sırayla.
  const taken = new Set(faces.map((f) => f.value).filter(Boolean));
  let free = 1;
  faces.forEach((f) => {
    if (f.value) return;
    while (taken.has(free)) free++;
    f.value = free;
    taken.add(free);
  });
}

// kind: 'd4'…'d20', 'd10', 'tens' (00–90) ya da 'units' (0–9) — son ikisi d100 çifti.
export function buildDie(THREE, kind, color) {
  const sides = kind === 'tens' || kind === 'units' ? 10 : +kind.slice(1);
  const geo = baseGeometry(THREE, sides);
  const faces = extractFaces(THREE, geo, sides === 6, sides === 10);
  numberFaces(faces);
  const label = (v) => (kind === 'tens' ? String((v % 10) * 10).padStart(2, '0') : kind === 'units' ? String(v % 10) : String(v));

  const group = new THREE.Group();
  // Koyu zarlar ışıkta griye dönmesin: koyu tonda, hafif parlak "obsidyen" yüzey.
  const dark = color.text === '#ffffff';
  const bodyMat = new THREE.MeshStandardMaterial({
    color: dark ? new THREE.Color(color.body[0]).lerp(new THREE.Color(color.body[1]), 0.7).multiplyScalar(0.75) : new THREE.Color(color.body[0]).lerp(new THREE.Color(color.body[1]), 0.35),
    roughness: dark ? 0.42 : 0.3,
    metalness: dark ? 0.45 : 0.25,
    flatShading: true,
    transparent: true,
  });
  const body = new THREE.Mesh(geo, bodyMat);
  body.castShadow = true;
  group.add(body);
  // d100 çiftinde onlar zarı altın kenarla ayrışır.
  const edgeColor = kind === 'tens' ? '#facc15' : color.edge;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 10), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.9 }));
  group.add(edges);

  for (const f of faces) {
    const tex = numberTexture(THREE, label(f.value), color.text, dark ? '#05050a' : null);
    let s = f.size * (sides === 4 ? 1.3 : sides === 20 ? 1.75 : sides === 8 ? 1.6 : sides === 10 ? 1.42 : sides === 12 ? 1.55 : 1.35);
    // Uçurtma yüzler dar: iki haneli onlar zarında sayı yüz genişliğine sığdırılır.
    if (sides === 10) s = Math.min(s, f.width * (kind === 'tens' ? 0.78 : 0.7));
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    const x = new THREE.Vector3().crossVectors(f.up, f.normal).normalize();
    const m = new THREE.Matrix4().makeBasis(x, f.up, f.normal);
    plane.quaternion.setFromRotationMatrix(m);
    // Üçgen yüzlerde sayıyı ağırlık merkezine biraz aşağı (taban tarafına) kaydır.
    const shift = sides === 10 ? -0.18 : sides === 4 || sides === 8 || sides === 20 ? -0.08 : 0;
    plane.position.copy(f.center).addScaledVector(f.normal, 0.012).addScaledVector(f.up, shift * f.size);
    group.add(plane);
    f.plane = plane;
  }
  group.userData = { faces, body, edges, bodyMat, kind, edgeColor };
  return group;
}

// Sonuç yüzünün sayısı parlak kalır, diğer yüzlerinki söner: hangi sayının geldiği tek bakışta okunur.
export function highlightFace(die, value) {
  for (const f of die.userData.faces) {
    f.plane.material.opacity = value == null || f.value === value ? 1 : 0.32;
  }
}

// Sonuç yüzünü bakış yönüne çeviren ve sayıyı ekranda dik tutan dönüş.
export function faceQuaternion(THREE, die, value, toCamera, screenUp) {
  const face = die.userData.faces.find((f) => f.value === value);
  const q1 = new THREE.Quaternion().setFromUnitVectors(face.normal, toCamera);
  const up1 = face.up.clone().applyQuaternion(q1);
  const want = screenUp.clone().sub(toCamera.clone().multiplyScalar(screenUp.dot(toCamera))).normalize();
  const angle = Math.atan2(new THREE.Vector3().crossVectors(up1, want).dot(toCamera), up1.dot(want));
  const q2 = new THREE.Quaternion().setFromAxisAngle(toCamera, angle);
  return q2.multiply(q1);
}

// d100 → onlar (00–90) ve birler (0–9) zarlarının yüz değerleri (1..10; 10 = "0"/"00").
export function percentileFaces(v) {
  const tens = Math.floor((v % 100) / 10);
  const units = v % 10;
  return { tens: tens === 0 ? 10 : tens, units: units === 0 ? 10 : units };
}
