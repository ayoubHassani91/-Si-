import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Hero 3D : une seule action dont on pilote le temps (cf. 3d/README.md).
 * build 0–4 s (une fois), idle 4–8 s (boucle), poles 8–11 s (piloté par le scroll).
 */
const BUILD_END = 4;
const IDLE_LEN = 4;
const POLES_START = 8;
const POLES_LEN = 3;

export interface HeroScene {
  setScroll: (p: number) => void;
  onTiles: (cb: (pts: { x: number; y: number }[]) => void) => void;
  dispose: () => void;
}

export async function mountHero(canvas: HTMLCanvasElement): Promise<HeroScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf7f5f0, 2.8));
  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(-3, 4, 4);
  scene.add(key);

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync('/3d/hero.glb');
  scene.add(gltf.scene);

  const camera = (gltf.cameras[0] as THREE.PerspectiveCamera) ?? new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const baseFov = camera.fov;
  // Largeur de champ de référence : celle du cadre 16:9 du rendu Blender.
  const hTan = Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * (16 / 9);
  // Décalage horizontal du & (fraction de la largeur), ramené à 0 pendant la séquence des pôles.
  let shift = 0;
  let w = 1;
  let h = 1;

  const fit = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // On garde toute la largeur de la scène (les trois tuiles des pôles) quel que soit le format.
    camera.fov = Math.max(baseFov, THREE.MathUtils.radToDeg(2 * Math.atan(hTan / camera.aspect)));
    shift = Number(canvas.dataset.shift ?? 0);
    camera.updateProjectionMatrix();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = THREE.AnimationClip.findByName(gltf.animations, 'hero') ?? gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.play();
  action.paused = true;

  let mode: 'build' | 'idle' | 'poles' = 'build';
  let t = 0;
  let idleClock = 0;
  let scrollP = 0;
  let visible = true;

  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  // Repères des tuiles (bloc central de chaque flux) pour placer les étiquettes HTML.
  const tiles = ['pole_logiciels', 'pole_communication', 'pole_conseil'].map(
    (n) => gltf.scene.getObjectByName(n)?.children[4] ?? null,
  );
  const v = new THREE.Vector3();
  let onTiles: ((pts: { x: number; y: number }[]) => void) | null = null;

  const applyShift = () => {
    const s = shift * (mode === 'poles' ? Math.max(0, 1 - scrollP * 1.6) : 1);
    if (s) camera.setViewOffset(w, h, -s * w, 0, w, h);
    else camera.clearViewOffset();
  };

  const timer = new THREE.Timer();
  timer.connect(document);
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    if (!visible) return;
    if (mode === 'build') {
      t += dt;
      if (t >= BUILD_END) { mode = 'idle'; idleClock = 0; }
    }
    if (mode === 'idle') { idleClock += dt; t = BUILD_END + (idleClock % IDLE_LEN); }
    if (mode === 'poles') t = POLES_START + scrollP * POLES_LEN;
    action.time = Math.min(t, clip.duration - 0.001);
    mixer.update(0);
    applyShift();
    renderer.render(scene, camera);
    if (onTiles && mode === 'poles') {
      onTiles(
        tiles.map((o) => {
          if (!o) return { x: 0, y: 0 };
          o.getWorldPosition(v).project(camera);
          return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
        }),
      );
    }
  });
  canvas.dataset.ready = 'true';

  return {
    onTiles(cb: (pts: { x: number; y: number }[]) => void) {
      onTiles = cb;
    },
    setScroll(p: number) {
      scrollP = p;
      if (p > 0.001 && mode !== 'build') mode = 'poles';
      else if (p <= 0.001 && mode === 'poles') { mode = 'idle'; idleClock = 0; }
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
