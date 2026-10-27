# Pencil 3D (`engine/pencil3d.js`)

Real 3D inside the 2D engine: meshes seen through a camera and drawn in coloured pencil (filled faces,
hatching in the shade, boiling outlines along silhouettes and creases), plus soft cumulus clouds. No
WebGL: everything goes onto the Sketch canvas, so it lives in `Sketch.sequence` next to 2D worlds,
boils on twos, takes palette roles and survives a palette switch. Use it when a pencil story needs
objects that turn in space: planes, cars, ships, a house the camera flies around, a cloud tower.
Not for characters with faces (use 2D) or glass/chrome (template `3d`).

Tested on a 2.5-minute WWII dogfight clip (two planes, a cloud tower, 5 worlds, 16:9). Render time:
about 4–6x the length on a Windows laptop (157 s in 11–16 min); a 2D clip is ~4x.

## API
```js
// build AFTER Sketch.mount (colours come from the palette set there): lazily, on first use
let plane = null;
const planeMesh = () => plane || (plane = P3.mesh()
  .loft([{ x: 3, ry: 0.2, rz: 0.2 }, { x: 1, ry: 0.6, rz: 0.55 }, { x: -4, ry: 0.15, rz: 0.12, y: 0.3 }], 12, "a1", "body")
  .wing([{ z: -5, x: 1.1, c: 1.0, t: 0.08 }, { z: 0, x: 1.6, c: 1.8, t: 0.22 }, { z: 5, x: 1.1, c: 1.0, t: 0.08 }], 12, "a1", "wing")
  .slab([[-3.2, -1.6], [-2.4, -1.6], [-2.4, 1.6], [-3.2, 1.6]], 0.3, 0.06, "a1", "tail")
  .fin([[-3.4, 0.3], [-2.6, 0.3], [-3.2, 1.5]], 0.06, "a1", "fin")
  .decal("fin", starPolygon, "red")                 // insignia: a flat polygon of model points on that part
  .decal("body", holes, "black", true)              // damage-only: shown when the object has damage > 0
  .rod([1, 0.5, -1.5], [1, 1.8, -1.5])              // struts, wires, antennas: pencil lines
  .done());

const cam = P3.camera(eye, target, 40, { up, roll });          // fov in degrees (vertical)
const fl = P3.flight(path, t);                                   // path(t) -> [x, y, z]  =>  { pos, vel, att }
P3.draw(d, cam, [
  P3.object(planeMesh(), fl.pos, fl.att, 1, { seed: "A", tint: 1, damage: 0, line: 0.09 }),
  ...P3.cumulus([300, -170, 260], 320, 520, "tower", { lod: 1 }),   // base, width, height (m), seed
  P3.puff(pos, 6, { lit: "line", shade: "soft", alpha: 0.6, seed: "smoke7" }),
], { sun: [0.4, 0.75, 0.5], ambient: 0.5, light: 1, shadow: "#1b1f2a", keep: [fl.pos] });   // keep: never hidden by a cloud
P3.line(d.ink, d, cam, trailPoints, { width: 2, color: "soft", alpha: 0.5, seed: "trail" });   // trails, tracers
P3.lag((tt) => aimOffset(tt), t, 0.4, shotStart);   // a camera aim that lags (mean over the last 0.4 s)
P3.span(path, t, 0.3);                               // [lo, hi]: where the path is continuous around t
c.createLinearGradient(...P3.horizon(cam, H * 1.1, H * 0.5));   // the sky: tilts with the camera's roll
```
- Model space: x = forward (nose), y = up, z = right; metres. World: y up.
- `loft` stations `{x, ry, rz, y}` make a body; `wing` sections `{z, x (leading edge), c (chord), t, y}`
  make an airfoil wing with a round leading edge that tapers to its tip; `slab` is a flat plate (cheap
  tailplanes), `fin` a vertical plate. Every call takes a colour role and a part name.
- Parts are drawn one by one, the farthest first, each filled and then outlined: a nearer part covers
  the lines of a farther one. Split big parts (each wing half its own part) so the order stays right.
- Decals are painted after all faces of their part (a curved skin would cover them).
- Ink and hatching take the darkest role: `black` if the palette has one, else the paper on dark
  palettes and `line` on light ones. Override with `world.ink` / `world.hatch` or `opts.lineColor`.
