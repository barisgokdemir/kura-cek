// Three.js yalnızca bir 3D modül açıldığında yüklenir (lazy-load).

let threePromise;
export const loadThree = () => (threePromise ??= import('../../vendor/three.min.js'));

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Zayıf cihazlarda gölgeyi ve antialias'ı kapat.
export function lowPower() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  return cores <= 4 && mem <= 4;
}

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeOutQuart = (t) => 1 - (1 - t) ** 4;
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export async function createStage(container, { cameraPos = [0, 7, 5], fov = 40, accent = 0x22d3ee } = {}) {
  const THREE = await loadThree();
  const low = lowPower();

  const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(...cameraPos);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 10, 6);
  sun.castShadow = !low;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  scene.add(sun);
  // Neon kenar ışığı (SocialCPU vurgusu)
  const rimLight = new THREE.DirectionalLight(accent, 1.6);
  rimLight.position.set(-6, 3, -6);
  scene.add(rimLight);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.45 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const render = () => renderer.render(scene, camera);

  const resize = () => {
    const w = container.clientWidth || 300;
    const hgt = container.clientHeight || 300;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
    render();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let disposed = false;

  // step(t) 0→1 arasında çağrılır; animasyon bitince promise çözülür.
  const animate = (duration, step) =>
    new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        if (disposed) return resolve();
        const t = Math.min(1, (now - start) / duration);
        step(t);
        render();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

  const dispose = () => {
    disposed = true;
    ro.disconnect();
    scene.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    });
    renderer.dispose();
    renderer.domElement.remove();
  };

  return { THREE, scene, camera, renderer, render, resize, animate, dispose, low };
}

// Canvas'tan doku üretir.
export function canvasTexture(THREE, size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
