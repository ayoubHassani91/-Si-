import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Hero 3D : le logo &si complet (modèle Blender : 15 blocs pour le &, 3 pièces pour « si »).
 * Entrée en trois temps :
 *  1. les blocs du & arrivent de tous les côtés en tournoyant et se verrouillent avec un léger rebond ;
 *  2. le « s » pivote depuis la droite, le fût du « i » monte, son point tombe en place ;
 *  3. la caméra se rapproche et le logo pivote pour se placer face au visiteur.
 * Ensuite : inclinaison vers le pointeur, dispersion si le pointeur bouge vite, nouvelle entrée au clic.
 * Le rendu ne tourne que pendant un mouvement, jamais en continu au repos.
 */
const TILT = THREE.MathUtils.degToRad(18);
const FIN = 2.4; // durée totale de l'entrée (s)

export interface HeroScene {
  replay: () => void;
  point: (nx: number, ny: number) => void; // -1..1, relatif au centre du logo
  dispose: () => void;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const backOut = (x: number, s = 1.6) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);

/** Générateur pseudo-aléatoire reproductible : la même chorégraphie à chaque visite. */
const aleatoire = (graine: number) => () => ((graine = (graine * 16807) % 2147483647) / 2147483647);

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
  const gltf = await loader.loadAsync(`${base}3d/logo.glb`);
  const logo = new THREE.Group();
  logo.add(gltf.scene);
  scene.add(logo);

  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
  const DIST = 4.6;
  const LARGEUR_LOGO = 1.07;
  const shift = opts.shift ?? 0;
  let part = 0.42; // part de la largeur du canvas occupée par le logo

  // Pièces et trajectoires d'entrée.
  type Piece = { o: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; depart: THREE.Vector3; axe: THREE.Vector3; angle: number; t0: number; duree: number; ecart: THREE.Vector3 };
  const pieces: Piece[] = [];
  const rnd = aleatoire(7);
  gltf.scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const p = o.position.clone();
    const q = o.quaternion.clone();
    const nom = (o.name || o.parent?.name || '').toLowerCase();
    const estSi = nom.startsWith('si_');
    let depart: THREE.Vector3;
    let axe: THREE.Vector3;
    let angle: number;
    let t0: number;
    let duree: number;
    if (!estSi) {
      // Blocs du & : depuis un point aléatoire autour, en profondeur variable.
      const a = rnd() * Math.PI * 2;
      depart = new THREE.Vector3(Math.cos(a) * (0.9 + rnd() * 0.6), Math.sin(a) * (0.6 + rnd() * 0.5), -1.6 + rnd() * 2.4);
      axe = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      angle = 1.6 + rnd() * 1.6;
      t0 = rnd() * 0.5;
      duree = 1.0 + rnd() * 0.2;
    } else {
      // « si » : chaque pièce a son geste.
      const estPoint = isPoint(o as THREE.Mesh);
      const estS = !estPoint && o.position.x < 0.35;
      if (estS) { depart = new THREE.Vector3(1.0, 0, -0.4); axe = new THREE.Vector3(0, 1, 0); angle = -1.9; t0 = 0.75; duree = 1.0; }
      else if (estPoint) { depart = new THREE.Vector3(0, 1.1, 0); axe = new THREE.Vector3(1, 0, 0); angle = 1.2; t0 = 1.15; duree = 0.8; }
      else { depart = new THREE.Vector3(0, -1.0, 0); axe = new THREE.Vector3(0, 0, 1); angle = 0.35; t0 = 0.95; duree = 0.9; }
    }
    const d = new THREE.Vector3(p.x, p.y, 0);
    if (d.lengthSq() < 1e-4) d.set(0, 1, 0);
    const ecart = d.normalize().setZ(0.5 + rnd() * 0.4);
    pieces.push({ o, p, q, depart, axe, angle, t0, duree, ecart });
  });
  function isPoint(m: THREE.Mesh) {
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox!;
    return b.max.y - b.min.y < 0.15; // le point du i est la seule petite pièce du « si »
  }

  const qTmp = new THREE.Quaternion();
  let t = 0;
  const target = new THREE.Vector2();
  const tilt = new THREE.Vector2();
  const last = new THREE.Vector2();
  let burst = 0;
  let explode = 0;
  let running = false;

  const render = () => {
    pieces.forEach((pc) => {
      const x = clamp01((t - pc.t0) / pc.duree);
      const k = backOut(x);
      const r = 1 - k;
      pc.o.position.copy(pc.p).addScaledVector(pc.depart, r).addScaledVector(pc.ecart, explode * 0.16);
      pc.o.quaternion.copy(pc.q);
      qTmp.setFromAxisAngle(pc.axe, pc.angle * r + explode * 0.4);
      pc.o.quaternion.premultiply(qTmp);
      pc.o.visible = t >= pc.t0;
    });
    // La caméra se rapproche, le logo pivote pour faire face.
    const c = expoOut(clamp01(t / FIN));
    camera.position.set(0, 0.35 + (1 - c) * 0.25, DIST + (1 - c) * 1.4);
    camera.lookAt(0, 0, 0);
    logo.rotation.set(tilt.y, tilt.x - (1 - c) * 0.45, 0);
    renderer.render(scene, camera);
  };

  let w = 1;
  let h = 1;
  const cadrer = () => {
    // Largeur visible à la distance de repos → le logo occupe « part » de la largeur du canvas.
    const tanH = LARGEUR_LOGO / (part * 2 * DIST);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanH / camera.aspect));
    if (shift) camera.setViewOffset(w, h, -shift * w, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const fit = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    part = shift ? 0.42 : 0.72;
    cadrer();
    render();
  };

  const timer = new THREE.Timer();
  timer.connect(document);
  const loop = () => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    if (t < FIN) t += dt;
    tilt.x = THREE.MathUtils.damp(tilt.x, target.x, 5, dt);
    tilt.y = THREE.MathUtils.damp(tilt.y, target.y, 5, dt);
    explode = THREE.MathUtils.damp(explode, burst, 8, dt);
    burst = THREE.MathUtils.damp(burst, 0, 2.6, dt);
    render();
    const calme = t >= FIN && explode < 1e-3 && burst < 1e-3
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
      if (t >= FIN) burst = Math.min(1, burst + speed * 1.1);
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
