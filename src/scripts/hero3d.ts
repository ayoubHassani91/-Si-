import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Hero 3D interactif : le & se construit (0–4 s du clip), puis
 * - s'incline doucement vers le pointeur ;
 * - se reconstruit quand on clique ou touche (replay()).
 * Le rendu ne tourne que pendant une animation, jamais en continu au repos.
 */
const BUILD_END = 4;
const TILT = THREE.MathUtils.degToRad(16);

export interface HeroScene {
  replay: () => void;
  point: (nx: number, ny: number) => void; // -1..1
  dispose: () => void;
}

export async function mountHero(canvas: HTMLCanvasElement): Promise<HeroScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
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
  const gltf = await loader.loadAsync(`${base}3d/hero.glb`);
  scene.add(gltf.scene);

  const camera = (gltf.cameras[0] as THREE.PerspectiveCamera) ?? new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const baseFov = camera.fov;
  const baseTan = Math.tan(THREE.MathUtils.degToRad(baseFov / 2));
  // Le & (amp_root) pivote sur lui-même ; les fragments et circuits restent en place.
  const amp = gltf.scene.getObjectByName('amp_root') ?? gltf.scene;
  const ampBase = amp.rotation.clone();

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = THREE.AnimationClip.findByName(gltf.animations, 'hero') ?? gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.play();
  action.paused = true;

  let t = 0;
  const target = new THREE.Vector2();
  const tilt = new THREE.Vector2();
  let running = false;

  const render = () => {
    action.time = Math.min(t, BUILD_END);
    mixer.update(0);
    // L'inclinaison s'ajoute après l'animation (le clip réécrit la rotation à chaque image).
    amp.rotation.set(ampBase.x + tilt.y, ampBase.y + tilt.x, ampBase.z);
    renderer.render(scene, camera);
  };

  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Cadre étroit : on élargit le champ pour garder le & entier.
    camera.fov = camera.aspect < 1.2 ? THREE.MathUtils.radToDeg(2 * Math.atan((baseTan * 1.2) / camera.aspect)) : baseFov;
    camera.updateProjectionMatrix();
    render();
  };

  const timer = new THREE.Timer();
  timer.connect(document);
  const loop = () => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    if (t < BUILD_END) t += dt;
    tilt.x = THREE.MathUtils.damp(tilt.x, target.x, 6, dt);
    tilt.y = THREE.MathUtils.damp(tilt.y, target.y, 6, dt);
    render();
    const settled = t >= BUILD_END && Math.abs(tilt.x - target.x) < 1e-3 && Math.abs(tilt.y - target.y) < 1e-3;
    if (settled) { renderer.setAnimationLoop(null); running = false; }
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
    replay() { t = 0; wake(); },
    point(nx, ny) { target.set(nx * TILT, -ny * TILT * 0.6); wake(); },
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
