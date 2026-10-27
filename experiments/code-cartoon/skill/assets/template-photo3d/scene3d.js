/* ============================================================================
 * PHOTO + 3D STARTER — a real photo, a picture that pops up from a bench, a dive into 3D.
 *   0 – xfade      assets/photo.jpg with a living camera, falling leaves, caption cap1
 *   xfade – twist  assets/drawing.jpg lies on a bench; POPUPS stand up one by one; push into HERO
 *   twist – home   3D space: a sun with a face (talks on "hello", winks on "wink"), a ringed planet, an Earth
 *   home – end     back to the photo; a golden star glows where the photo leaves room; title poster
 * Make it yours: run `cartoon photo . --photo you.jpg --image drawing.jpg`, measure POPUPS in the
 * drawing's pixels, retime cues.js, then change the 3D world in updateC(). Everything = f(t).
 * ==========================================================================*/
import * as THREE from "three";
import * as K from "./kit3d.js";

const PALETTE = "__PALETTE__";
/* pop-up cards: ellipses in assets/drawing.jpg pixels, a bit larger than each object (the paper halo is cut too) */
const POPUPS = [
  { id: "earth", cx: 185, cy: 760, rx: 88, ry: 88, cue: "pop1" },
  { id: "moon", cx: 560, cy: 240, rx: 56, ry: 56, cue: "pop2" },
  { id: "striped", cx: 1010, cy: 705, rx: 68, ry: 68, cue: "pop3" },
  { id: "ringed", cx: 720, cy: 565, rx: 158, ry: 82, rot: -0.2, cue: "pop4" },
  { id: "rocket", cx: 360, cy: 520, rx: 165, ry: 305, rot: -0.45, cue: "pop5" },
  { id: "sun", cx: 980, cy: 170, rx: 190, ry: 182, cue: "pop6" },
];
const HERO = "sun";                       // the card the camera dives into at the twist
const STAR_AT = { x: 0.7, y: 0.36 };      // golden star on the final photo, in frame fractions
/* Ken Burns on the photo: [scale, x, y] in fractions of the prepared photo, at the start and end of each photo part */
const PHOTO_IN = [[1.0, 0.5, 0.55], [1.1, 0.48, 0.6]], PHOTO_OUT = [[1.18, 0.5, 0.6], [1.0, 0.5, 0.55]];

const { PI, TAU, V, clamp, prog, lerp, ease, rng } = K;
const P = K.palette(PALETTE);
const root = document.querySelector("[data-composition-id]");
const W = +root.dataset.width, H = +root.dataset.height, DUR = +root.dataset.duration, ID = root.dataset.compositionId;
const { C, CE, events } = K.cueTimes();

let buildDone;
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["three-" + ID] = new Promise((r) => (buildDone = r));

const R = K.mkRenderer(document.getElementById("three-main"), W, H, { shadows: true });
const RO = K.mkRenderer(document.getElementById("three-over"), W, H, { alpha: true });
const envMain = K.envMap(R), envOver = K.envMap(RO);

/* ======================= B: the picture on a bench, popping up ======================= */
const SB = new THREE.Scene();
SB.background = new THREE.Color(0x1d1711);
SB.environment = envMain; SB.environmentIntensity = 0.25;
const camB = new THREE.PerspectiveCamera(35, W / H, 0.05, 100);
K.woodSurface(SB, P);
const sunB = new THREE.DirectionalLight(0xfff0d8, 2.6); sunB.position.set(-2.6, 5.2, 3.4); sunB.castShadow = true;
sunB.shadow.mapSize.set(2048, 2048); Object.assign(sunB.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 16 }); sunB.shadow.bias = -0.0004; sunB.shadow.normalBias = 0.01;
SB.add(sunB, new THREE.HemisphereLight(0xcfe0ff, 0x3a2c20, 0.55));
const sparksB = K.burst(SB, 10);
let pop = null, PW = 4, PH = 3;

