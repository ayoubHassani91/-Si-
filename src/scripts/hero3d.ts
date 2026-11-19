import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Hero 3D en arrière-plan : le & se construit à partir de fragments de code (0–4 s du clip), puis
 * - s'incline vers le pointeur ;
 * - éclate en blocs quand le pointeur bouge vite, puis se réassemble ;
 * - se reconstruit entièrement au clic (replay()).
 * Le rendu ne tourne que pendant un mouvement, jamais en continu au repos.
 */
const BUILD_END = 4;
const TILT = THREE.MathUtils.degToRad(22);

export interface HeroScene {
  replay: () => void;
  /** Zone du texte à épargner, en fraction du canvas (centre et rayons de l'ellipse). */
  setMask: (cx: number, cy: number, rx: number, ry: number) => void;
  point: (nx: number, ny: number) => void; // -1..1, relatif au centre du &
  dispose: () => void;
}

export async function mountHero(canvas: HTMLCanvasElement, opts: { shift?: number; masque?: boolean } = {}): Promise<HeroScene> {
  // Rendu en trois passes sur un seul canvas : fragments et circuits (calque 1), puis un voile couleur papier
  // en ellipse adoucie sur la zone du texte, puis le & (calque 0) par-dessus, jamais voilé.
  const make = (c: HTMLCanvasElement) => {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    return r;
  };
  const renderer = make(canvas);
  const masque = !!opts.masque;
  renderer.autoClear = false;
  const voileScene = new THREE.Scene();
  const voileCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const voileMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      couleur: { value: new THREE.Color('#f7f5f0') },
      centre: { value: new THREE.Vector2(0.27, 0.52) },
      rayon: { value: new THREE.Vector2(0.32, 0.44) },
      taille: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform vec3 couleur; uniform vec2 centre; uniform vec2 rayon; uniform vec2 taille;
      void main() {
        vec2 uv = vec2(gl_FragCoord.x / taille.x, 1.0 - gl_FragCoord.y / taille.y);
        float d = length((uv - centre) / rayon);
        float a = 1.0 - smoothstep(0.62, 1.0, d);
        gl_FragColor = vec4(couleur, a);
        #include <colorspace_fragment>
      }`,
  });
  voileScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), voileMat));
  
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
  if (masque) {
    scene.traverse((o) => { if ((o as THREE.Light).isLight) o.layers.enableAll(); });
    ['fx_code', 'fx_circuit', 'fx_poles'].forEach((n) => gltf.scene.getObjectByName(n)?.traverse((o) => o.layers.set(1)));
  }

  const camera = (gltf.cameras[0] as THREE.PerspectiveCamera) ?? new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  // Champ resserré : le & remplit presque toute la hauteur.
  const baseTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.68;
  const shift = opts.shift ?? 0;

  const amp = gltf.scene.getObjectByName('amp_root') ?? gltf.scene;
  const pieces = amp.children.filter((o) => o.name.startsWith('amp_piece'));
  const fx = ['fx_code', 'fx_circuit'].map((n) => gltf.scene.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
  // Direction d'éclatement et rotation propres à chaque bloc (déterministes).
  const spread = pieces.map((p, i) => {
    // Axes three.js : x horizontal, y vertical, z vers la caméra.
    const d = new THREE.Vector3(p.position.x, p.position.y, 0);
    if (d.lengthSq() < 1e-4) d.set(0, 1, 0);
    d.normalize();
    d.z = 0.6 + (i % 3) * 0.3; // vers la caméra
    return { d, r: new THREE.Vector3(((i * 37) % 7) - 3, ((i * 53) % 7) - 3, ((i * 29) % 7) - 3).multiplyScalar(0.18) };
  });

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = THREE.AnimationClip.findByName(gltf.animations, 'hero') ?? gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.play();
  action.paused = true;

  let t = 0;
  const target = new THREE.Vector2();
  const tilt = new THREE.Vector2();
  const last = new THREE.Vector2();
  let burst = 0; // éclatement cible (0..1), alimenté par la vitesse du pointeur
  let explode = 0;
  let running = false;
  let cumul = 0;

  // Décalages appliqués à l'image précédente. Le mixer ne réécrit une valeur que si elle change :
  // on les retire donc avant chaque mise à jour, sinon ils s'accumuleraient d'une image à l'autre.
  const applied = { tx: 0, ty: 0, e: 0 };
  const offset = (sign: number, tx: number, ty: number, e: number) => {
    amp.rotation.y += sign * tx;
    amp.rotation.x += sign * ty;
    if (e) pieces.forEach((p, i) => {
      p.position.addScaledVector(spread[i].d, sign * e * 0.2);
      p.rotation.x += sign * spread[i].r.x * e * 2.5;
      p.rotation.y += sign * spread[i].r.y * e * 2.5;
      p.rotation.z += sign * spread[i].r.z * e * 2.5;
    });
  };
  const render = () => {
    offset(-1, applied.tx, applied.ty, applied.e);
    action.time = Math.min(t, BUILD_END);
    mixer.update(0);
    const e = explode > 1e-3 ? explode : 0;
    offset(1, tilt.x, tilt.y, e);
    applied.tx = tilt.x; applied.ty = tilt.y; applied.e = e;
    // Parallaxe : fragments et circuit glissent à l'opposé du pointeur (positions absolues).
    fx.forEach((g, i) => { g.position.x = -tilt.x * (0.25 + i * 0.15); g.position.y = tilt.y * (0.25 + i * 0.15); });
    renderer.clear();
    if (masque) {
      // Les fragments et circuits ont disparu à 3,4 s : au-delà, seul le & est dessiné.
      if (t < 3.4) {
        camera.layers.set(1);
        renderer.render(scene, camera);
        renderer.render(voileScene, voileCam);
        renderer.clearDepth();
      }
      camera.layers.set(0);
    } else {
      camera.layers.enableAll();
    }
    renderer.render(scene, camera);
  };

  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    voileMat.uniforms.taille.value.set(renderer.domElement.width, renderer.domElement.height);
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
    if (t < BUILD_END) {
      t += dt;
      cumul += dt;
      if (cumul < 1 / 30 && t < BUILD_END) return; // le clip est à 30 i/s : inutile de dessiner plus souvent
      cumul = 0;
    }
    tilt.x = THREE.MathUtils.damp(tilt.x, target.x, 5, dt);
    tilt.y = THREE.MathUtils.damp(tilt.y, target.y, 5, dt);
    explode = THREE.MathUtils.damp(explode, burst, 9, dt);
    burst = THREE.MathUtils.damp(burst, 0, 2.6, dt);
    render();
    const calme = t >= BUILD_END && explode < 1e-3 && burst < 1e-3
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
    setMask(cx, cy, rx, ry) {
      voileMat.uniforms.centre.value.set(cx, cy);
      voileMat.uniforms.rayon.value.set(rx, ry);
      if (!running) render();
    },
    point(nx, ny) {
      const speed = Math.hypot(nx - last.x, ny - last.y);
      last.set(nx, ny);
      target.set(nx * TILT, ny * TILT * 0.7);
      if (t >= BUILD_END) burst = Math.min(1, burst + speed * 1.2);
      wake();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      timer.dispose();
      draco.dispose();
      voileMat.dispose();
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
