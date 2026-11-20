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
 * Ensuite : le logo reste compact et se tourne franchement vers le curseur, où qu'il soit sur l'écran ;
 * même souris immobile, il flotte et ondule doucement. Le rendu s'arrête quand le logo n'est plus visible.
 * Le rendu ne tourne que pendant un mouvement, jamais en continu au repos.
 */
const TOURNE = THREE.MathUtils.degToRad(80); // gauche / droite
const BASCULE = THREE.MathUtils.degToRad(55); // haut / bas
const FIN = 2.8;

export interface HeroScene {
  replay: () => void;
  /** nx, ny : position du curseur par rapport au logo (-1..1). */
  point: (nx: number, ny: number) => void;
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
    // Mouvement libre permanent (souris immobile ou non) : rotations lentes et légère flottaison.
    const a = vie;
    logo.rotation.set(
      tilt.y + a * (Math.sin(horloge * 0.83) * 0.16 + Math.sin(horloge * 0.37) * 0.08),
      tilt.x + a * (Math.sin(horloge * 0.61) * 0.32 + Math.sin(horloge * 0.29 + 1) * 0.14),
      a * Math.sin(horloge * 0.47) * 0.06,
    );
    logo.position.y = a * Math.sin(horloge * 1.1) * 0.025;
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

  let horloge = 0;
  let vie = 0; // amplitude du mouvement libre, monte en douceur après l'entrée
  let visible = true;
  const timer = new THREE.Timer();
  timer.connect(document);
  const loop = () => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    if (t < FIN) t += dt;
    horloge += dt;
    vie = t >= FIN ? THREE.MathUtils.damp(vie, 1, 1.2, dt) : 0;
    tilt.x = THREE.MathUtils.damp(tilt.x, target.x, 5, dt);
    tilt.y = THREE.MathUtils.damp(tilt.y, target.y, 5, dt);
    render();
    // Le logo vit en continu, mais on coupe le rendu dès qu'il sort de l'écran.
    if (!visible) { renderer.setAnimationLoop(null); running = false; }
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
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); });
  io.observe(canvas);
  wake();
  canvas.dataset.ready = 'true';

  return {
    replay() { t = 0; vie = 0; wake(); },
    point(nx, ny) {
      // Le logo se tourne vers le curseur : à droite → il regarde à droite, en bas → il regarde en bas.
      target.set(nx * TOURNE, ny * BASCULE);
      wake();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
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