function updateB(t) {
  pop.update(t);
  const hero = pop.centerOf(HERO);
  sparksB.update(hero.clone().add(V(0, 0, 0.05)), prog(t, C(POPUPS[POPUPS.length - 1].cue) + 0.2, C(POPUPS[POPUPS.length - 1].cue) + 1.0), 0.22, 0.7);
  const top0 = { p: V(0, PW * 0.96, 0.35), l: V(0, 0, 0.02) }, top1 = { p: V(0.12, PW * 0.86, 0.95), l: V(0.05, 0, 0) };
  const low = { p: V(0.35, 0.95, PW * 0.84), l: V(0.25, 0.45, -0.25) };
  const tA = C(POPUPS[0].cue), tB = C("push");
  let p, l;
  if (t < tA) { const u = ease.inOut(prog(t, C("xfade"), tA)); p = top0.p.clone().lerp(top1.p, u); l = top0.l.clone().lerp(top1.l, u); }
  else if (t < tB) { const u = ease.inOut(prog(t, tA, tB)); p = top1.p.clone().lerp(low.p, u); l = top1.l.clone().lerp(low.l, u); }
  else { const u = ease.in(prog(t, tB, C("twist"))); p = low.p.clone().lerp(hero.clone().add(V(0, 0.02, 0.75)), u); l = low.l.clone().lerp(hero, ease.out(prog(t, tB, tB + 0.4))); }
  camB.position.copy(p); camB.lookAt(l);
}

/* ======================= C: the 3D world ======================= */
const SC = new THREE.Scene();
SC.background = P.col("space");
SC.environment = envMain; SC.environmentIntensity = 0.45;
const camC = new THREE.PerspectiveCamera(35, W / H, 0.05, 400);
K.starfield(SC, P);
K.nebula(SC, P);
const SUN = V(0, 0, 0), SR = 2.2;
const sunMesh = K.planet(SC, SUN, SR, new THREE.MeshBasicMaterial({ toneMapped: false, map: K.tex(K.cv(1024, 512, (c, w, h) => {
  c.fillStyle = P.hex("sun"); c.fillRect(0, 0, w, h); const r = rng("sunt");
  for (let i = 0; i < 900; i++) { const x = r() * w, y = r() * h, rad = r.range(4, 26), g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, r() < 0.5 ? "rgba(255,150,40,0.35)" : "rgba(255,250,200,0.35)"); g.addColorStop(1, "rgba(255,200,80,0)"); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
})) }));
const corona = K.glowSprite(K.glowTex(P, "warm", 0.9), SR * 5.3); corona.position.copy(SUN); SC.add(corona);
const raysMat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, map: K.tex(K.cv(1024, 1024, (c) => {
  c.translate(512, 512); c.lineJoin = "round"; c.shadowColor = P.hex("orange"); c.shadowBlur = 26;
  [[340, 480, 0, 56, 14, "orange"], [350, 440, 0.06, 56, 8, "sun"]].forEach(([r0, r1, off, n, wd, role], k) => {
    c.strokeStyle = P.hex(role); c.lineWidth = wd; c.beginPath(); const rr = rng("rays", k);
    for (let i = 0; i <= n; i++) { const a = (i / n) * TAU + off, rad = i % 2 ? r1 + rr.range(-20, 25) : r0; if (i) c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); else c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    c.stroke();
  });
})) });
const rays = new THREE.Sprite(raysMat); rays.position.copy(SUN); rays.scale.setScalar(SR * 3.25); SC.add(rays);
const face = K.faceSprite(SC, SUN, SR);
const sunLight = new THREE.PointLight(0xffe2b0, 3.2, 0, 0); sunLight.position.copy(SUN); SC.add(sunLight);
SC.add(new THREE.AmbientLight(0x31406a, 0.55));
const keyC = new THREE.DirectionalLight(0xfff4e6, 1.1); SC.add(keyC, keyC.target);
const RING_POS = V(6.2, -2.0, -7), ringed = K.planet(SC, RING_POS, 1.1, new THREE.MeshStandardMaterial({ map: K.bandedTexture(P, "rp", ["violet", "nebula2", "violet", "a2"]), roughness: 0.8 }));
K.ring(SC, P, RING_POS, 1.5, 2.6, ["a2", "gold", "violet"]);
const world = K.earth(SC, V(-5.5, -2.8, -5), 1.3, { size: [1024, 512], continents: [[[-0.7, -0.4], [-0.3, -0.6], [-0.1, -0.3], [-0.4, 0.1], [-0.3, 0.5], [-0.65, 0.3]], [[0.15, -0.55], [0.6, -0.4], [0.7, 0.05], [0.35, 0.2], [0.2, -0.1]]] });
const camKeysC = () => K.camKeys([
  [C("twist"), V(0.2, 0.15, SR * 2.6), SUN.clone()],
  [C("twist") + 1.4, V(3.0, 1.2, 9.5), V(0.6, -0.4, -1.5), "out"],
  [C("home") - 0.8, V(-1.5, 0.8, 10.5), V(0, -0.5, -1.5)],
  [C("home"), V(0, 0.1, SR * 2.4), SUN.clone(), "in"],
]);
let camC_ = null;
function updateC(t) {
  const { pos, tgt } = camC_(t);
  camC.position.copy(pos); camC.lookAt(tgt);
  keyC.position.copy(pos).add(V(2, 3, 2)); keyC.target.position.copy(tgt);
  const talk = t >= C("hello") && t < CE("hello") ? 0.5 + 0.5 * Math.sin((t - C("hello")) * 15) : 0;
  const w0 = C("wink"), wink = ease.smooth(prog(t, w0, w0 + 0.12)) * (1 - ease.smooth(prog(t, w0 + 0.35, w0 + 0.5)));
  face.update(camC.position, { look: { x: 0.3 * Math.sin(t * 0.7), y: 0.15 * Math.sin(t * 0.5) }, talk, wink });
  raysMat.rotation = t * 0.07; sunMesh.rotation.y = t * 0.05; ringed.rotation.y = t * 0.08;
  world.earth.rotation.y = t * 0.03; world.clouds.rotation.y = t * 0.04;
}

