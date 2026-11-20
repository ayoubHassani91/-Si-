import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Hero 3D : le & (15 blocs découpés dans la lettre, modèle Blender) s'assemble depuis la profondeur,
 * bloc par bloc de gauche à droite, avec une décélération douce. Ensuite :
 * - il s'incline vers le pointeur ;
 * - ses blocs s'écartent légèrement si le pointeur bouge vite, puis se recalent ;
 * - un clic rejoue l'assemblage (replay()).
 * Le rendu ne tourne que pendant un mouvement, jamais en continu au repos.
 */
const TILT = THREE.MathUtils.degToRad(18);
const DUREE = 1.1; // durée d'arrivée d'un bloc (s)
const DECALAGE = 0.055; // délai entre deux blocs (s)

export interface HeroScene {
  replay: () => void;
  point: (nx: number, ny: number) => void; // -1..1, relatif au centre du &
  dispose: () => void;
}

const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

export async function mountHero(canvas: HTMLCanvasElement, opts: { shift?: number } = {}): Promise<HeroScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf7f5f0, 2.8));
  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(-3, 4, 4);
  scene.add(key);

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  const base = canvas.dataset.base ?? '/';
  draco.setDecoderPath(`${base}draco/`);
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync(`${base}3d/amp.glb`);
  const amp = new THREE.Group();
  amp.add(gltf.scene);
  scene.add(amp);

  // Caméra légèrement au-dessus, cadrage serré : le & remplit presque toute la hauteur.
  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
  camera.position.set(0, 0.35, 4.6);
  camera.lookAt(0, 0, 0);
  const baseTan = Math.tan(THREE.MathUtils.degToRad(10)) * 1.12;
  const shift = opts.shift ?? 0;

  // Blocs : position de repos, ordre d'arrivée (gauche → droite) et direction d'écartement.
  const blocs: THREE.Object3D[] = [];
  gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) blocs.push(o); });
  const repos = blocs.map((b) => ({ p: b.position.clone(), q: b.quaternion.clone() }));
  const xs = repos.map((r) => r.p.x);
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ordre = repos.map((r) => (r.p.x - xmin) / (xmax - xmin || 1));
  const ecart = repos.map((r, i) => {
    const d = new THREE.Vector3(r.p.x, r.p.y, 0);
    if (d.lengthSq() < 1e-4) d.set(0, 1, 0);
    return d.normalize().setZ(0.5 + (i % 3) * 0.2);
  });
  const axe = new THREE.Vector3();
  const qTmp = new THREE.Quaternion();

  let t = 0;
  const finEntree = DUREE + DECALAGE * blocs.length + 0.1;
  const target = new THREE.Vector2();
  const tilt = new THREE.Vector2();
  const last = new THREE.Vector2();
  let burst = 0;
  let explode = 0;
  let running = false;

  const render = () => {
    blocs.forEach((b, i) => {
      // Entrée : chaque bloc part de la profondeur (z négatif), un peu plus bas et incliné.
      const k = expoOut(Math.min(1, Math.max(0, (t - ordre[i] * DECALAGE * blocs.length) / DUREE)));
      const r = 1 - k;
      b.position.copy(repos[i].p);
      b.position.z -= r * 2.4;
      b.position.y -= r * 0.18;
      b.position.addScaledVector(ecart[i], explode * 0.16);
      b.quaternion.copy(repos[i].q);
      axe.set(1, 0.3 * (i % 2 ? 1 : -1), 0).normalize();
      qTmp.setFromAxisAngle(axe, r * 0.9 + explode * 0.35 * (i % 2 ? 1 : -1));
      b.quaternion.premultiply(qTmp);
      b.scale.setScalar(0.85 + 0.15 * k);
    });
    amp.rotation.set(tilt.y, tilt.x, 0);
    renderer.render(scene, camera);
  };

  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tan = camera.aspect < 1 ? baseTan / Math.max(camera.aspect, 0.6) : baseTan;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tan));
    if (shift) camera.setViewOffset(w, h, -shift * w, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    render();
  };

  const timer = new THREE.Timer();
  timer.connect(document);
  const loop = () => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    if (t < finEntree) t += dt;
    tilt.x = THREE.MathUtils.damp(tilt.x, target.x, 5, dt);
    tilt.y = THREE.MathUtils.damp(tilt.y, target.y, 5, dt);
    explode = THREE.MathUtils.damp(explode, burst, 8, dt);
    burst = THREE.MathUtils.damp(burst, 0, 2.6, dt);
    render();
    const calme = t >= finEntree && explode < 1e-3 && burst < 1e-3
      && Math.abs(tilt.x - target.x) < 1e-3 && Math.abs(tilt.y - target.y) < 1e-3;
    if (calme) { renderer.setAnimationLoop(null); running = false; }
  };
  const wake = () => {
    if (running) return;
    running = true;
    timer.update();
    renderer.setAnimationLoop(loop);
  };

  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  wake();
  canvas.dataset.ready = 'true';

  return {
    replay() { t = 0; burst = 0; explode = 0; wake(); },
    point(nx, ny) {
      const speed = Math.hypot(nx - last.x, ny - last.y);
      last.set(nx, ny);
      target.set(nx * TILT, ny * TILT * 0.6);
      if (t >= finEntree) burst = Math.min(1, burst + speed * 1.1);
      wake();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      timer.dispose();
      draco.dispose();
      renderer.dispose();
    },
  };
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