- Faces under ~140 px² get no pencil strokes (they would only be noise).
- `P3.cumulus` piles flattened, bumpy puffs into a dome; the low ones sit in the cloud's own shade, the
  sunlit tops get a short pencil rim. `lod: 0.5` for far clouds (fewer, bigger puffs). Puffs fade when
  the camera comes close, so it can fly through a cloud.
- `P3.attitude(fwd, up, roll)` and `P3.rot`, `P3.add`, ... are small vector helpers.

## Look
- Coloured pencil on a dark sky palette works best (`sky`, `storm`, `dusk`; they have `red`, `black`,
  `white` for insignia). Keep the 2D pencil intro: the 3D world comes in through an iris or a flash.
- The sun goes on the ink layer BEHIND everything (drawn first); a sun on the glow layer bleaches the
  silhouettes in front of it.
- A cloud tower is the set: the action goes around it, through it and over its top. A cumulus is
  wider than tall at the base and has a flat bottom; never single round balls.
- Vary the camera through the clip (side, behind the chaser, from below into the sun, over the tail)
  and cut it on bar lines. Every cut is a whole-frame change: add the cut times as cue events, or
  `cartoon frames --jumps` reports them.

## Motion: paths and flight
- A hand-made path (a function of `t`) is fine for calm flight: `P3.flight(path, t)` banks from the
  sideways acceleration only (smooth, at most ~77°), so the plane never flips over by itself. Add a
  roll on purpose with `{ roll }` (a barrel roll, a wing waggle).
- Two agents that react to each other (a dogfight, a chase): **simulate once at load**, record the
  samples, interpolate them. It is deterministic (no randomness outside `Sketch.rng`, fixed `dt`), and
  physics gives what hand-made curves never do: overshoots, energy loss in turns, a dive to escape.
```js
const SIM = (() => {
  const dt = 1 / 120, out = { A: [], B: [] }, g = 9.81;
  const spec = { A: { cruise: 70, vmin: 45, vmax: 110, gmax: 9, roll: 3 }, B: { cruise: 86, vmin: 55, vmax: 125, gmax: 8, roll: 2.5 } };
  let st = { A: { p: [-90, 40, 0], f: [1, 0, 0], v: 70, bank: 0 }, B: { p: [90, 44, 8], f: [-1, 0, 0], v: 86, bank: 0 } };
  for (let t = T0; t <= T1; t += dt) {
    const next = {};
    for (const id of ["A", "B"]) {
      // 1. where it wants to go: the attacker of this phrase flies lead pursuit far away (nose ahead of the
      //    target) and lag pursuit near (aim 40 m behind its tail, so it does not overshoot); the defender turns
      //    into the attacker, climbs or dives on the beat (Sketch.rng keyed by the beat); both pulled back
      //    toward the arena centre; never collide; never straight up or down
      // 2. turn toward it no faster than the g-limit allows at this speed: max angle = gmax * g / v * dt
      // 3. bank toward the lift (turn acceleration + g) with a limited roll rate; speed: engine, -g * climb
      // 4. record [x, y, z, fx, fy, fz, ux, uy, uz, speed]
    }
    for (const id of ["A", "B"]) out[id].push(next[id].row);
    st = next;
  }
  return out;
})();
const path = { A: P3.track(T0, 1 / 120, SIM.A), B: P3.track(T0, 1 / 120, SIM.B) };
const fl = path.A.flight(d.t);          // { pos, vel, att } with the simulated bank
```
- The story still decides: who attacks in which phrase is a table by phrase (`LEAD = ["B", "A", ...]`);
  a victim of a planned hit flies straight for a bar before it (it does not see the attacker).
- At ~2.5 min and 2 planes the simulation takes well under a second at load.

## Guns, hits, damage
- Bullets leave along the **nose** (`att.f`) at muzzle speed and fly straight; never turn the nose
  toward the target to "aim" (it snaps and the viewer sees it). Fire only when the stream would pass
  the target: for a burst at time `tb`, find the miss distance between the target at `tb + range/speed`
  and the stream point; fire on the half-beat grid when the miss is under ~18 m at 35–300 m.
- A planned hit: search the half-beats near the planned time for the best real alignment and move
  the hit there (the impact time = burst time + range / muzzle speed). Then the hit is both on the
  beat and believable.