/* ======================= O: overlay over the photo ======================= */
const SO = new THREE.Scene(); SO.environment = envOver;
const camO = new THREE.PerspectiveCamera(40, W / H, 0.1, 60); camO.lookAt(0, 0, -1);
const leaves = K.leavesOverlay(SO, P, W, H, { count: 30 });
const star = K.goldStar(SO, P);
const starLight = new THREE.PointLight(0xffd27a, 3, 6, 2); SO.add(starLight, new THREE.AmbientLight(0xffffff, 0.6));
const keyO = new THREE.DirectionalLight(0xfff0dd, 1.6); keyO.position.set(2, 3, 4); SO.add(keyO);
const STAR_POS = K.screenToWorld(STAR_AT.x * W, STAR_AT.y * H, 4, W, H);
function updateO(t) {
  leaves.update(t, t < CE("xfade") || t >= C("home"), t >= C("home") ? { x0: STAR_AT.x * 2 - 1.25, x1: STAR_AT.x * 2 - 0.75 } : null);
  const sp = prog(t, C("star"), C("star") + 0.8), on = t >= C("star") - 0.05;
  star.visible = on;
  if (on) {
    const sc = Math.max(0.001, ease.outBack(sp));
    star.position.copy(STAR_POS).add(V(0, Math.sin(t * 1.4) * 0.03, 0)); star.scale.setScalar(sc); star.rotation.set(0.15, Math.sin(t * 0.7) * 0.6, 0);
    starLight.position.copy(star.position).add(V(0, 0, 0.8));
  }
}

