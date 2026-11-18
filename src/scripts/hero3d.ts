import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Hero 3D : la construction du & (0–4 s du clip) se joue une fois,
 * puis la scène s'arrête sur le & assemblé. Aucun rendu en continu ensuite.
 */
const BUILD_END = 4;

export interface HeroScene {
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
  draco.setDecoderPath('/draco/');
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync('/3d/hero.glb');
  scene.add(gltf.scene);

  const camera = (gltf.cameras[0] as THREE.PerspectiveCamera) ?? new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const baseFov = camera.fov;
  const baseTan = Math.tan(THREE.MathUtils.degToRad(baseFov / 2));

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = THREE.AnimationClip.findByName(gltf.animations, 'hero') ?? gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.play();
  action.paused = true;

  let t = 0;
  const render = () => {
    action.time = Math.min(t, BUILD_END);
    mixer.update(0);
    renderer.render(scene, camera);
  };

  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Cadre étroit : on élargit le champ pour garder le & entier.
    camera.fov = camera.aspect < 1.1 ? THREE.MathUtils.radToDeg(2 * Math.atan((baseTan * 1.1) / camera.aspect)) : baseFov;
    camera.updateProjectionMatrix();
    render();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);

  const timer = new THREE.Timer();
  timer.connect(document);
  renderer.setAnimationLoop(() => {
    timer.update();
    t += Math.min(timer.getDelta(), 0.1);
    render();
    if (t >= BUILD_END) renderer.setAnimationLoop(null); // fin : plus aucun rendu en continu
  });
  canvas.dataset.ready = 'true';

  return {
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