- Damage: holes as damage-only decals (`opts.damage > 0`), a smoke trail from the moment of the hit,
  a short camera shake, a few pencil-drawn pieces flying off. Wounded, not destroyed, unless the story says so.

## Trails and cuts
- A trail is the path sampled backward from `t`, but **never before the start of the current shot**
  (`since`): when the scene jumps (a new pass, a new world), the trail starts again; else it draws a
  line across the jump.
- Smoke: `P3.puff` per sample, perspective width per segment, butt caps (round caps turn into dots).
- A head-on pass: converge on one line, both fire, break at the last moment with fixed roles (one
  always climbs, the other always dives: switching roles from pass to pass reads as random).

## Cuts without jerks
Rule 9 of SKILL.md, the 3D way. On the test clip every cut between head-on passes jerked: the plane
came in sideways and snapped level, the camera swung, the smoke was a stick for one drawing.
- **One path per shot.** Build a path per pass/shot, defined for any `t` (before and after its shot it
  simply flies on), and choose it once per drawing:
  `const P = paths[passOf(d.t)]` — never `path(t) { const i = passOf(t); ... }`. The second version
  jumps at the cut, and the bank, speed, cameras and trails all sample a short window around `t`.
- `P3.flight` stops its window where a path jumps (`P3.span`), so a stray jump no longer turns a plane
  sideways. Trails need `since` (the shot start), a lagging camera needs `from`.
- **The subject is planned.** "Over the chaser's tail" means the chaser of the phrase from the plan.
  Asking "who is behind now" flips at random moments, and the camera jumps to the other plane.
- **Aim with a little lag**: aim at `P3.lag(offset, t, 0.4, shotStart)` of the aim point *relative to the
  subject* (lagging the absolute point leaves it behind a fast plane). A target crossing close in front
  no longer swings the frame in one drawing.
- **Keep the subject in the frame**: pulling the aim toward a far target by a fixed fraction swings it
  40–50° off; rotate the aim back to within ~15° of the subject.
- **A chase camera rides its own plane, it is not bolted to the chased one.** It follows the plane's
  heading and bank averaged over ~0.5 s (`P3.lag` of `att.f` / `att.u`), and tilts the horizon by half the
  bank at most. Bolted on, every roll and pull of a 9 g fight whips the whole sky round in one drawing
  while the plane stays still. Lagged, the plane visibly banks in the frame, which reads better.
- **When the target comes close, move the camera along a stable axis** (rise along its up). Pushed "away
  from the target", the push flips direction as the target passes, and the camera jumps.
- **The sky turns with the camera**: a vertical gradient with a horizon from the pitch alone jumps when
  the camera rolls; use `P3.horizon(cam, ...)`.
- **A cloud never hides the subject**: `world.keep: [A.pos, B.pos]` fades the puffs between the camera
  and them.
- **End a shot on the action**: after a head-on crossing pan with one plane (the next shot starts over
  its tail); a fixed side camera that holds while both fly out ends on empty sky.
- **Roll in the plane's own frame**: a break "to the side LN" is a right bank for a plane flying +LX and a
  left bank for one flying back. Roll = lateral offset · direction of flight, never a world side.
- Mark the cuts as events and check them: `cartoon frames out.mp4 --jumps --cues cues.js`, then
  `--around <cut times>`.

## Cameras that work
- **Chase**: behind the planned chaser, aiming (with a lag) between a point ahead of it and the target,
  the chaser kept within ~15° of the centre. A framing camera for both: distance from their separation
  (`clamp(sep * 1.05 + 25, 34, 280)`).
- **Side follow**: a fixed side point that pans with the action (the sun behind them).
- **Over the tail**: just behind and above one plane, looking forward (`up: att.u`), the other comes at us.
- **From below into the sun**: silhouettes against the sun, for the climax.
- Check the middle and both ends of every shot (`--around`): a camera can lose the planes when they split.

## Workflow for a long 3D clip
1. Keyframes: `cartoon snapshot --at ...` of each world and a few key moments; show them.
2. Part drafts: `cartoon cut <part> --from X --to Y --size 1920x1080`, render one part at a time,
   show it, fix, next part.
3. The full render only after the parts are approved. Keep every version beside the last one
   (`clip-v3.mp4` + `versions/v3/` with the sources), so the user can compare.
4. `cartoon check-hf` after any big change: a snapshot that shows one frozen frame means the scene
   threw an exception (it reports `page_error`).