/* ======================= DOM: photo, light, captions ======================= */
const $ = (id) => document.getElementById(id);
const photo = $("photo"), mainCv = $("three-main"), leak = $("leak"), shade = $("shade"), grain = $("grain"), flash = $("flash"), titleEl = $("title");
const caps = K.captions($("cap"), events);
let photoL = null;
const kb = (t, a, b, A, B, e = ease.inOut) => { // Ken Burns, the centre clamped so no empty edge ever shows
  const u = e(prog(t, a, b)), s = lerp(A[0], B[0], u), iw = photo.naturalWidth, ih = photo.naturalHeight;
  const cx = clamp(lerp(A[1], B[1], u) * iw, W / (2 * s), iw - W / (2 * s)), cy = clamp(lerp(A[2], B[2], u) * ih, H / (2 * s), ih - H / (2 * s));
  photoL.set(s, cx, cy);
};
function updateDOM(t) {
  const home = C("home");
  if (t < home) kb(t, 0, CE("xfade"), PHOTO_IN[0], PHOTO_IN[1]); else kb(t, home, home + 2.4, PHOTO_OUT[0], PHOTO_OUT[1], ease.out);
  const mainOp = t < C("xfade") ? 0 : t < home ? ease.inOut(prog(t, C("xfade"), CE("xfade"))) : 1 - prog(t, home + 0.05, home + 0.5);
  mainCv.style.opacity = mainOp.toFixed(3);
  leak.style.opacity = (lerp(1, 0.25, mainOp) * (t >= C("twist") && t < home ? 0 : 1)).toFixed(3);
  shade.style.opacity = Math.max(...events.filter((e) => e.type === "caption" || e.type === "voice").map((e) => prog(t, e.t - 0.3, e.t + 0.3) * (1 - prog(t, e.t + (e.dur || 2) + 0.4, e.t + (e.dur || 2) + 0.9))), prog(t, C("title") - 0.3, C("title") + 0.5) * 0.9, 0).toFixed(3);
  const g = rng("grain", Math.floor(t * 24)); grain.style.backgroundPosition = `${Math.floor(g() * 256)}px ${Math.floor(g() * 256)}px`;
  grain.style.opacity = (t >= C("twist") && t < home ? 0.08 : 0.16).toFixed(3);
  const fl = Math.max(prog(t, C("twist") - 0.18, C("twist")) * (1 - prog(t, C("twist"), C("twist") + 0.55)), prog(t, home - 0.16, home) * (1 - prog(t, home, home + 0.6)));
  flash.style.opacity = (0.95 * fl).toFixed(3);
  caps.update(t);
  K.fade(titleEl, t, C("title"), CE("title"));
}

function renderAt(t) {
  updateDOM(t);
  if (t >= C("xfade") - 0.05 && t < C("twist")) { updateB(t); R.render(SB, camB); }
  else if (t >= C("twist") && t < C("home") + 0.6) { updateC(t); R.render(SC, camC); }
  else R.clear();
  if (t < CE("xfade") + 0.1 || t >= C("home")) { updateO(t); RO.render(SO, camO); } else RO.clear();
}

/* ======================= boot ======================= */
const loadTex = async (src) => { const t = await new THREE.TextureLoader().loadAsync(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const drawingTex = await loadTex("assets/drawing.jpg");
await new Promise((res) => { if (photo.complete && photo.naturalWidth) res(); else { photo.onload = res; photo.onerror = res; } });
photo.style.width = photo.naturalWidth + "px"; photo.style.height = photo.naturalHeight + "px";
photoL = K.photoLayer(photo, W, H);
const img = drawingTex.image;
PW = 4; PH = (PW * img.height) / img.width;
const sheet = K.paperSheet(SB, drawingTex, PW, PH);
pop = K.popupCutouts(SB, drawingTex, img, sheet, PW, POPUPS.map((p) => Object.assign({ at: C(p.cue) }, p)));
{ // the photo, blurred, far behind the bench: depth of field for free
  const bcv = K.cv(640, Math.round((640 * photo.naturalHeight) / photo.naturalWidth), (c, w, h) => { c.filter = "blur(9px)"; c.drawImage(photo, -20, -20, w + 40, h + 40); });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12, (12 * bcv.height) / bcv.width), new THREE.MeshBasicMaterial({ map: K.tex(bcv), color: 0xd8d2c8 }));
  back.position.set(0.6, 0.9, -9.5); SB.add(back);
}
camC_ = camKeysC();
const fsz = Math.round(Math.min(W, H) * 0.075);
$("cap").style.fontSize = fsz + "px"; titleEl.style.fontSize = Math.round(fsz * 1.25) + "px";
await document.fonts.ready;
const tl = gsap.timeline({ paused: true });
const proxy = { t: 0 };
tl.to(proxy, { t: DUR, duration: DUR, ease: "none", onUpdate: () => renderAt(tl.time()) }, 0);
window.__timelines[ID] = tl;
renderAt(0);
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
const q = new URLSearchParams(location.search).get("t"); if (q !== null) renderAt(parseFloat(q));
if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
buildDone();
