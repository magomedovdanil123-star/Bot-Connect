/* ============================================================================
 * 3D STARTER — "glass & chrome" tech-motion (Three.js), deterministic.
 * Same rules as the 2D engine: everything = f(t), seeded randomness, timing from
 * cues.js, colours from palette roles. Text stays in HTML (crisp, GSAP-animated).
 * Three.js through code = particles, geometry, logos, materials — not Pixar.
 * ==========================================================================*/
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";

const PALETTE = "__PALETTE__";
const pal = window.SKETCH_PALETTES[PALETTE];
const root = document.querySelector("[data-composition-id]");
const W = +root.dataset.width, H = +root.dataset.height, DUR = +root.dataset.duration, ID = root.dataset.compositionId;
const cue = (id) => window.CUES.events.find((e) => e.id === id).t;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// tell HyperFrames to wait for our own setup (fonts, PMREM) before capturing
let buildDone;
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["three-" + ID] = new Promise((r) => (buildDone = r));

// ---- renderer: fixed size and pixel ratio (no DPR-dependent output) --------
const canvas = document.getElementById("three-layer");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(pal.paper);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
// framing works for any aspect: hero (~2.5 units wide) takes ~55% of the frame width
// and sits in the upper part, leaving room for the HTML title below (top: 64%).
const FOV = THREE.MathUtils.degToRad(32), ASPECT = W / H;
const visH = Math.max(4.6 / ASPECT, 4.4);              // visible height at the hero's distance
const BASE_DIST = visH / 2 / Math.tan(FOV / 2);
const HERO_Y = 0.45, LOOK_Y = HERO_Y - 0.15 * visH;

// ---- hero: chrome knot inside a glass shell --------------------------------
const chrome = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.16, 260, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.12 }));
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transmission: 1, thickness: 0.6, ior: 1.45, transparent: true, opacity: 1 });
const glass = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 8), glassMat);
const hero = new THREE.Group(); hero.add(chrome, glass); scene.add(hero);
const fill = new THREE.HemisphereLight(new THREE.Color(pal.a2), new THREE.Color(pal.paper), 0.6); scene.add(fill);
const key = new THREE.PointLight(new THREE.Color(pal.warm), 0, 12); key.position.set(2.2, 1.5, 3); scene.add(key);

// ---- particles: seeded start positions; position is a pure function of t ---
const N = 1400, rnd = mulberry32(42), start = new Float32Array(N * 3), ring = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  const r = 2.2 + rnd() * 3.5, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
  start.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th) * 1.6, r * Math.cos(ph)], i * 3);
  const a = (i / N) * Math.PI * 2, rr = 1.75 + (rnd() - 0.5) * 0.18;
  ring.set([Math.cos(a) * rr, Math.sin(a) * rr * 0.32 + (rnd() - 0.5) * 0.08, Math.sin(a) * rr * 0.95], i * 3);
}
const pGeo = new THREE.BufferGeometry(); const pos = new Float32Array(N * 3); pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
const pMat = new THREE.PointsMaterial({ size: 0.045, color: new THREE.Color(pal.a1), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
scene.add(new THREE.Points(pGeo, pMat));

const cold = new THREE.Color(pal.a1), warm = new THREE.Color(pal.warm);
function renderAt(t) {
  const tw = cue("twist"), k = easeInOut(prog(t, tw - 0.2, tw + 1.0));
  // camera: slow orbit, punch-in after the twist
  const orbit = 0.35 + t * 0.12, dist = BASE_DIST * (1 - 0.12 * easeOut(prog(t, tw, tw + 1.2)));
  camera.position.set(Math.sin(orbit) * dist, LOOK_Y + 0.4 + Math.sin(t * 0.4) * 0.15, Math.cos(orbit) * dist);
  camera.lookAt(0, LOOK_Y, 0);
  hero.position.y = HERO_Y;
  hero.rotation.set(t * 0.35, t * 0.5, 0);
  chrome.scale.setScalar(0.85 + 0.15 * easeOut(prog(t, tw, tw + 0.5)));
  key.intensity = 25 * k;
  // particles: drift (cold) -> snap into a ring (twist) -> ring spins (warm)
  for (let i = 0; i < N; i++) {
    const j = i * 3, drift = Math.sin(t * 0.7 + i) * 0.05, spin = t * 0.6 * k;
    const rx = ring[j] * Math.cos(spin) - ring[j + 2] * Math.sin(spin), rz = ring[j] * Math.sin(spin) + ring[j + 2] * Math.cos(spin);
    pos[j] = start[j] + (rx - start[j]) * k + drift;
    pos[j + 1] = start[j + 1] + (ring[j + 1] + 0.45 - start[j + 1]) * k;
    pos[j + 2] = start[j + 2] + (rz - start[j + 2]) * k;
  }
  pGeo.attributes.position.needsUpdate = true;
  pMat.color.copy(cold).lerp(warm, k);
  renderer.render(scene, camera);
}

// ---- timeline: DOM text with GSAP + three.js rendered from the same clock ---
await document.fonts.ready;
const tl = gsap.timeline({ paused: true });
const proxy = { t: 0 };
tl.to(proxy, { t: DUR, duration: DUR, ease: "none", onUpdate: () => renderAt(tl.time()) }, 0);
tl.fromTo("#title", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, cue("title"));
tl.fromTo("#sub", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, cue("title") + 0.35);
window.__timelines[ID] = tl;
renderAt(0);
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
buildDone();
