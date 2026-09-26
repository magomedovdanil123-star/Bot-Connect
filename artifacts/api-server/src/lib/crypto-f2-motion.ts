export const CRYPTO_F2_OBJECT_MOTIFS = [
  "token",
  "block",
  "chain",
  "wallet",
  "key",
  "shield",
  "network",
  "ledger",
  "bridge",
  "magnifier",
  "orb",
] as const;

export type CryptoF2ObjectMotif = typeof CRYPTO_F2_OBJECT_MOTIFS[number];

export const CRYPTO_F2_MOTION_ACTIONS = [
  "assemble",
  "unfold",
  "morph",
  "reveal",
  "transfer",
  "flow",
  "orbit",
  "split_merge",
  "pulse",
  "scan",
  "lock",
  "build",
] as const;

export type CryptoF2MotionAction = typeof CRYPTO_F2_MOTION_ACTIONS[number];

export const CRYPTO_F2_ENTRY_ANIMATIONS = [
  "card_pop",
  "sticker_pop",
  "bounce",
  "slide_left",
  "slide_right",
  "slide_top",
  "slide_bottom",
  "scale_pop",
  "elastic_pop",
  "rotate_scale",
  "flip",
  "swipe",
  "spring",
  "floating",
  "notification",
  "overshoot",
  "arc_left",
  "arc_right",
  "arc_top",
  "arc_bottom",
  "spiral_in",
  "unfold_in",
  "draw_on",
  "shards_in",
  "magnet_snap",
  "depth_pop",
  "mask_reveal",
  "orbit_in",
  "ripple_in",
  "glitch_reform",
  "flow_in",
  "split_assemble",
] as const;

export type CryptoF2EntryAnimation = typeof CRYPTO_F2_ENTRY_ANIMATIONS[number];

export const CRYPTO_F2_EXIT_ANIMATIONS = [
  "slide_left",
  "slide_right",
  "slide_top",
  "slide_bottom",
  "shrink",
  "fade",
  "hold",
  "arc_out_left",
  "arc_out_right",
  "spiral_out",
  "fold_away",
  "dissolve",
  "shatter",
  "pull_back",
  "orbit_out",
  "flow_out",
  "glitch_out",
  "vanish",
  "transfer_out",
  "scale_through",
  "scatter",
  "turn_away",
] as const;

export type CryptoF2ExitAnimation = typeof CRYPTO_F2_EXIT_ANIMATIONS[number];

export const CRYPTO_F2_TRANSITIONS = [
  "cut",
  "light_flash",
  "radial_wipe",
  "center_split_wipe",
  "horizontal_sweep",
  "vertical_wipe",
  "zoom_blur",
  "object_match_cut",
  "shape_morph",
  "particle_dissolve",
  "whip_pan",
  "orbit_wipe",
  "split_reveal",
  "ripple_wipe",
  "object_push",
  "chain_link",
  "light_sweep",
] as const;

export type CryptoF2SceneTransition = typeof CRYPTO_F2_TRANSITIONS[number];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function cryptoF2MotionFingerprintFromPlan(value: unknown): string | undefined {
  const plan = asRecord(value);
  if (!plan || plan.visualTheme !== "crypto_f2") return undefined;
  if (typeof plan.cryptoF2MotionFingerprint === "string" && plan.cryptoF2MotionFingerprint) {
    return plan.cryptoF2MotionFingerprint;
  }
  if (!Array.isArray(plan.beats)) return undefined;

  const scenes = plan.beats.map((beatValue) => {
    const beat = asRecord(beatValue);
    if (!beat) return "";
    const moments = Array.isArray(beat.visualMoments)
      ? beat.visualMoments.map((momentValue) => {
          const moment = asRecord(momentValue);
          if (!moment) return "";
          const microBeats = Array.isArray(moment.microBeats)
            ? moment.microBeats.map((microBeatValue) => {
                const microBeat = asRecord(microBeatValue);
                return microBeat
                  ? [
                      stringValue(microBeat.kind),
                      stringValue(microBeat.enterAnimation),
                      stringValue(microBeat.exitAnimation),
                      String(numberValue(microBeat.motionVariant)),
                    ].join(".")
                  : "";
              }).join(",")
            : "";
          return [
            stringValue(moment.objectMotif),
            stringValue(moment.motionAction),
            stringValue(moment.enterAnimation),
            stringValue(moment.exitAnimation),
            String(numberValue(moment.motionVariant)),
            microBeats,
          ].join(".");
        }).join(",")
      : "";
    return `${stringValue(beat.transitionIn)}:${moments}`;
  }).join("|");

  return scenes || undefined;
}

export function cryptoF2VariationIndex(seed: string, count: number): number {
  if (!Number.isInteger(count) || count < 1) return 0;
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  }
  return (hash >>> 0) % count;
}

export function chooseDistinctCryptoF2Motion<T extends string>(
  requested: T,
  candidates: readonly T[],
  used: Set<string>,
  seed: string,
): T {
  if (candidates.length === 0) return requested;
  if (!used.has(requested)) {
    used.add(requested);
    return requested;
  }

  const start = cryptoF2VariationIndex(seed, candidates.length);
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidate = candidates[(start + offset) % candidates.length]!;
    if (used.has(candidate)) continue;
    used.add(candidate);
    return candidate;
  }

  const fallback = candidates[start]!;
  used.add(fallback);
  return fallback;
}