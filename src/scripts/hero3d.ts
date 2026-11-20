import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Hero 3D : le logo &si, construit dans Blender à partir des tracés exacts du logo SVG,
 * découpé en 29 blocs (& et « si »).
 *
 * Entrée (~2,8 s) :
 *  1. les blocs sont éparpillés dans l'espace autour du logo et tournent sur eux-mêmes ;
 *  2. la caméra fait un large mouvement tournant pendant que les blocs convergent en vague
 *     et se verrouillent avec un rebond ;
 *  3. un « clic » final fait vibrer tout le logo.
 * Ensuite : le logo reste compact ; chaque mouvement de souris dessus le fait pivoter dans le sens
 * du geste (il change d'orientation), puis il revient doucement de face.
 * Le rendu ne tourne que pendant un mouvement, jamais en continu au repos.
 */
const TILT = THREE.MathUtils.degToRad(14);
const FIN = 2.8;

export interface HeroScene {
  replay: () => void;
  /** nx, ny : position du pointeur (-1..1) ; px, py : coordonnées écran pour savoir s'il survole le logo. */
  point: (nx: number, ny: number, px?: number, py?: number) => void;
  dispose: () => void;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const backOut = (x: number, s = 1.7) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const aleatoire = (graine: number) => () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
const surSphere = (rnd: () => number) => {
  const u = rnd() * 2 - 1;
  const a = rnd() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), u);
};

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

  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 60);
  const DIST = 4.6;
  const LARGEUR_LOGO = 1.07;
  const shift = opts.shift ?? 0;

  type Bloc = {
    o: THREE.Mesh; p: THREE.Vector3; q: THREE.Quaternion;
    depart: THREE.Vector3; axeDepart: THREE.Vector3; tours: number; t0: number;
  };
  const rnd = aleatoire(11);
  const blocs: Bloc[] = [];
  gltf.scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const m = o as THREE.Mesh;
    const p = m.position.clone();
    // Ordre d'arrivée : vague de gauche à droite sur tout le logo, avec un peu de hasard.
    const vague = (p.x + 0.55) / 1.1;
    blocs.push({
      o: m, p, q: m.quaternion.clone(),
      depart: surSphere(rnd).multiplyScalar(1.6 + rnd() * 1.2),
      axeDepart: surSphere(rnd), tours: 2 + rnd() * 3,
      t0: 0.35 + vague * 0.9 + rnd() * 0.25,
    });
  });
  const qTmp = new THREE.Quaternion();
  let t = 0;
  const target = new THREE.Vector2();
  const tilt = new THREE.Vector2();
  const last = new THREE.Vector2();
  // Rotation du logo entier donnée par les gestes de la souris (x : autour de l'axe horizontal, y : vertical).
  const rot = new THREE.Vector2();
  const vit = new THREE.Vector2();
  let running = false;

  const render = () => {
    blocs.forEach((b) => {
      const k = backOut(clamp01((t - b.t0) / 1.05));
      const r = 1 - k;
      b.o.position.copy(b.p).addScaledVector(b.depart, r);
      b.o.quaternion.copy(b.q);
      // Avant l'arrivée, le bloc tourne sur lui-même ; à l'arrivée, la rotation se déroule jusqu'à zéro.
      qTmp.setFromAxisAngle(b.axeDepart, r * b.tours + (t < b.t0 ? t * 1.5 : 0));
      b.o.quaternion.premultiply(qTmp);
    });
    // Mouvement de caméra : de côté et au-dessus, jusqu'à la vue de face.
    const c = expoOut(clamp01(t / 2.4));
    const az = (1 - c) * 1.05;
    const el = 0.07 + (1 - c) * 0.35;
    const d = DIST + (1 - c) * 2.2;
    camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    camera.lookAt(0, 0, 0);
    // « Clic » final : une courte vibration quand le dernier bloc se verrouille.
    const choc = t > 2.25 && t < 2.75 ? Math.sin((t - 2.25) * 38) * Math.exp(-(t - 2.25) * 9) * 0.03 : 0;
    logo.scale.setScalar(1 + choc);
    logo.rotation.set(tilt.y + rot.x, tilt.x + rot.y, 0);
    renderer.render(scene, camera);
  };

  let w = 1;
  let h = 1;
  const fit = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const part = shift ? 0.42 : 0.72; // part de la largeur occupée par le logo au repos
    const tanH = LARGEUR_LOGO / (part * 2 * DIST);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanH / camera.aspect));
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
    if (t < FIN) t += dt;
    tilt.x = THREE.MathUtils.damp(tilt.x, target.x, 5, dt);
    tilt.y = THREE.MathUtils.damp(tilt.y, target.y, 5, dt);
    // Le logo pivote avec l'élan du geste, l'élan s'amortit, puis un ressort doux le ramène de face.
    // Angle limité pour que le logo reste toujours lisible (jamais vu par la tranche).
    rot.x = THREE.MathUtils.clamp(rot.x + vit.x * dt, -0.55, 0.55);
    rot.y = THREE.MathUtils.clamp(rot.y + vit.y * dt, -0.85, 0.85);
    vit.x = THREE.MathUtils.damp(vit.x, -rot.x * 2.5, 4, dt);
    vit.y = THREE.MathUtils.damp(vit.y, -rot.y * 2.5, 4, dt);
    render();
    const calme = t >= FIN && Math.abs(rot.x) + Math.abs(rot.y) + Math.abs(vit.x) + Math.abs(vit.y) < 1e-3
      && Math.abs(tilt.x - target.x) < 1e-3 && Math.abs(tilt.y - target.y) < 1e-3;
    if (calme) { renderer.setAnimationLoop(null); running = false; }
  };
  const wake = () => {
    if (running) return;
    running = true;
    timer.update();
    renderer.setAnimationLoop(loop);
  };

  // Le pointeur survole-t-il le logo ? Test sur les blocs eux-mêmes (29 maillages, peu coûteux).
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const meshes = blocs.map((b) => b.o);
  const surLogo = (px: number, py: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(meshes, false).length > 0;
  };

  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  wake();
  canvas.dataset.ready = 'true';

  return {
    replay() { t = 0; rot.set(0, 0); vit.set(0, 0); wake(); },
    point(nx, ny, px, py) {
      const prevX = last.x;
      const prevY = last.y;
      const speed = Math.hypot(nx - last.x, ny - last.y);
      last.set(nx, ny);
      target.set(nx * TILT, ny * TILT * 0.6);
      if (t >= FIN && px !== undefined && py !== undefined && speed > 0.002 && surLogo(px, py)) {
        // Le geste donne de l'élan au logo dans sa direction (horizontal → tourne de côté, vertical → bascule).
        const MAX = 5;
        vit.y = THREE.MathUtils.clamp(vit.y + (nx - prevX) * 18, -MAX, MAX);
        vit.x = THREE.MathUtils.clamp(vit.x + (ny - prevY) * 18, -MAX, MAX);
      }
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
